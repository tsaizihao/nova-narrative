# Nova Narrative Architecture Guide

## Purpose

This document is the primary architecture reference for `叙世者` as we evolve the current prototype into a maintainable `v1` desktop product.

Read this document first when the question is about:
- target architecture
- module boundaries
- directory evolution
- what we borrow from `../aink`
- what we intentionally do not borrow

For product semantics and domain language, keep using [docs/system-specification.md](./system-specification.md). For execution order and milestones, use [docs/implementation-roadmap-v1.md](./implementation-roadmap-v1.md).

## Product Spine And v1 Scope

`叙世者` is a desktop pipeline that turns a source novel into a playable interactive narrative:

1. Import source text
2. Extract a structured world model
3. Review and revise extracted assets
4. Compile a playable story package
5. Run reader sessions with explicit state, lore activation, and rule evaluation

`v1` does not include account systems, sync, plugins, multi-format import, or asset pipelines. The focus is a stable local authoring-and-playing loop.

## Current Prototype Vs Target State

### Current prototype strengths

- The end-to-end loop already exists in one repo and one app shell.
- The backend already has explicit worldbook, rule, story-state, and runtime concepts.
- The frontend already has distinct import, build, review, and reader surfaces.
- The test baseline is healthy for both Vitest and Rust unit tests.

### Current baseline limits

- `src/routes/+page.svelte` still orchestrates too much product flow.
- `src-tauri/src/store.rs` still combines orchestration, provider switching, runtime entrypoints, and part of the persistence policy.
- Public-facing types are too close to storage/runtime internals.

### Target state

We keep the current repository and tech stack, but we reshape it toward the `aink` direction:

1. `Svelte App Shell`
2. `Frontend Backend Adapter`
3. `Tauri Command Adapter`
4. `Application / Domain Core`
5. `Infrastructure`

The main rule is simple: each layer may depend downward, never sideways around its boundary.

## Layered Architecture

### 1. Svelte App Shell

Responsibilities:
- route-level orchestration
- local UI state
- async flow control
- passing data into presentational components

Rules:
- no direct `invoke`
- no direct mock backend usage
- no command-name strings
- no business-shape transformations that belong to backend adapters

Current direction:
- `src/routes/+page.svelte` now consumes domain backends instead of a monolithic `api` surface

### 2. Frontend Backend Adapter

Responsibilities:
- centralized IPC invocation
- error normalization
- stable domain backends for page consumption

Rules:
- `commandClient` is the only place allowed to call Tauri `invoke`
- mock backend dispatch stays in the adapter layer, not in pages
- domain modules export typed functions grouped by product area

Current shape:
- `src/lib/backend/commandClient.ts`
- `src/lib/modules/projects/backend.ts`
- `src/lib/modules/review/backend.ts`
- `src/lib/modules/runtime/backend.ts`
- `src/lib/modules/settings/backend.ts`

Compatibility note:
- `src/lib/api/client.ts` remains as a compatibility facade during the transition, but it is no longer the preferred entrypoint

### 3. Tauri Command Adapter

Responsibilities:
- receive IPC inputs
- call application services
- map backend errors to structured command errors
- register commands in one place

Rules:
- no real business logic in command files
- no direct provider orchestration in command files
- no filesystem details in command files
- command failures must return structured `{ code, message }`

Current shape:
- `src-tauri/src/commands/project.rs`
- `src-tauri/src/commands/review.rs`
- `src-tauri/src/commands/runtime.rs`
- `src-tauri/src/commands/settings.rs`
- shared lock/error bridge in `src-tauri/src/commands/shared.rs`

### 4. Application / Domain Core

Responsibilities:
- input validation
- use-case orchestration
- grouping store interactions behind service facades
- future home for DTO mapping and policy decisions

Rules:
- services define behavior by product area
- services may orchestrate repositories/providers/runtime, but should not care about Tauri
- validation helpers and command-facing utility types belong here or in `app_api`

Current shape:
- `src-tauri/src/application/project_service.rs`
- `src-tauri/src/application/review_service.rs`
- `src-tauri/src/application/runtime_service.rs`
- `src-tauri/src/application/settings_service.rs`
- input validation in `src-tauri/src/app_api/input_validation.rs`

### 5. Infrastructure

Responsibilities:
- persistence format
- keyring integration
- HTTP providers
- migrations and storage versioning
- logging and diagnostics

Near-term reality:
- `ProjectStore` is still the main persistence and orchestration object
- this is acceptable for the current phase, but it is now treated as a facade/assembly point rather than the permanent architecture center

## Frontend Boundary Rules

- Pages and components call only `modules/*/backend.ts`.
- UI tests should prefer domain backends or pure props, not direct command-name assertions.
- Any future non-Tauri dev mode stays behind `commandClient`.
- Shared error rendering should use normalized client errors rather than raw thrown values.

## Tauri Command Rules

- Commands must return serializable structured errors.
- Commands may lock shared state, then immediately delegate to application services.
- Commands must not contain provider selection, storage path decisions, or runtime state machine logic.
- New commands should be added under the appropriate domain file, not `lib.rs`.

## Rust Layer Responsibilities

### `app_api`

Use for:
- input validation
- future command DTOs
- error payloads and serialization helpers
- pure helper logic that should not know about storage or Tauri

Do not use for:
- filesystem access
- provider HTTP
- session mutation

### `application`

Use for:
- product-facing services grouped by domain
- orchestrating `ProjectStore`, runtime, compiler, analyzer, and validation

Do not use for:
- direct Tauri APIs
- direct UI-facing serialization details

### `infra`

Target future home for:
- project/session repositories
- AI settings storage
- migrations
- JSON/JSONL helpers
- provider transport adapters

Current shape:
- `src-tauri/src/infra/project_repository.rs`
- `src-tauri/src/infra/session_repository.rs`
- `src-tauri/src/infra/ai_settings_repository.rs`
- `src-tauri/src/infra/storage_manifest_repository.rs`
- `src-tauri/src/infra/diagnostics_repository.rs`
- `src-tauri/src/infra/path_layout.rs`

Current note:
- `ProjectStore` still assembles these repositories and owns the higher-level use cases
- disk layout remains `projects/*.json`, `sessions/*.json`, `ai-settings.json`, plus additive `storage-manifest.json` and `diagnostics.log`

## Storage Model And Runtime Model Boundaries

External semantic types remain:
- `NovelProject`
- `StoryPackage`
- `SessionState`
- `ScenePayload`
- `CharacterCard`
- `WorldBookEntry`
- `RuleDefinition`
- `StoryState`

Guidance:
- keep these stable for UI and command contracts
- do not assume these are the final storage record format
- introduce repository records or migration-aware DTOs before changing disk shape

The main anti-goal is conflating:
- disk record shape
- runtime in-memory shape
- UI transport shape

## `aink` Borrowing Strategy

### Adopt directly

- shared command client with error normalization
- grouped frontend domain backends
- thin Tauri command adapters
- input validation helpers
- structured command error payloads
- service-style state assembly
- gradual move toward dedicated infra modules

### Borrow as direction, not code

- app/domain/infra split
- stronger repository boundaries
- migration-aware storage
- workspace evolution only after clear benefits

### Do not copy

- Vue UI implementation
- writing-assistant-specific modules
- whole monorepo shape before the current repo earns it

## Repository Evolution Strategy

### Current default

Stay in one repository and one app. Split by responsibility first, then reconsider physical package boundaries later.

### Workspace migration gate

Do not move to an `aink`-style workspace until all are true:
- commands are fully modularized
- application and future infra boundaries are stable
- persistence format has a versioning strategy
- reader and review flows have stable regression coverage
- at least two real crates or front-end packages provide clear maintenance value

## Guardrails And No-Go Zones

- Do not re-centralize command implementations into `lib.rs`.
- Do not add new direct `invoke` usage outside `commandClient`.
- Do not let pages import mock backend helpers.
- Do not let new persistence logic accumulate inside route components.
- Do not adopt `../aink` code by copy-pasting domain behavior without checking fit against `叙世者` semantics.

## Current Implementation Status

The repository now partially implements the first foundation slice of this guide:
- frontend command invocation is centralized
- domain backends exist
- route-level usage has moved to domain backends
- Rust command implementations are split by domain
- Rust service facades and validation helpers exist

Still pending:
- `store.rs` extraction into dedicated infra/services
- structured command DTO layers
- migration-aware persistence
- deeper route-state decomposition
- v1 hardening phases for review and runtime
