package io.kafbat.ui.cooperative;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.KafkaException;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.apache.kafka.common.serialization.ByteArraySerializer;

/**
 * Receives cooperative reset commands and applies them through an active group consumer.
 *
 * <p>The listener thread only queues commands. The application must invoke {@link #applyPending()}
 * from the same thread that invokes {@link KafkaConsumer#poll(Duration)}, after records from the
 * previous poll have been processed.</p>
 *
 * @param <K> data consumer key type
 * @param <V> data consumer value type
 */
public final class CooperativeResetAgent<K, V> implements AutoCloseable {

  private static final Duration CONTROL_POLL_TIMEOUT = Duration.ofMillis(250);
  private static final Duration SEND_TIMEOUT = Duration.ofSeconds(10);
  private static final Duration ROLLBACK_TIMEOUT = Duration.ofSeconds(10);
  private static final int MAX_PENDING_COMMANDS = 1_024;
  private static final int MAX_COMMANDS_PER_POLL_CYCLE = 100;
  private static final int MAX_REMEMBERED_COMMANDS = 1_024;

  private final KafkaConsumer<K, V> consumer;
  private final KafkaConsumer<byte[], byte[]> commandConsumer;
  private final KafkaProducer<byte[], byte[]> ackProducer;
  private final String commandTopic;
  private final String ackTopic;
  private final ResetBarrier barrier;
  private final BlockingQueue<CooperativeResetCommand> pendingCommands =
      new ArrayBlockingQueue<>(MAX_PENDING_COMMANDS);
  private final AtomicBoolean running = new AtomicBoolean();
  private final CountDownLatch ready = new CountDownLatch(1);
  private final AtomicReference<Throwable> startupFailure = new AtomicReference<>();
  private final Map<String, CooperativeResetAck> rememberedAcks = new LinkedHashMap<>();
  private Thread commandThread;
  private PreparedReset preparedReset;

  /**
   * Creates an agent around an existing group consumer.
   *
   * @param consumer active application consumer; only the poll thread may call {@link #applyPending()}
   * @param kafkaProperties connectivity and authentication properties for control clients
   * @param commandTopic control topic read by every participating instance
   * @param ackTopic acknowledgement topic written after handling a command
   * @param barrier application drain barrier
   */
  public CooperativeResetAgent(
      KafkaConsumer<K, V> consumer,
      Properties kafkaProperties,
      String commandTopic,
      String ackTopic,
      ResetBarrier barrier) {
    this.consumer = consumer;
    this.commandTopic = commandTopic;
    this.ackTopic = ackTopic;
    this.barrier = barrier;
    this.commandConsumer = new KafkaConsumer<>(commandConsumerProperties(kafkaProperties));
    this.ackProducer = new KafkaProducer<>(ackProducerProperties(kafkaProperties));
  }

  /**
   * Starts the control-topic listener at the topic's current end offset.
   *
   * @param timeout maximum startup wait
   * @throws IllegalStateException when the listener cannot initialize before the timeout
   */
  public void start(Duration timeout) {
    if (!running.compareAndSet(false, true)) {
      return;
    }
    if (commandThread != null) {
      running.set(false);
      throw new IllegalStateException("Cooperative reset listener cannot be restarted");
    }
    commandThread = new Thread(this::readCommands, "kafbat-cooperative-reset-listener");
    commandThread.setDaemon(true);
    commandThread.start();
    try {
      if (!ready.await(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
        stopCommandListener();
        throw new IllegalStateException("Timed out starting cooperative reset listener");
      }
    } catch (InterruptedException error) {
      stopCommandListener();
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted starting cooperative reset listener", error);
    }
    if (startupFailure.get() != null) {
      running.set(false);
      throw new IllegalStateException(
          "Unable to start cooperative reset listener",
          startupFailure.get());
    }
  }

  /**
   * Applies queued commands targeted to this current member on the calling poll thread.
   *
   * @return number of targeted commands handled during this call
   * @throws KafkaException when an acknowledgement cannot be published
   */
  public int applyPending() {
    requireHealthy();
    rollbackExpiredReset();
    int handled = 0;
    List<CooperativeResetCommand> commands = new ArrayList<>();
    pendingCommands.drainTo(commands, MAX_COMMANDS_PER_POLL_CYCLE);
    for (CooperativeResetCommand command : commands) {
      if (isTarget(command)) {
        CooperativeResetAck remembered = rememberedAcks.get(command.commandId());
        if (remembered != null) {
          publishAcknowledgement(remembered);
        } else {
          handle(command);
        }
        handled++;
      }
    }
    return handled;
  }

  private boolean isTarget(CooperativeResetCommand command) {
    var metadata = consumer.groupMetadata();
    return command.groupId().equals(metadata.groupId())
        && command.targetMemberId().equals(metadata.memberId());
  }

  private void handle(CooperativeResetCommand command) {
    switch (command.action()) {
      case PREPARE -> prepare(command);
      case FINALIZE -> finalizeReset(command);
      case ROLLBACK -> rollback(command, "Coordinator requested rollback");
      default -> throw new IllegalArgumentException(
          "Unsupported cooperative reset action: " + command.action());
    }
  }

  private void prepare(CooperativeResetCommand command) {
    final var metadata = consumer.groupMetadata();
    if (isExpired(command)) {
      reject(command, "Command expired before it reached the poll thread");
      return;
    }
    if (preparedReset != null) {
      reject(command, "Another cooperative reset is already prepared on this member");
      return;
    }

    Set<TopicPartition> targetPartitions = new HashSet<>();
    Map<TopicPartition, OffsetAndMetadata> targetOffsets = new HashMap<>();
    command.offsets().forEach((partition, offset) -> {
      TopicPartition topicPartition = new TopicPartition(command.topic(), partition);
      targetPartitions.add(topicPartition);
      targetOffsets.put(topicPartition, new OffsetAndMetadata(offset));
    });

    if (!consumer.assignment().containsAll(targetPartitions)) {
      reject(command, "Target member no longer owns every requested partition");
      return;
    }

    Set<TopicPartition> alreadyPaused = consumer.paused();
    Map<TopicPartition, OffsetAndMetadata> previousOffsetMetadata =
        consumer.committed(targetPartitions, remaining(command));
    if (previousOffsetMetadata.values().stream().anyMatch(java.util.Objects::isNull)) {
      reject(command, "Cooperative reset requires an existing committed offset");
      return;
    }
    Map<Integer, Long> previousOffsets = previousOffsetMetadata.entrySet().stream()
        .collect(java.util.stream.Collectors.toMap(
            entry -> entry.getKey().partition(),
            entry -> entry.getValue().offset()));
    Map<TopicPartition, Long> previousPositions = new HashMap<>();
    targetPartitions.forEach(partition ->
        previousPositions.put(partition, consumer.position(partition, remaining(command))));
    PreparedReset pendingReset = new PreparedReset(
        command,
        metadata.generationId(),
        Map.copyOf(previousOffsetMetadata),
        Map.copyOf(previousPositions),
        Set.copyOf(targetPartitions),
        resumePartitions(targetPartitions, alreadyPaused));
    boolean targetMutationStarted = false;
    try {
      consumer.pause(targetPartitions);
      barrier.awaitDrained(Set.copyOf(targetPartitions));
      if (isExpired(command)) {
        throw new IllegalStateException("Command expired while draining in-flight records");
      }
      requireGeneration(metadata.generationId());
      targetMutationStarted = true;
      targetOffsets.forEach((partition, offset) -> consumer.seek(partition, offset.offset()));
      consumer.commitSync(targetOffsets, remaining(command));
      preparedReset = pendingReset;
    } catch (Exception error) {
      boolean rollbackConfirmed = !targetMutationStarted;
      if (targetMutationStarted) {
        try {
          previousPositions.forEach(consumer::seek);
          consumer.commitSync(previousOffsetMetadata, ROLLBACK_TIMEOUT);
          rollbackConfirmed = true;
        } catch (Exception rollbackFailure) {
          error.addSuppressed(rollbackFailure);
          preparedReset = pendingReset;
        }
      }
      if (rollbackConfirmed) {
        consumer.resume(pendingReset.resumePartitions());
      }
      reject(
          command,
          rollbackConfirmed
              ? error.getMessage()
              : "Prepare failed and rollback is pending: " + error.getMessage());
      return;
    }
    acknowledge(
        command,
        CooperativeResetAck.Status.PREPARED,
        previousOffsets,
        command.offsets(),
        null);
  }

  private void finalizeReset(CooperativeResetCommand command) {
    PreparedReset reset = matchingPreparedReset(command);
    if (reset == null) {
      return;
    }
    requireGeneration(reset.generationId());
    consumer.resume(reset.resumePartitions());
    preparedReset = null;
    acknowledge(
        command,
        CooperativeResetAck.Status.APPLIED,
        toPartitionOffsets(reset.previousOffsets()),
        reset.prepareCommand().offsets(),
        null);
  }

  private void rollback(CooperativeResetCommand command, String message) {
    PreparedReset reset = matchingPreparedReset(command);
    if (reset == null) {
      return;
    }
    rollbackPreparedReset(reset, command, message);
  }

  private void rollbackExpiredReset() {
    if (preparedReset != null && isExpired(preparedReset.prepareCommand())) {
      rollbackPreparedReset(
          preparedReset,
          preparedReset.prepareCommand(),
          "Prepared reset expired and was rolled back");
    }
  }

  private void rollbackPreparedReset(
      PreparedReset reset,
      CooperativeResetCommand acknowledgementCommand,
      String message) {
    reset.previousPositions().forEach(consumer::seek);
    consumer.commitSync(reset.previousOffsets(), ROLLBACK_TIMEOUT);
    consumer.resume(reset.resumePartitions());
    preparedReset = null;
    acknowledge(
        acknowledgementCommand,
        CooperativeResetAck.Status.ROLLED_BACK,
        toPartitionOffsets(reset.previousOffsets()),
        toPartitionOffsets(reset.previousOffsets()),
        message);
  }

  private PreparedReset matchingPreparedReset(CooperativeResetCommand command) {
    if (preparedReset == null
        || !preparedReset.prepareCommand().requestId().equals(command.requestId())) {
      reject(command, "No matching prepared reset exists on this member");
      return null;
    }
    return preparedReset;
  }

  private Set<TopicPartition> resumePartitions(
      Set<TopicPartition> targetPartitions,
      Set<TopicPartition> alreadyPaused) {
    Set<TopicPartition> result = new HashSet<>(targetPartitions);
    result.removeAll(alreadyPaused);
    return Set.copyOf(result);
  }

  private Map<Integer, Long> toPartitionOffsets(
      Map<TopicPartition, OffsetAndMetadata> offsets) {
    return offsets.entrySet().stream().collect(java.util.stream.Collectors.toMap(
        entry -> entry.getKey().partition(),
        entry -> entry.getValue().offset()));
  }

  private void requireGeneration(int generationId) {
    if (consumer.groupMetadata().generationId() != generationId) {
      throw new IllegalStateException("Consumer group generation changed during reset");
    }
  }

  private void reject(CooperativeResetCommand command, String message) {
    acknowledge(command, CooperativeResetAck.Status.REJECTED, Map.of(), Map.of(), message);
  }

  private boolean isExpired(CooperativeResetCommand command) {
    return System.currentTimeMillis() >= command.expiresAtEpochMs();
  }

  private Duration remaining(CooperativeResetCommand command) {
    long remainingMs = command.expiresAtEpochMs() - System.currentTimeMillis();
    if (remainingMs <= 0) {
      throw new IllegalStateException("Cooperative reset command expired");
    }
    return Duration.ofMillis(remainingMs);
  }

  private void acknowledge(
      CooperativeResetCommand command,
      CooperativeResetAck.Status status,
      Map<Integer, Long> previousOffsets,
      Map<Integer, Long> appliedOffsets,
      String message) {
    CooperativeResetAck ack = new CooperativeResetAck(
        CooperativeResetCommand.CURRENT_PROTOCOL_VERSION,
        command.requestId(),
        command.commandId(),
        command.groupId(),
        consumer.groupMetadata().memberId(),
        consumer.groupMetadata().generationId(),
        status,
        previousOffsets,
        appliedOffsets,
        System.currentTimeMillis(),
        message);
    remember(ack);
    publishAcknowledgement(ack);
  }

  private void remember(CooperativeResetAck ack) {
    rememberedAcks.put(ack.commandId(), ack);
    while (rememberedAcks.size() > MAX_REMEMBERED_COMMANDS) {
      rememberedAcks.remove(rememberedAcks.keySet().iterator().next());
    }
  }

  private void publishAcknowledgement(CooperativeResetAck ack) {
    try {
      ackProducer.send(new ProducerRecord<>(
          ackTopic,
          ack.commandId().getBytes(StandardCharsets.UTF_8),
          CooperativeResetJson.writeAck(ack))).get(SEND_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    } catch (Exception error) {
      throw new KafkaException("Unable to publish cooperative reset acknowledgement", error);
    }
  }

  private void readCommands() {
    try {
      var partitions = commandConsumer.partitionsFor(commandTopic, Duration.ofSeconds(10)).stream()
          .map(info -> new TopicPartition(commandTopic, info.partition()))
          .toList();
      if (partitions.isEmpty()) {
        throw new IllegalStateException("Cooperative reset command topic has no partitions");
      }
      commandConsumer.assign(partitions);
      commandConsumer.seekToEnd(partitions);
      ready.countDown();
      while (running.get()) {
        commandConsumer.poll(CONTROL_POLL_TIMEOUT).forEach(record -> {
          try {
            if (!pendingCommands.offer(CooperativeResetJson.readCommand(record.value()))) {
              throw new IllegalStateException("Cooperative reset command queue is full");
            }
          } catch (IllegalArgumentException ignored) {
            // Topic ACLs are the trust boundary; malformed records are ignored.
          }
        });
      }
    } catch (WakeupException error) {
      if (running.get()) {
        startupFailure.compareAndSet(null, error);
      }
    } catch (Throwable error) {
      startupFailure.compareAndSet(null, error);
      running.set(false);
    } finally {
      ready.countDown();
      commandConsumer.close();
    }
  }

  @Override
  public void close() {
    stopCommandListener();
    ackProducer.close(Duration.ofSeconds(5));
  }

  private void stopCommandListener() {
    if (running.compareAndSet(true, false)) {
      commandConsumer.wakeup();
    }
    if (commandThread == null) {
      commandConsumer.close(Duration.ofSeconds(5));
      return;
    }
    try {
      commandThread.join(Duration.ofSeconds(5).toMillis());
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
    }
  }

  private static Properties commandConsumerProperties(Properties source) {
    Properties properties = copy(source);
    properties.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
    properties.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
    properties.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
    properties.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "latest");
    properties.remove(ConsumerConfig.GROUP_ID_CONFIG);
    properties.remove(ConsumerConfig.GROUP_INSTANCE_ID_CONFIG);
    properties.put(
        ConsumerConfig.CLIENT_ID_CONFIG,
        "kafbat-cooperative-reset-agent-" + UUID.randomUUID());
    return properties;
  }

  private static Properties ackProducerProperties(Properties source) {
    Properties properties = copy(source);
    properties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class);
    properties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class);
    properties.put(ProducerConfig.ACKS_CONFIG, "all");
    properties.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
    properties.put(
        ProducerConfig.CLIENT_ID_CONFIG,
        "kafbat-cooperative-reset-agent-" + UUID.randomUUID());
    return properties;
  }

  private static Properties copy(Properties source) {
    Properties copy = new Properties();
    copy.putAll(source);
    return copy;
  }

  private void requireHealthy() {
    Throwable listenerFailure = startupFailure.get();
    if (listenerFailure == null) {
      return;
    }
    if (preparedReset != null) {
      PreparedReset reset = preparedReset;
      try {
        rollbackPreparedReset(
            reset,
            reset.prepareCommand(),
            "Control listener failed and the prepared reset was rolled back");
      } catch (RuntimeException rollbackFailure) {
        var unhealthy = new IllegalStateException(
            "Cooperative reset listener is not healthy and rollback failed",
            listenerFailure);
        unhealthy.addSuppressed(rollbackFailure);
        throw unhealthy;
      }
    }
    throw new IllegalStateException("Cooperative reset listener is not healthy", listenerFailure);
  }

  private record PreparedReset(
      CooperativeResetCommand prepareCommand,
      int generationId,
      Map<TopicPartition, OffsetAndMetadata> previousOffsets,
      Map<TopicPartition, Long> previousPositions,
      Set<TopicPartition> targetPartitions,
      Set<TopicPartition> resumePartitions) {
  }
}