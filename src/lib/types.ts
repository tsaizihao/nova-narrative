export type BuildStage = 'created' | 'imported' | 'analyzing' | 'compiling' | 'ready' | 'failed';

export type AiProviderKind = 'heuristic' | 'openai_compatible' | 'openrouter';

export interface BuildStatus {
  stage: BuildStage;
  message: string;
  progress: number;
  error?: string | null;
}

export interface ExternalProviderSettingsSnapshot {
  base_url: string;
  model: string;
  has_api_key: boolean;
}

export interface AppAiSettingsSnapshot {
  selected_provider: AiProviderKind;
  openai_compatible: ExternalProviderSettingsSnapshot;
  openrouter: ExternalProviderSettingsSnapshot;
}

export interface ExternalProviderSettingsInput {
  base_url: string;
  model: string;
  api_key?: string | null;
}

export interface SaveAiSettingsInput {
  selected_provider: AiProviderKind;
  openai_compatible: ExternalProviderSettingsInput;
  openrouter: ExternalProviderSettingsInput;
}

export interface ChapterChunk {
  id: string;
  order: number;
  title: string;
  content: string;
  excerpt: string;
  source_unit_kind?: SourceUnitKind;
  chapter_number?: number | null;
}

export type SourceUnitKind = 'preface' | 'chapter' | 'scene';

export interface ImportDiagnostics {
  byte_count: number;
  char_count: number;
  line_count: number;
  non_empty_line_count: number;
  source_unit_count: number;
  unassigned_line_count: number;
  missing_glyph_count: number;
  max_line_char_count: number;
  normalized_crlf: boolean;
}

export interface SourceChapterSnapshot {
  chapter_id: string;
  title: string;
  excerpt: string;
  source_unit_kind?: SourceUnitKind;
  chapter_number?: number | null;
}

export interface SourceNovelSnapshot {
  title: string;
  chapter_count: number;
  chapters: SourceChapterSnapshot[];
}

export interface CanonCharacterAnchor {
  character_id: string;
  name: string;
  protected_identity: string;
  protected_role: string;
  anchor_traits: string[];
  summary: string;
}

export interface CanonEventAnchor {
  event_id: string;
  chapter_id: string;
  title: string;
  summary: string;
  locked: boolean;
}

export interface AdaptationConstraintSet {
  preserve_character_core: boolean;
  allow_relationship_rewire: boolean;
  allow_player_insert: boolean;
}

export interface AdaptationKernelSnapshot {
  source_novel: SourceNovelSnapshot;
  canon_characters: CanonCharacterAnchor[];
  relationship_graph: RelationshipEdge[];
  event_graph: CanonEventAnchor[];
  world_rules: WorldRule[];
  constraints: AdaptationConstraintSet;
}

export type WorldBookCategory =
  | 'character'
  | 'location'
  | 'social_rule'
  | 'biology_rule'
  | 'supernatural_rule'
  | 'organization'
  | 'event_memory'
  | 'miscellaneous';

export type WorldBookInsertionMode = 'scene_prelude' | 'rules_guard' | 'codex_only';
export type WorldBookSelectiveLogic = 'and_any' | 'not_all' | 'not_any' | 'and_all';
export type LoreLifecycleState = 'ready' | 'sticky' | 'cooling_down' | 'delayed';

export interface CharacterCard {
  id: string;
  name: string;
  gender: string;
  age?: number | null;
  identity: string;
  faction: string;
  role: string;
  summary: string;
  desire: string;
  secrets: string[];
  traits: string[];
  abilities: string[];
  mutable_state: Record<string, string>;
}

export interface WorldBookEntry {
  id: string;
  title: string;
  category: WorldBookCategory;
  content: string;
  enabled: boolean;
  keys: string[];
  secondary_keys: string[];
  selective_logic: WorldBookSelectiveLogic;
  constant: boolean;
  recursive: boolean;
  exclude_recursion: boolean;
  prevent_recursion: boolean;
  delay_until_recursion?: number | null;
  scan_depth?: number | null;
  case_sensitive?: boolean | null;
  match_whole_words?: boolean | null;
  sticky?: number | null;
  cooldown?: number | null;
  delay?: number | null;
  triggers: string[];
  ignore_budget: boolean;
  order: number;
  insertion_mode: WorldBookInsertionMode;
  source: string;
  rule_binding?: string | null;
}

export interface ActiveLoreEntry {
  entry_id: string;
  title: string;
  slot: WorldBookInsertionMode;
  matched_keys: string[];
  reason: string;
  lifecycle_state: LoreLifecycleState;
  content: string;
  source: string;
  rule_binding?: string | null;
}

export type RulePriority =
  | 'hard_constraint'
  | 'soft_constraint'
  | 'consequence'
  | 'narrative_gate';

export type RuleOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';

export interface RuleCondition {
  fact: string;
  operator: RuleOperator;
  value: string;
}

export interface RuleEffect {
  key: string;
  value: string;
}

export interface RuleDefinition {
  id: string;
  name: string;
  category: string;
  priority: RulePriority;
  enabled: boolean;
  conditions: RuleCondition[];
  blockers: RuleCondition[];
  effects: RuleEffect[];
  explanation: string;
}

export interface ActiveRuleHit {
  rule_id: string;
  name: string;
  priority: RulePriority;
  explanation: string;
  effects: RuleEffect[];
  reason: string;
}

export interface LocationCard {
  id: string;
  name: string;
  summary: string;
}

export interface TimelineEntry {
  id: string;
  label: string;
  order: number;
  summary: string;
}

export interface WorldRule {
  id: string;
  description: string;
}

export interface RelationshipEdge {
  source: string;
  target: string;
  label: string;
  strength: number;
}

export interface CoreConflict {
  id: string;
  title: string;
  summary: string;
}

export interface StoryBible {
  title: string;
  characters: CharacterCard[];
  locations: LocationCard[];
  timeline: TimelineEntry[];
  world_rules: WorldRule[];
  relationships: RelationshipEdge[];
  core_conflicts: CoreConflict[];
}

export interface WorldModelSnapshot {
  character_cards: CharacterCard[];
  worldbook_entries: WorldBookEntry[];
  rules: RuleDefinition[];
}

export interface DialogueLine {
  speaker: string;
  text: string;
  emotion: string;
}

export interface StateEffect {
  key: string;
  delta: number;
  note: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  intent_tag: string;
  state_effects: StateEffect[];
  unlock_conditions: string[];
  next_scene_id: string;
}

export interface EndingReport {
  ending_type: string;
  summary: string;
  decisive_turns: string[];
  unresolved_threads: string[];
}

export interface SceneNode {
  id: string;
  chapter: number;
  title: string;
  summary: string;
  narration: string[];
  dialogue: DialogueLine[];
  entry_conditions: string[];
  present_characters: string[];
  candidate_choices: ChoiceOption[];
  fallback_next?: string | null;
  allow_free_input: boolean;
  checkpoint: boolean;
  ending?: EndingReport | null;
}

export interface StoryPackage {
  story_bible: StoryBible;
  world_model: WorldModelSnapshot;
  adaptation_kernel?: AdaptationKernelSnapshot | null;
  start_scene_id: string;
  scenes: Record<string, SceneNode>;
}

export interface FactRecord {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  value: string;
  timestamp: string;
  source: string;
}

export interface CharacterRuntimeState {
  character_id: string;
  status_flags: string[];
  counters: Record<string, number>;
}

export interface StoryState {
  current_scene_id: string;
  character_states: CharacterRuntimeState[];
  fact_records: FactRecord[];
  relationship_states: Record<string, number>;
  event_flags: string[];
  possibility_flags: string[];
  unlocked_rules: string[];
  visited_scenes: string[];
  checkpoints: string[];
  ending_report?: string | null;
}

export interface LoreLifecycleRecord {
  entry_id: string;
  sticky_remaining: number;
  cooldown_remaining: number;
  delay_remaining: number;
  state: LoreLifecycleState;
  last_scene_id?: string | null;
}

export interface CheckpointMarker {
  id: string;
  label: string;
  scene_id: string;
}

export interface CheckpointSnapshot {
  checkpoint: CheckpointMarker;
  current_scene_id: string;
  visited_scenes: string[];
  known_facts: string[];
  relationship_deltas: Record<string, number>;
  rule_flags: string[];
  major_choices: string[];
  story_state: StoryState;
  lore_lifecycle: LoreLifecycleRecord[];
  last_active_rules: ActiveRuleHit[];
}

export type SessionStatus = 'active' | 'ending_reached' | 'finished';

export interface SessionState {
  session_id: string;
  project_id: string;
  status?: SessionStatus;
  current_scene_id: string;
  visited_scenes: string[];
  known_facts: string[];
  relationship_deltas: Record<string, number>;
  rule_flags: string[];
  major_choices: string[];
  available_checkpoints: CheckpointSnapshot[];
  free_input_history: string[];
  ending_report?: EndingReport | null;
  story_state: StoryState;
  lore_lifecycle: LoreLifecycleRecord[];
  last_active_rules: ActiveRuleHit[];
}

export interface StoryCodex {
  characters: CharacterCard[];
  locations: LocationCard[];
  world_rules: WorldRule[];
  relationships: RelationshipEdge[];
  timeline: TimelineEntry[];
  recent_choices: string[];
  worldbook_entries: WorldBookEntry[];
  rules: RuleDefinition[];
}

export interface ScenePayload {
  scene: SceneNode;
  session: SessionState;
  active_lore: ActiveLoreEntry[];
  active_rules: ActiveRuleHit[];
  story_state: StoryState;
}

export interface RuntimeSnapshot {
  payload: ScenePayload;
  codex: StoryCodex;
}

export interface RuleEvaluationResult {
  story_state: StoryState;
  active_rules: ActiveRuleHit[];
  blocked: boolean;
}

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

export interface NovelProject {
  id: string;
  name: string;
  raw_text: string;
  chapters: ChapterChunk[];
  build_status: BuildStatus;
  story_package?: StoryPackage | null;
  adaptation_kernel?: AdaptationKernelSnapshot | null;
  character_cards: CharacterCard[];
  worldbook_entries: WorldBookEntry[];
  rules: RuleDefinition[];
  review_preview_context?: ReviewPreviewContext | null;
  import_diagnostics?: ImportDiagnostics | null;
}

export type SavedProjectActivityKind = 'project' | 'session' | 'ending';

export interface SavedProjectLibraryEntry {
  project: NovelProject;
  session_id?: string | null;
  current_scene_title?: string | null;
  ending_type?: string | null;
  last_activity_at: number;
  last_activity_kind: SavedProjectActivityKind;
}

export interface StageCard {
  key: BuildStage;
  label: string;
  status: 'done' | 'current' | 'upcoming' | 'error';
}
