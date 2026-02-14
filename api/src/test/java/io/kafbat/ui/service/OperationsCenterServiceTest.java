package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.kafbat.ui.config.ClustersProperties;
import io.kafbat.ui.model.InternalLogDirStats;
import io.kafbat.ui.model.KafkaCluster;
import io.kafbat.ui.model.Metrics;
import io.kafbat.ui.model.ServerStatusDTO;
import io.kafbat.ui.model.Statistics;
import io.kafbat.ui.service.ReactiveAdminClient.ClusterDescription;
import io.kafbat.ui.service.index.FilterTopicIndex;
import io.kafbat.ui.service.metrics.scrape.ScrapedClusterState;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.TopicPartitionInfo;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class OperationsCenterServiceTest {

  @Test
  void boundsResultLimit() {
    OperationsCenterService service = service(new ClustersProperties());

    assertThat(service.resolveLimit(null)).isEqualTo(10);
    assertThat(service.resolveLimit(0)).isEqualTo(1);
    assertThat(service.resolveLimit(20)).isEqualTo(20);
    assertThat(service.resolveLimit(100)).isEqualTo(50);
  }

  @Test
  void buildsHealthAndRiskPostureFromCachedState() {
    Node broker = new Node(1, "broker-1", 9092);
    TopicPartitionInfo partition = new TopicPartitionInfo(
        0,
        broker,
        List.of(broker),
        List.of());
    var topicDescription = new org.apache.kafka.clients.admin.TopicDescription(
        "orders",
        false,
        List.of(partition));
    var topicState = new ScrapedClusterState.TopicState(
        "orders",
        topicDescription,
        List.of(),
        Map.of(0, 0L),
        Map.of(0, 120L),
        new InternalLogDirStats.SegmentStats(2_048L, 1),
        Map.of());
    var clusterState = ScrapedClusterState.builder()
        .scrapeFinishedAt(Instant.ofEpochMilli(1_000L))
        .nodesStates(Map.of(
            1,
            new ScrapedClusterState.NodeState(
                1,
                broker,
                new InternalLogDirStats.SegmentStats(2_048L, 1),
                new InternalLogDirStats.LogDirSpaceStats(
                    10_000L,
                    5_000L,
                    Map.of(),
                    Map.of()))))
        .topicStates(Map.of("orders", topicState))
        .consumerGroupsStates(Map.of())
        .topicIndex(new FilterTopicIndex(List.of()))
        .build();
    Statistics statistics = Statistics.builder()
        .status(ServerStatusDTO.ONLINE)
        .clusterDescription(new ClusterDescription(broker, "cluster", List.of(broker), Set.of()))
        .metrics(Metrics.empty())
        .features(List.of())
        .clusterState(clusterState)
        .connectStates(Map.of())
        .build();
    ClustersProperties properties = new ClustersProperties();
    properties.setInternalTopicPrefix("_");
    ClustersProperties.Cluster clusterProperties = new ClustersProperties.Cluster();
    clusterProperties.setName("local");
    KafkaCluster cluster = KafkaCluster.builder()
        .name("local")
        .originalProperties(clusterProperties)
        .connectsConfigs(Map.of())
        .build();
    OperationsCenterService service = service(properties);

    var topics = service.getTopics(statistics, false);
    var snapshot = service.snapshot(cluster, statistics, topics, Set.of(), 10);

    assertThat(snapshot.getCollectedAtMs()).isEqualTo(1_000L);
    assertThat(snapshot.getHealth().getScore()).isEqualTo(88);
    assertThat(snapshot.getHealth().getUnderReplicatedPartitions()).isEqualTo(1);
    assertThat(snapshot.getTopics().getLargest())
        .singleElement()
        .satisfies(topic -> {
          assertThat(topic.getName()).isEqualTo("orders");
          assertThat(topic.getStorageBytes()).isEqualTo(2_048L);
          assertThat(topic.getRiskSignals())
              .contains("UNDER_REPLICATED", "NO_IN_SYNC_REPLICAS");
        });
    assertThat(snapshot.getIntegrations().getSchemaRegistry().getStatus().name())
        .isEqualTo("NOT_CONFIGURED");
  }

  private OperationsCenterService service(ClustersProperties properties) {
    return new OperationsCenterService(Mockito.mock(StatisticsCache.class), properties);
  }
}
