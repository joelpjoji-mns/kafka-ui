package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.kafbat.ui.model.CleanupPolicy;
import io.kafbat.ui.model.InternalPartition;
import io.kafbat.ui.model.InternalTopic;
import io.kafbat.ui.model.InternalTopicConfig;
import io.kafbat.ui.model.InternalTopicConsumerGroup;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.apache.kafka.common.ConsumerGroupState;
import org.junit.jupiter.api.Test;

class TopicDeveloperInsightsServiceTest {

  @Test
  void createsOperationalMetricsAndCriticalRecommendations() {
    InternalTopic topic =
        InternalTopic.builder()
            .name("orders")
            .internal(false)
            .replicas(1)
            .partitionCount(2)
            .inSyncReplicas(1)
            .replicationFactor(1)
            .underReplicatedPartitions(1)
            .partitions(
                Map.of(
                    0, partition(0, 0L, 100L),
                    1, partition(1, 0L, 20L)))
            .topicConfigs(
                List.of(
                    config("cleanup.policy", "delete"),
                    config("retention.ms", "86400000"),
                    config("retention.bytes", "-1"),
                    config("segment.ms", "3600000"),
                    config("segment.bytes", "1073741824"),
                    config("max.message.bytes", "1048576"),
                    config("compression.type", "zstd"),
                    config("min.insync.replicas", "1"),
                    config("unclean.leader.election.enable", "true")))
            .cleanUpPolicy(CleanupPolicy.DELETE)
            .bytesInPerSec(BigDecimal.valueOf(2048))
            .bytesOutPerSec(BigDecimal.valueOf(1024))
            .segmentSize(1024L)
            .segmentCount(10)
            .build();
    InternalTopicConsumerGroup consumer =
        InternalTopicConsumerGroup.builder()
            .groupId("orders-worker")
            .members(2)
            .consumerLag(20_000L)
            .isSimple(false)
            .partitionAssignor("range")
            .state(ConsumerGroupState.STABLE)
            .coordinator(null)
            .build();

    TopicDeveloperInsightsService.Insights insights =
        TopicDeveloperInsightsService.createInsights(topic, List.of(consumer), 3, 2);

    assertThat(insights.metrics()).hasSizeGreaterThanOrEqualTo(25);
    assertThat(insights.health()).isEqualTo(TopicDeveloperInsightsService.Health.CRITICAL);
    assertThat(insights.recommendations())
        .extracting(TopicDeveloperInsightsService.Recommendation::id)
        .contains("under-replicated", "single-replica", "unclean-election", "consumer-lag");
  }

  private InternalPartition partition(int id, long firstOffset, long lastOffset) {
    return InternalPartition.builder()
        .partition(id)
        .leader(id)
        .replicas(List.of())
        .inSyncReplicasCount(1)
        .replicasCount(1)
        .offsetMin(firstOffset)
        .offsetMax(lastOffset)
        .segmentSize(1024L)
        .segmentCount(1)
        .build();
  }

  private InternalTopicConfig config(String name, String value) {
    return InternalTopicConfig.builder()
        .name(name)
        .value(value)
        .defaultValue(value)
        .isReadOnly(false)
        .isSensitive(false)
        .synonyms(List.of())
        .build();
  }
}
