package io.kafbat.ui.service.profile;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.kafbat.ui.model.TopicDataProfileJsonTypeDTO;
import io.kafbat.ui.service.sampling.RecentTopicSampler;
import java.nio.charset.StandardCharsets;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.utils.Bytes;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class TopicDataProfileAccumulatorTest {

  @Test
  void summarizesAggregateSizeHeaderAndJsonShapeEvidence() {
    final TopicDataProfileAccumulator accumulator =
        new TopicDataProfileAccumulator(new ObjectMapper());
    ConsumerRecord<Bytes, Bytes> first =
        record(0, "key-1", "{\"id\":1,\"active\":true,\"meta\":{\"region\":\"eu\"}}");
    first.headers().add("source", bytes("import"));
    ConsumerRecord<Bytes, Bytes> second =
        record(1, null, "{\"id\":\"two\",\"active\":false,\"note\":null}");
    second.headers().add("source", bytes("api"));
    second.headers().add("region", bytes("eu"));

    accumulator.apply(first);
    accumulator.apply(second);

    var profile = accumulator.toDto(250, 3);

    assertThat(profile.getSampled()).isTrue();
    assertThat(profile.getSampledRecords()).isEqualTo(2);
    assertThat(profile.getSampledPartitions()).isEqualTo(2);
    assertThat(profile.getKey().getPresentCount()).isEqualTo(1);
    assertThat(profile.getKey().getNullCount()).isEqualTo(1);
    assertThat(profile.getValue().getSize().getObservedCount()).isEqualTo(2);
    assertThat(profile.getHeaders().getRecordsWithHeaders()).isEqualTo(2);
    assertThat(profile.getHeaders().getTotalHeaders()).isEqualTo(3);
    assertThat(profile.getHeaders().getNames())
        .extracting(header -> header.getName() + ":" + header.getOccurrenceCount())
        .containsExactly("source:2", "region:1");
    assertThat(profile.getJson().getParsedValueCount()).isEqualTo(2);
    assertThat(profile.getJson().getObjectValueCount()).isEqualTo(2);
    assertThat(profile.getJson().getTopLevelFields())
        .filteredOn(field -> field.getName().equals("id"))
        .singleElement()
        .satisfies(
            field ->
                assertThat(field.getTypes())
                    .contains(
                        TopicDataProfileJsonTypeDTO.NUMBER, TopicDataProfileJsonTypeDTO.STRING));
  }

  @Test
  void boundsRequestedSampleLimit() {
    TopicDataProfileService service =
        new TopicDataProfileService(Mockito.mock(RecentTopicSampler.class), new ObjectMapper());

    assertThat(service.resolveSampleLimit(null)).isEqualTo(250);
    assertThat(service.resolveSampleLimit(1)).isEqualTo(25);
    assertThat(service.resolveSampleLimit(500)).isEqualTo(500);
    assertThat(service.resolveSampleLimit(5_000)).isEqualTo(1_000);
  }

  private ConsumerRecord<Bytes, Bytes> record(int partition, String key, String value) {
    return new ConsumerRecord<>(
        "orders",
        partition,
        0,
        key == null ? null : Bytes.wrap(bytes(key)),
        Bytes.wrap(bytes(value)));
  }

  private byte[] bytes(String value) {
    return value.getBytes(StandardCharsets.UTF_8);
  }
}
