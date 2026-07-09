package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.kafbat.ui.model.TopicMessageDTO;
import io.kafbat.ui.service.MessagesService.DownloadFormat;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MessagesServiceDownloadFormatTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private TopicMessageDTO message(int partition, long offset, String key, String value,
                                  Map<String, String> headers) {
    return new TopicMessageDTO()
        .partition(partition)
        .offset(offset)
        .timestamp(OffsetDateTime.of(2024, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC))
        .key(key)
        .value(value)
        .headers(headers)
        .keySize(3L)
        .valueSize(5L)
        .keySerde("String")
        .valueSerde("String");
  }

  @Test
  void csvContainsHeaderRowAndEscapesSpecialCharacters() {
    var messages = List.of(
        message(0, 1L, "k1", "hello, \"world\"", Map.of("h", "v")),
        message(1, 2L, "k2", "line1\nline2", Map.of())
    );

    String csv = new String(
        MessagesService.serializeMessages("topicA", messages, DownloadFormat.CSV),
        StandardCharsets.UTF_8);

    String[] lines = csv.split("\r\n");
    assertThat(lines[0]).isEqualTo(
        "topic,partition,offset,timestamp,timestampType,key,value,headers,keySize,valueSize,keySerde,valueSerde");
    // value with comma + quote must be wrapped in quotes with inner quotes doubled
    assertThat(csv).contains("\"hello, \"\"world\"\"\"");
    // headers serialized as a JSON object, then CSV-escaped (inner quotes doubled)
    assertThat(csv).contains("\"{\"\"h\"\":\"\"v\"\"}\"");
    // an empty headers map needs no quoting
    assertThat(csv).contains(",{},");
    assertThat(lines[1]).startsWith("topicA,0,1,");
  }

  @Test
  void ndjsonEmitsOneJsonObjectPerLine() throws Exception {
    var messages = List.of(
        message(0, 1L, "k1", "v1", Map.of("h", "v")),
        message(2, 5L, "k2", "v2", Map.of())
    );

    String ndjson = new String(
        MessagesService.serializeMessages("topicB", messages, DownloadFormat.NDJSON),
        StandardCharsets.UTF_8);

    String[] lines = ndjson.strip().split("\n");
    assertThat(lines).hasSize(2);

    JsonNode first = MAPPER.readTree(lines[0]);
    assertThat(first.get("topic").asText()).isEqualTo("topicB");
    assertThat(first.get("partition").asInt()).isZero();
    assertThat(first.get("offset").asInt()).isEqualTo(1);
    assertThat(first.get("key").asText()).isEqualTo("k1");
    assertThat(first.get("value").asText()).isEqualTo("v1");
    assertThat(first.get("headers").get("h").asText()).isEqualTo("v");

    JsonNode second = MAPPER.readTree(lines[1]);
    assertThat(second.get("partition").asInt()).isEqualTo(2);
    assertThat(second.get("offset").asInt()).isEqualTo(5);
  }

  @Test
  void ndjsonForEmptyMessagesProducesEmptyOutput() {
    String ndjson = new String(
        MessagesService.serializeMessages("topicC", List.of(), DownloadFormat.NDJSON),
        StandardCharsets.UTF_8);
    assertThat(ndjson).isEmpty();
  }
}
