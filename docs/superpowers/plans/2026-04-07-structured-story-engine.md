# Structured Story Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the current prototype into a novel-to-game pipeline that extracts character cards and world book entries, defines explicit rules, maintains structured story state, and uses those systems to drive the interactive visual novel runtime.

**Architecture:** Keep the existing Tauri + Rust + SvelteKit split, but refactor the backend around four explicit runtime objects: `CharacterCard`, `WorldBookEntry`, `RuleDefinition`, and `StoryState`. Borrow SillyTavern's executable lorebook ideas for activation, recursion, and budgeting, then place them ahead of a deterministic state and rule engine. The backend becomes a world-model, lore-activation, and rule-evaluation service; the frontend becomes a review-and-play interface with dedicated surfaces for cards, lore, rules, and live state.

**Tech Stack:** Rust, Tauri commands, serde, cargo test, SvelteKit, Vitest, svelte-check

---

## File structure

### Rust backend
- Create: `src-tauri/src/worldbook.rs`
- Create: `src-tauri/src/rules.rs`
- Create: `src-tauri/src/state.rs`
- Create: `src-tauri/src/context_builder.rs`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/provider.rs`
- Modify: `src-tauri/src/analyzer.rs`
- Modify: `src-tauri/src/compiler.rs`
- Modify: `src-tauri/src/runtime.rs`
- Modify: `src-tauri/src/store.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/error.rs`

### Frontend
- Create: `src/lib/rule-helpers.ts`
- Create: `src/lib/rule-helpers.test.ts`
- Create: `src/lib/components/CharacterReviewPanel.svelte`
- Create: `src/lib/components/RuleBookPanel.svelte`
- Create: `src/lib/components/WorldBookPanel.svelte`
- Create: `src/lib/components/StoryStatePanel.svelte`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api/client.ts`
- Modify: `src/lib/mock-backend.ts`
- Modify: `src/lib/components/BuildProgressScreen.svelte`
- Modify: `src/lib/components/StoryCodexPanel.svelte`
- Modify: `src/lib/components/ReaderStage.svelte`
- Modify: `src/routes/+page.svelte`

### Docs
- Modify: `docs/superpowers/specs/2026-04-07-interactive-vn-reader-design.md`
- Create: `docs/superpowers/plans/2026-04-07-structured-story-engine.md`

---

## SillyTavern mapping constraints

- `CharacterCard` is allowed to seed embedded lore entries, similar to SillyTavern `character_book`, but our runtime still persists them as first-class `WorldBookEntry` values inside the project model.
- `WorldBookEntry` must support these SillyTavern-inspired fields in v1: `keys`, `secondary_keys`, `selective_logic`, `constant`, `exclude_recursion`, `prevent_recursion`, `delay_until_recursion`, `scan_depth`, `case_sensitive`, `match_whole_words`, `sticky`, `cooldown`, `delay`, `triggers`, `ignore_budget`, `order`, `insertion_mode`.
- `context_builder.rs` owns a composite scan buffer rather than a chat-only scan buffer. The first version should concatenate: current scene summary, scene body, chapter title, present-character summaries, recent major choices, last free input, known facts, and recursion buffer.
- Runtime insertion targets are not SillyTavern prompt slots. They are exactly: `scene_prelude`, `rules_guard`, and `codex_only`.
- Rule visibility is driven by active lore. If a lore entry activates into `rules_guard`, the player should be able to see the corresponding rule explanation in the scene payload.

---

### Task 1: Introduce explicit world-model types

**Files:**
- Create: `src-tauri/src/worldbook.rs`
- Create: `src-tauri/src/rules.rs`
- Create: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/models.rs`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write the failing Rust type tests**

Add these tests before implementation:

```rust
// src-tauri/src/rules.rs
#[cfg(test)]
mod tests {
    use super::{RuleCondition, RuleDefinition, RuleEffect, RuleOperator, RulePriority};

    #[test]
    fn rule_definition_can_model_biology_constraints() {
        let rule = RuleDefinition {
            id: "rule-biology-1".into(),
            name: "same-sex-cannot-conceive".into(),
            category: "biology".into(),
            priority: RulePriority::HardConstraint,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    fact: "actor.gender".into(),
                    operator: RuleOperator::Equals,
                    value: "male".into(),
                },
                RuleCondition {
                    fact: "target.gender".into(),
                    operator: RuleOperator::Equals,
                    value: "male".into(),
                },
                RuleCondition {
                    fact: "event.kind".into(),
                    operator: RuleOperator::Equals,
                    value: "sexual_relation".into(),
                },
            ],
            blockers: Vec::new(),
            effects: vec![RuleEffect {
                key: "possibility.conception".into(),
                value: "false".into(),
            }],
            explanation: "两个男性不能自然生育".into(),
        };

        assert_eq!(rule.conditions.len(), 3);
        assert_eq!(rule.effects[0].key, "possibility.conception");
    }
}
```

```rust
// src-tauri/src/state.rs
#[cfg(test)]
mod tests {
    use super::{CharacterRuntimeState, StoryState};

    #[test]
    fn story_state_tracks_character_and_possibility_flags() {
        let state = StoryState {
            current_scene_id: "scene-1".into(),
            character_states: vec![CharacterRuntimeState {
                character_id: "chen".into(),
                status_flags: vec!["injured".into()],
                counters: vec![("trust".into(), 2)].into_iter().collect(),
            }],
            ..StoryState::default()
        };

        assert_eq!(state.character_states[0].status_flags, vec!["injured"]);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
- `cargo test --manifest-path src-tauri/Cargo.toml rule_definition_can_model_biology_constraints`
- `cargo test --manifest-path src-tauri/Cargo.toml story_state_tracks_character_and_possibility_flags`

Expected: FAIL because the new modules and types do not exist yet.

- [ ] **Step 3: Add world-model Rust modules**

Create `src-tauri/src/worldbook.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorldBookCategory {
    Character,
    Location,
    SocialRule,
    BiologyRule,
    SupernaturalRule,
    Organization,
    EventMemory,
    Miscellaneous,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorldBookInsertionMode {
    ScenePrelude,
    RulesGuard,
    CodexOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorldBookSelectiveLogic {
    AndAny,
    NotAll,
    NotAny,
    AndAll,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorldBookEntry {
    pub id: String,
    pub title: String,
    pub category: WorldBookCategory,
    pub content: String,
    pub enabled: bool,
    pub keys: Vec<String>,
    pub secondary_keys: Vec<String>,
    pub selective_logic: WorldBookSelectiveLogic,
    pub constant: bool,
    pub recursive: bool,
    pub exclude_recursion: bool,
    pub prevent_recursion: bool,
    pub delay_until_recursion: Option<u8>,
    pub scan_depth: Option<usize>,
    pub case_sensitive: Option<bool>,
    pub match_whole_words: Option<bool>,
    pub sticky: Option<u16>,
    pub cooldown: Option<u16>,
    pub delay: Option<u16>,
    pub triggers: Vec<String>,
    pub ignore_budget: bool,
    pub order: i32,
    pub insertion_mode: WorldBookInsertionMode,
    pub source: String,
    pub rule_binding: Option<String>,
}
```

Create `src-tauri/src/rules.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RulePriority {
    HardConstraint,
    SoftConstraint,
    Consequence,
    NarrativeGate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuleOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    Contains,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleCondition {
    pub fact: String,
    pub operator: RuleOperator,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleEffect {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleDefinition {
    pub id: String,
    pub name: String,
    pub category: String,
    pub priority: RulePriority,
    pub enabled: bool,
    pub conditions: Vec<RuleCondition>,
    pub blockers: Vec<RuleCondition>,
    pub effects: Vec<RuleEffect>,
    pub explanation: String,
}
```

Create `src-tauri/src/state.rs`:

```rust
use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FactRecord {
    pub id: String,
    pub subject: String,
    pub predicate: String,
    pub object: String,
    pub value: String,
    pub timestamp: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CharacterRuntimeState {
    pub character_id: String,
    pub status_flags: Vec<String>,
    pub counters: BTreeMap<String, i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoryState {
    pub current_scene_id: String,
    pub character_states: Vec<CharacterRuntimeState>,
    pub fact_records: Vec<FactRecord>,
    pub relationship_states: BTreeMap<String, i32>,
    pub event_flags: Vec<String>,
    pub possibility_flags: Vec<String>,
    pub unlocked_rules: Vec<String>,
}
```

- [ ] **Step 4: Extend shared models**

Modify `src-tauri/src/models.rs` to:
- import the new modules
- extend `CharacterCard`
- add `RuleDefinition` and `StoryState` into `NovelProject` and `ScenePayload`

Add:

```rust
use crate::{rules::RuleDefinition, state::StoryState, worldbook::WorldBookEntry};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CharacterCard {
    pub id: String,
    pub name: String,
    pub gender: String,
    pub age: Option<u16>,
    pub identity: String,
    pub faction: String,
    pub role: String,
    pub summary: String,
    pub desire: String,
    pub secrets: Vec<String>,
    pub traits: Vec<String>,
    pub abilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NovelProject {
    pub id: String,
    pub name: String,
    pub raw_text: String,
    pub chapters: Vec<ChapterChunk>,
    pub build_status: BuildStatus,
    pub story_package: Option<StoryPackage>,
    pub character_cards: Vec<CharacterCard>,
    pub worldbook_entries: Vec<WorldBookEntry>,
    pub rules: Vec<RuleDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScenePayload {
    pub scene: SceneNode,
    pub session: SessionState,
    pub active_lore: Vec<String>,
    pub active_rules: Vec<String>,
    pub story_state: StoryState,
}
```

- [ ] **Step 5: Mirror the types in TypeScript**

Add matching interfaces to `src/lib/types.ts` for:
- `WorldBookEntry`
- `RuleDefinition`
- `RuleCondition`
- `RuleEffect`
- `FactRecord`
- `CharacterRuntimeState`
- `StoryState`

- [ ] **Step 6: Run tests to verify they now pass**

Run:
- `cargo test --manifest-path src-tauri/Cargo.toml rule_definition_can_model_biology_constraints`
- `cargo test --manifest-path src-tauri/Cargo.toml story_state_tracks_character_and_possibility_flags`
- `pnpm check`

Expected:
- both Rust tests PASS
- frontend type check PASS

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/worldbook.rs src-tauri/src/rules.rs src-tauri/src/state.rs src-tauri/src/models.rs src/lib/types.ts
git commit -m "feat: add explicit world model types"
```

---

### Task 2: Extract character cards, world book entries, and rule drafts from novels

**Files:**
- Modify: `src-tauri/src/provider.rs`
- Modify: `src-tauri/src/analyzer.rs`
- Modify: `src-tauri/src/store.rs`
- Test: `src-tauri/src/store.rs`

- [ ] **Step 1: Write failing extraction test**

Add this test in `src-tauri/src/store.rs`:

```rust
#[test]
fn build_populates_cards_worldbook_and_rules() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

    let project = store.create_project("临川夜话").expect("project");
    store.import_novel_text(&project.id, &sample_novel()).expect("import");
    store.build_story_package(&project.id).expect("build");

    let project = store.get_project(&project.id).expect("project");
    assert!(!project.character_cards.is_empty());
    assert!(!project.worldbook_entries.is_empty());
    assert!(!project.rules.is_empty());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml build_populates_cards_worldbook_and_rules`

Expected: FAIL because project build does not fill the new collections yet.

- [ ] **Step 3: Expand provider output**

Modify `src-tauri/src/provider.rs` so the heuristic provider returns richer structured output:

```rust
pub struct ExtractedWorldModel {
    pub character_cards: Vec<CharacterCard>,
    pub worldbook_entries: Vec<crate::worldbook::WorldBookEntry>,
    pub rules: Vec<crate::rules::RuleDefinition>,
    pub story_bible: StoryBible,
}
```

Change the trait:

```rust
pub trait StoryAiProvider: Send + Sync {
    fn analyze(&self, project: &NovelProject) -> AppResult<ExtractedWorldModel>;
}
```

In the heuristic implementation:
- map extracted names to `CharacterCard`
- map locations and rules to `WorldBookEntry`
- seed rule-related lore with `insertion_mode = RulesGuard`
- seed character/location summary lore with `insertion_mode = CodexOnly`
- if a character card implies private setting knowledge, allow it to emit companion `WorldBookEntry` rows derived from that character
- draft at least two explicit `RuleDefinition` values:
  - midnight north gate prohibition
  - mixed-sex relation implies conception possible

- [ ] **Step 4: Update analyzer and store build flow**

In `src-tauri/src/analyzer.rs`:

```rust
pub fn analyze(&self, project: &NovelProject) -> AppResult<crate::provider::ExtractedWorldModel> {
    self.provider.analyze(project)
}
```

In `src-tauri/src/store.rs` build flow:

```rust
let extracted = analyzer.analyze(project)?;
project.character_cards = extracted.character_cards.clone();
project.worldbook_entries = extracted.worldbook_entries.clone();
project.rules = extracted.rules.clone();
project.story_package = Some(compile_story_package(project, extracted.story_bible));
```

Also add:

```rust
pub fn get_project(&self, project_id: &str) -> AppResult<NovelProject> {
    self.projects
        .get(project_id)
        .cloned()
        .ok_or_else(|| AppError::NotFound(project_id.to_string()))
}
```

- [ ] **Step 5: Run tests**

Run:
- `cargo test --manifest-path src-tauri/Cargo.toml build_populates_cards_worldbook_and_rules`
- `cargo test --manifest-path src-tauri/Cargo.toml build_story_package_creates_playable_story_bible_and_scene_graph`

Expected: both PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/provider.rs src-tauri/src/analyzer.rs src-tauri/src/store.rs
git commit -m "feat: extract cards lore and rule drafts from novels"
```

---

### Task 3: Implement explicit rule evaluation and state mutation

**Files:**
- Create: `src-tauri/src/context_builder.rs`
- Modify: `src-tauri/src/rules.rs`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/runtime.rs`
- Modify: `src-tauri/src/error.rs`
- Test: `src-tauri/src/runtime.rs`

- [ ] **Step 1: Write failing rule-engine tests**

Add to `src-tauri/src/runtime.rs`:

```rust
#[cfg(test)]
mod rule_runtime_tests {
    use crate::{
        rules::{RuleCondition, RuleDefinition, RuleEffect, RuleOperator, RulePriority},
        state::StoryState,
    };
    use super::evaluate_rules;

    #[test]
    fn biology_rule_blocks_impossible_conception() {
        let rules = vec![RuleDefinition {
            id: "rule-1".into(),
            name: "same-sex-cannot-conceive".into(),
            category: "biology".into(),
            priority: RulePriority::HardConstraint,
            enabled: true,
            conditions: vec![
                RuleCondition { fact: "actor.gender".into(), operator: RuleOperator::Equals, value: "male".into() },
                RuleCondition { fact: "target.gender".into(), operator: RuleOperator::Equals, value: "male".into() },
                RuleCondition { fact: "event.kind".into(), operator: RuleOperator::Equals, value: "sexual_relation".into() },
            ],
            blockers: Vec::new(),
            effects: vec![RuleEffect { key: "possibility.conception".into(), value: "false".into() }],
            explanation: "两个男性不能自然生育".into(),
        }];

        let state = StoryState::default();
        let result = evaluate_rules(&state, &rules, "sexual_relation", "male", "male").expect("result");

        assert!(result.applied_rules.iter().any(|rule| rule == "rule-1"));
        assert!(result.story_state.possibility_flags.iter().any(|flag| flag == "possibility.conception=false"));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml biology_rule_blocks_impossible_conception`

Expected: FAIL because `evaluate_rules` and result types do not exist.

- [ ] **Step 3: Add runtime rule result types**

In `src-tauri/src/runtime.rs` add:

```rust
#[derive(Debug, Clone, Default)]
pub struct RuleEvaluationResult {
    pub story_state: crate::state::StoryState,
    pub applied_rules: Vec<String>,
    pub active_rule_explanations: Vec<String>,
}
```

- [ ] **Step 4: Implement minimal evaluator**

Add:

```rust
pub fn evaluate_rules(
    story_state: &crate::state::StoryState,
    rules: &[crate::rules::RuleDefinition],
    event_kind: &str,
    actor_gender: &str,
    target_gender: &str,
) -> AppResult<RuleEvaluationResult> {
    let mut next = story_state.clone();
    let mut applied = Vec::new();
    let mut explanations = Vec::new();

    for rule in rules.iter().filter(|rule| rule.enabled) {
        let matches = rule.conditions.iter().all(|condition| match condition.fact.as_str() {
            "event.kind" => compare_value(event_kind, &condition.operator, &condition.value),
            "actor.gender" => compare_value(actor_gender, &condition.operator, &condition.value),
            "target.gender" => compare_value(target_gender, &condition.operator, &condition.value),
            _ => false,
        });

        if matches {
            applied.push(rule.id.clone());
            explanations.push(rule.explanation.clone());
            for effect in &rule.effects {
                if effect.key.starts_with("possibility.") {
                    next.possibility_flags.push(format!("{}={}", effect.key, effect.value));
                } else {
                    next.event_flags.push(format!("{}={}", effect.key, effect.value));
                }
            }
        }
    }

    next.possibility_flags.sort();
    next.possibility_flags.dedup();
    next.event_flags.sort();
    next.event_flags.dedup();

    Ok(RuleEvaluationResult {
        story_state: next,
        applied_rules: applied,
        active_rule_explanations: explanations,
    })
}

fn compare_value(left: &str, operator: &crate::rules::RuleOperator, right: &str) -> bool {
    match operator {
        crate::rules::RuleOperator::Equals => left == right,
        crate::rules::RuleOperator::NotEquals => left != right,
        crate::rules::RuleOperator::Contains => left.contains(right),
        crate::rules::RuleOperator::GreaterThan | crate::rules::RuleOperator::LessThan => false,
    }
}
```

- [ ] **Step 5: Integrate evaluator into action handling**

In `submit_free_input` and later `submit_choice`, after parsing the action, call `evaluate_rules(...)`, then merge the returned `StoryState` into the session:

```rust
let evaluation = evaluate_rules(
    &session.story_state,
    rules,
    "sexual_relation",
    actor_gender,
    target_gender,
)?;
session.story_state = evaluation.story_state.clone();
```

For this wave, use simple heuristics to derive action/event kind:
- if input contains `发生关系` -> `sexual_relation`
- if input contains `开门` -> `open_gate`

- [ ] **Step 6: Run tests**

Run:
- `cargo test --manifest-path src-tauri/Cargo.toml biology_rule_blocks_impossible_conception`
- `cargo test --manifest-path src-tauri/Cargo.toml session_flow_supports_choices_free_input_and_checkpoint_rewind`

Expected: both PASS

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/rules.rs src-tauri/src/state.rs src-tauri/src/runtime.rs src-tauri/src/error.rs
git commit -m "feat: add explicit rule evaluation and state mutation"
```

---

### Task 4: Rebuild scene payloads around live world state

**Files:**
- Modify: `src-tauri/src/runtime.rs`
- Modify: `src-tauri/src/store.rs`
- Modify: `src-tauri/src/models.rs`
- Test: `src-tauri/src/store.rs`

- [ ] **Step 1: Write failing scene-payload test**

Add:

```rust
#[test]
fn current_scene_exposes_active_lore_rules_and_story_state() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

    let project = store.create_project("临川夜话").expect("project");
    store.import_novel_text(&project.id, &sample_novel()).expect("import");
    store.build_story_package(&project.id).expect("build");

    let session = store.start_session(&project.id).expect("session");
    let payload = store.get_current_scene(&session.session_id).expect("payload");

    assert!(!payload.story_state.current_scene_id.is_empty());
    assert!(!payload.active_lore.is_empty());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml current_scene_exposes_active_lore_rules_and_story_state`

Expected: FAIL because payload is not constructed from the new world model yet.

- [ ] **Step 3: Seed session state**

In `start_session`, initialize a structured `StoryState`:

```rust
let initial_state = crate::state::StoryState {
    current_scene_id: start_scene.id.clone(),
    character_states: package
        .story_bible
        .characters
        .iter()
        .map(|character| crate::state::CharacterRuntimeState {
            character_id: character.id.clone(),
            status_flags: Vec::new(),
            counters: Default::default(),
        })
        .collect(),
    ..crate::state::StoryState::default()
};
```

Add `story_state` to `SessionState`.

- [ ] **Step 4: Build scene payload from world model**

Update runtime payload assembly to:
- build a composite scan buffer from current scene + recent history + state facts + last free input + recursion buffer
- activate worldbook entries with primary key, secondary key, recursion, and budget checks
- split active lore into `scene_prelude`, `rules_guard`, and `codex_only`
- collect active rule explanations from latest evaluation or matching rule summaries
- expose `story_state`

Use:

```rust
ScenePayload {
    scene,
    session: session.clone(),
    active_lore,
    active_rules,
    story_state: session.story_state.clone(),
}
```

- [ ] **Step 5: Run tests**

Run:
- `cargo test --manifest-path src-tauri/Cargo.toml current_scene_exposes_active_lore_rules_and_story_state`
- `cargo test --manifest-path src-tauri/Cargo.toml store_reload_restores_projects_and_sessions_from_disk`

Expected: both PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/runtime.rs src-tauri/src/store.rs src-tauri/src/models.rs
git commit -m "feat: expose live world state in scene payloads"
```

---

### Task 5: Add review-stage UI for cards, lore, and rules

**Files:**
- Create: `src/lib/components/CharacterReviewPanel.svelte`
- Create: `src/lib/components/WorldBookPanel.svelte`
- Create: `src/lib/components/RuleBookPanel.svelte`
- Create: `src/lib/rule-helpers.ts`
- Create: `src/lib/rule-helpers.test.ts`
- Modify: `src/lib/api/client.ts`
- Modify: `src/lib/mock-backend.ts`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Write failing frontend helper test**

Create `src/lib/rule-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { ruleBadgeTone } from '$lib/rule-helpers';

describe('ruleBadgeTone', () => {
  it('maps hard constraints to danger styling', () => {
    expect(ruleBadgeTone('hard_constraint')).toBe('danger');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`

Expected: FAIL because `ruleBadgeTone` does not exist.

- [ ] **Step 3: Add helper implementation**

Create `src/lib/rule-helpers.ts`:

```ts
export function ruleBadgeTone(priority: string): 'danger' | 'warning' | 'accent' | 'muted' {
  if (priority === 'hard_constraint') return 'danger';
  if (priority === 'soft_constraint') return 'warning';
  if (priority === 'consequence') return 'accent';
  return 'muted';
}
```

- [ ] **Step 4: Create review panels**

Add `CharacterReviewPanel.svelte` that shows:
- character name
- identity
- gender
- desire
- secrets

Add `WorldBookPanel.svelte` that shows:
- worldbook entry title
- category
- content
- source

Add `RuleBookPanel.svelte` that shows:
- rule name
- category
- priority
- explanation
- conditions
- effects

Each panel should accept plain typed props and avoid inline API calls.

- [ ] **Step 5: Add build-review phase to the page**

Modify `src/routes/+page.svelte`:
- add a new phase: `'review'`
- after `build_story_package`, fetch project / cards / worldbook / rules
- show the three review panels before entering `'reader'`
- add a primary button: `进入互动故事`

- [ ] **Step 6: Update mock backend**

Mirror the new data on the browser-preview path:
- store `character_cards`
- store `worldbook_entries`
- store `rules`
- return them through the same methods used by the page

- [ ] **Step 7: Run verification**

Run:
- `pnpm test`
- `pnpm check`

Expected: both PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/CharacterReviewPanel.svelte src/lib/components/WorldBookPanel.svelte src/lib/components/RuleBookPanel.svelte src/lib/rule-helpers.ts src/lib/rule-helpers.test.ts src/lib/api/client.ts src/lib/mock-backend.ts src/routes/+page.svelte
git commit -m "feat: add review stage for cards lore and rules"
```

---

### Task 6: Add live state and rule visibility in the reader

**Files:**
- Create: `src/lib/components/StoryStatePanel.svelte`
- Modify: `src/lib/components/ReaderStage.svelte`
- Modify: `src/lib/components/StoryCodexPanel.svelte`
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write failing reader-state test**

Add a helper test to `src/lib/rule-helpers.test.ts`:

```ts
import { summarizePossibilityFlags } from '$lib/rule-helpers';

it('summarizes possibility flags for the state panel', () => {
  expect(summarizePossibilityFlags(['possibility.conception=false'])).toEqual(['conception=false']);
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `pnpm test`

Expected: FAIL because `summarizePossibilityFlags` does not exist.

- [ ] **Step 3: Add helper**

Append to `src/lib/rule-helpers.ts`:

```ts
export function summarizePossibilityFlags(flags: string[]): string[] {
  return flags.map((flag) => flag.replace('possibility.', ''));
}
```

- [ ] **Step 4: Create the state panel**

Create `src/lib/components/StoryStatePanel.svelte` showing:
- event flags
- possibility flags
- character runtime flags
- active rules

Use props:

```ts
export let storyState: import('$lib/types').StoryState;
export let activeRules: string[] = [];
```

- [ ] **Step 5: Wire the panel into reader mode**

In `src/routes/+page.svelte`, update the reader layout to three columns on desktop:
- `ReaderStage`
- `StoryCodexPanel`
- `StoryStatePanel`

Pass:

```svelte
<StoryStatePanel storyState={payload.story_state} activeRules={payload.active_rules} />
```

In `ReaderStage.svelte`, add a short section above choices:

```svelte
{#if payload.active_rules.length}
  <div class="rule-strip">
    {#each payload.active_rules as rule}
      <p>{rule}</p>
    {/each}
  </div>
{/if}
```

- [ ] **Step 6: Run verification**

Run:
- `pnpm test`
- `pnpm check`
- `pnpm build`

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/StoryStatePanel.svelte src/lib/components/ReaderStage.svelte src/lib/components/StoryCodexPanel.svelte src/routes/+page.svelte src/lib/rule-helpers.ts src/lib/rule-helpers.test.ts
git commit -m "feat: show live state and rules in reader"
```

---

### Task 7: Add API surface for editing cards, lore, and rules

**Files:**
- Modify: `src-tauri/src/store.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/api/client.ts`
- Modify: `src/lib/mock-backend.ts`
- Test: `src-tauri/src/store.rs`

- [ ] **Step 1: Write failing backend CRUD test**

Add:

```rust
#[test]
fn project_supports_updating_rule_definitions() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

    let project = store.create_project("临川夜话").expect("project");
    store.import_novel_text(&project.id, &sample_novel()).expect("import");
    store.build_story_package(&project.id).expect("build");

    let mut project_model = store.get_project(&project.id).expect("project");
    let mut rule = project_model.rules[0].clone();
    rule.explanation = "更新后的规则说明".into();

    let updated = store.upsert_rule(&project.id, rule).expect("upsert");
    assert!(updated.iter().any(|rule| rule.explanation == "更新后的规则说明"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml project_supports_updating_rule_definitions`

Expected: FAIL because `upsert_rule` does not exist.

- [ ] **Step 3: Add CRUD methods**

In `src-tauri/src/store.rs` add:

```rust
pub fn upsert_rule(&mut self, project_id: &str, rule: crate::rules::RuleDefinition) -> AppResult<Vec<crate::rules::RuleDefinition>> {
    let project = self.projects.get_mut(project_id).ok_or_else(|| AppError::NotFound(project_id.to_string()))?;
    if let Some(existing) = project.rules.iter_mut().find(|item| item.id == rule.id) {
        *existing = rule;
    } else {
        project.rules.push(rule);
    }
    let snapshot = project.clone();
    self.persist_project(&snapshot)?;
    Ok(snapshot.rules)
}

pub fn delete_rule(&mut self, project_id: &str, rule_id: &str) -> AppResult<Vec<crate::rules::RuleDefinition>> {
    let project = self.projects.get_mut(project_id).ok_or_else(|| AppError::NotFound(project_id.to_string()))?;
    project.rules.retain(|rule| rule.id != rule_id);
    let snapshot = project.clone();
    self.persist_project(&snapshot)?;
    Ok(snapshot.rules)
}
```

Also add similar CRUD for character cards and worldbook entries if not already present.

- [ ] **Step 4: Add Tauri commands and frontend API mapping**

In `src-tauri/src/lib.rs`, add:
- `get_project`
- `upsert_rule`
- `delete_rule`
- `upsert_character_card`
- `delete_character_card`
- `upsert_worldbook_entry`
- `delete_worldbook_entry`

In `src/lib/api/client.ts`, map them one by one using explicit methods.

- [ ] **Step 5: Run verification**

Run:
- `cargo test --manifest-path src-tauri/Cargo.toml project_supports_updating_rule_definitions`
- `pnpm check`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/store.rs src-tauri/src/lib.rs src/lib/api/client.ts src/lib/mock-backend.ts
git commit -m "feat: add project model editing apis"
```

---

### Task 8: Final regression coverage and documentation alignment

**Files:**
- Modify: `docs/superpowers/specs/2026-04-07-interactive-vn-reader-design.md`
- Modify: `src-tauri/src/store.rs`
- Modify: `src/lib/rule-helpers.test.ts`

- [ ] **Step 1: Add backend regression test for rule-triggered state**

Append to `src-tauri/src/store.rs`:

```rust
#[test]
fn free_input_that_implies_relation_updates_story_possibility_flags() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

    let project = store.create_project("临川夜话").expect("project");
    store.import_novel_text(&project.id, &sample_novel()).expect("import");
    store.build_story_package(&project.id).expect("build");

    let session = store.start_session(&project.id).expect("session");
    let _ = store.submit_free_input(&session.session_id, "一男一女发生了关系").expect("input");
    let payload = store.get_current_scene(&session.session_id).expect("payload");

    assert!(payload.story_state.possibility_flags.iter().any(|flag| flag.contains("possibility.conception")));
}
```

- [ ] **Step 2: Add frontend regression test for helper stability**

Append to `src/lib/rule-helpers.test.ts`:

```ts
it('keeps unknown rule priorities muted', () => {
  expect(ruleBadgeTone('unknown')).toBe('muted');
});
```

- [ ] **Step 3: Run full verification**

Run:
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm test`
- `pnpm check`
- `pnpm build`

Expected:
- all Rust tests PASS
- all Vitest tests PASS
- svelte-check PASS
- production build PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-07-interactive-vn-reader-design.md src-tauri/src/store.rs src/lib/rule-helpers.test.ts
git commit -m "test: cover structured story engine regressions"
```

---

## Public interface changes

- `CharacterCard` becomes a richer model with identity, faction, secrets, traits, abilities
- `NovelProject` gains:
  - `character_cards`
  - `worldbook_entries`
  - `rules`
- `SessionState` gains:
  - `story_state`
- `ScenePayload` gains:
  - `active_lore`
  - `active_rules`
  - `story_state`
- New Tauri command family:
  - `get_project`
  - `upsert_character_card`
  - `delete_character_card`
  - `upsert_worldbook_entry`
  - `delete_worldbook_entry`
  - `upsert_rule`
  - `delete_rule`

## Test plan

- Backend extraction tests:
  - character cards are non-empty
  - worldbook entries are non-empty
  - rule drafts are non-empty
- Rule engine tests:
  - impossible biological outcomes are blocked
  - legal combinations set possibility flags
  - forbidden actions create rule explanations
- Runtime tests:
  - scene payload includes active lore and story state
  - free input can mutate structured state
  - checkpoint rewind preserves state coherently
- Frontend tests:
  - rule priority badge helper
  - possibility flag summarizer
  - existing build-stage helper remains stable
- Full verification:
  - `cargo test --manifest-path src-tauri/Cargo.toml`
  - `pnpm test`
  - `pnpm check`
  - `pnpm build`

## Assumptions and defaults

- First wave remains Chinese-text-first.
- Rule evaluation stays deterministic and explicit; AI does not override hard constraints.
- The heuristic provider only drafts initial cards/lore/rules; later a cloud model provider can replace it without changing the runtime contract.
- Review happens after build and before play; this is required because extracted world models may need correction.
- We keep the existing single-project prototype and evolve it in place rather than restarting the repo.
