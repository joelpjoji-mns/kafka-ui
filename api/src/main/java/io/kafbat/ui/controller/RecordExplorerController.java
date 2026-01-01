package io.kafbat.ui.controller;

import static io.kafbat.ui.model.rbac.permission.TopicAction.MESSAGES_READ;

import io.kafbat.ui.api.RecordExplorerApi;
import io.kafbat.ui.model.KafkaCluster;
import io.kafbat.ui.model.RecordExplorerResponseDTO;
import io.kafbat.ui.model.rbac.AccessContext;
import io.kafbat.ui.service.TopicsService;
import io.kafbat.ui.service.explorer.RecordExplorerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
public class RecordExplorerController extends AbstractController implements RecordExplorerApi {

  private final TopicsService topicsService;
  private final RecordExplorerService recordExplorerService;

  @Override
  public Mono<ResponseEntity<RecordExplorerResponseDTO>> searchRecords(
      String clusterName,
      String query,
      String topic,
      Boolean includeInternal,
      Integer topicLimit,
      Integer perTopicSampleLimit,
      Integer resultLimit,
      ServerWebExchange exchange) {
    KafkaCluster cluster = getCluster(clusterName);
    var context = AccessContext.builder()
        .cluster(clusterName)
        .operationName("searchRecords")
        .build();
    RecordExplorerService.Limits limits = recordExplorerService.resolveLimits(
        topicLimit,
        perTopicSampleLimit,
        resultLimit);

    return validateAccess(context)
        .then(topicsService.getTopics(cluster, topic, Boolean.TRUE.equals(includeInternal), false))
        .flatMap(visibleTopics -> Flux.fromIterable(visibleTopics)
            .filterWhen(visibleTopic -> accessControlService.isTopicAccessible(
                visibleTopic.getName(), clusterName, MESSAGES_READ))
            .map(visibleTopic -> visibleTopic.getName())
            .collectList())
        .flatMap(visibleTopics -> recordExplorerService.search(cluster, visibleTopics, query, limits))
        .map(ResponseEntity::ok)
        .doOnEach(signal -> audit(context, signal));
  }
}