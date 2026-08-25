package io.kafbat.ui.controller;

import static io.kafbat.ui.model.rbac.permission.ConsumerGroupAction.RESET_OFFSETS;
import static java.util.stream.Collectors.toMap;

import io.kafbat.ui.api.CooperativeConsumerGroupsApi;
import io.kafbat.ui.exception.ValidationException;
import io.kafbat.ui.model.ConsumerGroupOffsetsResetDTO;
import io.kafbat.ui.model.ConsumerGroupStateDTO;
import io.kafbat.ui.model.CooperativeConsumerGroupOffsetsResetPartitionDTO;
import io.kafbat.ui.model.CooperativeConsumerGroupOffsetsResetResponseDTO;
import io.kafbat.ui.model.PartitionOffsetDTO;
import io.kafbat.ui.model.rbac.AccessContext;
import io.kafbat.ui.model.rbac.permission.TopicAction;
import io.kafbat.ui.service.CooperativeOffsetResetService;
import io.kafbat.ui.service.OffsetsResetService;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.util.CollectionUtils;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
public class CooperativeConsumerGroupsController
    extends AbstractController implements CooperativeConsumerGroupsApi {

  private final OffsetsResetService offsetsResetService;
  private final CooperativeOffsetResetService cooperativeOffsetResetService;

  @Override
  public Mono<ResponseEntity<CooperativeConsumerGroupOffsetsResetResponseDTO>>
      cooperativeResetConsumerGroupOffsets(
          String clusterName,
          String group,
          Mono<ConsumerGroupOffsetsResetDTO> resetDto,
          ServerWebExchange exchange) {
    return resetDto.flatMap(reset -> {
      var context = AccessContext.builder()
          .cluster(clusterName)
          .topicActions(reset.getTopic(), TopicAction.VIEW)
          .consumerGroupActions(group, RESET_OFFSETS)
          .operationName("cooperativeResetConsumerGroupOffsets")
          .build();
      var cluster = getCluster(clusterName);

      return validateAccess(context)
          .then(Mono.defer(() -> previewResetOffsets(clusterName, group, reset)))
          .flatMap(preview -> cooperativeOffsetResetService.reset(
              cluster,
              group,
              reset.getTopic(),
              preview.partitions().stream().collect(toMap(
                  OffsetsResetService.OffsetResetPartitionPreview::partition,
                  OffsetsResetService.OffsetResetPartitionPreview::targetOffset))))
          .map(this::toResponse)
          .map(ResponseEntity::ok)
          .doOnEach(signal -> audit(context, signal));
    });
  }

  private Mono<OffsetsResetService.OffsetResetPreview> previewResetOffsets(
      String clusterName,
      String group,
      ConsumerGroupOffsetsResetDTO reset) {
    var cluster = getCluster(clusterName);
    return switch (reset.getResetType()) {
      case EARLIEST -> offsetsResetService.previewToEarliest(
          cluster, group, reset.getTopic(), reset.getPartitions());
      case LATEST -> offsetsResetService.previewToLatest(
          cluster, group, reset.getTopic(), reset.getPartitions());
      case TIMESTAMP -> {
        if (reset.getResetToTimestamp() == null) {
          yield Mono.error(new ValidationException(
              "resetToTimestamp is required when TIMESTAMP reset type used"));
        }
        yield offsetsResetService.previewToTimestamp(
            cluster,
            group,
            reset.getTopic(),
            reset.getPartitions(),
            reset.getResetToTimestamp());
      }
      case OFFSET -> offsetsResetService.previewToOffsets(
          cluster, group, reset.getTopic(), resetOffsets(reset));
    };
  }

  private Map<Integer, Long> resetOffsets(ConsumerGroupOffsetsResetDTO reset) {
    if (CollectionUtils.isEmpty(reset.getPartitionsOffsets())) {
      throw new ValidationException("partitionsOffsets is required when OFFSET reset type used");
    }
    return reset.getPartitionsOffsets().stream()
        .collect(toMap(
            PartitionOffsetDTO::getPartition,
            offset -> Optional.ofNullable(offset.getOffset()).orElse(0L)));
  }

  private CooperativeConsumerGroupOffsetsResetResponseDTO toResponse(
      CooperativeOffsetResetService.Result result) {
    return new CooperativeConsumerGroupOffsetsResetResponseDTO()
        .requestId(result.requestId())
        .groupState(ConsumerGroupStateDTO.valueOf(result.groupState().name()))
        .partitions(result.partitions().stream()
            .map(this::toPartition)
            .toList());
  }

  private CooperativeConsumerGroupOffsetsResetPartitionDTO toPartition(
      CooperativeOffsetResetService.PartitionResult partition) {
    return new CooperativeConsumerGroupOffsetsResetPartitionDTO()
        .partition(partition.partition())
        .previousOffset(partition.previousOffset())
        .targetOffset(partition.targetOffset())
        .memberId(partition.memberId());
  }
}