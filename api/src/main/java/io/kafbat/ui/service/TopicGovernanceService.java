package io.kafbat.ui.service;

import io.kafbat.ui.config.ClustersProperties;
import io.kafbat.ui.model.CleanupPolicy;
import io.kafbat.ui.model.InternalLogDirStats;
import io.kafbat.ui.model.InternalTopic;
import io.kafbat.ui.model.KafkaCluster;
import io.kafbat.ui.model.Statistics;
import io.kafbat.ui.model.TopicGovernanceRecommendationDTO;
import io.kafbat.ui.model.TopicGovernanceReportDTO;
import io.kafbat.ui.model.TopicGovernanceSettingsDTO;
import io.kafbat.ui.model.TopicGovernanceSummaryDTO;
import io.kafbat.ui.model.TopicGovernanceTopicDTO;
import io.kafbat.ui.service.metrics.scrape.ScrapedClusterState;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.common.config.TopicConfig;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TopicGovernanceService {

  private static final int RECOMMENDED_REPLICATION_FACTOR = 3;
  private static final int HIGH_PARTITIONS_PER_BROKER = 100;
  private static final long LARGE_MESSAGE_RANGE_THRESHOLD = 10_000_000L;
  private static final long LARGE_STORAGE_THRESHOLD_BYTES = 100L * 1024L * 1024L * 1024L;
  private static final long LARGE_MAX_MESSAGE_BYTES = 10L * 1024L * 1024L;

  private final StatisticsCache statisticsCache;
  private final ClustersProperties clustersProperties;

  public Statistics getStatistics(KafkaCluster cluster) {
    return statisticsCache.get(cluster);
  }

  public List<InternalTopic> getTopics(Statistics statistics, boolean includeInternal) {
    return statistics.getClusterState().getTopicStates().values().stream()
        .map(topicState -> InternalTopic.from(topicState, internalTopicPrefix()))
        .map(topic -> topic.withMetrics(statistics.getMetrics()))
        .filter(topic -> includeInternal || !topic.isInternal())
        .toList();
  }

  public TopicGovernanceReportDTO report(Statistics statistics,
                                          List<InternalTopic> visibleTopics,
                                          boolean includeInternal) {
    int brokerCount = statistics.getClusterDescription().getNodes().size();
    List<TopicGovernanceTopicDTO> topics = visibleTopics.stream()
        .map(topic -> topicReport(statistics, topic, brokerCount))
        .sorted(Comparator
            .comparingInt((TopicGovernanceTopicDTO topic) -> severityRank(topic.getSeverity()))
            .thenComparing(TopicGovernanceTopicDTO::getScore)
            .thenComparing(TopicGovernanceTopicDTO::getName))
        .toList();

    return new TopicGovernanceReportDTO()
        .collectedAtMs(statistics.getClusterState().getScrapeFinishedAt().toEpochMilli())
        .brokerCount(brokerCount)
        .includedInternalTopics(includeInternal)
        .namingRule(namingRule())
        .summary(summary(topics))
        .topics(topics);
  }

  private TopicGovernanceTopicDTO topicReport(Statistics statistics,
                                                InternalTopic topic,
                                                int brokerCount) {
    ScrapedClusterState.TopicState topicState = statistics.getClusterState()
        .getTopicStates()
        .get(topic.getName());
    TopicSettings settings = settings(topicState);
    boolean offsetDataAvailable = offsetDataAvailable(topic);
    Long messageCount = messageCount(topic, offsetDataAvailable);
    Long storageBytes = storageBytes(topicState);
    boolean storageDataAvailable = storageBytes != null;
    int noInSyncReplicaPartitions = noInSyncReplicaPartitions(topic);
    boolean applicationTopic = !topic.isInternal();
    boolean namingCompliant = !applicationTopic || isNamingCompliant(topic.getName());
    List<Advice> advice = advice(
        topic,
        settings,
        brokerCount,
        noInSyncReplicaPartitions,
        namingCompliant,
        offsetDataAvailable,
        storageDataAvailable,
        messageCount,
        storageBytes);
    TopicGovernanceTopicDTO.SeverityEnum severity = severity(advice);

    return new TopicGovernanceTopicDTO()
        .name(topic.getName())
        .classification(applicationTopic
            ? TopicGovernanceTopicDTO.ClassificationEnum.APPLICATION
            : TopicGovernanceTopicDTO.ClassificationEnum.SYSTEM)
        .namingCompliant(namingCompliant)
        .score(score(advice))
        .severity(severity)
        .partitionCount(topic.getPartitionCount())
        .replicationFactor(topic.getReplicationFactor())
        .underReplicatedPartitions(topic.getUnderReplicatedPartitions())
        .noInSyncReplicaPartitions(noInSyncReplicaPartitions)
        .messageCount(messageCount)
        .storageBytes(storageBytes)
        .offsetDataAvailable(offsetDataAvailable)
        .storageDataAvailable(storageDataAvailable)
        .settings(settings.toDto())
        .recommendations(advice.stream()
            .sorted(Comparator
                .comparingInt((Advice item) -> severityRank(item.severity()))
                .thenComparing(Advice::code))
            .map(Advice::toDto)
            .toList());
  }

  private List<Advice> advice(InternalTopic topic,
                              TopicSettings settings,
                              int brokerCount,
                              int noInSyncReplicaPartitions,
                              boolean namingCompliant,
                              boolean offsetDataAvailable,
                              boolean storageDataAvailable,
                              Long messageCount,
                              Long storageBytes) {
    List<Advice> advice = new ArrayList<>();
    if (topic.getPartitionCount() == 0) {
      advice.add(new Advice(
          "NO_PARTITIONS",
          Severity.CRITICAL,
          "The topic has no partitions and cannot carry records.",
          null));
    }
    if (noInSyncReplicaPartitions > 0) {
      advice.add(new Advice(
          "NO_IN_SYNC_REPLICAS",
          Severity.CRITICAL,
          "One or more partitions have no in-sync replicas.",
          noInSyncReplicaPartitions + " partition(s) without ISR"));
    }
    if (topic.getUnderReplicatedPartitions() > 0) {
      advice.add(new Advice(
          "UNDER_REPLICATED",
          Severity.CRITICAL,
          "One or more partitions are under replicated.",
          topic.getUnderReplicatedPartitions() + " under-replicated partition(s)"));
    }
    if (brokerCount == 0) {
      advice.add(new Advice(
          "BROKER_COUNT_UNAVAILABLE",
          Severity.INFO,
          "Replication recommendations are unavailable because no brokers were sampled.",
          null));
    } else {
      int recommendedReplication = Math.min(RECOMMENDED_REPLICATION_FACTOR, brokerCount);
      if (topic.getReplicationFactor() < recommendedReplication) {
        advice.add(new Advice(
            "LOW_REPLICATION",
            Severity.WARNING,
            "Replication is below the advisor target for the sampled broker count.",
            "Replication factor " + topic.getReplicationFactor()
                + "; recommended " + recommendedReplication
                + " for " + brokerCount + " broker(s)"));
      }
      if ((long) topic.getPartitionCount() > (long) brokerCount * HIGH_PARTITIONS_PER_BROKER) {
        advice.add(new Advice(
            "HIGH_PARTITION_DENSITY",
            Severity.WARNING,
            "The topic exceeds the advisor partition-density threshold.",
            topic.getPartitionCount() + " partitions; threshold "
                + HIGH_PARTITIONS_PER_BROKER + " per broker"));
      }
    }
    if (!settings.configurationAvailable()) {
      advice.add(new Advice(
          "CONFIGURATION_UNAVAILABLE",
          Severity.INFO,
          "Topic configuration evidence is unavailable in the cached snapshot.",
          null));
    } else {
      cleanupPolicyAdvice(settings, advice);
      retentionAdvice(settings, advice);
      maxMessageAdvice(settings, advice);
    }
    if (!topic.isInternal() && !namingCompliant) {
      advice.add(new Advice(
          "NAMING_HYGIENE",
          Severity.INFO,
          "Application topic names should use lowercase letters, digits, dots, underscores, and hyphens.",
          topic.getName()));
    }
    if (!offsetDataAvailable) {
      advice.add(new Advice(
          "OFFSET_DATA_UNAVAILABLE",
          Severity.INFO,
          "Message-count posture is unavailable because complete start and end offsets were not sampled.",
          null));
    } else if (messageCount != null && messageCount >= LARGE_MESSAGE_RANGE_THRESHOLD) {
      advice.add(new Advice(
          "LARGE_MESSAGE_RANGE",
          Severity.INFO,
          "The sampled offset range is large; confirm retention and consumer capacity are intentional.",
          messageCount + " records in the sampled offset range"));
    }
    if (!storageDataAvailable) {
      advice.add(new Advice(
          "STORAGE_DATA_UNAVAILABLE",
          Severity.INFO,
          "Storage posture is unavailable because log-directory statistics were not sampled.",
          null));
    } else if (storageBytes != null && storageBytes >= LARGE_STORAGE_THRESHOLD_BYTES) {
      advice.add(new Advice(
          "LARGE_STORAGE_FOOTPRINT",
          Severity.INFO,
          "The topic has a large sampled storage footprint; review retention and capacity planning.",
          storageBytes + " bytes across sampled log directories"));
    }
    return advice;
  }

  private void cleanupPolicyAdvice(TopicSettings settings, List<Advice> advice) {
    CleanupPolicy cleanupPolicy = settings.cleanupPolicy() == null
        ? CleanupPolicy.UNKNOWN
        : CleanupPolicy.fromString(settings.cleanupPolicy());
    if (cleanupPolicy == CleanupPolicy.UNKNOWN) {
      advice.add(new Advice(
          "UNKNOWN_CLEANUP_POLICY",
          Severity.INFO,
          "Cleanup policy could not be determined from the cached topic configuration.",
          null));
    } else if (cleanupPolicy == CleanupPolicy.COMPACT
        || cleanupPolicy == CleanupPolicy.COMPACT_DELETE) {
      advice.add(new Advice(
          "COMPACTION_POSTURE",
          Severity.INFO,
          "Log compaction is enabled; validate tombstone retention and key-based record lifecycle.",
          settings.cleanupPolicy()));
    }
  }

  private void retentionAdvice(TopicSettings settings, List<Advice> advice) {
    if (Long.valueOf(-1L).equals(settings.retentionMs())
        && Long.valueOf(-1L).equals(settings.retentionBytes())) {
      advice.add(new Advice(
          "UNBOUNDED_RETENTION",
          Severity.WARNING,
          "Both time- and size-based retention are disabled.",
          "retention.ms=-1, retention.bytes=-1"));
    }
  }

  private void maxMessageAdvice(TopicSettings settings, List<Advice> advice) {
    if (settings.maxMessageBytes() != null
        && settings.maxMessageBytes() > LARGE_MAX_MESSAGE_BYTES) {
      advice.add(new Advice(
          "LARGE_MAX_MESSAGE",
          Severity.WARNING,
          "The maximum message size exceeds the advisor threshold; verify producer and consumer fetch limits.",
          settings.maxMessageBytes() + " bytes; threshold " + LARGE_MAX_MESSAGE_BYTES));
    }
  }

  private TopicSettings settings(ScrapedClusterState.TopicState topicState) {
    List<ConfigEntry> configs = topicState == null || topicState.configs() == null
        ? List.of()
        : topicState.configs();
    return new TopicSettings(
        !configs.isEmpty(),
        configValue(configs, TopicConfig.CLEANUP_POLICY_CONFIG),
        numericConfig(configs, TopicConfig.RETENTION_MS_CONFIG),
        numericConfig(configs, TopicConfig.RETENTION_BYTES_CONFIG),
        numericConfig(configs, TopicConfig.SEGMENT_MS_CONFIG),
        numericConfig(configs, TopicConfig.SEGMENT_BYTES_CONFIG),
        numericConfig(configs, TopicConfig.MAX_MESSAGE_BYTES_CONFIG));
  }

  private String configValue(List<ConfigEntry> configs, String name) {
    return configs.stream()
        .filter(config -> name.equals(config.name()))
        .map(ConfigEntry::value)
        .findFirst()
        .orElse(null);
  }

  private Long numericConfig(List<ConfigEntry> configs, String name) {
    String value = configValue(configs, name);
    if (value == null) {
      return null;
    }
    try {
      return Long.parseLong(value);
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  private boolean offsetDataAvailable(InternalTopic topic) {
    return topic.getPartitionCount() > 0
        && topic.getPartitions().values().stream()
            .allMatch(partition -> partition.getOffsetMin() != null
                && partition.getOffsetMax() != null);
  }

  private Long messageCount(InternalTopic topic, boolean offsetDataAvailable) {
    if (!offsetDataAvailable || topic.getCleanUpPolicy() != CleanupPolicy.DELETE) {
      return null;
    }
    return topic.getMessagesCount();
  }

  private Long storageBytes(ScrapedClusterState.TopicState topicState) {
    if (topicState == null || topicState.segmentStats() == null) {
      return null;
    }
    InternalLogDirStats.SegmentStats stats = topicState.segmentStats();
    if (stats.getSegmentSize() == null) {
      return null;
    }
    return stats.getSegmentSize();
  }

  private int noInSyncReplicaPartitions(InternalTopic topic) {
    return (int) topic.getPartitions().values().stream()
        .filter(partition -> partition.getReplicasCount() > 0
            && partition.getInSyncReplicasCount() == 0)
        .count();
  }

  private boolean isNamingCompliant(String name) {
    return name.matches("^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$");
  }

  private TopicGovernanceSummaryDTO summary(List<TopicGovernanceTopicDTO> topics) {
    return new TopicGovernanceSummaryDTO()
        .totalTopics(topics.size())
        .criticalTopics(countSeverity(topics, TopicGovernanceTopicDTO.SeverityEnum.CRITICAL))
        .warningTopics(countSeverity(topics, TopicGovernanceTopicDTO.SeverityEnum.WARNING))
        .infoTopics(countSeverity(topics, TopicGovernanceTopicDTO.SeverityEnum.INFO))
        .healthyTopics(countSeverity(topics, TopicGovernanceTopicDTO.SeverityEnum.HEALTHY));
  }

  private int countSeverity(List<TopicGovernanceTopicDTO> topics,
                            TopicGovernanceTopicDTO.SeverityEnum severity) {
    return (int) topics.stream().filter(topic -> topic.getSeverity() == severity).count();
  }

  private TopicGovernanceTopicDTO.SeverityEnum severity(List<Advice> advice) {
    if (advice.stream().anyMatch(item -> item.severity() == Severity.CRITICAL)) {
      return TopicGovernanceTopicDTO.SeverityEnum.CRITICAL;
    }
    if (advice.stream().anyMatch(item -> item.severity() == Severity.WARNING)) {
      return TopicGovernanceTopicDTO.SeverityEnum.WARNING;
    }
    if (advice.isEmpty()) {
      return TopicGovernanceTopicDTO.SeverityEnum.HEALTHY;
    }
    return TopicGovernanceTopicDTO.SeverityEnum.INFO;
  }

  private int score(List<Advice> advice) {
    int deductions = advice.stream()
        .mapToInt(this::scoreDeduction)
        .sum();
    return Math.max(0, Math.min(100, 100 - deductions));
  }

  private int scoreDeduction(Advice advice) {
    return switch (advice.code()) {
      case "NO_PARTITIONS" -> 50;
      case "NO_IN_SYNC_REPLICAS" -> 40;
      case "UNDER_REPLICATED" -> 20;
      case "LOW_REPLICATION" -> 15;
      case "UNBOUNDED_RETENTION" -> 12;
      case "LARGE_MAX_MESSAGE" -> 8;
      case "HIGH_PARTITION_DENSITY" -> 8;
      case "NAMING_HYGIENE" -> 3;
      default -> 0;
    };
  }

  private int severityRank(TopicGovernanceTopicDTO.SeverityEnum severity) {
    return switch (severity) {
      case CRITICAL -> 0;
      case WARNING -> 1;
      case INFO -> 2;
      case HEALTHY -> 3;
    };
  }

  private int severityRank(Severity severity) {
    return switch (severity) {
      case CRITICAL -> 0;
      case WARNING -> 1;
      case INFO -> 2;
    };
  }

  private String internalTopicPrefix() {
    String configuredPrefix = clustersProperties.getInternalTopicPrefix();
    return configuredPrefix == null || configuredPrefix.isBlank() ? "_" : configuredPrefix;
  }

  private String namingRule() {
    return "System topics are Kafka-internal or begin with the configured internal prefix '"
        + internalTopicPrefix()
        + "'. Application names should be lowercase, begin and end with a letter or digit, "
        + "and use only letters, digits, dots, underscores, or hyphens.";
  }

  private enum Severity {
    CRITICAL,
    WARNING,
    INFO
  }

  private record Advice(String code, Severity severity, String message, String evidence) {
    private TopicGovernanceRecommendationDTO toDto() {
      return new TopicGovernanceRecommendationDTO()
          .code(code)
          .severity(switch (severity) {
            case CRITICAL -> TopicGovernanceRecommendationDTO.SeverityEnum.CRITICAL;
            case WARNING -> TopicGovernanceRecommendationDTO.SeverityEnum.WARNING;
            case INFO -> TopicGovernanceRecommendationDTO.SeverityEnum.INFO;
          })
          .message(message)
          .evidence(evidence);
    }
  }

  private record TopicSettings(boolean configurationAvailable,
                               String cleanupPolicy,
                               Long retentionMs,
                               Long retentionBytes,
                               Long segmentMs,
                               Long segmentBytes,
                               Long maxMessageBytes) {
    private TopicGovernanceSettingsDTO toDto() {
      return new TopicGovernanceSettingsDTO()
          .configurationAvailable(configurationAvailable)
          .cleanupPolicy(cleanupPolicy)
          .retentionMs(retentionMs)
          .retentionBytes(retentionBytes)
          .segmentMs(segmentMs)
          .segmentBytes(segmentBytes)
          .maxMessageBytes(maxMessageBytes);
    }
  }
}