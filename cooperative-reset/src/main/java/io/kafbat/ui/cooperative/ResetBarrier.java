package io.kafbat.ui.cooperative;

import java.util.Set;
import org.apache.kafka.common.TopicPartition;

/** Waits until application work already fetched for target partitions is complete. */
@FunctionalInterface
public interface ResetBarrier {

  /**
   * Blocks the poll thread until older work cannot commit over the reset.
   *
   * @param partitions partitions being reset
   * @throws Exception when pending work cannot be drained safely
   */
  void awaitDrained(Set<TopicPartition> partitions) throws Exception;

  /**
   * Returns a barrier for consumers that process each poll synchronously.
   *
   * @return no-op barrier
   */
  static ResetBarrier noOp() {
    return ignored -> { };
  }
}