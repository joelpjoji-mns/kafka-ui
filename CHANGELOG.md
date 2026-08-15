# Changelog

All notable MyKafka UI changes are documented in Git history and published as release notes.

## Automated Release Notes

Every successful commit to `main` creates a `mykafka-v0.1.<run>` GitHub Release. Its changelog contains every non-merge commit since the previous MyKafka release tag, and the release attaches the matching `mykafka-ui-v0.1.<run>.jar`.

This file describes the release policy and the durable product milestones. The GitHub Release page is the authoritative per-build changelog because it is generated from the exact commit range that produced the JAR.

## Unreleased

### Release automation

- Successful `main` commits now publish an incrementing MyKafka UI release after backend, frontend, and JAR packaging checks pass.
- Every automated release includes a downloadable JAR and commit-level changelog notes.
- The manual release workflow remains available for artifact-only builds and explicitly named releases.

### Product identity

- Renamed the fork and runtime identity to **MyKafka UI**.
- Added a MyKafka UI startup banner and aligned browser titles, manifests, API titles, repository links, JAR naming, and workflow labels.
- Retained the original bat-inspired fork mark without using official Batman or DC artwork.

### Operator workflows

- Added history-first, gap-free live message tailing with new messages prepended above the current view.
- Added safe consumer offset reset previews and inactive-group protection.
- Added topic download/upload, Developer Hub, Operations Center, Topic Governance, Audit Explorer, Record Explorer, and refined Glass/AMOLED themes.

## Historical Context

The first automated MyKafka UI release will include the repository's complete historical non-merge commit log because no prior `mykafka-v*` tag exists. Subsequent releases will contain only the commits introduced after the preceding release.
