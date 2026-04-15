# Phase 4B Review Preview Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a runtime-aligned aggregated review preview flow with configurable persisted preview context, projected outcome, and debounced auto-refresh inside the review workspace.

**Architecture:** Add two new review commands on the Rust side, `preview_review_snapshot` and `save_review_preview_context`, backed by additive `NovelProject` metadata and a new aggregated preview DTO. Then update the mock backend, frontend review backend, workspace controller, and preview UI so the review surface manages applied preview context, auto-refresh timing, stale-response protection, and projected-outcome rendering without involving `+page.svelte`.

**Tech Stack:** SvelteKit, TypeScript, Vitest, Svelte stores, Tauri 2 commands, Rust application/store layers.

---

### Task 1: Lock The Shared Preview Contract

**Files:**
- Create: none
- Modify: `src/lib/types.ts`
- Modify: `src/lib/modules/review/backend.ts`
- Modify: `src/lib/modules/review/backend.test.ts`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/application/review_service.rs`
- Modify: `src-tauri/src/commands/review.rs`

- [ ] **Step 1: Write the failing frontend backend-contract tests**

Add this test block to `src/lib/modules/review/backend.test.ts`:

```ts
it('requests aggregated review preview through the shared command client', async () => {
  const { previewReviewSnapshot } = await import('./backend');

  invokeCommand.mockResolvedValueOnce({
    context: {
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: 'character-1',
      targetCharacterId: 'character-2'
    },
    lorePreview: [],
    rulePreview: { blocked: false, active_rules: [], story_state: { current_scene_id: 'scene-1', character_states: [], fact_records: [], relationship_states: {}, event_flags: [], possibility_flags: [], unlocked_rules: [], visited_scenes: ['scene-1'], checkpoints: [] } },
    projectedOutcome: {
      blocked: false,
      staysOnScene: false,
      nextSceneId: 'scene-2',
      nextSceneTitle: '北门开启',
      nextSceneSummary: '门后的真相终于显露。',
      candidateChoices: []
    },
    explanations: {
      loreSummary: '没有新增 lore 命中',
      ruleSummary: '没有规则阻止当前动作',
      outcomeSummary: '动作会推进到 scene-2'
    }
  });

  await previewReviewSnapshot('project-1', {
    sceneId: 'scene-1',
    eventKind: 'open_gate',
    inputText: '午夜去开门',
    actorCharacterId: 'character-1',
    targetCharacterId: 'character-2'
  });

  expect(invokeCommand).toHaveBeenCalledWith('preview_review_snapshot', {
    projectId: 'project-1',
    context: {
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: 'character-1',
      targetCharacterId: 'character-2'
    }
  });
});

it('requests preview-context persistence through the shared command client', async () => {
  const { saveReviewPreviewContext } = await import('./backend');

  invokeCommand.mockResolvedValueOnce({
    sceneId: 'scene-1',
    eventKind: 'open_gate',
    inputText: '午夜去开门',
    actorCharacterId: 'character-1',
    targetCharacterId: 'character-2'
  });

  await saveReviewPreviewContext('project-1', {
    sceneId: 'scene-1',
    eventKind: 'open_gate',
    inputText: '午夜去开门',
    actorCharacterId: 'character-1',
    targetCharacterId: 'character-2'
  });

  expect(invokeCommand).toHaveBeenCalledWith('save_review_preview_context', {
    projectId: 'project-1',
    context: {
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: 'character-1',
      targetCharacterId: 'character-2'
    }
  });
});
```

- [ ] **Step 2: Run the frontend contract test to verify it fails**

Run:

```bash
pnpm test -- --run src/lib/modules/review/backend.test.ts
```

Expected: FAIL because `previewReviewSnapshot` and `saveReviewPreviewContext` do not exist yet and the new shared types are missing.

- [ ] **Step 3: Add the shared TypeScript and Rust DTOs plus command signatures**

In `src/lib/types.ts`, add:

```ts
export interface ReviewPreviewContext {
  sceneId: string;
  eventKind: string;
  inputText: string;
  actorCharacterId?: string | null;
  targetCharacterId?: string | null;
}

export interface ProjectedSceneChoicePreview {
  id: string;
  label: string;
  intentTag: string;
  nextSceneId: string;
  unlockConditions: string[];
}

export interface ProjectedOutcomePreview {
  blocked: boolean;
  staysOnScene: boolean;
  nextSceneId?: string | null;
  nextSceneTitle?: string | null;
  nextSceneSummary?: string | null;
  candidateChoices: ProjectedSceneChoicePreview[];
}

export interface ReviewPreviewExplanations {
  loreSummary: string;
  ruleSummary: string;
  outcomeSummary: string;
}

export interface ReviewPreviewSnapshot {
  context: ReviewPreviewContext;
  lorePreview: ActiveLoreEntry[];
  rulePreview: RuleEvaluationResult;
  projectedOutcome: ProjectedOutcomePreview;
  explanations: ReviewPreviewExplanations;
}
```

Also extend `NovelProject`:

```ts
export interface NovelProject {
  // existing fields
  review_preview_context?: ReviewPreviewContext | null;
}
```

In `src/lib/modules/review/backend.ts`, add:

```ts
import type {
  ReviewPreviewContext,
  ReviewPreviewSnapshot
} from '$lib/types';

export const previewReviewSnapshot = (
  projectId: string,
  context: ReviewPreviewContext
): Promise<ReviewPreviewSnapshot> =>
  invokeCommand('preview_review_snapshot', { projectId, context });

export const saveReviewPreviewContext = (
  projectId: string,
  context: ReviewPreviewContext
): Promise<ReviewPreviewContext> =>
  invokeCommand('save_review_preview_context', { projectId, context });
```

In `src-tauri/src/models.rs`, add:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReviewPreviewContext {
    pub scene_id: String,
    pub event_kind: String,
    pub input_text: String,
    pub actor_character_id: Option<String>,
    pub target_character_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectedSceneChoicePreview {
    pub id: String,
    pub label: String,
    pub intent_tag: String,
    pub next_scene_id: String,
    pub unlock_conditions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectedOutcomePreview {
    pub blocked: bool,
    pub stays_on_scene: bool,
    pub next_scene_id: Option<String>,
    pub next_scene_title: Option<String>,
    pub next_scene_summary: Option<String>,
    pub candidate_choices: Vec<ProjectedSceneChoicePreview>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReviewPreviewExplanations {
    pub lore_summary: String,
    pub rule_summary: String,
    pub outcome_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReviewPreviewSnapshot {
    pub context: ReviewPreviewContext,
    pub lore_preview: Vec<ActiveLoreEntry>,
    pub rule_preview: RuleEvaluationResult,
    pub projected_outcome: ProjectedOutcomePreview,
    pub explanations: ReviewPreviewExplanations,
}
```

Extend `NovelProject`:

```rust
#[serde(default)]
pub review_preview_context: Option<ReviewPreviewContext>,
```

In `src-tauri/src/application/review_service.rs` and `src-tauri/src/commands/review.rs`, add signatures for:

```rust
pub fn preview_review_snapshot(...)
pub fn save_review_preview_context(...)
```

- [ ] **Step 4: Run the frontend contract test again**

Run:

```bash
pnpm test -- --run src/lib/modules/review/backend.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the contract layer**

Run:

```bash
git add src/lib/types.ts src/lib/modules/review/backend.ts src/lib/modules/review/backend.test.ts src-tauri/src/models.rs src-tauri/src/application/review_service.rs src-tauri/src/commands/review.rs
git commit -m "feat: add review preview snapshot contracts"
```

### Task 2: Implement Rust Preview Snapshot Assembly And Context Persistence

**Files:**
- Modify: `src-tauri/src/store.rs`
- Modify: `src-tauri/src/application/review_service.rs`
- Modify: `src-tauri/src/commands/review.rs`
- Test: `src-tauri/src/store.rs`

- [ ] **Step 1: Write the failing Rust store tests**

Add these tests inside `src-tauri/src/store.rs` test module:

```rust
#[test]
fn preview_review_snapshot_uses_explicit_context_and_returns_projected_outcome() {
    let temp = tempfile::tempdir().expect("tempdir");
    let mut store = ProjectStore::new(temp.path().to_path_buf()).expect("store");
    let project = seed_built_project(&mut store);
    let scene_id = project.story_package.as_ref().unwrap().start_scene_id.clone();

    let snapshot = store
        .preview_review_snapshot(
            &project.id,
            ReviewPreviewContext {
                scene_id: scene_id.clone(),
                event_kind: "open_gate".into(),
                input_text: "午夜去开门".into(),
                actor_character_id: Some("character-1".into()),
                target_character_id: Some("character-2".into()),
            },
        )
        .expect("snapshot");

    assert_eq!(snapshot.context.scene_id, scene_id);
    assert_eq!(snapshot.context.event_kind, "open_gate");
    assert!(!snapshot.explanations.rule_summary.is_empty());
    assert_eq!(snapshot.projected_outcome.blocked, snapshot.rule_preview.blocked);
}

#[test]
fn save_review_preview_context_persists_on_project_and_survives_reload() {
    let temp = tempfile::tempdir().expect("tempdir");
    let mut store = ProjectStore::new(temp.path().to_path_buf()).expect("store");
    let project = store.create_project("临川夜话").expect("project");

    let saved = store
        .save_review_preview_context(
            &project.id,
            ReviewPreviewContext {
                scene_id: "scene-1".into(),
                event_kind: "open_gate".into(),
                input_text: "午夜去开门".into(),
                actor_character_id: Some("character-1".into()),
                target_character_id: Some("character-2".into()),
            },
        )
        .expect("saved");

    assert_eq!(saved.event_kind, "open_gate");

    let reloaded = ProjectStore::reload(temp.path().to_path_buf()).expect("reload");
    let project = reloaded.get_project(&project.id).expect("project after reload");
    assert_eq!(
        project.review_preview_context.expect("persisted context").input_text,
        "午夜去开门"
    );
}
```

- [ ] **Step 2: Run the Rust store tests to verify they fail**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml preview_review_snapshot
```

Expected: FAIL because `preview_review_snapshot`, `save_review_preview_context`, and `seed_built_project`-compatible logic do not exist yet.

- [ ] **Step 3: Implement aggregated snapshot assembly and persistence in `store.rs`**

Add methods shaped like:

```rust
pub fn preview_review_snapshot(
    &self,
    project_id: &str,
    context: ReviewPreviewContext,
) -> AppResult<ReviewPreviewSnapshot> {
    let package = self.load_story_package(project_id)?;
    let scene = package
        .scenes
        .get(&context.scene_id)
        .ok_or_else(|| AppError::NotFound(context.scene_id.clone()))?;

    let actor = resolve_preview_actor(&package, context.actor_character_id.as_deref())?;
    let target = resolve_preview_target(&package, &actor, context.target_character_id.as_deref())?;
    let lore_preview =
        RuntimeEngine::preview_active_worldbook(&package, &context.scene_id, Some(&context.input_text))?;
    let rule_preview = crate::runtime::evaluate_rules(
        &crate::state::StoryState {
            current_scene_id: scene.id.clone(),
            ..crate::state::StoryState::default()
        },
        &package.world_model.rules,
        RuleEvaluationInput {
            event_kind: context.event_kind.clone(),
            actor_character_id: actor.id.clone(),
            actor_gender: actor.gender.clone(),
            target_character_id: target.id.clone(),
            target_gender: target.gender.clone(),
            source_text: context.input_text.clone(),
            scene_title: scene.title.clone(),
        },
    )?;
    let projected_outcome = build_projected_outcome(scene, &rule_preview);

    Ok(ReviewPreviewSnapshot {
        context,
        explanations: build_preview_explanations(&lore_preview, &rule_preview, &projected_outcome),
        lore_preview,
        rule_preview,
        projected_outcome,
    })
}

pub fn save_review_preview_context(
    &mut self,
    project_id: &str,
    context: ReviewPreviewContext,
) -> AppResult<ReviewPreviewContext> {
    let project = self
        .projects
        .get_mut(project_id)
        .ok_or_else(|| AppError::NotFound(project_id.to_string()))?;
    project.review_preview_context = Some(context.clone());
    let snapshot = project.clone();
    self.persist_project(&snapshot)?;
    Ok(context)
}
```

Also add helper functions in `store.rs` for:

```rust
fn resolve_preview_actor(...)
fn resolve_preview_target(...)
fn build_projected_outcome(...)
fn build_preview_explanations(...)
```

Implementation rules:

- actor resolution prefers explicit id, then first world-model character
- target resolution prefers explicit id, then first character whose id differs from actor, then actor clone
- blocked outcome sets `stays_on_scene = true`
- unblocked outcome prefers the first `scene.candidate_choices` next scene, then `scene.fallback_next`
- projected candidate choices come from the projected next scene when one exists, otherwise `[]`

- [ ] **Step 4: Expose the new store methods through review service and Tauri commands**

In `src-tauri/src/application/review_service.rs`, add:

```rust
pub fn preview_review_snapshot(
    store: &mut ProjectStore,
    project_id: &str,
    context: ReviewPreviewContext,
) -> AppResult<ReviewPreviewSnapshot> {
    let project_id = require_project_id(project_id)?;
    let scene_id = require_scene_id(&context.scene_id)?;
    let event_kind = require_event_kind(&context.event_kind)?;
    let mut context = context;
    context.scene_id = scene_id.to_string();
    context.event_kind = event_kind.to_string();
    store.preview_review_snapshot(project_id, context)
}

pub fn save_review_preview_context(
    store: &mut ProjectStore,
    project_id: &str,
    context: ReviewPreviewContext,
) -> AppResult<ReviewPreviewContext> {
    let project_id = require_project_id(project_id)?;
    store.save_review_preview_context(project_id, context)
}
```

In `src-tauri/src/commands/review.rs`, add:

```rust
#[tauri::command]
pub fn preview_review_snapshot(
    state: State<'_, StoreState>,
    project_id: String,
    context: ReviewPreviewContext,
) -> CommandResult<ReviewPreviewSnapshot> {
    with_store(state, move |store| {
        ReviewService::preview_review_snapshot(store, &project_id, context)
    })
}

#[tauri::command]
pub fn save_review_preview_context(
    state: State<'_, StoreState>,
    project_id: String,
    context: ReviewPreviewContext,
) -> CommandResult<ReviewPreviewContext> {
    with_store(state, move |store| {
        ReviewService::save_review_preview_context(store, &project_id, context)
    })
}
```

And register both in `src-tauri/src/lib.rs`:

```rust
preview_review_snapshot,
save_review_preview_context,
```

- [ ] **Step 5: Run the targeted Rust tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml preview_review_snapshot
cargo test --manifest-path src-tauri/Cargo.toml save_review_preview_context
```

Expected: PASS.

- [ ] **Step 6: Commit the Rust implementation**

Run:

```bash
git add src-tauri/src/store.rs src-tauri/src/application/review_service.rs src-tauri/src/commands/review.rs src-tauri/src/lib.rs src-tauri/src/models.rs
git commit -m "feat: add rust review preview snapshot flow"
```

### Task 3: Align The Mock Backend With The New Snapshot Contract

**Files:**
- Modify: `src/lib/mock-backend.ts`
- Modify: `src/lib/mock-backend.test.ts`

- [ ] **Step 1: Write the failing mock-backend tests**

Add these tests to `src/lib/mock-backend.test.ts`:

```ts
it('returns an aggregated review preview snapshot with projected outcome', async () => {
  const project = await backend.create_project('北门夜话');
  await backend.import_novel_text(project.id, SAMPLE_NOVEL);
  await backend.build_story_package(project.id);

  const snapshot = await backend.preview_review_snapshot(project.id, {
    sceneId: 'scene-1',
    eventKind: 'open_gate',
    inputText: '午夜去开门',
    actorCharacterId: 'character-1',
    targetCharacterId: 'character-2'
  });

  expect(snapshot.context.sceneId).toBe('scene-1');
  expect(snapshot.projectedOutcome.blocked).toBe(snapshot.rulePreview.blocked);
  expect(snapshot.explanations.outcomeSummary.length).toBeGreaterThan(0);
});

it('persists review preview context on the project', async () => {
  const project = await backend.create_project('北门夜话');

  await backend.save_review_preview_context(project.id, {
    sceneId: 'scene-1',
    eventKind: 'open_gate',
    inputText: '午夜去开门',
    actorCharacterId: 'character-1',
    targetCharacterId: 'character-2'
  });

  const reloaded = await backend.get_project(project.id);
  expect(reloaded.review_preview_context?.eventKind).toBe('open_gate');
});
```

- [ ] **Step 2: Run the mock-backend tests to verify they fail**

Run:

```bash
pnpm test -- --run src/lib/mock-backend.test.ts
```

Expected: FAIL because the new aggregated methods and project field are missing.

- [ ] **Step 3: Implement the new mock-backend methods and persistence**

In `src/lib/mock-backend.ts`, extend `buildProject`:

```ts
review_preview_context: null
```

Add methods:

```ts
async preview_review_snapshot(projectId: string, context: ReviewPreviewContext): Promise<ReviewPreviewSnapshot> {
  const storyPackage = packages.get(projectId);
  if (!storyPackage) throw new Error('story package not found');
  const scene = storyPackage.scenes[context.sceneId];
  if (!scene) throw new Error('scene not found');

  const lorePreview = previewActiveLore(
    storyPackage,
    context.sceneId,
    context.inputText,
    seedLoreLifecycle(storyPackage)
  );
  const rulePreview = evaluateRules(
    emptyStoryState(scene.id),
    storyPackage,
    context.eventKind,
    context.inputText
  );
  const projectedOutcome = buildProjectedOutcomePreview(storyPackage, scene, rulePreview);

  return {
    context: clone(context),
    lorePreview,
    rulePreview,
    projectedOutcome,
    explanations: buildReviewPreviewExplanations(lorePreview, rulePreview, projectedOutcome)
  };
},

async save_review_preview_context(projectId: string, context: ReviewPreviewContext) {
  const project = projects.get(projectId);
  if (!project) throw new Error('project not found');
  const next = { ...project, review_preview_context: clone(context) };
  projects.set(projectId, next);
  return clone(context);
},
```

Add helpers:

```ts
function buildProjectedOutcomePreview(...)
function buildReviewPreviewExplanations(...)
```

Use the same semantics as Rust:

- blocked => stay on current scene
- unblocked => choose first candidate choice next scene, else fallback next
- projected candidate choices come from the next scene

- [ ] **Step 4: Run the mock-backend test again**

Run:

```bash
pnpm test -- --run src/lib/mock-backend.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the mock-backend alignment**

Run:

```bash
git add src/lib/mock-backend.ts src/lib/mock-backend.test.ts
git commit -m "feat: align mock backend with review preview snapshot"
```

### Task 4: Expand The Review Workspace Controller For Applied Context, Auto-Refresh, And Persistence

**Files:**
- Modify: `src/lib/modules/review/workspace.ts`
- Modify: `src/lib/modules/review/workspace.test.ts`
- Modify: `src/lib/modules/review/backend.ts`

- [ ] **Step 1: Write the failing review-workspace controller tests**

Add these tests to `src/lib/modules/review/workspace.test.ts`:

```ts
it('loads preview context from the project and refreshes immediately on scene changes', async () => {
  const deps = {
    updateCharacterCard: vi.fn(),
    upsertWorldBookEntry: vi.fn(),
    deleteWorldBookEntry: vi.fn(),
    upsertRule: vi.fn(),
    deleteRule: vi.fn(),
    previewReviewSnapshot: vi.fn().mockResolvedValue(createSnapshot()),
    saveReviewPreviewContext: vi.fn().mockResolvedValue({
      sceneId: 'scene-2',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: 'char-1',
      targetCharacterId: 'char-2'
    })
  };
  const workspace = createReviewWorkspaceController(createProject({
    review_preview_context: {
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: 'char-1',
      targetCharacterId: 'char-2'
    }
  }), deps as never);

  workspace.updatePreviewContext({ sceneId: 'scene-2' });
  await flushPromises();

  expect(deps.previewReviewSnapshot).toHaveBeenCalled();
  expect(get(workspace).preview.appliedContext?.sceneId).toBe('scene-2');
});

it('debounces input text refresh and ignores stale async responses', async () => {
  vi.useFakeTimers();
  const first = deferred<ReviewPreviewSnapshot>();
  const second = deferred<ReviewPreviewSnapshot>();
  const deps = {
    updateCharacterCard: vi.fn(),
    upsertWorldBookEntry: vi.fn(),
    deleteWorldBookEntry: vi.fn(),
    upsertRule: vi.fn(),
    deleteRule: vi.fn(),
    previewReviewSnapshot: vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise),
    saveReviewPreviewContext: vi.fn().mockResolvedValue(createPreviewContext('第二次'))
  };
  const workspace = createReviewWorkspaceController(createProject(), deps as never);

  workspace.updatePreviewContext({ inputText: '第一次' });
  workspace.updatePreviewContext({ inputText: '第二次' });
  vi.advanceTimersByTime(300);

  second.resolve(createSnapshot({ context: createPreviewContext('第二次') }));
  await flushPromises();
  first.resolve(createSnapshot({ context: createPreviewContext('第一次') }));
  await flushPromises();

  expect(get(workspace).preview.appliedContext?.inputText).toBe('第二次');
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run the controller test to verify it fails**

Run:

```bash
pnpm test -- --run src/lib/modules/review/workspace.test.ts
```

Expected: FAIL because preview context state, debounce logic, and new backend methods do not exist yet.

- [ ] **Step 3: Expand `workspace.ts` with preview context orchestration**

Add backend interface methods:

```ts
previewReviewSnapshot(projectId: string, context: ReviewPreviewContext): Promise<ReviewPreviewSnapshot>;
saveReviewPreviewContext(projectId: string, context: ReviewPreviewContext): Promise<ReviewPreviewContext>;
```

Replace the preview state shape with:

```ts
preview: {
  status: ReviewPreviewStatus;
  draftContext: ReviewPreviewContext | null;
  appliedContext: ReviewPreviewContext | null;
  snapshot: ReviewPreviewSnapshot | null;
  error: string;
  requestNonce: number;
}
```

Add controller methods:

```ts
updatePreviewContext(patch: Partial<ReviewPreviewContext>): void;
refreshPreview(options?: { immediate?: boolean }): Promise<void>;
```

Core logic:

```ts
let inputRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let latestRequestNonce = 0;

function queuePreviewRefresh(kind: 'immediate' | 'debounced') {
  if (kind === 'immediate') {
    if (inputRefreshTimer) clearTimeout(inputRefreshTimer);
    void refreshPreview({ immediate: true });
    return;
  }

  if (inputRefreshTimer) clearTimeout(inputRefreshTimer);
  inputRefreshTimer = setTimeout(() => {
    void refreshPreview({ immediate: true });
  }, 300);
}
```

Successful refresh must:

- update `preview.snapshot`
- update `preview.appliedContext`
- clear `preview.error`
- persist the applied context via `saveReviewPreviewContext`
- update `state.project.review_preview_context`

Failed refresh must:

- keep `draftContext`
- keep `appliedContext`
- keep last successful `snapshot`
- only update `preview.error` and `preview.status`

- [ ] **Step 4: Run the controller test again**

Run:

```bash
pnpm test -- --run src/lib/modules/review/workspace.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the workspace-controller changes**

Run:

```bash
git add src/lib/modules/review/workspace.ts src/lib/modules/review/workspace.test.ts src/lib/modules/review/backend.ts
git commit -m "feat: add persisted preview context to review workspace"
```

### Task 5: Build The New Review Preview UI And Wire The Snapshot Through

**Files:**
- Modify: `src/lib/components/ReviewWorkspace.svelte`
- Modify: `src/lib/components/ReviewPreviewPanel.svelte`
- Modify: `src/lib/components/ReviewPreviewPanel.test.ts`
- Modify: `src/lib/components/ReviewWorkspace.test.ts`
- Modify: `src/lib/components/ReviewStageShell.test.ts`
- Modify: `src/routes/page-flow.test.ts`

- [ ] **Step 1: Write the failing component tests**

Add this test to `src/lib/components/ReviewPreviewPanel.test.ts`:

```ts
it('renders preview context controls and projected outcome details', async () => {
  const contextChange = vi.fn();
  render(ReviewPreviewPanel, {
    props: {
      status: 'ready',
      draftContext: {
        sceneId: 'scene-1',
        eventKind: 'open_gate',
        inputText: '午夜去开门',
        actorCharacterId: 'character-1',
        targetCharacterId: 'character-2'
      },
      appliedContext: {
        sceneId: 'scene-1',
        eventKind: 'open_gate',
        inputText: '午夜去开门',
        actorCharacterId: 'character-1',
        targetCharacterId: 'character-2'
      },
      snapshot: createSnapshot({
        projectedOutcome: {
          blocked: false,
          staysOnScene: false,
          nextSceneId: 'scene-2',
          nextSceneTitle: '北门开启',
          nextSceneSummary: '门后的真相终于显露。',
          candidateChoices: [{ id: 'choice-1', label: '迈进门内', intentTag: 'enter_gate', nextSceneId: 'scene-3', unlockConditions: [] }]
        }
      }),
      refreshError: '',
      sceneOptions: [{ id: 'scene-1', title: '北门前夜' }],
      eventOptions: [{ value: 'open_gate', label: 'open_gate' }],
      characterOptions: [{ id: 'character-1', name: '沈砚' }, { id: 'character-2', name: '宁昭' }]
    },
    events: {
      updateContext: contextChange
    }
  });

  expect(screen.getByLabelText('预览场景')).toBeInTheDocument();
  expect(screen.getByLabelText('事件类型')).toBeInTheDocument();
  expect(screen.getByLabelText('输入文本')).toBeInTheDocument();
  expect(screen.getByText('Projected Outcome')).toBeInTheDocument();
  expect(screen.getByText('北门开启')).toBeInTheDocument();
  expect(screen.getByText('迈进门内')).toBeInTheDocument();
});
```

Add this route-level expectation to `src/routes/page-flow.test.ts`:

```ts
expect(await screen.findByLabelText('预览场景')).toBeInTheDocument();
expect(screen.getByLabelText('事件类型')).toBeInTheDocument();
expect(screen.getByLabelText('输入文本')).toBeInTheDocument();
```

- [ ] **Step 2: Run the component and route tests to verify they fail**

Run:

```bash
pnpm test -- --run src/lib/components/ReviewPreviewPanel.test.ts src/lib/components/ReviewWorkspace.test.ts src/lib/components/ReviewStageShell.test.ts src/routes/page-flow.test.ts
```

Expected: FAIL because the new preview-context props and projected-outcome UI do not exist yet.

- [ ] **Step 3: Redesign the preview panel and wire it through `ReviewWorkspace.svelte`**

In `src/lib/components/ReviewPreviewPanel.svelte`, accept:

```ts
export let draftContext: ReviewPreviewContext | null = null;
export let appliedContext: ReviewPreviewContext | null = null;
export let snapshot: ReviewPreviewSnapshot | null = null;
export let refreshError = '';
export let sceneOptions: Array<{ id: string; title: string }> = [];
export let eventOptions: Array<{ value: string; label: string }> = [];
export let characterOptions: Array<{ id: string; name: string }> = [];
```

Dispatch:

```ts
const dispatch = createEventDispatcher<{
  updateContext: Partial<ReviewPreviewContext>;
  refresh: void;
}>();
```

Render:

```svelte
<section class="preview-context">
  <label>
    <span>预览场景</span>
    <select value={draftContext?.sceneId ?? ''} on:change={(event) => dispatch('updateContext', { sceneId: (event.currentTarget as HTMLSelectElement).value })}>
      {#each sceneOptions as scene}
        <option value={scene.id}>{scene.title}</option>
      {/each}
    </select>
  </label>
  <label>
    <span>事件类型</span>
    <select value={draftContext?.eventKind ?? ''} on:change={(event) => dispatch('updateContext', { eventKind: (event.currentTarget as HTMLSelectElement).value })}>
      {#each eventOptions as event}
        <option value={event.value}>{event.label}</option>
      {/each}
    </select>
  </label>
  <label>
    <span>输入文本</span>
    <textarea rows="3" value={draftContext?.inputText ?? ''} on:input={(event) => dispatch('updateContext', { inputText: (event.currentTarget as HTMLTextAreaElement).value })}></textarea>
  </label>
</section>

<section class="projected-outcome">
  <strong>Projected Outcome</strong>
  <p>{snapshot?.projectedOutcome.blocked ? '本次动作会被阻止' : '本次动作允许推进'}</p>
  {#if snapshot?.projectedOutcome.nextSceneTitle}
    <h4>{snapshot.projectedOutcome.nextSceneTitle}</h4>
    <p>{snapshot.projectedOutcome.nextSceneSummary}</p>
  {/if}
</section>
```

In `src/lib/components/ReviewWorkspace.svelte`, derive and pass:

```ts
sceneOptions = Object.values(state.project.story_package?.scenes ?? {}).map((scene) => ({
  id: scene.id,
  title: scene.title
}));
eventOptions = [
  { value: 'open_gate', label: 'open_gate' },
  { value: 'seek_truth', label: 'seek_truth' },
  { value: 'sexual_relation', label: 'sexual_relation' },
  { value: 'free_input', label: 'free_input' }
];
characterOptions = state.project.character_cards.map((card) => ({ id: card.id, name: card.name }));
```

And bridge events:

```svelte
<ReviewPreviewPanel
  status={state.preview.status}
  draftContext={state.preview.draftContext}
  appliedContext={state.preview.appliedContext}
  snapshot={state.preview.snapshot}
  refreshError={state.preview.error}
  {sceneOptions}
  {eventOptions}
  {characterOptions}
  on:updateContext={(event) => dispatch('updatePreviewContext', event.detail)}
  on:refresh={() => dispatch('refreshPreview')}
/>
```

- [ ] **Step 4: Run the component and route tests again**

Run:

```bash
pnpm test -- --run src/lib/components/ReviewPreviewPanel.test.ts src/lib/components/ReviewWorkspace.test.ts src/lib/components/ReviewStageShell.test.ts src/routes/page-flow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the review UI**

Run:

```bash
git add src/lib/components/ReviewWorkspace.svelte src/lib/components/ReviewPreviewPanel.svelte src/lib/components/ReviewPreviewPanel.test.ts src/lib/components/ReviewWorkspace.test.ts src/lib/components/ReviewStageShell.test.ts src/routes/page-flow.test.ts
git commit -m "feat: add runtime aligned review preview UI"
```

### Task 6: Run Full Verification And Fix Any Regressions

**Files:**
- Modify: any files required by failing checks
- Test: full repo verification

- [ ] **Step 1: Run the full frontend test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 2: Run static checks**

Run:

```bash
pnpm check
```

Expected: PASS with `svelte-check found 0 errors and 0 warnings`.

- [ ] **Step 3: Run the Rust suite**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: PASS.

- [ ] **Step 4: If any regression appears, fix it test-first before changing implementation**

Use the failing file path and exact Rust test names reported by the three verification commands, add the smallest missing test first, then change production code.

Command loop:

```bash
pnpm test -- --run src/lib/components/ReviewPreviewPanel.test.ts
cargo test --manifest-path src-tauri/Cargo.toml preview_review_snapshot_uses_explicit_context_and_returns_projected_outcome
```

- [ ] **Step 5: Commit the verified Phase 4B completion**

Run:

```bash
git add src/lib src-tauri/src
git commit -m "feat: complete phase 4b review preview semantics"
```
