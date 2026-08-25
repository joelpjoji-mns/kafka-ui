package io.kafbat.ui.cooperative;

import java.util.Map;
import java.util.Objects;

/**
 * The consumer member's result after applying or rejecting a cooperative reset command.
 *
 * @param protocolVersion protocol schema version
 * @param requestId originating operator request ID
 * @param commandId command being acknowledged
 * @param groupId target consumer group
 * @param memberId member that handled the command
 * @param generationId consumer group generation that handled the command
 * @param status applied or rejected status
 * @param previousOffsets committed offsets before the command
 * @param appliedOffsets offsets committed by an applied command
 * @param completedAtEpochMs completion time
 * @param message rejection detail, or {@code null} for an applied command
 */
public record CooperativeResetAck(
    int protocolVersion,
    String requestId,
    String commandId,
    String groupId,
    String memberId,
    int generationId,
    Status status,
    Map<Integer, Long> previousOffsets,
    Map<Integer, Long> appliedOffsets,
    long completedAtEpochMs,
    String message) {

  /** Result status reported by a cooperating consumer. */
  public enum Status {
    /** The consumer committed and sought to every target offset and remains paused. */
    PREPARED,
    /** The coordinator verified the prepared state and the consumer resumed. */
    APPLIED,
    /** The consumer restored its previous committed offsets and positions. */
    ROLLED_BACK,
    /** The consumer made no successful reset and reported a reason. */
    REJECTED
  }

  /**
   * Validates and creates a cooperative reset acknowledgement.
   */
  public CooperativeResetAck {
    if (protocolVersion != CooperativeResetCommand.CURRENT_PROTOCOL_VERSION) {
      throw new IllegalArgumentException("Unsupported cooperative reset protocol version");
    }
    Objects.requireNonNull(requestId, "requestId");
    Objects.requireNonNull(commandId, "commandId");
    Objects.requireNonNull(groupId, "groupId");
    Objects.requireNonNull(memberId, "memberId");
    Objects.requireNonNull(status, "status");
    previousOffsets = Map.copyOf(Objects.requireNonNull(previousOffsets, "previousOffsets"));
    appliedOffsets = Map.copyOf(Objects.requireNonNull(appliedOffsets, "appliedOffsets"));
  }
}