package io.kafbat.ui.service.sampling;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.Test;

class RecentTopicSamplerTest {

  @Test
  void dividesABoundedRecentSampleAcrossNonEmptyPartitions() {
    TopicPartition first = new TopicPartition("orders", 0);
    TopicPartition second = new TopicPartition("orders", 1);
    TopicPartition empty = new TopicPartition("orders", 2);

    Map<TopicPartition, Integer> quotas = RecentTopicSampler.recentSampleQuotas(
        Map.of(first, 10L, second, 15L, empty, 0L),
        Map.of(first, 110L, second, 19L, empty, 0L),
        12);

    assertThat(quotas).containsEntry(first, 4).containsEntry(second, 4);
    assertThat(quotas).doesNotContainKey(empty);
  }

  @Test
  void rejectsEmptySamplingPlans() {
    assertThat(RecentTopicSampler.recentSampleQuotas(Map.of(), Map.of(), 25)).isEmpty();
    assertThat(RecentTopicSampler.recentSampleQuotas(Map.of(), Map.of(), 0)).isEmpty();
  }
}