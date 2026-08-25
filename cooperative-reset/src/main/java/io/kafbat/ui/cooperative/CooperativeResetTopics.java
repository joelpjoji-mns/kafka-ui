package io.kafbat.ui.cooperative;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Derives isolated control topics for one consumer group.
 *
 * @param commandTopic topic from which cooperating consumers receive commands
 * @param acknowledgementTopic topic to which cooperating consumers publish results
 */
public record CooperativeResetTopics(String commandTopic, String acknowledgementTopic) {

  /**
   * Derives deterministic topic names without embedding a possibly sensitive group ID.
   *
   * @param commandTopicPrefix command topic prefix
   * @param acknowledgementTopicPrefix acknowledgement topic prefix
   * @param groupId consumer group ID
   * @return per-group topic names
   */
  public static CooperativeResetTopics forGroup(
      String commandTopicPrefix,
      String acknowledgementTopicPrefix,
      String groupId) {
    String suffix = digest(groupId).substring(0, 24);
    return new CooperativeResetTopics(
        commandTopicPrefix + "-" + suffix,
        acknowledgementTopicPrefix + "-" + suffix);
  }

  private static String digest(String value) {
    try {
      return java.util.HexFormat.of().formatHex(
          MessageDigest.getInstance("SHA-256")
              .digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 is unavailable", error);
    }
  }
}