package io.kafbat.ui.cooperative;

import java.util.Map;
import java.util.Objects;

/**
 * A versioned offset reset command targeted to the current owner of one or more partitions.
 *
 * @param protocolVersion protocol schema version
 * @param requestId ID shared by all commands in one operator request
 * @param commandId unique ID for this owning member's command
 * @param action protocol phase to execute
 * @param groupId target consumer group
 * @param targetMemberId current Kafka member ID that must apply the command
 * @param topic target data topic
 * @param offsets partition-to-offset targets
 * @param issuedAtEpochMs command creation time
 * @param expiresAtEpochMs time after which the command must be rejected
 */
public record CooperativeResetCommand(
    int protocolVersion,
    String requestId,
    String commandId,
    Action action,
    String groupId,
    String targetMemberId,
    String topic,
    Map<Integer, Long> offsets,
    long issuedAtEpochMs,
    long expiresAtEpochMs) {

  public static final int CURRENT_PROTOCOL_VERSION = 1;

  /** Coordinator action for one phase of the reset protocol. */
  public enum Action {
    /** Pause, drain, seek, and commit, but keep target partitions paused. */
    PREPARE,
    /** Resume a successfully verified prepared reset. */
    FINALIZE,
    /** Restore offsets and positions captured by the prepared reset. */
    ROLLBACK
  }

  /**
   * Validates and creates a cooperative reset command.
   */
  public CooperativeResetCommand {
    if (protocolVersion != CURRENT_PROTOCOL_VERSION) {
      throw new IllegalArgumentException("Unsupported cooperative reset protocol version");
    }
    Objects.requireNonNull(requestId, "requestId");
    Objects.requireNonNull(commandId, "commandId");
    Objects.requireNonNull(action, "action");
    Objects.requireNonNull(groupId, "groupId");
    Objects.requireNonNull(targetMemberId, "targetMemberId");
    Objects.requireNonNull(topic, "topic");
    offsets = Map.copyOf(Objects.requireNonNull(offsets, "offsets"));
    if (offsets.isEmpty()) {
      throw new IllegalArgumentException("At least one offset is required");
    }
    if (expiresAtEpochMs <= issuedAtEpochMs) {
      throw new IllegalArgumentException("expiresAtEpochMs must be after issuedAtEpochMs");
    }
  }
}