package io.kafbat.ui.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.kafbat.ui.model.ConsumerGroupOffsetsResetDTO;
import io.kafbat.ui.model.ConsumerGroupOffsetsResetTypeDTO;
import io.kafbat.ui.model.ConsumerGroupStateDTO;
import io.kafbat.ui.model.KafkaCluster;
import io.kafbat.ui.model.PartitionOffsetDTO;
import io.kafbat.ui.service.ClustersStorage;
import io.kafbat.ui.service.CooperativeOffsetResetService;
import io.kafbat.ui.service.CsvWriterService;
import io.kafbat.ui.service.OffsetsResetService;
import io.kafbat.ui.service.audit.AuditService;
import io.kafbat.ui.service.rbac.AccessControlService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.apache.kafka.common.ConsumerGroupState;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import reactor.core.publisher.Mono;

class ConsumerGroupsControllerCooperativeResetTest {

  @Test
  void sendsPreviewAdjustedOffsetsAndReturnsStableResult() {
    var offsetsResetService = Mockito.mock(OffsetsResetService.class);
    var cooperativeResetService = Mockito.mock(CooperativeOffsetResetService.class);
    var controller = new CooperativeConsumerGroupsController(
            offsetsResetService,
            cooperativeResetService);
    var clustersStorage = Mockito.mock(ClustersStorage.class);
    var accessControlService = Mockito.mock(AccessControlService.class);
    var auditService = Mockito.mock(AuditService.class);
    controller.setClustersStorage(clustersStorage);
    controller.setAccessControlService(accessControlService);
    controller.setAuditService(auditService);
    controller.setCsvWriterService(Mockito.mock(CsvWriterService.class));

    KafkaCluster cluster = KafkaCluster.builder().name("test").build();
    when(clustersStorage.getClusterByName("test")).thenReturn(Optional.of(cluster));
    when(accessControlService.validateAccess(Mockito.any())).thenReturn(Mono.empty());
    when(offsetsResetService.previewToOffsets(
        cluster,
        "orders-group",
        "orders",
        Map.of(0, 50L)))
        .thenReturn(Mono.just(new OffsetsResetService.OffsetResetPreview(List.of(
            new OffsetsResetService.OffsetResetPartitionPreview(
                0,
                8L,
                50L,
                10L,
                0L,
                10L,
                OffsetsResetService.OffsetResetImpact.SKIP,
                2L,
                true)))));
    when(cooperativeResetService.reset(
        cluster,
        "orders-group",
        "orders",
        Map.of(0, 10L)))
        .thenReturn(Mono.just(new CooperativeOffsetResetService.Result(
            "request-1",
            ConsumerGroupState.STABLE,
            List.of(new CooperativeOffsetResetService.PartitionResult(
                0,
                8L,
                10L,
                "member-1")))));
    var request = new ConsumerGroupOffsetsResetDTO()
        .topic("orders")
        .resetType(ConsumerGroupOffsetsResetTypeDTO.OFFSET)
        .partitionsOffsets(List.of(new PartitionOffsetDTO().partition(0).offset(50L)));

    var response = controller.cooperativeResetConsumerGroupOffsets(
        "test",
        "orders-group",
        Mono.just(request),
        null).block();

    assertThat(response).isNotNull();
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().getRequestId()).isEqualTo("request-1");
    assertThat(response.getBody().getGroupState()).isEqualTo(ConsumerGroupStateDTO.STABLE);
    assertThat(response.getBody().getPartitions()).singleElement().satisfies(partition -> {
      assertThat(partition.getPartition()).isZero();
      assertThat(partition.getPreviousOffset()).isEqualTo(8L);
      assertThat(partition.getTargetOffset()).isEqualTo(10L);
      assertThat(partition.getMemberId()).isEqualTo("member-1");
    });
    verify(cooperativeResetService).reset(
        cluster,
        "orders-group",
        "orders",
        Map.of(0, 10L));
  }
}