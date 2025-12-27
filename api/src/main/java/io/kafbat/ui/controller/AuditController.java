package io.kafbat.ui.controller;

import io.kafbat.ui.api.AuditApi;
import io.kafbat.ui.model.AuditTrailResponseDTO;
import io.kafbat.ui.model.rbac.AccessContext;
import io.kafbat.ui.model.rbac.permission.AuditAction;
import io.kafbat.ui.service.audit.AuditTrailService;
import java.time.OffsetDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
public class AuditController extends AbstractController implements AuditApi {

  private final AuditTrailService auditTrailService;

  @Override
  public Mono<ResponseEntity<AuditTrailResponseDTO>> getAuditTrail(String clusterName,
                                                                    OffsetDateTime from,
                                                                    OffsetDateTime to,
                                                                    String resource,
                                                                    String operation,
                                                                    String outcome,
                                                                    String cursor,
                                                                    Integer limit,
                                                                    ServerWebExchange exchange) {
    var context = AccessContext.builder()
        .cluster(clusterName)
        .auditActions(AuditAction.VIEW)
        .operationName("getAuditTrail")
        .build();
    var query = new AuditTrailService.Query(from, to, resource, operation, outcome, cursor, limit);

    return validateAccess(context)
        .then(auditTrailService.getAuditTrail(getCluster(clusterName), query))
        .map(ResponseEntity::ok)
        .doOnEach(signal -> audit(context, signal));
  }
}