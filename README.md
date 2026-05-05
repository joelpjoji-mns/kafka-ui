<div align="center">
  <img src="documentation/images/logo_new.png" alt="Kafbat UI logo" width="320" />
  <h1>Kafbat UI Custom Build</h1>
  <p>Fast, lightweight web UI for managing Apache Kafka clusters, with extra topic download and upload workflows.</p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="Apache 2.0 license" /></a>
    <img src="documentation/images/free-open-source.svg" alt="free and open source" />
    <a href="https://github.com/joelpjoji-mns/kafka-ui/releases"><img src="https://img.shields.io/github/v/release/joelpjoji-mns/kafka-ui" alt="latest custom build release" /></a>
  </p>

  <p>
    <a href="#overview">Overview</a> |
    <a href="#custom-features">Custom features</a> |
    <a href="#quick-start">Quick start</a> |
    <a href="#run-the-custom-build">Run custom build</a> |
    <a href="#development">Development</a>
  </p>
</div>

## Overview

This repository is a personal fork and custom build of [Kafbat UI](https://github.com/kafbat/kafka-ui). It keeps the core Kafka management experience from upstream Kafbat UI, then adds focused workflows for exporting messages from topics, uploading messages into topics, and making the UI more tolerant of restricted Kafka admin permissions.

The fork is not intended to be merged back into upstream Kafbat UI. Upstream organization automation for DockerHub, AWS/ECR, Helm publishing, Maven Central, Discord, feature environments, release drafter, and Codecov has been removed because those workflows depend on upstream organization infrastructure and secrets.

Use this README when you want to run, build, or maintain this custom fork. For the upstream product documentation, see the [Kafbat UI documentation](https://ui.docs.kafbat.io/).

## Custom Features

This build keeps the standard Kafbat UI feature set and adds a few opinionated tools for moving topic data in and out of Kafka.

| Area                      | What this fork adds                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topic Download            | Dedicated Topic Download tab for exporting Kafka messages as a ZIP archive, with one file per message and filenames that include offset, partition, and topic metadata.                |
| Download controls         | Partition selection, newest/oldest windows, offset windows, timestamp windows, text filters, smart filters, key/value serdes, and text, JSON metadata, or payload-only output formats. |
| Topic Upload              | Dedicated Topic Upload tab for producing messages from a single file, multiple files, or a ZIP archive.                                                                                |
| Upload parsing            | File-per-message, text-lines, NDJSON, and JSON-array parsing modes, plus dry-run preview and parsed message limits.                                                                    |
| Upload routing            | Broker/default partitioning, selected partition, random partition, and even round-robin over all or selected partitions.                                                               |
| Safer restricted clusters | Optional cluster metadata calls are handled as non-fatal, so topics can still load when some cluster-level admin permissions are unavailable.                                          |
| UI polish                 | Responsive topic tabs, horizontal tab scrolling, dark-mode card surfaces, and clearer helper text around the custom workflows.                                                         |

## Core Kafbat UI Features

Kafbat UI is a web interface for observing and operating Kafka clusters from one place.

- Manage multiple Kafka clusters from a single UI.
- Inspect topics, partitions, replication, topic configuration, and broker assignments.
- Browse messages in JSON, plain text, Avro, Protobuf, and other configured encodings.
- Produce messages, create topics, and update topic configuration through guided UI flows.
- Monitor consumer groups, offsets, partition-level lag, and combined lag.
- Work with Schema Registry using Avro, JSON Schema, and Protobuf schemas.
- Connect to Kafka Connect, KSQL, JMX, Prometheus metrics, and managed Kafka services.
- Configure authentication with OAuth 2.0, LDAP, basic auth, cloud IAM, RBAC, and data masking.
- Enable Swagger UI with `SWAGGER_UI_ENABLED=true` for API documentation.
- Use the built-in Model Context Protocol server support from upstream Kafbat UI.

## Interface

![Kafbat UI interface](https://raw.githubusercontent.com/kafbat/kafka-ui/images/overview.gif)

## Quick Start

### Try the published upstream image

The quickest way to see the base Kafbat UI experience is to run the published upstream image:

```bash
docker run -it -p 8080:8080 \
  -e DYNAMIC_CONFIG_ENABLED=true \
  -e SWAGGER_UI_ENABLED=true \
  ghcr.io/kafbat/kafka-ui
```

Open [http://localhost:8080](http://localhost:8080). This Docker image is published by upstream Kafbat UI; use the custom JAR path below when you need the fork-specific Topic Download and Topic Upload features.

### Persistent Docker configuration

For a persistent local or server setup, mount a dynamic config file into the container:

```yaml
services:
    kafbat-ui:
        container_name: kafbat-ui
        image: ghcr.io/kafbat/kafka-ui:latest
        ports:
            - 8080:8080
        environment:
            DYNAMIC_CONFIG_ENABLED: "true"
            SWAGGER_UI_ENABLED: "true"
        volumes:
            - ~/kui/config.yml:/etc/kafkaui/dynamic_config.yaml
```

The compose examples in [documentation/compose/DOCKER_COMPOSE.md](documentation/compose/DOCKER_COMPOSE.md) cover SSL, Schema Registry auth, basic auth, JMX, reverse proxies, SASL, Traefik, Prometheus JMX exporter, and ZooKeeper setups.

## Run the Custom Build

### Download a custom JAR

This fork publishes downloadable JARs through the **Personal: Build Custom JAR** workflow in [.github/workflows/custom-jar.yml](.github/workflows/custom-jar.yml). Download the run-numbered `kafka-ui-V2-<run_number>.jar` asset from a workflow artifact or GitHub Release, then run it with your Kafka UI configuration:

```bash
java -jar kafka-ui-V2-<run_number>.jar --spring.config.additional-location=path/to/kafka-ui-config.yaml
```

### Build a custom JAR locally

Use Java 25 and build the API module with the frontend bundled in:

```bash
./gradlew clean build -x test -Pinclude-frontend=true -Pversion=custom-local
java -jar api/build/libs/api-custom-local.jar --spring.config.additional-location=path/to/kafka-ui-config.yaml
```

On Windows PowerShell, use `./gradlew.bat` instead of `./gradlew`.

## Configuration

Most runtime configuration follows upstream Kafbat UI.

- Dynamic config is enabled with `DYNAMIC_CONFIG_ENABLED=true`.
- The default dynamic config path inside the container is `/etc/kafkaui/dynamic_config.yaml`.
- Swagger UI can be enabled with `SWAGGER_UI_ENABLED=true`.
- Liveness and readiness are exposed at `/actuator/health`.
- Build and application info are exposed at `/actuator/info`.
- Full configuration options are documented in upstream [configuration properties](https://ui.docs.kafbat.io/configuration/misc-configuration-properties).
- Persistent installation guidance is available in upstream [configuration file documentation](https://ui.docs.kafbat.io/configuration/configuration-file).

## Development

### Prerequisites

Use the versions already pinned by this repository:

| Tool    | Version                                         |
| ------- | ----------------------------------------------- |
| Java    | 25                                              |
| Node.js | 22.12.0                                         |
| pnpm    | 10.26.1                                         |
| Docker  | Required for compose environments and e2e tests |

### Project layout

| Module              | Purpose                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| `api`               | Spring Boot backend, Kafka integrations, API resources, and packaged application JAR. |
| `frontend`          | React and Vite web application.                                                       |
| `contract`          | OpenAPI contract resources.                                                           |
| `contract-typespec` | TypeSpec API source and OpenAPI generation.                                           |
| `serde-api`         | Shared serializer/deserializer API contracts.                                         |

### Backend and full build

```bash
./gradlew :api:test
./gradlew clean build -x test -Pinclude-frontend=true -Pversion=custom-local
```

### Frontend

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm gen:sources
pnpm compile
pnpm lint
pnpm test:CI
pnpm dev
```

Use `VITE_DEV_PROXY` in `frontend/.env.local` if the Vite dev server should proxy API requests to a running backend.

### End-to-end tests

```bash
docker-compose -f ./documentation/compose/e2e-tests.yaml up -d
cd e2e-playwright
npm install
npx playwright install
npm run test:stage
```

Use `npm run debug` for Playwright inspector mode and `npm run test:failed` to rerun failures.

## CI/CD in This Fork

Only the personal workflows needed for this fork are kept.

| Workflow                   | File                                                                 | When it runs                       | What it does                                                                          | Secrets                 |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- | ----------------------- |
| Personal: Branch CI        | [.github/workflows/branch-ci.yml](.github/workflows/branch-ci.yml)   | Push, pull request, or manual run  | Runs backend tests, frontend compile, frontend lint, and frontend unit tests.         | None                    |
| Personal: Build Custom JAR | [.github/workflows/custom-jar.yml](.github/workflows/custom-jar.yml) | Manual run or `custom-v*` tag push | Builds `kafka-ui-V2-<run_number>.jar` and uploads it as an artifact or release asset. | Built-in `GITHUB_TOKEN` |

The custom JAR workflow has two publishing modes:

1. Leave `release_tag` empty to create a temporary `kafka-ui-V2-<run_number>.jar` Actions artifact retained for 30 days.
2. Provide a tag such as `custom-v2026.05.01-1`, or push a matching `custom-v*` tag, to create or update a GitHub Release with a run-numbered JAR asset. Existing run-numbered JARs on the release are kept.

## Feature Tour

<details>
  <summary>Show the upstream Kafbat UI workflow examples</summary>

### Topics

Create topics in the browser by choosing settings or pasting parameters.

![Create topic](documentation/images/Create_topic_kafka-ui.gif)

Jump between connectors, related topics, consumers, and overview settings.

![Connector topic consumer](documentation/images/Connector_Topic_Consumer.gif)

### Messages

Produce messages into topics and inspect them from the UI.

![Produce message](documentation/images/Create_message_kafka-ui.gif)

### Schema Registry

Create and manage Avro, JSON Schema, and Protobuf schemas.

![Create schema](documentation/images/Create_schema.gif)

Add schemas before producing Avro or Protobuf encoded messages.

![Schema topic](documentation/images/Schema_Topic.gif)

</details>

## Upstream Resources

This fork is based on upstream Kafbat UI, and most product documentation still lives there:

- [Documentation](https://ui.docs.kafbat.io/)
- [Demo quick start](https://ui.docs.kafbat.io/quick-start/demo-run)
- [Configuration wizard](https://ui.docs.kafbat.io/configuration/configuration-wizard)
- [Helm chart quick start](https://ui.docs.kafbat.io/configuration/helm-charts/quick-start)
- [Contributing guide](https://ui.docs.kafbat.io/development/contributing)
- [Discord community](https://discord.gg/4DWzD7pGE5)
- [Sponsor upstream Kafbat](https://github.com/sponsors/kafbat)

Custom Topic Download and Topic Upload behavior in this fork may not be covered by the upstream documentation.

## License

Kafbat UI is distributed under the [Apache License 2.0](LICENSE). This fork keeps upstream attribution while carrying local customizations for personal builds.
