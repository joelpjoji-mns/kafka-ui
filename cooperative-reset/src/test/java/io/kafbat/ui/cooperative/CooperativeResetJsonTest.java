package io.kafbat.ui.cooperative;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class CooperativeResetJsonTest {

  @Test
  void roundTripsCommandsAndAcknowledgements() {
    CooperativeResetCommand command = new CooperativeResetCommand(
        1, "request", "command", CooperativeResetCommand.Action.PREPARE,
        "group", "member", "orders",
        Map.of(0, 12L), 100L, 200L);
    CooperativeResetAck ack = new CooperativeResetAck(
        1, "request", "command", "group", "member", 3,
        CooperativeResetAck.Status.PREPARED,
        Map.of(0, 20L), Map.of(0, 12L), 150L, null);

    assertThat(CooperativeResetJson.readCommand(CooperativeResetJson.writeCommand(command)))
        .isEqualTo(command);
    assertThat(CooperativeResetJson.readAck(CooperativeResetJson.writeAck(ack)))
        .isEqualTo(ack);
  }
}