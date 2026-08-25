# Cooperative Offset Reset

Kafka's administrative offset reset requires an empty consumer group. MyKafka UI's cooperative reset protocol offers a separate opt-in path for applications that must remain `STABLE`.

The consumer instance that currently owns a target partition receives a `PREPARE` command and applies `pause`, `seek`, and `commitSync` on its own polling thread. It keeps the partition paused while Kafka UI verifies the group assignment and committed offset. Kafka UI then sends `FINALIZE`, and only then does the consumer resume.

## Safety Contract

- The feature is disabled by default.
- Every consumer instance in a participating group must run a compatible adapter.
- `applyPending()` must run on the same thread that calls `KafkaConsumer.poll()`.
- Call `applyPending()` only after processing the records returned by the preceding poll.
- Async processors must provide a `ResetBarrier` that waits until in-flight work for the target partitions is drained.
- The group must be `STABLE`, and every requested partition must have a current owner.
- Every partition in one request must currently belong to the same member. Submit separate requests for different owners; Kafka UI rejects multi-owner requests before publishing a command.
- Any rebalance, ownership change, timeout, rejected acknowledgement, or mismatched committed offset fails the request.
- Kafka UI never removes or fences consumer members in cooperative mode.
- Commands are deduplicated by command ID. A second cooperative reset for the same group is rejected while one is running.
- A prepared reset automatically rolls back to the previous committed offsets and positions when its command expires before finalization.

## Build The Adapter

Publish the current adapter to the local Maven repository:

```bash
./gradlew :cooperative-reset:publishToMavenLocal
```

Then add it to a Java consumer application:

```groovy
repositories {
    mavenLocal()
}

dependencies {
    implementation "io.kafbat:cooperative-reset:0.0.1-SNAPSHOT"
}
```

Use the exact group-consumer properties for authentication and connectivity. The adapter creates a separate manually assigned control consumer and acknowledgement producer from those properties.

```java
Properties properties = consumerProperties();
KafkaConsumer<String, String> consumer = new KafkaConsumer<>(properties);

try (var resetAgent = new CooperativeResetAgent<>(
    consumer,
    properties,
    CooperativeResetTopics.forGroup(
      "__kui-cooperative-reset-commands",
      "__kui-cooperative-reset-acks",
      "orders-consumer").commandTopic(),
    CooperativeResetTopics.forGroup(
      "__kui-cooperative-reset-commands",
      "__kui-cooperative-reset-acks",
      "orders-consumer").acknowledgementTopic(),
    ResetBarrier.noOp())) {
  consumer.subscribe(List.of("orders"));
  resetAgent.start(Duration.ofSeconds(10));

  while (running) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
    processSynchronously(records);

    // Must execute on this poll thread, after the current records are handled.
    resetAgent.applyPending();
  }
}
```

For asynchronous processing, provide a barrier instead of `ResetBarrier.noOp()`:

```java
ResetBarrier barrier = partitions -> workerPool.awaitDrained(partitions);
```

The barrier must prevent an older in-flight record from committing an offset after the reset.

## Configure MyKafka UI

```yaml
cooperative-offset-reset:
  enabled: true
  # Prefixes. Kafka UI appends a SHA-256-derived suffix for each group.
  command-topic: __kui-cooperative-reset-commands
  acknowledgement-topic: __kui-cooperative-reset-acks
  timeout: 30s
  auto-create-topics: false
  topic-partitions: 1
  topic-properties:
    cleanup.policy: delete
    retention.ms: "86400000"
```

Pre-create the two derived topics for every participating group before starting consumers. Use `CooperativeResetTopics.forGroup(...)` to calculate the exact names. Auto-creation is available as a development convenience, but adapters cannot listen to a topic that does not yet exist.

Environment variables are also supported:

```bash
KAFBAT_UI_COOPERATIVE_OFFSET_RESET_ENABLED=true
KAFBAT_UI_COOPERATIVE_OFFSET_RESET_COMMAND_TOPIC=__kui-cooperative-reset-commands
KAFBAT_UI_COOPERATIVE_OFFSET_RESET_ACK_TOPIC=__kui-cooperative-reset-acks
KAFBAT_UI_COOPERATIVE_OFFSET_RESET_TIMEOUT=30s
KAFBAT_UI_COOPERATIVE_OFFSET_RESET_AUTO_CREATE_TOPICS=false
```

When `enabled` is `true`, Kafka UI advertises the capability through application info and shows the **Keep the consumer group STABLE** reset option. Disabled deployments expose only the standard inactive-group reset flow.

## Kafka ACLs

Treat each group's control topics as administrative resources. Producing a valid command can change consumer position.

Kafka UI needs:

- `WRITE` and `DESCRIBE` on the command topic.
- `READ` and `DESCRIBE` on the acknowledgement topic.
- `DESCRIBE` on participating consumer groups and data topics.
- `CREATE` on the cluster only when topic auto-creation is enabled.

Participating consumer applications need:

- `READ` and `DESCRIBE` on the command topic.
- `WRITE` and `DESCRIBE` on the acknowledgement topic.
- Their normal group and data-topic permissions.

Do not grant command-topic write permission to ordinary application principals.

## Protocol

The command and acknowledgement payloads are versioned JSON. Commands are targeted to Kafka's current `memberId`, not merely a client ID or host. Every adapter in that group reads the group's isolated control topic, but only the targeted current owner applies a command.

One request targets one owning member. The protocol uses `PREPARE`, `FINALIZE`, and `ROLLBACK` commands. A command contains:

- Protocol, request, and command IDs.
- Consumer group and current target member IDs.
- Data topic and partition-to-offset map.
- Issue and expiry timestamps.

An acknowledgement contains:

- Prepared, applied, rolled-back, or rejected status.
- Consumer generation ID used to fence finalization.
- Previous committed offsets.
- Applied offsets.
- Completing member ID and timestamp.
- A rejection message when applicable.

## Operational Notes

- A cooperative reset deliberately replays or skips records without a rebalance.
- Existing records already handed to application code cannot be recalled. Drain them before applying a reset.
- Downstream processing should be idempotent when replaying records.
- Kafka UI verifies the group is still `STABLE`, the exact member assignments are unchanged, the target commit matches while partitions remain paused, and prepare/finalize acknowledgements use the same generation.
- If an acknowledgement is lost after a successful commit, Kafka UI reports a timeout rather than claiming success. Inspect committed offsets before retrying.
- If Kafka UI cannot finalize a prepared reset, it sends `ROLLBACK`; command expiry provides a second rollback path on the consumer poll thread.
- Non-Java consumers can implement the same JSON protocol and poll-thread rules without using this module.

## Validation

Run the real Kafka adapter and coordinator suite with:

```bash
./gradlew :api:test --tests 'io.kafbat.ui.service.CooperativeResetAgentIntegrationTest'
```

It verifies the direct two-phase adapter path, the full Kafka UI coordinator path, and listener startup-timeout cleanup. The active group remains `STABLE`, committed offsets move to the requested target, and `PREPARED` and `APPLIED` acknowledgements are published.