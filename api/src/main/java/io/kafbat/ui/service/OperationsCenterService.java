package io.kafbat.ui.service;

import io.kafbat.ui.config.ClustersProperties;
import io.kafbat.ui.model.CleanupPolicy;
import io.kafbat.ui.model.ClusterFeature;
import io.kafbat.ui.model.InternalLogDirStats;
import io.kafbat.ui.model.InternalPartition;
import io.kafbat.ui.model.InternalReplica;
import io.kafbat.ui.model.InternalTopic;
import io.kafbat.ui.model.KafkaCluster;
import io.kafbat.ui.model.OperationsBrokerDTO;
import io.kafbat.ui.model.OperationsBrokersDTO;
import io.kafbat.ui.model.OperationsCenterSnapshotDTO;
import io.kafbat.ui.model.OperationsConsumerGroupDTO;
import io.kafbat.ui.model.OperationsConsumerStateCountDTO;
import io.kafbat.ui.model.OperationsConsumersDTO;
import io.kafbat.ui.model.OperationsHealthDTO;
import io.kafbat.ui.model.OperationsIntegrationDTO;
import io.kafbat.ui.model.OperationsIntegrationsDTO;
import io.kafbat.ui.model.OperationsTopicDTO;
import io.kafbat.ui.model.OperationsTopicsDTO;
import io.kafbat.ui.model.ServerStatusDTO;
import io.kafbat.ui.model.Statistics;
import io.kafbat.ui.service.metrics.scrape.KafkaConnectState;
import io.kafbat.ui.service.metrics.scrape.ScrapedClusterState;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.TopicPartition;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OperationsCenterService {

  private static final int DEFAULT_LIMIT = 10;
  private static final int MAX_LIMIT = 50;
  private static final int MIN_PARTITIONS_FOR_SKEW = 50;

  private final StatisticsCache statisticsCache;
  private final ClustersProperties clustersProperties;

  public Statistics getStatistics(KafkaCluster cluster) {
    return statisticsCache.get(cluster);
  }

  public int resolveLimit(Integer requestedLimit) {
    if (requestedLimit == null) {
      return DEFAULT_LIMIT;
    }
    return Math.max(1, Math.min(requestedLimit, MAX_LIMIT));
  }

  public List<InternalTopic> getTopics(Statistics statistics, boolean includeInternal) {
    return statistics.getClusterState().getTopicStates().values().stream()
        .map(
            topicState ->
                InternalTopic.from(topicState, clustersProperties.getInternalTopicPrefix())
                    .withMetrics(statistics.getMetrics()))
        .filter(topic -> includeInternal || !topic.isInternal())
        .toList();
  }

  public OperationsCenterSnapshotDTO snapshot(
      KafkaCluster cluster,
      Statistics statistics,
      List<InternalTopic> visibleTopics,
      Set<String> visibleConsumerGroups,
      int limit) {
    Map<String, InternalTopic> visibleTopicsByName =
        visibleTopics.stream().collect(Collectors.toMap(InternalTopic::getName, topic -> topic));
    Map<Integer, BrokerPosture> brokerPosture = brokerPosture(visibleTopics);

    return new OperationsCenterSnapshotDTO()
        .collectedAtMs(statistics.getClusterState().getScrapeFinishedAt().toEpochMilli())
        .health(health(statistics, visibleTopics, brokerPosture))
        .brokers(brokers(statistics, brokerPosture, visibleTopics))
        .topics(topics(statistics, visibleTopics, limit))
        .consumers(consumers(statistics, visibleTopicsByName, visibleConsumerGroups, limit))
        .integrations(this.integrations(cluster, statistics));
  }

  private OperationsHealthDTO health(
      Statistics statistics,
      List<InternalTopic> visibleTopics,
      Map<Integer, BrokerPosture> brokerPosture) {
    int offlinePartitions =
        visibleTopics.stream()
            .flatMap(topic -> topic.getPartitions().values().stream())
            .map(InternalPartition::getLeader)
            .mapToInt(leader -> leader == null ? 1 : 0)
            .sum();
    int replicas = visibleTopics.stream().mapToInt(InternalTopic::getReplicas).sum();
    int inSyncReplicas = visibleTopics.stream().mapToInt(InternalTopic::getInSyncReplicas).sum();
    int underReplicatedPartitions =
        visibleTopics.stream().mapToInt(InternalTopic::getUnderReplicatedPartitions).sum();
    int outOfSyncReplicas = Math.max(0, replicas - inSyncReplicas);

    return new OperationsHealthDTO()
        .status(statistics.getStatus())
        .controller(
            statistics.getController() == null
                ? null
                : io.kafbat.ui.model.ControllerTypeDTO.fromValue(statistics.getController().name()))
        .score(
            healthScore(
                statistics.getStatus(),
                offlinePartitions,
                underReplicatedPartitions,
                outOfSyncReplicas))
        .brokerCount(brokerPosture.size())
        .offlinePartitions(offlinePartitions)
        .inSyncReplicas(inSyncReplicas)
        .outOfSyncReplicas(outOfSyncReplicas)
        .underReplicatedPartitions(underReplicatedPartitions)
        .lastError(lastError(statistics));
  }

  private OperationsBrokersDTO brokers(
      Statistics statistics,
      Map<Integer, BrokerPosture> brokerPosture,
      List<InternalTopic> visibleTopics) {
    Collection<Node> nodes = statistics.getClusterDescription().getNodes();
    boolean skewAvailable =
        visibleTopics.stream().mapToInt(InternalTopic::getPartitionCount).sum()
            >= MIN_PARTITIONS_FOR_SKEW;
    double averageReplicas =
        average(
            brokerPosture.values().stream().mapToInt(posture -> posture.replicaCount).toArray());
    double averageLeaders =
        average(brokerPosture.values().stream().mapToInt(posture -> posture.leaderCount).toArray());

    List<OperationsBrokerDTO> brokers =
        nodes.stream()
            .sorted(Comparator.comparingInt(Node::id))
            .map(
                node -> {
                  BrokerPosture posture =
                      brokerPosture.getOrDefault(node.id(), new BrokerPosture());
                  ScrapedClusterState.NodeState nodeState =
                      statistics.getClusterState().getNodesStates().get(node.id());
                  InternalLogDirStats.SegmentStats segmentStats =
                      nodeState == null ? null : nodeState.segmentStats();
                  InternalLogDirStats.LogDirSpaceStats spaceStats =
                      nodeState == null ? null : nodeState.logDirSpaceStats();

                  return new OperationsBrokerDTO()
                      .id(node.id())
                      .host(node.host())
                      .port(node.port())
                      .leaderCount(posture.leaderCount)
                      .replicaCount(posture.replicaCount)
                      .inSyncReplicaCount(posture.inSyncReplicaCount)
                      .segmentBytes(segmentStats == null ? null : segmentStats.getSegmentSize())
                      .totalBytes(spaceStats == null ? null : spaceStats.totalBytes())
                      .usableBytes(spaceStats == null ? null : spaceStats.usableBytes())
                      .partitionSkew(skew(skewAvailable, posture.replicaCount, averageReplicas))
                      .leaderSkew(skew(skewAvailable, posture.leaderCount, averageLeaders));
                })
            .toList();

    return new OperationsBrokersDTO()
        .skewAvailable(skewAvailable)
        .totalBytes(sumKnownLong(brokers.stream().map(OperationsBrokerDTO::getTotalBytes).toList()))
        .usableBytes(
            sumKnownLong(brokers.stream().map(OperationsBrokerDTO::getUsableBytes).toList()))
        .brokers(brokers);
  }

  private OperationsTopicsDTO topics(
      Statistics statistics, List<InternalTopic> visibleTopics, int limit) {
    int brokerCount = statistics.getClusterDescription().getNodes().size();
    List<OperationsTopicDTO> topicDtos =
        visibleTopics.stream().map(topic -> topicDto(statistics, topic, brokerCount)).toList();

    List<OperationsTopicDTO> atRisk =
        topicDtos.stream()
            .filter(topic -> !topic.getRiskSignals().isEmpty())
            .sorted(
                Comparator.comparingInt((OperationsTopicDTO topic) -> topic.getRiskSignals().size())
                    .reversed()
                    .thenComparing(
                        OperationsTopicDTO::getUnderReplicatedPartitions, Comparator.reverseOrder())
                    .thenComparing(
                        OperationsTopicDTO::getStorageBytes,
                        Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(limit)
            .toList();
    List<OperationsTopicDTO> largest =
        topicDtos.stream()
            .filter(topic -> topic.getStorageBytes() != null)
            .sorted(
                Comparator.comparing(
                    OperationsTopicDTO::getStorageBytes, Comparator.reverseOrder()))
            .limit(limit)
            .toList();

    return new OperationsTopicsDTO()
        .visibleCount(visibleTopics.size())
        .internalCount((int) visibleTopics.stream().filter(InternalTopic::isInternal).count())
        .partitions(visibleTopics.stream().mapToInt(InternalTopic::getPartitionCount).sum())
        .storageBytes(
            sumKnownLong(topicDtos.stream().map(OperationsTopicDTO::getStorageBytes).toList()))
        .inboundBytesPerSec(
            sumKnownDouble(
                topicDtos.stream().map(OperationsTopicDTO::getInboundBytesPerSec).toList()))
        .outboundBytesPerSec(
            sumKnownDouble(
                topicDtos.stream().map(OperationsTopicDTO::getOutboundBytesPerSec).toList()))
        .atRisk(atRisk)
        .largest(largest);
  }

  private OperationsTopicDTO topicDto(Statistics statistics, InternalTopic topic, int brokerCount) {
    ScrapedClusterState.TopicState topicState =
        statistics.getClusterState().getTopicStates().get(topic.getName());
    Long storageBytes =
        Optional.ofNullable(topicState)
            .map(ScrapedClusterState.TopicState::segmentStats)
            .map(InternalLogDirStats.SegmentStats::getSegmentSize)
            .orElse(null);
    List<String> riskSignals = topicRiskSignals(topic, brokerCount);

    return new OperationsTopicDTO()
        .name(topic.getName())
        .internal(topic.isInternal())
        .partitionCount(topic.getPartitionCount())
        .replicationFactor(topic.getReplicationFactor())
        .underReplicatedPartitions(topic.getUnderReplicatedPartitions())
        .messageCount(topic.getMessagesCount())
        .storageBytes(storageBytes)
        .inboundBytesPerSec(toDouble(topic.getBytesInPerSec()))
        .outboundBytesPerSec(toDouble(topic.getBytesOutPerSec()))
        .cleanupPolicy(topic.getCleanUpPolicy().name())
        .riskSignals(riskSignals);
  }

  private OperationsConsumersDTO consumers(
      Statistics statistics,
      Map<String, InternalTopic> visibleTopics,
      Set<String> visibleConsumerGroups,
      int limit) {
    List<OperationsConsumerGroupDTO> groups =
        statistics.getClusterState().getConsumerGroupsStates().values().stream()
            .filter(group -> visibleConsumerGroups.contains(group.group()))
            .map(group -> consumerGroupDto(group, statistics.getClusterState(), visibleTopics))
            .toList();
    Map<String, Long> states =
        groups.stream()
            .collect(
                Collectors.groupingBy(
                    group -> Optional.ofNullable(group.getState()).orElse("UNKNOWN"),
                    LinkedHashMap::new,
                    Collectors.counting()));

    return new OperationsConsumersDTO()
        .visibleCount(groups.size())
        .totalLag(
            groups.stream()
                .map(OperationsConsumerGroupDTO::getLag)
                .filter(value -> value != null)
                .mapToLong(Long::longValue)
                .sum())
        .states(
            states.entrySet().stream()
                .map(
                    entry ->
                        new OperationsConsumerStateCountDTO()
                            .state(entry.getKey())
                            .count(entry.getValue().intValue()))
                .toList())
        .worstLagging(
            groups.stream()
                .sorted(
                    Comparator.comparing(
                        OperationsConsumerGroupDTO::getLag,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(limit)
                .toList());
  }

  private OperationsConsumerGroupDTO consumerGroupDto(
      ScrapedClusterState.ConsumerGroupState group,
      ScrapedClusterState clusterState,
      Map<String, InternalTopic> visibleTopics) {
    long lag = 0;
    for (Map.Entry<TopicPartition, Long> entry : group.committedOffsets().entrySet()) {
      TopicPartition topicPartition = entry.getKey();
      InternalTopic topic = visibleTopics.get(topicPartition.topic());
      ScrapedClusterState.TopicState topicState =
          clusterState.getTopicStates().get(topicPartition.topic());
      if (topic == null || topicState == null) {
        continue;
      }
      Long endOffset = topicState.endOffsets().get(topicPartition.partition());
      if (endOffset != null && entry.getValue() != null) {
        lag += Math.max(0, endOffset - entry.getValue());
      }
    }

    return new OperationsConsumerGroupDTO()
        .groupId(group.group())
        .state(group.description() == null ? null : group.description().state().toString())
        .lag(lag)
        .committedPartitions(group.committedOffsets().size());
  }

  private OperationsIntegrationsDTO integrations(KafkaCluster cluster, Statistics statistics) {
    boolean schemaConfigured =
        cluster.getOriginalProperties().getSchemaRegistry() != null
            && !cluster.getOriginalProperties().getSchemaRegistry().isBlank();
    OperationsIntegrationDTO schemaRegistry =
        new OperationsIntegrationDTO()
            .name("Schema Registry")
            .status(schemaStatus(schemaConfigured, statistics));

    List<OperationsIntegrationDTO> connects =
        Optional.ofNullable(cluster.getConnectsConfigs()).orElse(Map.of()).entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(
                entry ->
                    connectIntegration(
                        entry.getKey(), statistics.getConnectStates().get(entry.getKey())))
            .toList();

    return new OperationsIntegrationsDTO().schemaRegistry(schemaRegistry).connects(connects);
  }

  private OperationsIntegrationDTO connectIntegration(String name, KafkaConnectState state) {
    if (state == null) {
      return new OperationsIntegrationDTO()
          .name(name)
          .status(OperationsIntegrationDTO.StatusEnum.UNKNOWN);
    }

    int connectorCount = state.getConnectors().size();
    int failingConnectorCount =
        (int)
            state.getConnectors().stream()
                .filter(
                    connector ->
                        connector.status() != null
                            && connector.status().getState() != null
                            && "FAILED".equals(connector.status().getState().name()))
                .count();
    return new OperationsIntegrationDTO()
        .name(name)
        .status(
            failingConnectorCount > 0
                ? OperationsIntegrationDTO.StatusEnum.UNAVAILABLE
                : OperationsIntegrationDTO.StatusEnum.AVAILABLE)
        .connectorCount(connectorCount)
        .failingConnectorCount(failingConnectorCount);
  }

  private OperationsIntegrationDTO.StatusEnum schemaStatus(
      boolean configured, Statistics statistics) {
    if (!configured) {
      return OperationsIntegrationDTO.StatusEnum.NOT_CONFIGURED;
    }
    return statistics.getFeatures().contains(ClusterFeature.SCHEMA_REGISTRY)
        ? OperationsIntegrationDTO.StatusEnum.AVAILABLE
        : OperationsIntegrationDTO.StatusEnum.UNKNOWN;
  }

  private Map<Integer, BrokerPosture> brokerPosture(List<InternalTopic> topics) {
    Map<Integer, BrokerPosture> posture = new HashMap<>();
    for (InternalTopic topic : topics) {
      for (InternalPartition partition : topic.getPartitions().values()) {
        if (partition.getLeader() != null) {
          posture.computeIfAbsent(partition.getLeader(), ignored -> new BrokerPosture())
              .leaderCount++;
        }
        for (InternalReplica replica : partition.getReplicas()) {
          BrokerPosture broker =
              posture.computeIfAbsent(replica.getBroker(), ignored -> new BrokerPosture());
          broker.replicaCount++;
          if (replica.isInSync()) {
            broker.inSyncReplicaCount++;
          }
        }
      }
    }
    return posture;
  }

  private List<String> topicRiskSignals(InternalTopic topic, int brokerCount) {
    List<String> signals = new ArrayList<>();
    if (topic.getUnderReplicatedPartitions() > 0) {
      signals.add("UNDER_REPLICATED");
    }
    if (topic.getReplicas() > 0 && topic.getInSyncReplicas() == 0) {
      signals.add("NO_IN_SYNC_REPLICAS");
    }
    if (brokerCount > 1 && topic.getReplicationFactor() < Math.min(3, brokerCount)) {
      signals.add("LOW_REPLICATION");
    }
    if (topic.getCleanUpPolicy() == CleanupPolicy.UNKNOWN) {
      signals.add("UNKNOWN_CLEANUP_POLICY");
    }
    return signals;
  }

  private int healthScore(
      ServerStatusDTO status,
      int offlinePartitions,
      int underReplicatedPartitions,
      int outOfSyncReplicas) {
    if (status == ServerStatusDTO.OFFLINE) {
      return 0;
    }
    if (status == ServerStatusDTO.INITIALIZING) {
      return 50;
    }
    int deductions =
        offlinePartitions * 25 + underReplicatedPartitions * 10 + outOfSyncReplicas * 2;
    return Math.max(0, 100 - deductions);
  }

  private String lastError(Statistics statistics) {
    return Optional.ofNullable(statistics.getLastKafkaException())
        .map(error -> error.getClass().getSimpleName())
        .orElse(null);
  }

  private Double skew(boolean available, int actual, double average) {
    if (!available || average == 0) {
      return null;
    }
    return BigDecimal.valueOf((actual - average) / average * 100)
        .setScale(1, RoundingMode.HALF_UP)
        .doubleValue();
  }

  private double average(int[] values) {
    if (values.length == 0) {
      return 0;
    }
    return (double) java.util.Arrays.stream(values).sum() / values.length;
  }

  private Long sumKnownLong(List<Long> values) {
    List<Long> knownValues = values.stream().filter(value -> value != null).toList();
    if (knownValues.isEmpty()) {
      return null;
    }
    return knownValues.stream().mapToLong(Long::longValue).sum();
  }

  private Double sumKnownDouble(List<Double> values) {
    List<Double> knownValues = values.stream().filter(value -> value != null).toList();
    if (knownValues.isEmpty()) {
      return null;
    }
    return knownValues.stream().mapToDouble(Double::doubleValue).sum();
  }

  private Double toDouble(BigDecimal value) {
    return value == null ? null : value.doubleValue();
  }

  private static final class BrokerPosture {
    private int leaderCount;
    private int replicaCount;
    private int inSyncReplicaCount;
  }
}
