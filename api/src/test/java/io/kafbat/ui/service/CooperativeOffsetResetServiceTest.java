package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.kafbat.ui.config.CooperativeOffsetResetProperties;
import io.kafbat.ui.cooperative.CooperativeResetCommand;
import io.kafbat.ui.exception.ValidationException;
import io.kafbat.ui.model.KafkaCluster;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.kafka.clients.admin.ConsumerGroupDescription;
import org.apache.kafka.clients.admin.MemberAssignment;
import org.apache.kafka.clients.admin.MemberDescription;
import org.apache.kafka.common.ConsumerGroupState;
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import reactor.test.StepVerifier;

class CooperativeOffsetResetServiceTest {

  @Test
  void createsPrepareCommandForOneCurrentPartitionOwner() {
    String topic = "orders";
    ConsumerGroupDescription group = new ConsumerGroupDescription(
        "orders-group",
        false,
        List.of(member("member-a", Set.of(
            new TopicPartition(topic, 0),
            new TopicPartition(topic, 1)))),
        "range",
        ConsumerGroupState.STABLE,
        null);

    var commands = CooperativeOffsetResetService.commandsFor(
        "request",
        group,
        topic,
        Map.of(0, 10L, 1, 20L),
        100L,
        200L);

    assertThat(commands).singleElement().satisfies(command -> {
      assertThat(command.action()).isEqualTo(CooperativeResetCommand.Action.PREPARE);
      assertThat(command.targetMemberId()).isEqualTo("member-a");
      assertThat(command.offsets()).containsExactlyInAnyOrderEntriesOf(
          Map.of(0, 10L, 1, 20L));
    });
  }

  @Test
  void rejectsPartitionsOwnedByMultipleMembers() {
    String topic = "orders";
    ConsumerGroupDescription group = new ConsumerGroupDescription(
        "orders-group",
        false,
        List.of(
            member("member-a", Set.of(new TopicPartition(topic, 0))),
            member("member-b", Set.of(new TopicPartition(topic, 1)))),
        "range",
        ConsumerGroupState.STABLE,
        null);

    assertThatThrownBy(() -> CooperativeOffsetResetService.commandsFor(
        "request",
        group,
        topic,
        Map.of(0, 10L, 1, 20L),
        100L,
        200L))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("one consumer member");
  }

  @Test
  void rejectsRequestsWhenFeatureIsDisabled() {
    var properties = new CooperativeOffsetResetProperties();
    var service = new CooperativeOffsetResetService(
        Mockito.mock(AdminClientService.class),
        properties);

    StepVerifier.create(service.reset(
            KafkaCluster.builder().name("test").build(),
            "group",
            "topic",
            Map.of(0, 1L)))
        .expectErrorSatisfies(error -> assertThat(error)
            .isInstanceOf(ValidationException.class)
            .hasMessageContaining("disabled"))
        .verify();
  }

  private MemberDescription member(String memberId, Set<TopicPartition> assignment) {
    return new MemberDescription(
        memberId,
        null,
        "client-" + memberId,
        "host",
        new MemberAssignment(assignment));
  }
}