package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

class ReactiveAdminClientPartitionCallsTest {

  @Test
  void respectsConfiguredConcurrencyWhenMergingBatches() {
    var inFlight = new AtomicInteger();
    var maximumInFlight = new AtomicInteger();

    StepVerifier.create(
            ReactiveAdminClient.partitionCalls(
                List.of(1, 2, 3, 4),
                1,
                2,
                batch -> delayedBatch(batch, inFlight, maximumInFlight),
                this::merge
            ))
        .assertNext(result -> assertThat(result).containsExactlyInAnyOrderEntriesOf(Map.of(
            1, 1,
            2, 2,
            3, 3,
            4, 4
        )))
        .verifyComplete();

    assertThat(maximumInFlight).hasValue(2);
  }

  private Mono<Map<Integer, Integer>> delayedBatch(
      Collection<Integer> batch,
      AtomicInteger inFlight,
      AtomicInteger maximumInFlight) {
    int currentInFlight = inFlight.incrementAndGet();
    maximumInFlight.accumulateAndGet(currentInFlight, Math::max);
    int item = batch.iterator().next();

    return Mono.delay(Duration.ofMillis(10))
        .thenReturn(Map.of(item, item))
      .doOnTerminate(inFlight::decrementAndGet);
  }

  private Map<Integer, Integer> merge(
      Map<Integer, Integer> first,
      Map<Integer, Integer> second) {
    var merged = new HashMap<>(first);
    merged.putAll(second);
    return merged;
  }
}