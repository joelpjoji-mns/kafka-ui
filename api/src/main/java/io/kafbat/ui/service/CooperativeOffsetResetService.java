package io.kafbat.ui.service;

import io.kafbat.ui.config.CooperativeOffsetResetProperties;
import io.kafbat.ui.cooperative.CooperativeResetAck;
import io.kafbat.ui.cooperative.CooperativeResetCommand;
import io.kafbat.ui.cooperative.CooperativeResetJson;
import io.kafbat.ui.cooperative.CooperativeResetTopics;
import io.kafbat.ui.exception.NotFoundException;
import io.kafbat.ui.exception.ValidationException;
import io.kafbat.ui.model.KafkaCluster;
import io.kafbat.ui.util.KafkaClientSslPropertiesUtil;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.admin.ConsumerGroupDescription;
import org.apache.kafka.clients.admin.MemberDescription;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.ConsumerGroupState;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Service
@RequiredArgsConstructor
public class CooperativeOffsetResetService {

  private static final Duration ACK_POLL_INTERVAL = Duration.ofMillis(250);
  private static final Map<String, Object> COMMAND_PRODUCER_PROPERTIES = Map.of(
      ProducerConfig.ACKS_CONFIG, "all",
      ProducerConfig.COMPRESSION_TYPE_CONFIG, "gzip");

  private final AdminClientService adminClientService;
  private final CooperativeOffsetResetProperties properties;
  private final Map<String, ReentrantLock> groupLocks = new ConcurrentHashMap<>();

  public Mono<Result> reset(
      KafkaCluster cluster,
      String groupId,
      String topic,
      Map<Integer, Long> offsets) {
    return Mono.fromCallable(() -> resetBlocking(cluster, groupId, topic, offsets))
        .subscribeOn(Schedulers.boundedElastic());
  }

  private Result resetBlocking(
      KafkaCluster cluster,
      String groupId,
      String topic,
      Map<Integer, Long> offsets) {
    requireEnabled();
    if (offsets.isEmpty()) {
      throw new ValidationException("At least one partition offset is required");
    }

    String lockKey = cluster.getName() + "\u0000" + groupId;
    ReentrantLock lock = groupLocks.computeIfAbsent(lockKey, ignored -> new ReentrantLock());
    if (!lock.tryLock()) {
      throw new ValidationException(
          "Another cooperative offset reset is already running for this consumer group");
    }
    try {
      return resetLocked(cluster, groupId, topic, offsets);
    } finally {
      lock.unlock();
      groupLocks.remove(lockKey, lock);
    }
  }

  private Result resetLocked(
      KafkaCluster cluster,
      String groupId,
      String topic,
      Map<Integer, Long> offsets) {
    long deadlineNanos = System.nanoTime() + properties.getTimeout().toNanos();

    ReactiveAdminClient adminClient = Objects.requireNonNull(
        adminClientService.get(cluster).block(remaining(deadlineNanos)),
        "Admin client is unavailable");
    CooperativeResetTopics resetTopics = CooperativeResetTopics.forGroup(
        properties.getCommandTopic(),
        properties.getAcknowledgementTopic(),
        groupId);
    ensureTopics(adminClient, resetTopics, deadlineNanos);
    ConsumerGroupDescription group = describeGroup(adminClient, groupId);
    requireStable(group);

    String requestId = UUID.randomUUID().toString();
    long issuedAt = System.currentTimeMillis();
    List<CooperativeResetCommand> commands = commandsFor(
        requestId,
        group,
        topic,
        offsets,
        issuedAt,
        issuedAt + remaining(deadlineNanos).toMillis());
    CooperativeResetCommand prepareCommand = commands.getFirst();
    CooperativeResetAck preparedAck = null;

    try (KafkaConsumer<byte[], byte[]> ackConsumer = acknowledgementConsumer(cluster);
         KafkaProducer<byte[], byte[]> commandProducer =
             MessagesService.createProducer(cluster, COMMAND_PRODUCER_PROPERTIES)) {
      prepareAcknowledgementConsumer(
          ackConsumer,
          resetTopics.acknowledgementTopic(),
          deadlineNanos);
      try {
        publishCommand(
            commandProducer,
            resetTopics.commandTopic(),
            prepareCommand,
            deadlineNanos);
        preparedAck = awaitAcknowledgement(
            ackConsumer,
            prepareCommand,
            CooperativeResetAck.Status.PREPARED,
            deadlineNanos);
        verifyPrepared(adminClient, groupId, topic, offsets, group, prepareCommand, preparedAck);

        CooperativeResetCommand finalizeCommand = phaseCommand(
            prepareCommand,
            CooperativeResetCommand.Action.FINALIZE);
        publishCommand(
            commandProducer,
            resetTopics.commandTopic(),
            finalizeCommand,
            deadlineNanos);
        CooperativeResetAck appliedAck = awaitAcknowledgement(
            ackConsumer,
            finalizeCommand,
            CooperativeResetAck.Status.APPLIED,
            deadlineNanos);
        verifyFinalized(adminClient, groupId, group, preparedAck, appliedAck);
        return result(requestId, prepareCommand, preparedAck);
      } catch (RuntimeException error) {
        rollbackBestEffort(
            commandProducer,
            ackConsumer,
            resetTopics.commandTopic(),
            prepareCommand,
            preparedAck,
            deadlineNanos);
        throw error;
      }
    }
  }

  private void requireEnabled() {
    if (!properties.isEnabled()) {
      throw new ValidationException(
          "Cooperative offset reset is disabled. Enable cooperative-offset-reset.enabled "
              + "after integrating the consumer adapter.");
    }
  }

  private synchronized void ensureTopics(
      ReactiveAdminClient adminClient,
      CooperativeResetTopics resetTopics,
      long deadlineNanos) {
    Set<String> topicNames = Set.of(
        resetTopics.commandTopic(),
        resetTopics.acknowledgementTopic());
    Set<String> existing = new HashSet<>(Objects.requireNonNull(
        adminClient.listTopics(true).block(remaining(deadlineNanos)),
        "Unable to list Kafka topics"));
    Set<String> missing = new HashSet<>(topicNames);
    missing.removeAll(existing);
    if (missing.isEmpty()) {
      return;
    }
    if (!properties.isAutoCreateTopics()) {
      throw new ValidationException(
          "Cooperative reset topics do not exist: " + String.join(", ", missing));
    }
    for (String topic : missing) {
      adminClient.createTopic(
          topic,
          properties.getTopicPartitions(),
          null,
          properties.getTopicProperties()).block(remaining(deadlineNanos));
    }
  }

  private ConsumerGroupDescription describeGroup(
      ReactiveAdminClient adminClient,
      String groupId) {
    Map<String, ConsumerGroupDescription> descriptions = Objects.requireNonNull(
        adminClient.describeConsumerGroups(List.of(groupId)).block(properties.getTimeout()),
        "Unable to describe consumer group");
    ConsumerGroupDescription description = descriptions.get(groupId);
    if (description == null) {
      throw new NotFoundException("Consumer group not found");
    }
    return description;
  }

  private void requireStable(ConsumerGroupDescription group) {
    if (group.state() != ConsumerGroupState.STABLE) {
      throw new ValidationException(
          "Cooperative offset reset requires a STABLE consumer group, but group is in "
              + group.state().name() + " state");
    }
  }

  static List<CooperativeResetCommand> commandsFor(
      String requestId,
      ConsumerGroupDescription group,
      String topic,
      Map<Integer, Long> offsets,
      long issuedAt,
      long expiresAt) {
    Map<TopicPartition, MemberDescription> owners = group.members().stream()
        .flatMap(member -> member.assignment().topicPartitions().stream()
            .map(partition -> Map.entry(partition, member)))
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    Map<String, Map<Integer, Long>> offsetsByMember = new HashMap<>();
    for (Map.Entry<Integer, Long> offset : offsets.entrySet()) {
      TopicPartition partition = new TopicPartition(topic, offset.getKey());
      MemberDescription owner = owners.get(partition);
      if (owner == null) {
        throw new ValidationException(
            "No active consumer owns partition " + partition);
      }
      offsetsByMember.computeIfAbsent(owner.consumerId(), ignored -> new HashMap<>())
          .put(offset.getKey(), offset.getValue());
    }
    if (offsetsByMember.size() != 1) {
      throw new ValidationException(
          "A cooperative reset request must target partitions owned by one consumer member. "
              + "Submit separate requests per owner to avoid partial resets.");
    }
    return offsetsByMember.entrySet().stream()
        .map(entry -> new CooperativeResetCommand(
            CooperativeResetCommand.CURRENT_PROTOCOL_VERSION,
            requestId,
            UUID.randomUUID().toString(),
            CooperativeResetCommand.Action.PREPARE,
            group.groupId(),
            entry.getKey(),
            topic,
            entry.getValue(),
            issuedAt,
            expiresAt))
        .toList();
  }

  private KafkaConsumer<byte[], byte[]> acknowledgementConsumer(KafkaCluster cluster) {
    Properties consumerProperties = new Properties();
    KafkaClientSslPropertiesUtil.addKafkaSslProperties(
        cluster.getOriginalProperties().getSsl(), consumerProperties);
    consumerProperties.putAll(cluster.getProperties());
    consumerProperties.putAll(cluster.getConsumerProperties());
    consumerProperties.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, cluster.getBootstrapServers());
    consumerProperties.put(ConsumerConfig.CLIENT_ID_CONFIG,
        "kafbat-cooperative-reset-coordinator-" + UUID.randomUUID());
    consumerProperties.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
    consumerProperties.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
    consumerProperties.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
    consumerProperties.remove(ConsumerConfig.GROUP_ID_CONFIG);
    consumerProperties.remove(ConsumerConfig.GROUP_INSTANCE_ID_CONFIG);
    return new KafkaConsumer<>(consumerProperties);
  }

  private void prepareAcknowledgementConsumer(
      KafkaConsumer<byte[], byte[]> consumer,
      String acknowledgementTopic,
      long deadlineNanos) {
    List<TopicPartition> partitions = consumer.partitionsFor(
            acknowledgementTopic,
            remaining(deadlineNanos)).stream()
        .map(info -> new TopicPartition(acknowledgementTopic, info.partition()))
        .toList();
    consumer.assign(partitions);
    consumer.seekToEnd(partitions);
    partitions.forEach(partition -> consumer.position(partition, remaining(deadlineNanos)));
  }

  private void publishCommand(
      KafkaProducer<byte[], byte[]> producer,
      String commandTopic,
      CooperativeResetCommand command,
      long deadlineNanos) {
    try {
      producer.send(new ProducerRecord<>(
          commandTopic,
          command.requestId().getBytes(StandardCharsets.UTF_8),
          CooperativeResetJson.writeCommand(command)))
          .get(remaining(deadlineNanos).toMillis(), TimeUnit.MILLISECONDS);
    } catch (Exception error) {
      throw new ValidationException("Unable to publish cooperative reset command");
    }
  }

  private CooperativeResetAck awaitAcknowledgement(
      KafkaConsumer<byte[], byte[]> consumer,
      CooperativeResetCommand command,
      CooperativeResetAck.Status expectedStatus,
      long deadlineNanos) {
    byte[] expectedKey = command.commandId().getBytes(StandardCharsets.UTF_8);
    while (System.nanoTime() < deadlineNanos) {
      for (var record : consumer.poll(minimum(ACK_POLL_INTERVAL, remaining(deadlineNanos)))) {
        if (!java.util.Arrays.equals(record.key(), expectedKey)) {
          continue;
        }
        try {
          CooperativeResetAck ack = CooperativeResetJson.readAck(record.value());
          validateAcknowledgement(command, ack);
          if (ack.status() == CooperativeResetAck.Status.REJECTED) {
            throw new ValidationException(
                "Consumer rejected cooperative offset reset: " + ack.message());
          }
          if (ack.status() != expectedStatus) {
            throw new ValidationException(
                "Consumer returned an unexpected cooperative reset status: " + ack.status());
          }
          return ack;
        } catch (IllegalArgumentException ignored) {
          // The acknowledgement topic may contain records from another protocol version.
        }
      }
    }
    throw new ValidationException(
        "Timed out waiting for cooperative reset acknowledgement. "
            + "Confirm the target consumer has the cooperative reset adapter enabled.");
  }

  private void validateAcknowledgement(
      CooperativeResetCommand command,
      CooperativeResetAck acknowledgement) {
    if (!command.requestId().equals(acknowledgement.requestId())
        || !command.commandId().equals(acknowledgement.commandId())
        || !command.groupId().equals(acknowledgement.groupId())
        || !command.targetMemberId().equals(acknowledgement.memberId())) {
      throw new ValidationException(
          "Cooperative reset acknowledgement did not match the issued command");
    }
    if (acknowledgement.status() != CooperativeResetAck.Status.REJECTED
        && !command.offsets().equals(acknowledgement.appliedOffsets())) {
      throw new ValidationException(
          "Cooperative reset acknowledgement contained unexpected offsets");
    }
  }

  private void verifyPrepared(
      ReactiveAdminClient adminClient,
      String groupId,
      String topic,
      Map<Integer, Long> offsets,
      ConsumerGroupDescription originalGroup,
      CooperativeResetCommand command,
      CooperativeResetAck acknowledgement) {
    ConsumerGroupDescription currentGroup = describeGroup(adminClient, groupId);
    requireStable(currentGroup);
    requireSameMembershipAndAssignments(originalGroup, currentGroup);
    validateAcknowledgement(command, acknowledgement);

    List<TopicPartition> partitions = offsets.keySet().stream()
        .map(partition -> new TopicPartition(topic, partition))
        .toList();
    Map<TopicPartition, Long> committedOffsets = Objects.requireNonNull(
        adminClient.listConsumerGroupOffsets(List.of(groupId), partitions)
            .block(properties.getTimeout()),
        "Unable to verify committed offsets").row(groupId);
    offsets.forEach((partition, offset) -> {
      Long committed = committedOffsets.get(new TopicPartition(topic, partition));
      if (!offset.equals(committed)) {
        throw new ValidationException(
            "Cooperative reset acknowledgement did not match the committed offset for partition "
                + partition);
      }
    });
  }

  private void verifyFinalized(
      ReactiveAdminClient adminClient,
      String groupId,
      ConsumerGroupDescription originalGroup,
      CooperativeResetAck prepared,
      CooperativeResetAck applied) {
    ConsumerGroupDescription currentGroup = describeGroup(adminClient, groupId);
    requireStable(currentGroup);
    requireSameMembershipAndAssignments(originalGroup, currentGroup);
    if (prepared.generationId() != applied.generationId()) {
      throw new ValidationException(
          "Consumer group generation changed during cooperative offset reset");
    }
  }

  private void requireSameMembershipAndAssignments(
      ConsumerGroupDescription expected,
      ConsumerGroupDescription actual) {
    if (!assignments(expected).equals(assignments(actual))) {
      throw new ValidationException(
          "Consumer group membership or assignment changed during cooperative offset reset");
    }
  }

  private Map<String, Set<TopicPartition>> assignments(ConsumerGroupDescription group) {
    return group.members().stream().collect(Collectors.toMap(
        MemberDescription::consumerId,
        member -> Set.copyOf(member.assignment().topicPartitions())));
  }

  private CooperativeResetCommand phaseCommand(
      CooperativeResetCommand prepare,
      CooperativeResetCommand.Action action) {
    return new CooperativeResetCommand(
        prepare.protocolVersion(),
        prepare.requestId(),
        UUID.randomUUID().toString(),
        action,
        prepare.groupId(),
        prepare.targetMemberId(),
        prepare.topic(),
        prepare.offsets(),
        prepare.issuedAtEpochMs(),
        prepare.expiresAtEpochMs());
  }

  private void rollbackBestEffort(
      KafkaProducer<byte[], byte[]> producer,
      KafkaConsumer<byte[], byte[]> acknowledgementConsumer,
      String commandTopic,
      CooperativeResetCommand prepare,
      CooperativeResetAck preparedAck,
      long deadlineNanos) {
    if (System.nanoTime() >= deadlineNanos) {
      return;
    }
    try {
      CooperativeResetCommand rollback = phaseCommand(
          prepare,
          CooperativeResetCommand.Action.ROLLBACK);
      publishCommand(producer, commandTopic, rollback, deadlineNanos);
      if (preparedAck != null) {
        awaitAcknowledgement(
            acknowledgementConsumer,
            rollback,
            CooperativeResetAck.Status.ROLLED_BACK,
            deadlineNanos);
      }
    } catch (RuntimeException ignored) {
      // The prepared command expires and the adapter rolls it back locally.
    }
  }

  private Duration remaining(long deadlineNanos) {
    long remainingNanos = deadlineNanos - System.nanoTime();
    if (remainingNanos <= 0) {
      throw new ValidationException("Cooperative offset reset timed out");
    }
    return Duration.ofNanos(remainingNanos);
  }

  private Duration minimum(Duration first, Duration second) {
    return first.compareTo(second) <= 0 ? first : second;
  }

  private Result result(
      String requestId,
      CooperativeResetCommand command,
      CooperativeResetAck acknowledgement) {
    List<PartitionResult> partitions = new ArrayList<>();
    command.offsets().forEach((partition, targetOffset) -> partitions.add(
        new PartitionResult(
            partition,
            acknowledgement.previousOffsets().get(partition),
            targetOffset,
            acknowledgement.memberId())));
    partitions.sort(java.util.Comparator.comparingInt(PartitionResult::partition));
    return new Result(requestId, ConsumerGroupState.STABLE, List.copyOf(partitions));
  }

  public record Result(
      String requestId,
      ConsumerGroupState groupState,
      List<PartitionResult> partitions) {
  }

  public record PartitionResult(
      int partition,
      Long previousOffset,
      long targetOffset,
      String memberId) {
  }
}