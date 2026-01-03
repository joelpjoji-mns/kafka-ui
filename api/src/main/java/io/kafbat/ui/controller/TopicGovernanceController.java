package io.kafbat.ui.controller;

import io.kafbat.ui.api.TopicGovernanceAdvisorApi;
import io.kafbat.ui.model.InternalTopic;
import io.kafbat.ui.model.KafkaCluster;
import io.kafbat.ui.model.Statistics;
import io.kafbat.ui.model.TopicGovernanceReportDTO;
import io.kafbat.ui.model.rbac.AccessContext;
import io.kafbat.ui.service.TopicGovernanceService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
public class TopicGovernanceController extends AbstractController
    implements TopicGovernanceAdvisorApi {

  private final TopicGovernanceService topicGovernanceService;

  @Override
  public Mono<ResponseEntity<TopicGovernanceReportDTO>> getTopicGovernanceReport(
      String clusterName,
      Boolean includeInternal,
      ServerWebExchange exchange) {
    KafkaCluster cluster = getCluster(clusterName);
    Statistics statistics = topicGovernanceService.getStatistics(cluster);
    boolean resolvedIncludeInternal = Boolean.TRUE.equals(includeInternal);
    AccessContext context = AccessContext.builder()
        .cluster(clusterName)
        .operationName("getTopicGovernanceReport")
        .build();
    List<InternalTopic> requestedTopics = topicGovernanceService.getTopics(
        statistics,
        resolvedIncludeInternal);

    return validateAccess(context)
        .then(accessControlService.filterViewableTopics(requestedTopics, clusterName))
        .map(visibleTopics -> topicGovernanceService.report(
            statistics,
            visibleTopics,
            resolvedIncludeInternal))
        .map(ResponseEntity::ok)
        .doOnEach(signal -> audit(context, signal));
  }
}