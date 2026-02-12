package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.kafbat.ui.model.TopicMessageDTO;
import io.kafbat.ui.model.TopicMessageEventDTO;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class MessagesServiceTimestampRangeTest {

  @Test
  void keepsOnlyMessageEventsAtOrBeforeTheSelectedEndTimestamp() {
    long endTimestamp = OffsetDateTime.of(2024, 1, 1, 12, 0, 0, 0, ZoneOffset.UTC)
        .toInstant()
        .toEpochMilli();

    TopicMessageEventDTO beforeEnd = messageAt("2024-01-01T11:59:59Z");
    TopicMessageEventDTO atEnd = messageAt("2024-01-01T12:00:00Z");
    TopicMessageEventDTO afterEnd = messageAt("2024-01-01T12:00:01Z");
    TopicMessageEventDTO consuming = new TopicMessageEventDTO()
        .type(TopicMessageEventDTO.TypeEnum.CONSUMING);

    assertThat(MessagesService.isEventWithinTimestampUpperBound(beforeEnd, endTimestamp)).isTrue();
    assertThat(MessagesService.isEventWithinTimestampUpperBound(atEnd, endTimestamp)).isTrue();
    assertThat(MessagesService.isEventWithinTimestampUpperBound(afterEnd, endTimestamp)).isFalse();
    assertThat(MessagesService.isEventWithinTimestampUpperBound(consuming, endTimestamp)).isTrue();
  }

  private TopicMessageEventDTO messageAt(String timestamp) {
    return new TopicMessageEventDTO()
        .type(TopicMessageEventDTO.TypeEnum.MESSAGE)
        .message(new TopicMessageDTO().timestamp(OffsetDateTime.parse(timestamp)));
  }
}