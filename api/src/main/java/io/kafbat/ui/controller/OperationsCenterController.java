package io.kafbat.ui.controller;

import io.kafbat.ui.api.OperationsCenterApi;
import io.kafbat.ui.model.InternalTopic;
import io.kafbat.ui.model.KafkaCluster;
import io.kafbat.ui.model.OperationsCenterSnapshotDTO;
import io.kafbat.ui.model.Statistics;
import io.kafbat.ui.model.rbac.AccessContext;
import io.kafbat.ui.service.OperationsCenterService;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
public class OperationsCenterController extends AbstractController implements OperationsCenterApi {

  private final OperationsCenterService operationsCenterService;

  @Override
  public Mono<ResponseEntity<OperationsCenterSnapshotDTO>> getOperationsCenter(
      String clusterName,
      Integer limit,
      Boolean includeInternal,
      ServerWebExchange exchange) {
    KafkaCluster cluster = getCluster(clusterName);
    Statistics statistics = operationsCenterService.getStatistics(cluster);
    int resolvedLimit = operationsCenterService.resolveLimit(limit);
    boolean resolvedIncludeInternal = Boolean.TRUE.equals(includeInternal);
    var context = AccessContext.builder()
        .cluster(clusterName)
        .operationName("getOperationsCenter")
        .build();
    List<InternalTopic> requestedTopics = operationsCenterService.getTopics(
        statistics,
        resolvedIncludeInternal);

    return validateAccess(context)
        .then(accessControlService.filterViewableTopics(requestedTopics, clusterName))
        .flatMap(visibleTopics -> visibleConsumerGroups(statistics, clusterName)
            .map(visibleGroups -> operationsCenterService.snapshot(
                cluster,
                statistics,
                visibleTopics,
                visibleGroups,
                resolvedLimit)))
        .map(ResponseEntity::ok)
        .doOnEach(signal -> audit(context, signal));
  }

  private Mono<Set<String>> visibleConsumerGroups(Statistics statistics, String clusterName) {
    return Flux.fromIterable(statistics.getClusterState().getConsumerGroupsStates().values())
        .filterWhen(group -> accessControlService.isConsumerGroupAccessible(group.group(), clusterName))
        .map(group -> group.group())
        .collect(Collectors.toSet());
  }
}