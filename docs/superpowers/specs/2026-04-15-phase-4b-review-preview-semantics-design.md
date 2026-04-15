# Phase 4B Review Preview Semantics Design

## Goal

Upgrade the review workspace from a manual sample-based preview rail into a runtime-aligned authoring surface. The review stage should let authors configure preview context, see lore/rule/state outcomes that match runtime semantics more closely, and understand the projected story outcome without entering the reader.

## Scope

This slice builds on Phase 4A and stays focused on review semantics and author feedback.

In scope:

- add a single aggregated review preview command
- add configurable preview context for `sceneId`, `eventKind`, `inputText`, `actorCharacterId`, and `targetCharacterId`
- persist the last successfully applied preview context inside the project
- auto-refresh preview when context changes
- debounce `inputText` refreshes while keeping `scene / event / actor / target` immediate
- return and render a runtime-aligned preview snapshot, including projected outcome
- keep mock backend and Rust backend semantically aligned

Out of scope:

- full runtime session simulation
- preview history or diff view
- migration hooks or storage versioning
- workspace migration
- turning review into a second reader shell

## Product Decisions

The following decisions are locked for Phase 4B:

- Use a new aggregated preview command rather than composing multiple existing preview commands in the frontend.
- Preview context is configurable and includes:
  - `sceneId`
  - `eventKind`
  - `inputText`
  - `actorCharacterId`
  - `targetCharacterId`
- Preview context is persisted inside the project.
- Context is only persisted after a preview request succeeds and the returned snapshot is accepted as the applied preview.
- Context changes auto-refresh preview.
- `inputText` refreshes are debounced.
- `scene / event / actor / target` changes refresh immediately.
- Preview result includes projected outcome, not only current-scene evaluation.
- Review remains an authoring tool, not a hidden reader/runtime shell.

## Target Architecture

Phase 4B keeps the Phase 4A review workspace controller as the review-state owner and expands it with preview context and applied snapshot orchestration.

The flow becomes:

1. Review workspace loads a built `NovelProject`.
2. Workspace resolves preview context from persisted project metadata or sensible defaults.
3. Context edits update local draft state.
4. Context edits trigger auto-refresh:
   - immediate for `sceneId`, `eventKind`, `actorCharacterId`, `targetCharacterId`
   - debounced for `inputText`
5. Frontend calls one aggregated backend command.
6. Backend returns a `ReviewPreviewSnapshot`.
7. Frontend updates the applied snapshot and persists the applied context only after a successful refresh.

This keeps command composition, semantic defaults, and runtime alignment in the backend while keeping interaction timing, race handling, and UI state in the review workspace controller.

## Data Model

### Project Metadata

Add a new project-level field for persisted review preview configuration.

Use this exact shape:

```ts
interface ReviewPreviewContext {
  sceneId: string;
  eventKind: string;
  inputText: string;
  actorCharacterId?: string | null;
  targetCharacterId?: string | null;
}
```

Add this exact field to `NovelProject`:

```ts
interface NovelProject {
  // existing fields
  review_preview_context?: ReviewPreviewContext | null;
}
```

This field belongs on `NovelProject`, not on `story_package`, because it is authoring metadata rather than compiled output or runtime state.

### Aggregated Snapshot

Add a new frontend/backend shared preview result contract.

Use this exact shape:

```ts
interface ProjectedSceneChoicePreview {
  id: string;
  label: string;
  intentTag: string;
  nextSceneId: string;
  unlockConditions: string[];
}

interface ProjectedOutcomePreview {
  blocked: boolean;
  staysOnScene: boolean;
  nextSceneId?: string | null;
  nextSceneTitle?: string | null;
  nextSceneSummary?: string | null;
  candidateChoices: ProjectedSceneChoicePreview[];
}

interface ReviewPreviewExplanations {
  loreSummary: string;
  ruleSummary: string;
  outcomeSummary: string;
}

interface ReviewPreviewSnapshot {
  context: ReviewPreviewContext;
  lorePreview: ActiveLoreEntry[];
  rulePreview: RuleEvaluationResult;
  projectedOutcome: ProjectedOutcomePreview;
  explanations: ReviewPreviewExplanations;
}
```

These field names are part of the 4B contract and should be used consistently in frontend types, backend DTOs, and mock backend responses.

## Backend Design

### New Review Command

Add a new aggregated review command and supporting application-service entrypoint.

Use this exact command name:

- `preview_review_snapshot`

Input:

- `projectId`
- `sceneId`
- `eventKind`
- `inputText`
- `actorCharacterId`
- `targetCharacterId`

No existing review command is removed in this slice. Existing commands can remain for compatibility or internal reuse.

### Snapshot Assembly

The backend should assemble `ReviewPreviewSnapshot` by:

1. loading the project story package
2. resolving the selected scene
3. resolving actor and target characters from explicit ids or stable defaults
4. evaluating active lore for the selected scene and input
5. evaluating rules using the same actor/target/input context
6. deriving projected outcome from the selected scene plus evaluation result
7. generating short, structured explanation strings for author-facing display

### Runtime Alignment Rule

The backend must align review preview semantics with runtime semantics as far as possible without creating a true session:

- use the selected scene from the compiled package
- use real world-model characters for actor/target resolution
- use real rule evaluation with the selected event and text
- surface `blocked` exactly as runtime would interpret the rule evaluation
- derive next-scene projection from current scene candidate choices and fallback semantics where possible

The backend does not need to produce a real `ScenePayload`. It should instead produce a deterministic preview projection that is explicitly labeled as projected author feedback.

### Projected Outcome Semantics

Projected outcome should answer these questions:

- will this action be blocked?
- if blocked, does the story remain on the current scene?
- if not blocked, is there a deterministic next scene to project?
- what scene would the story likely move to?
- what candidate choices would likely be visible after that move?

If no deterministic next scene can be inferred, the outcome should state that the story remains on the current scene or that no scene transition can be projected yet.

### Persistence

Add a narrow review command dedicated to storing the applied preview context.

Use this exact command name:

- `save_review_preview_context`

Input:

- `projectId`
- `context`

This command writes `review_preview_context` into the project after a successful preview refresh. Phase 4B does not persist preview snapshots themselves.

## Frontend Design

### Review Workspace Controller

Expand the review workspace controller with:

- `previewContextDraft`
- `appliedPreviewContext`
- `previewSnapshot`
- `previewStatus`
- `previewError`
- request sequencing state to discard stale async results

The controller should own all refresh timing and race handling. The page should remain uninvolved.

### Refresh Behavior

Refresh policy:

- changing `sceneId`, `eventKind`, `actorCharacterId`, or `targetCharacterId` triggers an immediate refresh
- changing `inputText` triggers a debounced refresh
- save/delete actions for cards, lore, or rules should still mark preview as stale, but preview should recover through the normal auto-refresh path after the next relevant context change or explicit refresh

If a request returns out of order, the controller must ignore it instead of overwriting the newest snapshot.

If a request fails:

- keep the current local draft context
- keep the last successfully applied context
- keep the last successful snapshot visible if present
- show refresh error feedback without clearing the editing workspace

### Review UI

Upgrade the review preview area into three sections:

1. **Preview Context**
   - scene selector
   - event selector
   - input text
   - actor selector
   - target selector
   - refresh state and applied-context indicator

2. **Semantic Result**
   - active lore
   - active rules
   - blocked state
   - story-state summary
   - short explanations

3. **Projected Outcome**
   - whether the action is blocked
   - whether the story stays on the current scene
   - next scene title/summary when available
   - projected candidate choices

The UI should reuse existing runtime language and display patterns where practical so review and reader semantics do not drift apart.

## Mock Backend

The mock backend must support the same aggregated snapshot behavior as Rust:

- same input shape
- same persisted preview context behavior
- same immediate vs debounced refresh expectations from the frontend contract
- same projected-outcome semantics for blocked vs unblocked actions

Mock behavior may stay heuristic, but the shape and major semantics must remain aligned with Rust so frontend tests stay meaningful.

## Error Handling

Backend should keep structured command errors.

Frontend should distinguish:

- refresh failure
- invalid preview context
- unavailable projected outcome

Preview errors should not reset:

- unsaved entity drafts
- preview context draft
- last successful preview snapshot

## Test Strategy

### Rust

Add coverage for:

- aggregated preview snapshot using configurable scene/event/input/actor/target
- actor and target resolution
- blocked vs unblocked projected outcome
- preview explanation presence
- persisted review preview context round-trip through project storage

### Frontend

Add coverage for:

- loading persisted preview context into the review workspace
- immediate refresh on scene/event/actor/target changes
- debounced refresh on input text changes
- successful refresh persisting applied context
- refresh failure preserving draft context and last successful snapshot
- stale async preview result being ignored
- projected outcome rendering

### Regression

Keep passing:

- existing review workspace tests from Phase 4A
- build and runtime regression tests
- mock backend contract tests

## Acceptance Criteria

Phase 4B is done when:

- authors can configure preview context from the review workspace
- preview refreshes automatically with the chosen timing rules
- the last successful preview context survives project reopen
- the review panel shows runtime-aligned lore/rule/state feedback
- the review panel shows projected outcome for the configured action
- blocked and unblocked outcomes are clearly distinguishable
- frontend and backend tests cover the new behavior

## Risks And Constraints

- Projected outcome must stay conservative and explicit rather than pretending to be a real session.
- Persisted preview context changes project format, so implementation should stay additive and tolerant of missing data.
- Auto-refresh requires stale-response protection to avoid race-condition UI regressions.
- This slice should not absorb Phase 5 runtime stabilization work.
