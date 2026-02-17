package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.kafbat.ui.config.ClustersProperties;
import io.kafbat.ui.model.InternalLogDirStats;
import io.kafbat.ui.model.Metrics;
import io.kafbat.ui.model.ServerStatusDTO;
import io.kafbat.ui.model.Statistics;
import io.kafbat.ui.model.TopicGovernanceTopicDTO;
import io.kafbat.ui.service.ReactiveAdminClient.ClusterDescription;
import io.kafbat.ui.service.index.FilterTopicIndex;
import io.kafbat.ui.service.metrics.scrape.ScrapedClusterState;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.TopicPartitionInfo;
import org.apache.kafka.common.config.TopicConfig;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class TopicGovernanceServiceTest {

  @Test
  void evaluatesCachedReplicationCleanupRetentionNamingAndCapacityEvidence() {
    List<Node> brokers = List.of(
        new Node(1, "broker-1", 9092),
        new Node(2, "broker-2", 9092),
        new Node(3, "broker-3", 9092));
    TopicPartitionInfo partition = new TopicPartitionInfo(
        0,
        brokers.getFirst(),
        brokers.subList(0, 2),
        List.of());
    ScrapedClusterState.TopicState topicState = topicState(
        "Orders.Billing",
        List.of(partition),
        List.of(
            new ConfigEntry(TopicConfig.CLEANUP_POLICY_CONFIG, "delete"),
            new ConfigEntry(TopicConfig.RETENTION_MS_CONFIG, "-1"),
            new ConfigEntry(TopicConfig.RETENTION_BYTES_CONFIG, "-1"),
            new ConfigEntry(TopicConfig.SEGMENT_MS_CONFIG, "3600000"),
            new ConfigEntry(TopicConfig.SEGMENT_BYTES_CONFIG, "1073741824"),
            new ConfigEntry(TopicConfig.MAX_MESSAGE_BYTES_CONFIG, "11534336")),
        Map.of(0, 0L),
        Map.of(0, 12_000_000L),
        new InternalLogDirStats.SegmentStats(200L * 1024L * 1024L * 1024L, 2));
    Statistics statistics = statistics(brokers, Map.of("Orders.Billing", topicState));
    TopicGovernanceService service = service();

    var report = service.report(statistics, service.getTopics(statistics, false), false);

    assertThat(report.getBrokerCount()).isEqualTo(3);
    assertThat(report.getSummary().getCriticalTopics()).isEqualTo(1);
    assertThat(report.getTopics()).singleElement().satisfies(topic -> {
      assertThat(topic.getClassification())
          .isEqualTo(TopicGovernanceTopicDTO.ClassificationEnum.APPLICATION);
      assertThat(topic.getNamingCompliant()).isFalse();
      assertThat(topic.getSeverity())
          .isEqualTo(TopicGovernanceTopicDTO.SeverityEnum.CRITICAL);
      assertThat(topic.getScore()).isBetween(0, 100);
      assertThat(topic.getMessageCount()).isEqualTo(12_000_000L);
      assertThat(topic.getStorageBytes()).isEqualTo(200L * 1024L * 1024L * 1024L);
      assertThat(topic.getSettings().getCleanupPolicy()).isEqualTo("delete");
      assertThat(topic.getSettings().getRetentionMs()).isEqualTo(-1L);
      assertThat(topic.getSettings().getRetentionBytes()).isEqualTo(-1L);
      assertThat(topic.getSettings().getSegmentMs()).isEqualTo(3_600_000L);
      assertThat(topic.getSettings().getSegmentBytes()).isEqualTo(1_073_741_824L);
      assertThat(topic.getSettings().getMaxMessageBytes()).isEqualTo(11_534_336L);
      assertThat(topic.getRecommendations())
          .extracting(recommendation -> recommendation.getCode())
          .contains(
              "NO_IN_SYNC_REPLICAS",
              "UNDER_REPLICATED",
              "LOW_REPLICATION",
              "UNBOUNDED_RETENTION",
              "LARGE_MAX_MESSAGE",
              "NAMING_HYGIENE",
              "LARGE_MESSAGE_RANGE",
              "LARGE_STORAGE_FOOTPRINT");
      assertThat(topic.getRecommendations().getFirst().getSeverity().name()).isEqualTo("CRITICAL");
    });
  }

  @Test
  void filtersSystemTopicsByDefaultAndReportsUnavailableCachedEvidence() {
    Node broker = new Node(1, "broker-1", 9092);
    TopicPartitionInfo partition = new TopicPartitionInfo(
        0,
        broker,
        List.of(broker),
        List.of(broker));
    ScrapedClusterState.TopicState topicState = topicState(
        "_consumer_offsets",
        List.of(partition),
        List.of(),
        Map.of(),
        Map.of(),
        null);
    Statistics statistics = statistics(List.of(broker), Map.of("_consumer_offsets", topicState));
    TopicGovernanceService service = service();

    assertThat(service.getTopics(statistics, false)).isEmpty();

    var report = service.report(statistics, service.getTopics(statistics, true), true);

    assertThat(report.getIncludedInternalTopics()).isTrue();
    assertThat(report.getTopics()).singleElement().satisfies(topic -> {
      assertThat(topic.getClassification())
          .isEqualTo(TopicGovernanceTopicDTO.ClassificationEnum.SYSTEM);
      assertThat(topic.getNamingCompliant()).isTrue();
      assertThat(topic.getSettings().getConfigurationAvailable()).isFalse();
      assertThat(topic.getOffsetDataAvailable()).isFalse();
      assertThat(topic.getStorageDataAvailable()).isFalse();
      assertThat(topic.getRecommendations())
          .extracting(recommendation -> recommendation.getCode())
          .contains(
              "CONFIGURATION_UNAVAILABLE",
              "OFFSET_DATA_UNAVAILABLE",
              "STORAGE_DATA_UNAVAILABLE");
    });
  }

  private TopicGovernanceService service() {
    ClustersProperties properties = new ClustersProperties();
    properties.setInternalTopicPrefix("_");
    return new TopicGovernanceService(Mockito.mock(StatisticsCache.class), properties);
  }

  private Statistics statistics(List<Node> brokers,
                                Map<String, ScrapedClusterState.TopicState> topics) {
    return Statistics.builder()
        .status(ServerStatusDTO.ONLINE)
        .clusterDescription(new ClusterDescription(brokers.getFirst(), "cluster", brokers, Set.of()))
        .metrics(Metrics.empty())
        .features(List.of())
        .clusterState(ScrapedClusterState.builder()
            .scrapeFinishedAt(Instant.ofEpochMilli(1_000L))
            .nodesStates(Map.of())
            .topicStates(topics)
            .consumerGroupsStates(Map.of())
            .topicIndex(new FilterTopicIndex(List.of()))
            .build())
        .connectStates(Map.of())
        .build();
  }

  private ScrapedClusterState.TopicState topicState(
      String name,
      List<TopicPartitionInfo> partitions,
      List<ConfigEntry> configs,
      Map<Integer, Long> startOffsets,
      Map<Integer, Long> endOffsets,
      InternalLogDirStats.SegmentStats segmentStats) {
    return new ScrapedClusterState.TopicState(
        name,
        new TopicDescription(name, false, partitions),
        configs,
        startOffsets,
        endOffsets,
        segmentStats,
        Map.of());
  }
}