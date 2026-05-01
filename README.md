<div align="center">
<img src="documentation/images/logo_new.png" alt="logo"/>
<h1>Kafka-Ui-V2</h1>

Personal Kafka UI build with an overpowered message Download tab, safe Upload tab, and a simple downloadable JAR release flow.
</div>

<div align="center">
<a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License"/></a>
<img src="documentation/images/free-open-source.svg" alt="price free"/>
<a href="https://github.com/joelpjoji-mns/kafka-ui/releases"><img src="https://img.shields.io/github/v/release/joelpjoji-mns/kafka-ui?label=Kafka-Ui-V2" alt="latest fork release version"/></a>
</div>

## Why this fork exists

Kafka-Ui-V2 is my personal fork of the upstream Kafbat UI project. I needed a portable Kafka UI JAR that could be dropped into my own environments and do more than browse messages. The goal is not to replace or merge back into upstream. The goal is a practical personal build with the exact tools I wanted for day-to-day Kafka investigation:

* download a precise slice of topic data quickly,
* keep every exported Kafka message as its own file,
* upload messages back safely with dry-run previews,
* run without upstream organization publishing secrets or infrastructure,
* publish one simple GitHub Release asset named like `kafka-ui-v2.0.jar`.

This repository keeps the core Kafka UI experience and Apache 2.0 license lineage from Kafbat UI, while removing upstream-only automation such as DockerHub, AWS/ECR, Helm publishing, Maven Central, Discord/community automation, feature-environment jobs, release drafter, and Codecov workflows.

## What is different in Kafka-Ui-V2

### Topic Download tab

Kafka-Ui-V2 adds a dedicated topic Download tab for ZIP exports:

* one file per Kafka message,
* filenames include offset, partition, and topic,
* all partitions or selected partitions,
* newest/oldest windows,
* global offset windows,
* timestamp windows and timeframes,
* text search and smart filter support,
* key/value serde selection,
* text, JSON metadata, or payload-only output.

Advanced offset filters are also included:

* **Per-partition starting offsets** — export from different offsets in different partitions, for example partition 0 from offset 100 and partition 1 from offset 500.
* **Per-partition offset ranges** — export inclusive ranges per partition, for example partition 0 offsets 100 through 200 and partition 1 offsets 500 through 650.
* The message limit is a total ZIP cap across all selected partitions and ranges.

### Topic Upload tab

Kafka-Ui-V2 adds a dedicated topic Upload tab:

* single file, multiple files, or ZIP upload,
* file-per-message, text-lines, NDJSON, and JSON-array parsing,
* dry-run preview before producing,
* parsed message limits,
* optional metadata headers,
* extra JSON headers,
* key/value serde selection,
* broker/default partitioning,
* selected partition,
* random partition,
* even round-robin across all or selected partitions.

### Runtime and UI polish

* Optional Kafka metadata calls tolerate restricted cluster admin permissions so topics can still load when some cluster-level operations are denied.
* Download and Upload tabs have responsive layouts, horizontal topic-tab scrolling, dark-mode card surfaces, and readable helper text.

## CI/CD in this fork

Only two GitHub Actions workflows are kept:

| Workflow | File | Purpose | Secrets needed |
| --- | --- | --- | --- |
| **Personal: Branch CI** | [.github/workflows/branch-ci.yml](.github/workflows/branch-ci.yml) | Tests branches and pull requests with backend tests plus frontend compile/lint/unit tests. | None |
| **Personal: Build Custom JAR** | [.github/workflows/custom-jar.yml](.github/workflows/custom-jar.yml) | Builds a frontend-included Kafka-Ui-V2 JAR as an Actions artifact or GitHub Release asset. | None beyond `GITHUB_TOKEN` |

No Packages are published by design. The long-lived downloadable output is the JAR attached to a GitHub Release.

## Version and JAR naming

Kafka-Ui-V2 releases use incremental tags like:

* `kafka-ui-v2.0`
* `kafka-ui-v2.1`
* `kafka-ui-v2.0.1`

The release JAR name matches the tag:

* `kafka-ui-v2.0.jar`
* `kafka-ui-v2.1.jar`
* `kafka-ui-v2.0.1.jar`

## Publishing a downloadable JAR

Use **Personal: Build Custom JAR** in [.github/workflows/custom-jar.yml](.github/workflows/custom-jar.yml).

There are two publishing modes:

1. **Temporary Actions artifact** — run the workflow manually and leave `release_tag` empty. It uploads a 30-day Actions artifact named like `kafka-ui-v2-dev-<short-sha>`.
2. **GitHub Release asset** — run the workflow with a release tag such as `kafka-ui-v2.0`, or push a tag matching `kafka-ui-v*`. It creates or updates a GitHub Release and attaches a long-lived JAR named like `kafka-ui-v2.0.jar`.

To publish `kafka-ui-v2.0.jar`:

1. Open this fork in GitHub.
2. Go to **Actions**.
3. Select **Personal: Build Custom JAR**.
4. Click **Run workflow**.
5. Select the branch or commit to build.
6. Enter `kafka-ui-v2.0` as `release_tag`.
7. Download `kafka-ui-v2.0.jar` from the created GitHub Release.

Run the downloaded JAR with your Kafka UI config:

```bash
java -jar kafka-ui-v2.0.jar --spring.config.additional-location=path/to/kafka-ui-config.yaml
```

## Running locally from source

Build the full frontend-included JAR:

```bash
./gradlew clean build -x test -Pinclude-frontend=true -Pversion=2.0-SNAPSHOT
```

Run it:

```bash
java -jar api/build/libs/api-2.0-SNAPSHOT.jar --spring.config.additional-location=path/to/kafka-ui-config.yaml
```

The app listens on the configured server port. Health is available at `/actuator/health`, and build info is available at `/actuator/info`.

## Upstream attribution

Kafka-Ui-V2 is based on Kafbat UI and preserves its Apache 2.0 licensing. The Java package names and many UI assets still carry Kafbat naming because this fork focuses on personal functionality and release packaging, not a deep package rename.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
