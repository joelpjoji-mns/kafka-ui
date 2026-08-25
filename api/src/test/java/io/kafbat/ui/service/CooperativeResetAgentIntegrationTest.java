package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import io.kafbat.ui.config.ClustersProperties;
import io.kafbat.ui.config.CooperativeOffsetResetProperties;
import io.kafbat.ui.cooperative.CooperativeResetAck;
import io.kafbat.ui.cooperative.CooperativeResetAgent;
import io.kafbat.ui.cooperative.CooperativeResetCommand;
import io.kafbat.ui.cooperative.CooperativeResetJson;
import io.kafbat.ui.cooperative.CooperativeResetTopics;
import io.kafbat.ui.cooperative.ResetBarrier;
import io.kafbat.ui.model.KafkaCluster;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.ConsumerGroupState;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.utils.Bytes;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.ConfluentKafkaContainer;
import org.testcontainers.utility.DockerImageName;
import reactor.core.publisher.Mono;

@Testcontainers(disabledWithoutDocker = true)
class CooperativeResetAgentIntegrationTest {

  @Container
  private static final ConfluentKafkaContainer KAFKA = new ConfluentKafkaContainer(
      DockerImageName.parse("confluentinc/cp-kafka:7.8.0"));

  private final String suffix = UUID.randomUUID().toString();
  private final String topic = "cooperative-reset-data-" + suffix;
  private final String groupId = "cooperative-reset-group-" + suffix;
  private final String commandTopicPrefix = "cooperative-reset-commands";
  private final String ackTopicPrefix = "cooperative-reset-acks";
  private final CooperativeResetTopics resetTopics = CooperativeResetTopics.forGroup(
      commandTopicPrefix,
      ackTopicPrefix,
      groupId);
  private final String commandTopic = resetTopics.commandTopic();
  private final String ackTopic = resetTopics.acknowledgementTopic();

  @AfterEach
  void cleanUp() {
    try (var admin = adminClient()) {
      admin.deleteTopics(List.of(topic, commandTopic, ackTopic)).all().get();
    } catch (Exception ignored) {
      // A failed setup can leave some topics absent.
    }
  }

  @Test
  void resetsOffsetThroughOwningPollThreadWithoutLeavingStableState() throws Exception {
    createTopics();
    sendMessages();

    TopicPartition partition = new TopicPartition(topic, 0);
    Properties consumerProperties = consumerProperties();
    try (var consumer = new KafkaConsumer<Bytes, Bytes>(consumerProperties);
         var admin = adminClient();
          var ackConsumer = ackConsumer();
         var commandProducer = commandProducer();
         var agent = new CooperativeResetAgent<>(
             consumer,
             consumerProperties,
             commandTopic,
             ackTopic,
             ResetBarrier.noOp())) {
      consumer.subscribe(List.of(topic));
      waitForStableAssignment(consumer, admin);
      consumer.commitSync(Map.of(partition, new OffsetAndMetadata(5L)));

      TopicPartition ackPartition = new TopicPartition(ackTopic, 0);
      ackConsumer.assign(List.of(ackPartition));
      ackConsumer.seekToEnd(ackConsumer.assignment());
      ackConsumer.position(ackPartition);
      agent.start(Duration.ofSeconds(10));

      String memberId = consumer.groupMetadata().memberId();
      long issuedAt = System.currentTimeMillis();
      CooperativeResetCommand command = new CooperativeResetCommand(
          CooperativeResetCommand.CURRENT_PROTOCOL_VERSION,
          UUID.randomUUID().toString(),
          UUID.randomUUID().toString(),
          CooperativeResetCommand.Action.PREPARE,
          groupId,
          memberId,
          topic,
          Map.of(0, 2L),
          issuedAt,
          issuedAt + Duration.ofSeconds(30).toMillis());
      commandProducer.send(new ProducerRecord<>(
          commandTopic,
          command.commandId().getBytes(java.nio.charset.StandardCharsets.UTF_8),
          CooperativeResetJson.writeCommand(command))).get(10, TimeUnit.SECONDS);

      int handled = 0;
      for (int attempt = 0; attempt < 40 && handled == 0; attempt++) {
        consumer.poll(Duration.ofMillis(100));
        handled = agent.applyPending();
      }

      assertThat(handled).isEqualTo(1);
      assertThat(groupState(admin)).isEqualTo(ConsumerGroupState.STABLE);
      assertThat(consumer.position(partition)).isEqualTo(2L);
      assertThat(consumer.committed(Set.of(partition)).get(partition).offset()).isEqualTo(2L);
      assertThat(consumer.paused()).contains(partition);
      CooperativeResetAck prepared = waitForAck(ackConsumer, command.commandId());
      assertThat(prepared.status()).isEqualTo(CooperativeResetAck.Status.PREPARED);
      assertThat(prepared.previousOffsets()).containsEntry(0, 5L);
      assertThat(prepared.appliedOffsets()).containsEntry(0, 2L);

      CooperativeResetCommand finalizeCommand = new CooperativeResetCommand(
          CooperativeResetCommand.CURRENT_PROTOCOL_VERSION,
          command.requestId(),
          UUID.randomUUID().toString(),
          CooperativeResetCommand.Action.FINALIZE,
          groupId,
          memberId,
          topic,
          command.offsets(),
          command.issuedAtEpochMs(),
          command.expiresAtEpochMs());
      commandProducer.send(new ProducerRecord<>(
          commandTopic,
          finalizeCommand.requestId().getBytes(StandardCharsets.UTF_8),
          CooperativeResetJson.writeCommand(finalizeCommand))).get(10, TimeUnit.SECONDS);
      handled = 0;
      for (int attempt = 0; attempt < 40 && handled == 0; attempt++) {
        consumer.poll(Duration.ofMillis(100));
        handled = agent.applyPending();
      }
      assertThat(handled).isEqualTo(1);
      assertThat(consumer.paused()).doesNotContain(partition);
      CooperativeResetAck applied = waitForAck(
          ackConsumer,
          finalizeCommand.commandId());
      assertThat(applied.status()).isEqualTo(CooperativeResetAck.Status.APPLIED);
      assertThat(applied.generationId()).isEqualTo(prepared.generationId());
      assertThat(groupState(admin)).isEqualTo(ConsumerGroupState.STABLE);
    }
  }

  @Test
  void coordinatorResetsThroughLiveConsumerAndVerifiesStableState() throws Exception {
    createTopics();
    sendMessages();

    AtomicBoolean running = new AtomicBoolean(true);
    AtomicReference<Throwable> consumerFailure = new AtomicReference<>();
    CountDownLatch ready = new CountDownLatch(1);
    Thread consumerThread = new Thread(
        () -> runCooperatingConsumer(running, ready, consumerFailure),
        "cooperative-reset-integration-consumer");
    consumerThread.start();

    try (var rawAdmin = adminClient()) {
      assertThat(ready.await(20, TimeUnit.SECONDS)).isTrue();
      assertThat(consumerFailure).hasValue(null);

      ReactiveAdminClient reactiveAdmin = ReactiveAdminClient.create(
          rawAdmin,
          new ClustersProperties.AdminClient()).block(Duration.ofSeconds(10));
      AdminClientService adminClientService = Mockito.mock(AdminClientService.class);
      when(adminClientService.get(Mockito.any())).thenReturn(Mono.just(reactiveAdmin));
      var properties = new CooperativeOffsetResetProperties();
      properties.setEnabled(true);
      properties.setCommandTopic(commandTopicPrefix);
      properties.setAcknowledgementTopic(ackTopicPrefix);
      properties.setAutoCreateTopics(false);
      properties.setTimeout(Duration.ofSeconds(10));
      var service = new CooperativeOffsetResetService(
          adminClientService,
          properties);

      CooperativeOffsetResetService.Result result = service.reset(
          cluster(),
          groupId,
          topic,
          Map.of(0, 2L)).block(Duration.ofSeconds(15));

      assertThat(result).isNotNull();
      assertThat(result.groupState()).isEqualTo(ConsumerGroupState.STABLE);
      assertThat(result.partitions()).singleElement().satisfies(partition -> {
        assertThat(partition.partition()).isZero();
        assertThat(partition.previousOffset()).isEqualTo(5L);
        assertThat(partition.targetOffset()).isEqualTo(2L);
      });
      assertThat(groupState(rawAdmin)).isEqualTo(ConsumerGroupState.STABLE);
      TopicPartition partition = new TopicPartition(topic, 0);
      assertThat(rawAdmin.listConsumerGroupOffsets(groupId)
          .partitionsToOffsetAndMetadata()
          .get())
          .containsEntry(partition, new OffsetAndMetadata(2L));
      assertThat(consumerFailure).hasValue(null);
    } finally {
      running.set(false);
      consumerThread.join(Duration.ofSeconds(5).toMillis());
      assertThat(consumerThread.isAlive()).isFalse();
    }
  }

  @Test
  void stopsListenerWhenStartupTimesOut() {
    Properties properties = consumerProperties();
    try (var consumer = new KafkaConsumer<Bytes, Bytes>(properties);
         var agent = new CooperativeResetAgent<>(
             consumer,
             properties,
             commandTopic + "-missing",
             ackTopic,
             ResetBarrier.noOp())) {
      assertThatThrownBy(() -> agent.start(Duration.ZERO))
          .isInstanceOf(IllegalStateException.class)
          .hasMessage("Timed out starting cooperative reset listener");
      assertThatThrownBy(() -> agent.start(Duration.ofSeconds(1)))
          .isInstanceOf(IllegalStateException.class)
          .hasMessage("Cooperative reset listener cannot be restarted");
    }
  }

  private void runCooperatingConsumer(
      AtomicBoolean running,
      CountDownLatch ready,
      AtomicReference<Throwable> failure) {
    Properties properties = consumerProperties();
    try (var consumer = new KafkaConsumer<Bytes, Bytes>(properties);
         var admin = adminClient();
         var agent = new CooperativeResetAgent<>(
             consumer,
             properties,
             commandTopic,
             ackTopic,
             ResetBarrier.noOp())) {
      consumer.subscribe(List.of(topic));
      waitForStableAssignment(consumer, admin);
      consumer.commitSync(Map.of(
          new TopicPartition(topic, 0),
          new OffsetAndMetadata(5L)));
      agent.start(Duration.ofSeconds(10));
      ready.countDown();
      while (running.get()) {
        consumer.poll(Duration.ofMillis(100));
        agent.applyPending();
      }
    } catch (Throwable error) {
      failure.set(error);
      ready.countDown();
    }
  }

  private void createTopics() throws Exception {
    try (var admin = adminClient()) {
      admin.createTopics(List.of(
          new NewTopic(topic, 1, (short) 1),
          new NewTopic(commandTopic, 1, (short) 1),
          new NewTopic(ackTopic, 1, (short) 1))).all().get();
    }
  }

  private void sendMessages() throws Exception {
    Properties properties = baseProperties();
    properties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class);
    properties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class);
    try (var producer = new KafkaProducer<byte[], byte[]>(properties)) {
      for (int offset = 0; offset < 10; offset++) {
        producer.send(new ProducerRecord<>(topic, new byte[] {(byte) offset})).get();
      }
    }
  }

  private Properties consumerProperties() {
    Properties properties = baseProperties();
    properties.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
    properties.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
    properties.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
    properties.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
    properties.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
    return properties;
  }

  private KafkaConsumer<byte[], byte[]> ackConsumer() {
    Properties properties = baseProperties();
    properties.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
    properties.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
    return new KafkaConsumer<>(properties);
  }

  private KafkaProducer<byte[], byte[]> commandProducer() {
    Properties properties = baseProperties();
    properties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class);
    properties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class);
    return new KafkaProducer<>(properties);
  }

  private AdminClient adminClient() {
    return AdminClient.create(baseProperties());
  }

  private Properties baseProperties() {
    Properties properties = new Properties();
    properties.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers());
    return properties;
  }

  private KafkaCluster cluster() {
    ClustersProperties.Cluster original = new ClustersProperties.Cluster();
    original.setName("test");
    original.setBootstrapServers(KAFKA.getBootstrapServers());
    original.setProperties(Map.of());
    original.setConsumerProperties(Map.of());
    original.setProducerProperties(Map.of());
    return KafkaCluster.builder()
        .name("test")
        .bootstrapServers(KAFKA.getBootstrapServers())
        .originalProperties(original)
        .properties(new Properties())
        .consumerProperties(new Properties())
        .producerProperties(new Properties())
        .build();
  }

  private void waitForStableAssignment(
      KafkaConsumer<Bytes, Bytes> consumer,
      AdminClient admin) throws Exception {
    for (int attempt = 0; attempt < 40; attempt++) {
      consumer.poll(Duration.ofMillis(100));
      if (!consumer.assignment().isEmpty()
          && groupState(admin) == ConsumerGroupState.STABLE) {
        return;
      }
    }
    throw new AssertionError("Consumer group did not become STABLE");
  }

  private ConsumerGroupState groupState(AdminClient admin) throws Exception {
    return admin.describeConsumerGroups(List.of(groupId))
        .all()
        .get()
        .get(groupId)
        .state();
  }

  private CooperativeResetAck waitForAck(
      KafkaConsumer<byte[], byte[]> consumer,
      String commandId) {
    for (int attempt = 0; attempt < 40; attempt++) {
      for (var record : consumer.poll(Duration.ofMillis(250))) {
        CooperativeResetAck ack = CooperativeResetJson.readAck(record.value());
        if (ack.commandId().equals(commandId)) {
          return ack;
        }
      }
    }
    throw new AssertionError("Cooperative reset acknowledgement was not received");
  }
}