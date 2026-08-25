package io.kafbat.ui.cooperative;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.json.JsonMapper;

/** Encodes and decodes the language-neutral cooperative reset JSON protocol. */
public final class CooperativeResetJson {

  private static final JsonMapper MAPPER = JsonMapper.builder().build();

  private CooperativeResetJson() {
  }

  /**
   * Encodes a command.
   *
   * @param command command to encode
   * @return UTF-8 JSON bytes
   */
  public static byte[] writeCommand(CooperativeResetCommand command) {
    return write(command);
  }

  /**
   * Decodes and validates a command.
   *
   * @param value UTF-8 JSON bytes
   * @return decoded command
   * @throws IllegalArgumentException when the payload is malformed or unsupported
   */
  public static CooperativeResetCommand readCommand(byte[] value) {
    return read(value, CooperativeResetCommand.class);
  }

  /**
   * Encodes an acknowledgement.
   *
   * @param ack acknowledgement to encode
   * @return UTF-8 JSON bytes
   */
  public static byte[] writeAck(CooperativeResetAck ack) {
    return write(ack);
  }

  /**
   * Decodes and validates an acknowledgement.
   *
   * @param value UTF-8 JSON bytes
   * @return decoded acknowledgement
   * @throws IllegalArgumentException when the payload is malformed or unsupported
   */
  public static CooperativeResetAck readAck(byte[] value) {
    return read(value, CooperativeResetAck.class);
  }

  private static byte[] write(Object value) {
    try {
      return MAPPER.writeValueAsBytes(value);
    } catch (JsonProcessingException error) {
      throw new IllegalArgumentException("Unable to encode cooperative reset message", error);
    }
  }

  private static <T> T read(byte[] value, Class<T> type) {
    try {
      return MAPPER.readValue(value, type);
    } catch (Exception error) {
      throw new IllegalArgumentException("Unable to decode cooperative reset message", error);
    }
  }
}