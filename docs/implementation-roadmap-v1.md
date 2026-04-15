# Nova Narrative v1 Implementation Roadmap

## Purpose

This document is the canonical execution roadmap for taking the current prototype to a maintainable `v1`.

Use this document when the question is:
- what phase comes next
- what counts as done for a phase
- what interfaces are expected to change
- what tests must exist before we claim completion

For architecture rules, use [docs/architecture-guide.md](./architecture-guide.md). For system semantics, use [docs/system-specification.md](./system-specification.md).

## Roadmap Principles

- Prioritize the full authoring-to-playing loop over idealized refactors.
- Borrow heavily from `../aink` patterns, but keep `叙世者` semantics and repo shape intentionally smaller.
- Stabilize boundaries before deep storage migrations.
- Keep public semantics stable while internal structures evolve.

## Phase Overview

| Phase | Goal | Current Status |
|---|---|---|
| 0 | Establish one trusted documentation entrypoint | Implemented |
| 1 | Replace monolithic frontend/backend entrypoints with domain boundaries | Implemented |
| 2 | Introduce Rust `commands + app_api + application` skeleton | Implemented |
| 3 | Harden import/extract/compile behavior | Implemented |
| 4 | Upgrade review workspace into a stable authoring surface | Implemented |
| 5 | Stabilize runtime and reader behavior for v1 | Implemented |
| 6 | Add storage migration and diagnostics foundations | Implemented |
| 7 | Align docs/tests/commands into a releasable v1 baseline | Implemented |

## Detailed Phases

### Phase 0: Documentation Consolidation

Goal:
- make architecture and roadmap discoverable from one place

Entry condition:
- repo already has system and historical design docs

Work:
- add `docs/architecture-guide.md`
- add `docs/implementation-roadmap-v1.md`
- update older top-level docs to point at the new canonical entrypoints

Done when:
- new contributors can answer “what is the target shape?” and “what do we do next?” without reading historical design files first

Risks:
- duplicated guidance across old and new docs

Mitigation:
- treat old spec/plan documents as historical or domain-reference material, not primary execution sources

### Phase 1: Boundary Refactor Without Product Flow Changes

Goal:
- move frontend and Tauri entrypoints to stable domain boundaries without changing the main product loop

Entry condition:
- baseline tests are green

Work:
- centralize command invocation and error normalization
- create domain backends for `projects`, `review`, `runtime`, `settings`
- move route-level usage to domain backends
- split Tauri command implementations out of `lib.rs`

Done when:
- pages no longer depend on raw command names
- new command files are grouped by domain
- frontend tests prove command contract wiring
- existing end-to-end flow still behaves the same

Completed in this change:
- `commandClient`
- domain backends
- route migration away from monolithic `api`
- domain command files under Rust
- structured command error shape in backend code

### Phase 2: Rust Layering Skeleton

Goal:
- create the smallest useful form of `commands / app_api / application`

Entry condition:
- Phase 1 boundary changes are stable

Work:
- add validation helpers
- introduce service facades by domain
- route command files through service layer
- keep `ProjectStore` as a temporary orchestration facade

Done when:
- command files are adapters, not policy hosts
- input validation is not scattered through route or component code
- backend structure is ready for later `infra` extraction

Completed in this change:
- `app_api/input_validation.rs`
- `application/*_service.rs`
- `commands/*`

### Phase 3: Import / Extract / Compile Hardening

Goal:
- make the import-to-build loop predictable and failure-aware

Dependencies:
- Phase 2 skeleton in place

Work:
- classify importer, analyzer, and compiler failures
- normalize build status transitions
- document and test re-import reset behavior
- make provider failure semantics consistent

Done when:
- import, extract, and compile failures surface predictable structured errors
- the UI can reflect build progress and failure state without string guessing
- re-import and rebuild are regression-tested

### Phase 4: Review Workspace v1

Goal:
- make the review surface a reliable authoring tool rather than only a prototype editor

Dependencies:
- stable build outputs from Phase 3

Work:
- extract review page orchestration state
- decouple editing actions from preview refresh
- surface lore hits, rule hits, and blocked actions clearly
- prepare space for project summary, warnings, and validation feedback

Done when:
- creators can iterate on cards, lore, and rules with consistent preview feedback
- preview semantics match runtime semantics

### Phase 5: Runtime And Reader Stabilization

Goal:
- make the reading and play loop dependable enough for `v1`

Dependencies:
- review/build chain stable

Work:
- isolate session progression orchestration
- formalize choice, free input, checkpoint, and ending transitions
- keep reader shells presentation-focused
- ensure rail/drawer data comes from the same runtime snapshot semantics

Done when:
- runtime state transitions are covered in Rust and UI tests
- desktop and mobile readers share one data contract

Implemented baseline:
- runtime snapshot is the single reader data source
- session lifecycle now distinguishes `active`, `ending_reached`, and `finished`
- ending flow supports explicit finish and checkpoint rewind reopening
- review shell only marks truly active sessions as resumable

### Phase 6: Storage, Migration, Diagnostics

Goal:
- make persisted data survivable across iterative development

Dependencies:
- stable command/application boundaries

Work:
- define storage versioning or migration hooks
- normalize project/session/settings directory conventions
- extract JSON/JSONL and persistence concerns out of `store.rs`
- add lightweight diagnostics and logging

Done when:
- project/session data has a documented compatibility path
- failures can be localized by layer

Implemented baseline:
- runtime storage now bootstraps `storage-manifest.json`
- migration hook exists for manifest version upgrades
- diagnostics append to `diagnostics.log` for major store operations and failures

### Phase 7: v1 Release Baseline

Goal:
- finish the first maintainable product baseline

Dependencies:
- phases 0-6 completed or consciously deferred

Work:
- align README, roadmap, architecture, and system spec
- clean up compatibility layers that are no longer needed
- standardize build/check/test commands
- decide whether workspace migration is justified next

Done when:
- repo docs and code boundaries tell the same story
- new contributors can run, test, and extend the core loop confidently

Implemented baseline:
- `README.md`, architecture guide, roadmap, and system spec entry links are aligned
- repo-level verification is standardized through `pnpm verify`
- the current single-repo `v1` baseline is explicit, while workspace migration remains a later decision

## Public Interface Adjustments

### Frontend

Preferred public frontend backend groups:
- `projects backend`
- `review backend`
- `runtime backend`
- `settings backend`

Temporary compatibility:
- `src/lib/api/client.ts` may remain until route/component migration is complete, but new work should not build on it

### Tauri Errors

Commands should return:
- `code`
- `message`

Frontend should consume normalized client errors rather than raw thrown values.

### Backend Internal Contracts

Expected layers:
- command input types and validation
- service-level DTO or argument mapping where needed
- storage/repository records introduced before disk migrations

## Test Requirements

### Rust Unit Tests

Must cover:
- input validation
- structured error mapping
- importer chapter split and re-import reset behavior
- analyzer/provider failure branches
- compiler output invariants
- runtime transitions for choice, free input, rewind, finish

### Rust Integration Tests

Must cover:
- create project -> build story package -> start session
- re-import reset behavior
- session progression
- preview/runtime semantic alignment

### Frontend Unit And Component Tests

Must cover:
- command client normalization
- domain backend command contracts
- review save/delete/refresh flows
- reader data contract parity across desktop and mobile
- error/empty/busy states

### End-To-End Scenarios

Required minimum:
1. Create a project and import sample text
2. Choose provider and build
3. Edit character/worldbook/rule data in review
4. Enter reader
5. Submit a choice
6. Submit free input
7. Rewind to checkpoint
8. Reach an ending
9. Reopen project and resume

## Technical Debt Order

Work this debt in order:

1. `store.rs` decomposition
2. build pipeline failure classification
3. route-state decomposition for import/review/runtime
4. storage migration/versioning
5. compatibility-layer cleanup
6. workspace-migration evaluation

## Workspace Migration Decision Gate

Re-evaluate workspace migration only after:
- command modules are stable
- service and future infra boundaries are clear
- persistence has a versioning plan
- tests cover review/runtime flows with confidence
- splitting crates/packages would reduce real maintenance cost

Until then, prefer a clean single-repo structure over premature monorepo complexity.
