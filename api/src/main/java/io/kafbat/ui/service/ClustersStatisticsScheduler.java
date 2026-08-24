package io.kafbat.ui.service;

import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
@Slf4j
public class ClustersStatisticsScheduler {

  private final ClustersStorage clustersStorage;

  private final StatisticsService statisticsService;

  private final int updateMetricsConcurrency;

  private final AtomicBoolean updateInProgress = new AtomicBoolean();

  public ClustersStatisticsScheduler(
      ClustersStorage clustersStorage,
      StatisticsService statisticsService,
      @Value("${kafka.update-metrics-concurrency:4}") int updateMetricsConcurrency) {
    if (updateMetricsConcurrency < 1) {
      throw new IllegalArgumentException("kafka.update-metrics-concurrency must be at least 1");
    }
    this.clustersStorage = clustersStorage;
    this.statisticsService = statisticsService;
    this.updateMetricsConcurrency = updateMetricsConcurrency;
  }

  @Scheduled(fixedRateString = "${kafka.update-metrics-rate-millis:30000}")
  public void updateStatistics() {
    if (!updateInProgress.compareAndSet(false, true)) {
      log.warn("Skipping cluster statistics refresh because the previous refresh is still running");
      return;
    }

    try {
      Flux.fromIterable(clustersStorage.getKafkaClusters())
          .flatMap(cluster -> {
            log.debug("Start getting metrics for kafkaCluster: {}", cluster.getName());
            return statisticsService.updateCache(cluster)
                .doOnSuccess(m -> log.debug("Metrics updated for cluster: {}", cluster.getName()))
                .onErrorResume(error -> {
                  log.warn("Failed to update metrics for kafkaCluster: {}", cluster.getName(), error);
                  return Mono.empty();
                });
          }, updateMetricsConcurrency)
          .then()
          .block();
    } finally {
      updateInProgress.set(false);
    }
  }
}
