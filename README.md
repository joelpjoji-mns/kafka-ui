# MyKafka UI

[GitHub repository](https://github.com/joelpjoji-mns/Mykafka-Ui) | [Apache-2.0 license](LICENSE)

MyKafka UI is a personal, independently maintained fork of Kafbat UI for inspecting and operating Apache Kafka clusters. It keeps the upstream Kafka management foundation and adds focused developer, operations, message-transfer, and safety workflows.

## Fork status

- This is the active fork repository: [joelpjoji-mns/Mykafka-Ui](https://github.com/joelpjoji-mns/Mykafka-Ui).
- The fork is not affiliated with, endorsed by, or released by the upstream Kafbat organization.
- Upstream-only Docker publishing, AWS/ECR environments, Helm publication, Maven Central publication, Codecov, Discord, and external release automation are intentionally not part of this repository.
- The application uses its original bat-inspired fork mark. It does not include the official Batman logo or other DC artwork.
- The project remains Apache-2.0 licensed and retains its upstream attribution.

## Custom capabilities

| Area | MyKafka UI behavior |
| --- | --- |
| Live message tail | Live mode loads a bounded recent snapshot first, then tails new records from a fixed Kafka end-offset checkpoint. This avoids a history-to-live gap and puts fresh messages at the top. |
| Message browsing | Multiple text refinements, smart filters, serde-aware decoding, timestamp ranges with From/To controls, offset and timestamp seek modes, and a larger configurable message window. |
| Message table | Key, headers, and value previews; explicit headers visibility; persistent resizable columns; and a live-arrival animation for new records. |
| Consumer reset | Offset impact preview plus earliest, latest, timestamp, and explicit-offset strategies. Active consumer groups can wait for a safe inactive state before mutation, avoiding disruptive races. |
| Topic Download | Export selected topic messages with partition, window, filter, smart-filter, and serde controls. ZIP, CSV, and NDJSON formats are supported. |
| Topic Upload | Produce from single files, multiple files, or ZIP archives with file-per-message, line, NDJSON, and JSON-array parsing; dry-run previews; limits; and flexible partition routing. |
| Developer Hub | Per-topic operational readiness report with health, topology, storage, configuration, traffic, consumer, and integration signals plus actionable workflow links. |
| Operations Center | Cluster-wide health, broker, topic, consumer-lag, and integration snapshots for a faster operational overview. |
| Topic Governance | Topic compliance scoring and actionable recommendations for naming, configuration, availability, storage, and safety concerns. |
| Audit Explorer | Cursor-paginated audit trail with date, resource, operation, outcome, and target filters. |
| Record Explorer | Cross-topic search through a bounded recent sample, with topic filtering, result coverage, offsets, partitions, timestamps, and payload sizing. |
| Restricted clusters | Optional metadata access failures are handled as non-fatal where possible, so usable topic workflows remain available under limited admin permissions. |
| Themes | Auto, Light, Dark, Midnight, Harbor, Ember, AMOLED, and Glass modes. AMOLED uses true-black core surfaces; Glass uses material navigation and transient controls while keeping operational content opaque, with reduced-transparency and increased-contrast fallbacks. |

## Standard Kafka workflows

MyKafka UI retains the core upstream experience for:

- Multi-cluster Kafka administration, topics, partitions, replication, configs, and brokers.
- Message inspection and production with configured serdes.
- Consumer groups, offsets, lag, and group details.
- Schema Registry, Kafka Connect, KSQL, JMX, Prometheus, and managed Kafka integrations.
- Authentication, RBAC, LDAP, OAuth 2.0, data masking, and Swagger UI configuration.
- Built-in Model Context Protocol support from the upstream project.

## Run a release JAR

Release artifacts are produced by the **MyKafka UI: Build Release JAR** workflow in [.github/workflows/custom-jar.yml](.github/workflows/custom-jar.yml).

- Run the workflow without `release_tag` to receive a 30-day Actions artifact named `mykafka-ui-<run_number>.jar`.
- Run it with a `mykafka-v*` tag, such as `mykafka-v2026.08.15-1`, to create or update a GitHub Release with the same JAR asset. Legacy `custom-v*` tags remain supported.

Run a downloaded artifact with your Kafka UI configuration:

```bash
java -jar mykafka-ui-<run_number>.jar \
  --spring.config.additional-location=path/to/kafka-ui-config.yaml
```

## Build locally

Prerequisites:

| Tool | Version |
| --- | --- |
| Java | 25 |
| Node.js | 22.13.0 |
| pnpm | 10.26.1 |
| Docker | Required for compose environments and integration tests |

Build a runnable JAR with the frontend embedded:

```bash
./gradlew :api:bootJar --no-daemon \
  -Pinclude-frontend=true \
  -Pversion=mykafka-local

java -jar api/build/libs/api-mykafka-local.jar \
  --spring.config.additional-location=path/to/kafka-ui-config.yaml
```

Run the backend tests:

```bash
./gradlew :api:test
```

Run the frontend checks:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm compile
pnpm lint:CI
pnpm test:CI
```

Start the frontend development server with `pnpm dev`. Use `VITE_DEV_PROXY` in `frontend/.env.local` when it should proxy requests to a running API.

## Configuration

The application keeps the upstream configuration model.

- Set `DYNAMIC_CONFIG_ENABLED=true` to enable dynamic configuration.
- The default dynamic configuration path in the packaged container layout is `/etc/kafkaui/dynamic_config.yaml`.
- Set `SWAGGER_UI_ENABLED=true` to expose API documentation.
- Liveness and readiness are available from `/actuator/health`.
- Build and application information are available from `/actuator/info`.
- Local compose examples are available under [documentation/compose](documentation/compose).

## CI and releases

| Workflow | Trigger | What it verifies or produces |
| --- | --- | --- |
| **MyKafka UI: CI** | Push, pull request, manual run | Backend tests, frontend compile/lint/unit tests, then a frontend-embedded application JAR. |
| **MyKafka UI: Build Release JAR** | Manual run or `mykafka-v*` tag | Uploads a downloadable JAR artifact; creates or updates a GitHub Release when a tag is supplied. Legacy `custom-v*` tags remain supported. |

The CI workflow uses no personal cloud, registry, analytics, or publication secrets. Release publication uses GitHub's built-in token only.

## Project layout

| Module | Purpose |
| --- | --- |
| `api` | Spring Boot API, Kafka integrations, application services, and packaged JAR. |
| `frontend` | React and Vite application. |
| `contract` | Generated OpenAPI client and contract resources. |
| `contract-typespec` | TypeSpec source of truth for the API. |
| `serde-api` | Shared serializer/deserializer interfaces. |

## Attribution and license

MyKafka UI is derived from the upstream [Kafbat UI](https://github.com/kafbat/kafka-ui) project and is distributed under the [Apache License 2.0](LICENSE). Fork-specific behavior is maintained in this repository.