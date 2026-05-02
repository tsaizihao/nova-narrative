use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::{
    rules::{ActiveRuleHit, RuleDefinition},
    state::{LoreLifecycleRecord, StoryState},
    worldbook::{ActiveLoreEntry, WorldBookEntry},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum BuildStage {
    #[default]
    Created,
    Imported,
    Analyzing,
    Compiling,
    Ready,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AiProviderKind {
    #[default]
    Heuristic,
    OpenAiCompatible,
    OpenRouter,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BuildStatus {
    pub stage: BuildStage,
    pub message: String,
    pub progress: u8,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SavedProjectActivityKind {
    Project,
    Session,
    Ending,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedProjectLibraryEntry {
    pub project: NovelProject,
    pub session_id: Option<String>,
    pub current_scene_title: Option<String>,
    pub ending_type: Option<String>,
    pub last_activity_at: i64,
    pub last_activity_kind: SavedProjectActivityKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExternalProviderSettingsSnapshot {
    pub base_url: String,
    pub model: String,
    pub has_api_key: bool,
}

impl Default for ExternalProviderSettingsSnapshot {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            model: String::new(),
            has_api_key: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppAiSettingsSnapshot {
    pub selected_provider: AiProviderKind,
    pub openai_compatible: ExternalProviderSettingsSnapshot,
    pub openrouter: ExternalProviderSettingsSnapshot,
}

impl Default for AppAiSettingsSnapshot {
    fn default() -> Self {
        Self {
            selected_provider: AiProviderKind::Heuristic,
            openai_compatible: ExternalProviderSettingsSnapshot::default(),
            openrouter: ExternalProviderSettingsSnapshot {
                base_url: "https://openrouter.ai/api/v1".into(),
                model: String::new(),
                has_api_key: false,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct ExternalProviderSettingsInput {
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SaveAiSettingsInput {
    pub selected_provider: AiProviderKind,
    pub openai_compatible: ExternalProviderSettingsInput,
    pub openrouter: ExternalProviderSettingsInput,
}

impl Default for SaveAiSettingsInput {
    fn default() -> Self {
        Self {
            selected_provider: AiProviderKind::Heuristic,
            openai_compatible: ExternalProviderSettingsInput::default(),
            openrouter: ExternalProviderSettingsInput {
                base_url: "https://openrouter.ai/api/v1".into(),
                model: String::new(),
                api_key: None,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum SourceUnitKind {
    Preface,
    #[default]
    Chapter,
    Scene,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ImportDiagnostics {
    pub byte_count: usize,
    pub char_count: usize,
    pub line_count: usize,
    pub non_empty_line_count: usize,
    pub source_unit_count: usize,
    pub unassigned_line_count: usize,
    pub missing_glyph_count: usize,
    pub max_line_char_count: usize,
    pub normalized_crlf: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChapterChunk {
    pub id: String,
    pub order: usize,
    pub title: String,
    pub content: String,
    pub excerpt: String,
    #[serde(default)]
    pub source_unit_kind: SourceUnitKind,
    #[serde(default)]
    pub chapter_number: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SourceChapterSnapshot {
    pub chapter_id: String,
    pub title: String,
    pub excerpt: String,
    #[serde(default)]
    pub source_unit_kind: SourceUnitKind,
    #[serde(default)]
    pub chapter_number: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SourceNovelSnapshot {
    pub title: String,
    pub chapter_count: usize,
    pub chapters: Vec<SourceChapterSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CanonCharacterAnchor {
    pub character_id: String,
    pub name: String,
    pub protected_identity: String,
    pub protected_role: String,
    pub anchor_traits: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CanonEventAnchor {
    pub event_id: String,
    pub chapter_id: String,
    pub title: String,
    pub summary: String,
    pub locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AdaptationConstraintSet {
    pub preserve_character_core: bool,
    pub allow_relationship_rewire: bool,
    pub allow_player_insert: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AdaptationKernelSnapshot {
    pub source_novel: SourceNovelSnapshot,
    pub canon_characters: Vec<CanonCharacterAnchor>,
    pub relationship_graph: Vec<RelationshipEdge>,
    pub event_graph: Vec<CanonEventAnchor>,
    pub world_rules: Vec<WorldRule>,
    pub constraints: AdaptationConstraintSet,
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
    #[serde(default)]
    pub review_preview_context: Option<ReviewPreviewContext>,
    #[serde(default)]
    pub adaptation_kernel: Option<AdaptationKernelSnapshot>,
    #[serde(default)]
    pub import_diagnostics: Option<ImportDiagnostics>,
}

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
    pub mutable_state: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocationCard {
    pub id: String,
    pub name: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TimelineEntry {
    pub id: String,
    pub label: String,
    pub order: usize,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorldRule {
    pub id: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RelationshipEdge {
    pub source: String,
    pub target: String,
    pub label: String,
    pub strength: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CoreConflict {
    pub id: String,
    pub title: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoryBible {
    pub title: String,
    pub characters: Vec<CharacterCard>,
    pub locations: Vec<LocationCard>,
    pub timeline: Vec<TimelineEntry>,
    pub world_rules: Vec<WorldRule>,
    pub relationships: Vec<RelationshipEdge>,
    pub core_conflicts: Vec<CoreConflict>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorldModelSnapshot {
    pub character_cards: Vec<CharacterCard>,
    pub worldbook_entries: Vec<WorldBookEntry>,
    pub rules: Vec<RuleDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DialogueLine {
    pub speaker: String,
    pub text: String,
    pub emotion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StateEffect {
    pub key: String,
    pub delta: i32,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChoiceOption {
    pub id: String,
    pub label: String,
    pub intent_tag: String,
    pub state_effects: Vec<StateEffect>,
    pub unlock_conditions: Vec<String>,
    pub next_scene_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EndingReport {
    pub ending_type: String,
    pub summary: String,
    pub decisive_turns: Vec<String>,
    pub unresolved_threads: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SceneNode {
    pub id: String,
    pub chapter: usize,
    pub title: String,
    pub summary: String,
    pub narration: Vec<String>,
    pub dialogue: Vec<DialogueLine>,
    pub entry_conditions: Vec<String>,
    pub present_characters: Vec<String>,
    pub candidate_choices: Vec<ChoiceOption>,
    pub fallback_next: Option<String>,
    pub allow_free_input: bool,
    pub checkpoint: bool,
    pub ending: Option<EndingReport>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoryPackage {
    pub story_bible: StoryBible,
    pub world_model: WorldModelSnapshot,
    #[serde(default)]
    pub adaptation_kernel: Option<AdaptationKernelSnapshot>,
    pub start_scene_id: String,
    pub scenes: BTreeMap<String, SceneNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CheckpointMarker {
    pub id: String,
    pub label: String,
    pub scene_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CheckpointSnapshot {
    pub checkpoint: CheckpointMarker,
    pub current_scene_id: String,
    pub visited_scenes: Vec<String>,
    pub known_facts: Vec<String>,
    pub relationship_deltas: BTreeMap<String, i32>,
    pub rule_flags: Vec<String>,
    pub major_choices: Vec<String>,
    pub story_state: StoryState,
    pub lore_lifecycle: Vec<LoreLifecycleRecord>,
    pub last_active_rules: Vec<ActiveRuleHit>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    #[default]
    Active,
    EndingReached,
    Finished,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionState {
    pub session_id: String,
    pub project_id: String,
    #[serde(default)]
    pub status: SessionStatus,
    pub current_scene_id: String,
    pub visited_scenes: Vec<String>,
    pub known_facts: Vec<String>,
    pub relationship_deltas: BTreeMap<String, i32>,
    pub rule_flags: Vec<String>,
    pub major_choices: Vec<String>,
    pub available_checkpoints: Vec<CheckpointSnapshot>,
    pub free_input_history: Vec<String>,
    pub ending_report: Option<EndingReport>,
    pub story_state: StoryState,
    pub lore_lifecycle: Vec<LoreLifecycleRecord>,
    pub last_active_rules: Vec<ActiveRuleHit>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoryCodex {
    pub characters: Vec<CharacterCard>,
    pub locations: Vec<LocationCard>,
    pub world_rules: Vec<WorldRule>,
    pub relationships: Vec<RelationshipEdge>,
    pub timeline: Vec<TimelineEntry>,
    pub recent_choices: Vec<String>,
    pub worldbook_entries: Vec<WorldBookEntry>,
    pub rules: Vec<RuleDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScenePayload {
    pub scene: SceneNode,
    pub session: SessionState,
    pub active_lore: Vec<ActiveLoreEntry>,
    pub active_rules: Vec<ActiveRuleHit>,
    pub story_state: StoryState,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuntimeSnapshot {
    pub payload: ScenePayload,
    pub codex: StoryCodex,
}

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
    pub rule_preview: crate::runtime::RuleEvaluationResult,
    pub projected_outcome: ProjectedOutcomePreview,
    pub explanations: ReviewPreviewExplanations,
}
