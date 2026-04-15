import type {
  AiProviderKind,
  ActiveLoreEntry,
  ActiveRuleHit,
  AppAiSettingsSnapshot,
  BuildStatus,
  CharacterCard,
  CheckpointSnapshot,
  CoreConflict,
  ExternalProviderSettingsInput,
  LoreLifecycleRecord,
  NovelProject,
  ProjectedOutcomePreview,
  RuleDefinition,
  RuleEvaluationResult,
  ReviewPreviewContext,
  ReviewPreviewExplanations,
  ReviewPreviewSnapshot,
  RuntimeSnapshot,
  SavedProjectLibraryEntry,
  SaveAiSettingsInput,
  SceneNode,
  ScenePayload,
  SessionStatus,
  SessionState,
  StoryBible,
  StoryCodex,
  StoryPackage,
  StoryState,
  WorldBookEntry
} from '$lib/types';

const projects = new Map<string, NovelProject>();
const packages = new Map<string, StoryPackage>();
const sessions = new Map<string, SessionState>();
const projectActivityAt = new Map<string, number>();
const sessionActivityAt = new Map<string, number>();
const providerApiKeys: Record<Exclude<AiProviderKind, 'heuristic'>, string> = {
  openai_compatible: '',
  openrouter: ''
};
let aiSettings: AppAiSettingsSnapshot = {
  selected_provider: 'heuristic',
  openai_compatible: {
    base_url: '',
    model: '',
    has_api_key: false
  },
  openrouter: {
    base_url: 'https://openrouter.ai/api/v1',
    model: '',
    has_api_key: false
  }
};
let counter = 0;
let activityClock = Date.now();

function nextId(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

function nextActivityAt() {
  activityClock = Math.max(activityClock + 1_000, Date.now());
  return activityClock;
}

function touchProject(projectId: string) {
  projectActivityAt.set(projectId, nextActivityAt());
}

function touchSession(sessionId: string) {
  sessionActivityAt.set(sessionId, nextActivityAt());
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function normalizeProviderInput(input: ExternalProviderSettingsInput, fallbackBaseUrl = '') {
  return {
    base_url: normalizeBaseUrl(input.base_url || fallbackBaseUrl),
    model: input.model.trim()
  };
}

function sanitizeNovelText(input: string) {
  return input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function isExternalProviderComplete(settings: AppAiSettingsSnapshot) {
  if (settings.selected_provider === 'heuristic') return true;
  const active =
    settings.selected_provider === 'openai_compatible'
      ? settings.openai_compatible
      : settings.openrouter;
  return Boolean(active.base_url && active.model && active.has_api_key);
}

function splitChapterLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function clearProjectBuildOutputs(project: NovelProject): NovelProject {
  return {
    ...project,
    story_package: null,
    character_cards: [],
    worldbook_entries: [],
    rules: []
  };
}

function hasUsableImportedSource(project: NovelProject) {
  return Boolean(project.raw_text.trim() && project.chapters.length > 0);
}

function resolveSessionStatus(status?: SessionStatus | null): SessionStatus {
  return status ?? 'active';
}

function sessionStatusRank(status: SessionStatus) {
  switch (status) {
    case 'active':
      return 2;
    case 'ending_reached':
      return 1;
    case 'finished':
      return 0;
  }
}

function failProjectBuild(project: NovelProject, message: string, progress: number, error: string) {
  const failed: NovelProject = {
    ...project,
    build_status: {
      stage: 'failed',
      message,
      progress,
      error
    }
  };
  projects.set(project.id, failed);
  touchProject(project.id);
  return failed;
}

function invalidateProjectSessions(projectId: string) {
  for (const [sessionId, session] of sessions.entries()) {
    if (session.project_id === projectId) {
      sessions.delete(sessionId);
      sessionActivityAt.delete(sessionId);
    }
  }
}

function getLatestProjectSession(projectId: string) {
  return Array.from(sessions.values())
    .filter((session) => session.project_id === projectId)
    .sort((left, right) => {
      const statusOrder =
        sessionStatusRank(resolveSessionStatus(right.status)) -
        sessionStatusRank(resolveSessionStatus(left.status));
      if (statusOrder !== 0) {
        return statusOrder;
      }

      const activityOrder =
        (sessionActivityAt.get(right.session_id) ?? 0) - (sessionActivityAt.get(left.session_id) ?? 0);
      if (activityOrder !== 0) {
        return activityOrder;
      }

      return right.session_id.localeCompare(left.session_id);
    })[0];
}

function buildProject(name: string): NovelProject {
  return {
    id: nextId('project'),
    name,
    raw_text: '',
    chapters: [],
    build_status: {
      stage: 'created',
      message: 'Project created',
      progress: 0
    },
    character_cards: [],
    worldbook_entries: [],
    rules: [],
    story_package: null
  };
}

function buildCharacters(): CharacterCard[] {
  return [
    {
      id: 'character-1',
      name: '沈砚',
      gender: 'male',
      age: 22,
      identity: '守门人',
      faction: '临川城',
      role: '主视角',
      summary: '被迫在禁忌与责任之间做选择。',
      desire: '想知道门后究竟藏着什么',
      secrets: ['知道北门的真正代价'],
      traits: ['克制', '敏锐'],
      abilities: ['识别规则', '忍耐压力'],
      mutable_state: { trust: '1' }
    },
    {
      id: 'character-2',
      name: '宁昭',
      gender: 'female',
      age: 21,
      identity: '破局者',
      faction: '门外之约',
      role: '关键同伴',
      summary: '不断推动故事逼近真相。',
      desire: '想打破已经失效的旧约',
      secrets: ['知道旧约曾被篡改'],
      traits: ['坚定', '锋利'],
      abilities: ['追问真相', '逼近禁忌'],
      mutable_state: { trust: '2' }
    },
    {
      id: 'character-3',
      name: '城规',
      gender: 'unknown',
      age: null,
      identity: '无形对手',
      faction: '临川城',
      role: '规则化身',
      summary: '像角色一样施压在每一步抉择上。',
      desire: '想维持旧秩序',
      secrets: ['自己也依赖故事被不断重复'],
      traits: ['冰冷', '顽固'],
      abilities: ['施加禁令'],
      mutable_state: {}
    }
  ];
}

function buildRules(): RuleDefinition[] {
  return [
    {
      id: 'rule-biology-1',
      name: 'same-sex-cannot-conceive',
      category: 'biology_rule',
      priority: 'hard_constraint',
      enabled: true,
      conditions: [
        { fact: 'event.kind', operator: 'equals', value: 'sexual_relation' },
        { fact: 'actor.gender', operator: 'equals', value: 'male' },
        { fact: 'target.gender', operator: 'equals', value: 'male' }
      ],
      blockers: [],
      effects: [{ key: 'possibility.conception', value: 'false' }],
      explanation: '两个男性不能自然生育'
    },
    {
      id: 'rule-biology-2',
      name: 'mixed-sex-can-conceive',
      category: 'biology_rule',
      priority: 'consequence',
      enabled: true,
      conditions: [
        { fact: 'event.kind', operator: 'equals', value: 'sexual_relation' },
        { fact: 'actor.gender', operator: 'equals', value: 'male' },
        { fact: 'target.gender', operator: 'equals', value: 'female' }
      ],
      blockers: [],
      effects: [{ key: 'possibility.conception', value: 'true' }],
      explanation: '一男一女发生关系时存在怀孕可能'
    },
    {
      id: 'rule-gate-1',
      name: 'north-gate-midnight-forbidden',
      category: 'social_rule',
      priority: 'hard_constraint',
      enabled: true,
      conditions: [
        { fact: 'event.kind', operator: 'equals', value: 'open_gate' },
        { fact: 'scene.time', operator: 'equals', value: 'midnight' }
      ],
      blockers: [],
      effects: [{ key: 'event.forbidden', value: 'true' }],
      explanation: '午夜之后绝不能打开北门'
    }
  ];
}

function buildWorldBook(characters: CharacterCard[], rules: RuleDefinition[]): WorldBookEntry[] {
  return [
    {
      id: 'lore-character-shen',
      title: '角色卡：沈砚',
      category: 'character',
      content: '守门人，始终在真相与秩序之间摇摆。',
      enabled: true,
      keys: ['沈砚'],
      secondary_keys: ['守门人'],
      selective_logic: 'and_any',
      constant: true,
      recursive: false,
      exclude_recursion: false,
      prevent_recursion: false,
      delay_until_recursion: null,
      scan_depth: 4,
      case_sensitive: false,
      match_whole_words: false,
      sticky: 1,
      cooldown: null,
      delay: null,
      triggers: ['scene'],
      ignore_budget: true,
      order: 0,
      insertion_mode: 'codex_only',
      source: 'character_card',
      rule_binding: null
    },
    {
      id: 'lore-gate',
      title: '北门禁令',
      category: 'social_rule',
      content: '午夜之后绝不能打开北门。',
      enabled: true,
      keys: ['北门', '门'],
      secondary_keys: ['午夜'],
      selective_logic: 'and_any',
      constant: false,
      recursive: true,
      exclude_recursion: false,
      prevent_recursion: false,
      delay_until_recursion: null,
      scan_depth: 4,
      case_sensitive: false,
      match_whole_words: false,
      sticky: 1,
      cooldown: 1,
      delay: null,
      triggers: ['scene', 'free_input'],
      ignore_budget: false,
      order: 10,
      insertion_mode: 'rules_guard',
      source: 'rule_sentence',
      rule_binding: 'rule-gate-1'
    },
    {
      id: 'lore-mist',
      title: '雾的代价',
      category: 'event_memory',
      content: '只要北门打开一次，河上的雾就会吞掉名字。',
      enabled: true,
      keys: ['雾', '名字'],
      secondary_keys: [],
      selective_logic: 'and_any',
      constant: false,
      recursive: false,
      exclude_recursion: false,
      prevent_recursion: false,
      delay_until_recursion: null,
      scan_depth: 4,
      case_sensitive: false,
      match_whole_words: false,
      sticky: null,
      cooldown: 1,
      delay: 1,
      triggers: ['scene'],
      ignore_budget: false,
      order: 20,
      insertion_mode: 'scene_prelude',
      source: 'rule_sentence',
      rule_binding: null
    },
    ...characters.slice(1).map((character, index) => ({
      id: `lore-character-${character.id}`,
      title: `角色卡：${character.name}`,
      category: 'character' as const,
      content: `${character.summary} 欲望：${character.desire}`,
      enabled: true,
      keys: [character.name],
      secondary_keys: [character.identity],
      selective_logic: 'and_any' as const,
      constant: false,
      recursive: false,
      exclude_recursion: false,
      prevent_recursion: false,
      delay_until_recursion: null,
      scan_depth: 4,
      case_sensitive: false,
      match_whole_words: false,
      sticky: null,
      cooldown: null,
      delay: null,
      triggers: ['scene'],
      ignore_budget: false,
      order: 30 + index,
      insertion_mode: 'codex_only' as const,
      source: 'character_card',
      rule_binding: null
    })),
    ...rules.map((rule, index) => ({
      id: `lore-rule-${rule.id}`,
      title: `规则摘要：${rule.name}`,
      category: rule.category.includes('biology') ? ('biology_rule' as const) : ('social_rule' as const),
      content: rule.explanation,
      enabled: true,
      keys:
        rule.id === 'rule-biology-1'
          ? ['男男', '两个男性']
          : rule.id === 'rule-biology-2'
            ? ['一男一女', '发生关系']
            : ['午夜', '开门'],
      secondary_keys: [],
      selective_logic: 'and_any' as const,
      constant: false,
      recursive: false,
      exclude_recursion: false,
      prevent_recursion: false,
      delay_until_recursion: null,
      scan_depth: 4,
      case_sensitive: false,
      match_whole_words: false,
      sticky: null,
      cooldown: null,
      delay: rule.id === 'rule-gate-1' ? 1 : null,
      triggers: ['free_input', 'choice'],
      ignore_budget: false,
      order: 40 + index,
      insertion_mode: 'rules_guard' as const,
      source: 'rule_definition',
      rule_binding: rule.id
    }))
  ];
}

function buildStoryBible(project: NovelProject): StoryBible {
  const chapters = project.chapters;
  const title = project.name;
  const conflicts: CoreConflict[] = [
    {
      id: 'conflict-1',
      title: '秩序与真相',
      summary: '用户需要在守住规则与改写命运之间做出抉择。'
    }
  ];

  return {
    title,
    characters: project.character_cards,
    locations: [
      { id: 'location-1', name: '临川城', summary: '被雾与古老约定围困的地方。' },
      { id: 'location-2', name: '北门', summary: '一切抉择最终都会汇聚到这里。' }
    ],
    timeline: chapters.map((chapter) => ({
      id: `timeline-${chapter.order}`,
      label: chapter.title,
      order: chapter.order,
      summary: chapter.excerpt
    })),
    world_rules: project.rules.map((rule) => ({
      id: rule.id,
      description: rule.explanation
    })),
    relationships: [
      { source: '沈砚', target: '宁昭', label: '信任与拉扯', strength: 2 },
      { source: '沈砚', target: '城规', label: '服从与反抗', strength: -1 }
    ],
    core_conflicts: conflicts
  };
}

function makeChoice(id: string, label: string, nextSceneId: string, intent: string, unlock: string[] = []) {
  return {
    id,
    label,
    intent_tag: intent,
    state_effects: [],
    unlock_conditions: unlock,
    next_scene_id: nextSceneId
  };
}

function buildStoryPackage(project: NovelProject): StoryPackage {
  const bible = buildStoryBible(project);
  const intro = project.chapters[0]?.excerpt ?? '故事开始了。';
  const middle = project.chapters[1]?.excerpt ?? '旧约在逼近。';
  const finale = project.chapters[2]?.excerpt ?? '最后的选择已经到来。';

  const scenes: Record<string, SceneNode> = {
    'scene-1': {
      id: 'scene-1',
      chapter: 1,
      title: project.chapters[0]?.title ?? '序章',
      summary: intro,
      narration: [intro, '你能感觉到，这不是一个只适合旁观的故事。'],
      dialogue: [
        { speaker: '沈砚', text: '这场雨像是在提醒我，今晚不会只是一次等待。', emotion: '警觉' },
        { speaker: '宁昭', text: '如果答案就在门后，你还想继续沉默吗？', emotion: '试探' }
      ],
      entry_conditions: [],
      present_characters: ['沈砚', '宁昭'],
      candidate_choices: [
        makeChoice('scene-1-steady', '谨慎推进', 'scene-2', 'steady'),
        makeChoice('scene-1-probe', '追问真相', 'scene-2', 'probe'),
        makeChoice('scene-1-conceal', '暂时隐瞒', 'scene-2', 'conceal')
      ],
      fallback_next: 'scene-2',
      allow_free_input: false,
      checkpoint: true,
      ending: null
    },
    'scene-2': {
      id: 'scene-2',
      chapter: 2,
      title: project.chapters[1]?.title ?? '过渡',
      summary: middle,
      narration: [middle, '你现在可以亲自表达立场，故事会记住这一句。'],
      dialogue: [
        { speaker: '宁昭', text: '我不是想逼你，我只是想知道你究竟想守住什么。', emotion: '克制' }
      ],
      entry_conditions: [],
      present_characters: ['沈砚', '宁昭'],
      candidate_choices: [
        makeChoice('scene-2-steady', '继续观察', 'scene-3', 'steady'),
        makeChoice('scene-2-push', '逼近禁忌', 'scene-3', 'push'),
        makeChoice('scene-2-delay', '拖住对方', 'scene-3', 'delay')
      ],
      fallback_next: 'scene-3',
      allow_free_input: true,
      checkpoint: false,
      ending: null
    },
    'scene-3': {
      id: 'scene-3',
      chapter: 3,
      title: project.chapters[2]?.title ?? '抉择',
      summary: finale,
      narration: [finale, '最后的门槛就在眼前，所有分支都在等你的决定。'],
      dialogue: [
        { speaker: '沈砚', text: '如果我现在转身，故事会不会永远停在这里？', emotion: '迟疑' },
        { speaker: '宁昭', text: '无论你选哪条路，我都会记住这是你亲手做出的决定。', emotion: '坚定' }
      ],
      entry_conditions: [],
      present_characters: ['沈砚', '宁昭'],
      candidate_choices: [
        makeChoice('choice-covenant', '守住规则，留下余地', 'ending-covenant', 'covenant'),
        makeChoice('choice-truth', '揭开真相，改写结局', 'ending-revelation', 'truth', ['insight:truth']),
        makeChoice('choice-exile', '不顾代价，强行开门', 'ending-exile', 'exile')
      ],
      fallback_next: 'ending-covenant',
      allow_free_input: false,
      checkpoint: true,
      ending: null
    },
    'ending-covenant': {
      id: 'ending-covenant',
      chapter: 99,
      title: '余烬中的守约',
      summary: '你守住了边界，也把答案留在了门后。',
      narration: ['门没有打开，风却替你把遗憾吹得很远。'],
      dialogue: [],
      entry_conditions: [],
      present_characters: ['沈砚', '宁昭'],
      candidate_choices: [],
      fallback_next: null,
      allow_free_input: false,
      checkpoint: false,
      ending: {
        ending_type: '守约结局',
        summary: '你选择让秩序延续，换来一个带着遗憾但可承受的夜晚。',
        decisive_turns: ['守住规则'],
        unresolved_threads: ['门后的真相仍未完全揭开']
      }
    },
    'ending-revelation': {
      id: 'ending-revelation',
      chapter: 100,
      title: '雾散之后',
      summary: '你把真相推到台前，也终于让故事前进了一步。',
      narration: ['门缓缓推开，雾没有吞掉名字，反而让旧约第一次显出裂缝。'],
      dialogue: [],
      entry_conditions: [],
      present_characters: ['沈砚', '宁昭'],
      candidate_choices: [],
      fallback_next: null,
      allow_free_input: false,
      checkpoint: false,
      ending: {
        ending_type: '真相结局',
        summary: '你揭开禁忌，代价巨大，但故事终于摆脱了重复。',
        decisive_turns: ['追问真相', '改写结局'],
        unresolved_threads: ['旧秩序的反扑仍在酝酿']
      }
    },
    'ending-exile': {
      id: 'ending-exile',
      chapter: 101,
      title: '门外之人',
      summary: '你用最激烈的方式打破规则，也被规则反噬。',
      narration: ['门开得过猛，风先一步把火把和名字都吹散。'],
      dialogue: [],
      entry_conditions: [],
      present_characters: ['沈砚', '宁昭'],
      candidate_choices: [],
      fallback_next: null,
      allow_free_input: false,
      checkpoint: false,
      ending: {
        ending_type: '流放结局',
        summary: '你越界而行，换来一个锋利、孤独但真实的结局。',
        decisive_turns: ['强行开门'],
        unresolved_threads: ['门外世界究竟通向哪里仍是未知']
      }
    }
  };

  return {
    story_bible: bible,
    world_model: {
      character_cards: clone(project.character_cards),
      worldbook_entries: clone(project.worldbook_entries),
      rules: clone(project.rules)
    },
    start_scene_id: 'scene-1',
    scenes
  };
}

function emptyStoryState(currentSceneId = ''): StoryState {
  return {
    current_scene_id: currentSceneId,
    character_states: [],
    fact_records: [],
    relationship_states: {},
    event_flags: [],
    possibility_flags: [],
    unlocked_rules: [],
    visited_scenes: currentSceneId ? [currentSceneId] : [],
    checkpoints: [],
    ending_report: null
  };
}

function seedStoryState(storyPackage: StoryPackage): StoryState {
  return {
    ...emptyStoryState(storyPackage.start_scene_id),
    character_states: storyPackage.world_model.character_cards.map((character) => ({
      character_id: character.id,
      status_flags: [],
      counters: {}
    }))
  };
}

function seedLoreLifecycle(storyPackage: StoryPackage): LoreLifecycleRecord[] {
  return storyPackage.world_model.worldbook_entries.map((entry) => ({
    entry_id: entry.id,
    sticky_remaining: 0,
    cooldown_remaining: 0,
    delay_remaining: entry.delay ?? 0,
    state: entry.delay ? 'delayed' : 'ready',
    last_scene_id: null
  }));
}

function captureCheckpoint(session: SessionState, scene: SceneNode): SessionState {
  if (!scene.checkpoint) return session;
  const id = `checkpoint-${scene.id}`;
  if (session.available_checkpoints.some((item) => item.checkpoint.id === id)) return session;

  const snapshot: CheckpointSnapshot = {
    checkpoint: {
      id,
      label: scene.title,
      scene_id: scene.id
    },
    current_scene_id: scene.id,
    visited_scenes: [...session.visited_scenes],
    known_facts: [...session.known_facts],
    relationship_deltas: { ...session.relationship_deltas },
    rule_flags: [...session.rule_flags],
    major_choices: [...session.major_choices],
    story_state: clone(session.story_state),
    lore_lifecycle: clone(session.lore_lifecycle),
    last_active_rules: clone(session.last_active_rules)
  };

  return {
    ...session,
    available_checkpoints: [...session.available_checkpoints, snapshot]
  };
}

function evaluateRules(
  storyState: StoryState,
  storyPackage: StoryPackage,
  eventKind: string,
  sourceText: string,
  actorGender?: string,
  targetGender?: string
): RuleEvaluationResult {
  const activeRules: ActiveRuleHit[] = [];
  const nextState = clone(storyState);
  let blocked = false;
  const resolvedActorGender = actorGender ?? 'male';
  const resolvedTargetGender =
    targetGender ??
    (sourceText.includes('一男一女')
      ? 'female'
      : sourceText.includes('两个男性') || sourceText.includes('男男')
        ? 'male'
        : 'female');
  const sceneTime = sourceText.includes('午夜') ? 'midnight' : 'day';

  for (const rule of storyPackage.world_model.rules) {
    if (!rule.enabled) continue;
    const matches = rule.conditions.every((condition) => {
      const left =
        condition.fact === 'event.kind'
          ? eventKind
          : condition.fact === 'actor.gender'
            ? resolvedActorGender
            : condition.fact === 'target.gender'
              ? resolvedTargetGender
              : condition.fact === 'scene.time'
                ? sceneTime
                : sourceText;
      if (condition.operator === 'equals') return left === condition.value;
      if (condition.operator === 'contains') return left.includes(condition.value);
      if (condition.operator === 'not_equals') return left !== condition.value;
      return false;
    });

    if (!matches) continue;
    nextState.unlocked_rules = Array.from(new Set([...nextState.unlocked_rules, rule.id]));
    for (const effect of rule.effects) {
      if (effect.key.startsWith('possibility.')) {
        nextState.possibility_flags = Array.from(
          new Set([...nextState.possibility_flags, `${effect.key}=${effect.value}`])
        );
      } else {
        nextState.event_flags = Array.from(
          new Set([...nextState.event_flags, `${effect.key}=${effect.value}`])
        );
        if (effect.key === 'event.forbidden' && effect.value === 'true') blocked = true;
      }
    }
    activeRules.push({
      rule_id: rule.id,
      name: rule.name,
      priority: rule.priority,
      explanation: rule.explanation,
      effects: clone(rule.effects),
      reason: `命中事件 ${eventKind}`
    });
  }

  return {
    story_state: nextState,
    active_rules: activeRules,
    blocked
  };
}

function createPreviewActorFallback() {
  return {
    id: '',
    name: '',
    gender: 'unknown',
    age: null,
    identity: '',
    faction: '',
    role: '',
    summary: '',
    desire: '',
    secrets: [],
    traits: [],
    abilities: [],
    mutable_state: {}
  };
}

function resolvePreviewActor(storyPackage: StoryPackage, explicitId?: string | null) {
  return (
    (explicitId
      ? storyPackage.world_model.character_cards.find((card) => card.id === explicitId)
      : undefined) ??
    storyPackage.world_model.character_cards[0] ??
    createPreviewActorFallback()
  );
}

function resolvePreviewTarget(
  storyPackage: StoryPackage,
  actorId: string,
  explicitId?: string | null
) {
  return (
    (explicitId
      ? storyPackage.world_model.character_cards.find((card) => card.id === explicitId)
      : undefined) ??
    storyPackage.world_model.character_cards.find((card) => card.id !== actorId) ??
    resolvePreviewActor(storyPackage, actorId)
  );
}

function buildProjectedOutcome(
  scene: SceneNode,
  storyPackage: StoryPackage,
  rulePreview: RuleEvaluationResult
): ProjectedOutcomePreview {
  if (rulePreview.blocked) {
    return {
      blocked: true,
      staysOnScene: true,
      nextSceneId: null,
      nextSceneTitle: null,
      nextSceneSummary: null,
      candidateChoices: []
    };
  }

  const nextSceneId =
    scene.candidate_choices.find((choice) => choice.next_scene_id.trim())?.next_scene_id ??
    scene.fallback_next ??
    null;

  if (!nextSceneId) {
    return {
      blocked: false,
      staysOnScene: true,
      nextSceneId: null,
      nextSceneTitle: null,
      nextSceneSummary: null,
      candidateChoices: []
    };
  }

  const nextScene = storyPackage.scenes[nextSceneId];
  return {
    blocked: false,
    staysOnScene: false,
    nextSceneId,
    nextSceneTitle: nextScene?.title ?? null,
    nextSceneSummary: nextScene?.summary ?? null,
    candidateChoices:
      nextScene?.candidate_choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        intentTag: choice.intent_tag,
        nextSceneId: choice.next_scene_id,
        unlockConditions: [...choice.unlock_conditions]
      })) ?? []
  };
}

function buildPreviewExplanations(
  lorePreview: ActiveLoreEntry[],
  rulePreview: RuleEvaluationResult,
  projectedOutcome: ProjectedOutcomePreview
): ReviewPreviewExplanations {
  return {
    loreSummary: lorePreview.length ? `命中 ${lorePreview.length} 条 lore` : '没有新增 lore 命中',
    ruleSummary: rulePreview.blocked
      ? `存在 ${rulePreview.active_rules.length} 条激活规则，当前动作会被阻止`
      : rulePreview.active_rules.length
        ? `命中 ${rulePreview.active_rules.length} 条激活规则，但当前动作允许继续`
        : '没有规则阻止当前动作',
    outcomeSummary: projectedOutcome.blocked
      ? '动作会停留在当前场景'
      : projectedOutcome.staysOnScene
        ? '当前上下文下不会推进到新场景'
        : projectedOutcome.nextSceneTitle
          ? `动作会推进到《${projectedOutcome.nextSceneTitle}》`
          : projectedOutcome.nextSceneId
            ? `动作会推进到 ${projectedOutcome.nextSceneId}`
            : '当前上下文下不会推进到新场景'
  };
}

function previewActiveLore(
  storyPackage: StoryPackage,
  sceneId: string,
  lastFreeInput?: string,
  lifecycle?: LoreLifecycleRecord[]
): ActiveLoreEntry[] {
  const scene = storyPackage.scenes[sceneId];
  const source = [scene.title, scene.summary, scene.narration.join('\n'), lastFreeInput ?? ''].join('\n');

  return storyPackage.world_model.worldbook_entries
    .filter((entry) => entry.enabled)
    .filter((entry) => {
      const lifecycleRecord = lifecycle?.find((record) => record.entry_id === entry.id);
      if ((lifecycleRecord?.delay_remaining ?? 0) > 0) return false;
      if ((lifecycleRecord?.cooldown_remaining ?? 0) > 0 && lifecycleRecord?.last_scene_id !== sceneId) {
        return false;
      }
      if (entry.constant) return true;
      if ((lifecycleRecord?.sticky_remaining ?? 0) > 0) return true;
      return entry.keys.some((key) => source.includes(key));
    })
    .slice(0, 8)
    .map((entry) => {
      const lifecycleRecord = lifecycle?.find((record) => record.entry_id === entry.id);
      const matchedKeys = entry.constant ? ['constant'] : entry.keys.filter((key) => source.includes(key));
      return {
        entry_id: entry.id,
        title: entry.title,
        slot: entry.insertion_mode,
        matched_keys: matchedKeys.length ? matchedKeys : ['sticky'],
        reason: entry.constant ? '常驻条目' : `命中关键词：${matchedKeys.join(' / ') || 'sticky'}`,
        lifecycle_state:
          lifecycleRecord?.sticky_remaining && !matchedKeys.length
            ? 'sticky'
            : lifecycleRecord?.cooldown_remaining
              ? 'cooling_down'
              : lifecycleRecord?.delay_remaining
                ? 'delayed'
                : 'ready',
        content: entry.content,
        source: entry.source,
        rule_binding: entry.rule_binding
      };
    });
}

function syncLoreLifecycle(
  session: SessionState,
  storyPackage: StoryPackage,
  activeLore: ActiveLoreEntry[]
): LoreLifecycleRecord[] {
  return storyPackage.world_model.worldbook_entries.map((entry) => {
    const existing = session.lore_lifecycle.find((record) => record.entry_id === entry.id);
    const matched = activeLore.some((active) => active.entry_id === entry.id);
    if (matched) {
      return {
        entry_id: entry.id,
        sticky_remaining: entry.sticky ?? existing?.sticky_remaining ?? 0,
        cooldown_remaining: existing?.cooldown_remaining ?? 0,
        delay_remaining: 0,
        state: entry.sticky ? 'sticky' : 'ready',
        last_scene_id: session.current_scene_id
      };
    }
    return {
      entry_id: entry.id,
      sticky_remaining: Math.max((existing?.sticky_remaining ?? 0) - 1, 0),
      cooldown_remaining:
        existing?.last_scene_id === session.current_scene_id
          ? entry.cooldown ?? existing?.cooldown_remaining ?? 0
          : Math.max((existing?.cooldown_remaining ?? 0) - 1, 0),
      delay_remaining: Math.max((existing?.delay_remaining ?? entry.delay ?? 0) - 1, 0),
      state:
        (existing?.delay_remaining ?? entry.delay ?? 0) > 0
          ? 'delayed'
          : (existing?.cooldown_remaining ?? 0) > 0
            ? 'cooling_down'
            : (existing?.sticky_remaining ?? 0) > 0
              ? 'sticky'
              : 'ready',
      last_scene_id: existing?.last_scene_id ?? null
    };
  });
}

function buildPayload(session: SessionState, storyPackage: StoryPackage): ScenePayload {
  const activeLore = previewActiveLore(
    storyPackage,
    session.current_scene_id,
    session.free_input_history.at(-1),
    session.lore_lifecycle
  );
  const activeRules = [...session.last_active_rules];
  for (const lore of activeLore) {
    if (lore.slot !== 'rules_guard' || !lore.rule_binding) continue;
    if (activeRules.some((rule) => rule.rule_id === lore.rule_binding)) continue;
    const rule = storyPackage.world_model.rules.find((candidate) => candidate.id === lore.rule_binding);
    if (!rule) continue;
    activeRules.push({
      rule_id: rule.id,
      name: rule.name,
      priority: rule.priority,
      explanation: rule.explanation,
      effects: clone(rule.effects),
      reason: `由 lore《${lore.title}》激活`
    });
  }

  return {
    scene: clone(storyPackage.scenes[session.current_scene_id]),
    session: clone(session),
    active_lore: activeLore,
    active_rules: activeRules,
    story_state: clone(session.story_state)
  };
}

function rebuildProject(project: NovelProject): NovelProject {
  const storyPackage = buildStoryPackage(project);
  const updated: NovelProject = {
    ...project,
    story_package: storyPackage,
    build_status: {
      stage: 'ready',
      message: 'Story package ready',
      progress: 100
    }
  };
  packages.set(project.id, storyPackage);
  projects.set(project.id, updated);
  touchProject(project.id);
  return updated;
}

export const mockBackend = {
  async get_ai_settings() {
    return clone(aiSettings);
  },

  async save_ai_settings(input: SaveAiSettingsInput) {
    const openaiCompatible = normalizeProviderInput(input.openai_compatible);
    const openrouter = normalizeProviderInput(input.openrouter, 'https://openrouter.ai/api/v1');

    if (typeof input.openai_compatible.api_key === 'string') {
      providerApiKeys.openai_compatible = input.openai_compatible.api_key.trim();
    }
    if (typeof input.openrouter.api_key === 'string') {
      providerApiKeys.openrouter = input.openrouter.api_key.trim();
    }

    aiSettings = {
      selected_provider: input.selected_provider,
      openai_compatible: {
        ...openaiCompatible,
        has_api_key: Boolean(providerApiKeys.openai_compatible)
      },
      openrouter: {
        ...openrouter,
        has_api_key: Boolean(providerApiKeys.openrouter)
      }
    };

    return clone(aiSettings);
  },

  async clear_provider_api_key(providerKind: AiProviderKind) {
    if (providerKind === 'heuristic') {
      return clone(aiSettings);
    }

    providerApiKeys[providerKind] = '';
    aiSettings = {
      ...aiSettings,
      [providerKind]: {
        ...aiSettings[providerKind],
        has_api_key: false
      }
    };

    return clone(aiSettings);
  },

  async create_project(name: string) {
    const project = buildProject(name);
    projects.set(project.id, project);
    touchProject(project.id);
    return clone(project);
  },

  async list_projects() {
    return clone(
      Array.from(projects.values()).sort((left, right) => {
        const readinessOrder = Number(Boolean(right.story_package)) - Number(Boolean(left.story_package));
        if (readinessOrder !== 0) {
          return readinessOrder;
        }

        const nameOrder = left.name.localeCompare(right.name);
        if (nameOrder !== 0) {
          return nameOrder;
        }

        return left.id.localeCompare(right.id);
      })
    );
  },

  async list_saved_projects(): Promise<SavedProjectLibraryEntry[]> {
    return clone(
      Array.from(projects.values())
        .filter((project) => project.build_status.stage === 'ready' && Boolean(project.story_package))
    .map((project) => {
          const session = getLatestProjectSession(project.id);
          const sessionId = session?.session_id ?? null;
          const sceneTitle =
            session && project.story_package
              ? project.story_package.scenes[session.current_scene_id]?.title ?? null
              : null;

          return {
            project,
            session_id: sessionId,
            current_scene_title: sceneTitle,
            ending_type: session?.ending_report?.ending_type ?? null,
            last_activity_at: sessionId
              ? (sessionActivityAt.get(sessionId) ?? projectActivityAt.get(project.id) ?? 0)
              : (projectActivityAt.get(project.id) ?? 0),
            last_activity_kind:
              sessionId == null
                ? 'project'
                : resolveSessionStatus(session?.status) === 'active'
                  ? 'session'
                  : 'ending'
          } satisfies SavedProjectLibraryEntry;
        })
        .sort((left, right) => {
          const activityOrder = right.last_activity_at - left.last_activity_at;
          if (activityOrder !== 0) {
            return activityOrder;
          }

          const nameOrder = left.project.name.localeCompare(right.project.name);
          if (nameOrder !== 0) {
            return nameOrder;
          }

          return left.project.id.localeCompare(right.project.id);
        })
    );
  },

  async import_novel_text(projectId: string, content: string) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');

    const sanitized = sanitizeNovelText(content);
    if (!sanitized) {
      throw new Error('Novel text cannot be empty');
    }

    const lines = splitChapterLines(sanitized);
    const chapters = lines
      .map((line, index) =>
        line.startsWith('第')
          ? { id: `chapter-${index}`, order: index + 1, title: line, content: '', excerpt: '' }
          : line
      )
      .reduce<Array<NovelProject['chapters'][number]>>((accumulator, item) => {
        if (typeof item !== 'string') {
          accumulator.push(item);
        } else if (accumulator.length > 0) {
          const chapter = accumulator[accumulator.length - 1];
          chapter.content = [chapter.content, item].filter(Boolean).join('\n');
          chapter.excerpt = chapter.content.slice(0, 84);
        }
        return accumulator;
      }, []);

    invalidateProjectSessions(projectId);
    packages.delete(projectId);

    const imported: NovelProject = {
      ...clearProjectBuildOutputs(project),
      raw_text: sanitized,
      chapters,
      build_status: {
        stage: 'imported',
        message: 'Novel imported',
        progress: 20
      }
    };

    projects.set(projectId, imported);
    touchProject(projectId);
    return clone(imported);
  },

  async build_story_package(projectId: string) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');
    if (!hasUsableImportedSource(project)) {
      failProjectBuild(
        project,
        '构建无法开始',
        0,
        'project must contain imported source text before build'
      );
      throw new Error('project must contain imported source text before build');
    }

    const analyzingProject: NovelProject = {
      ...project,
      build_status: {
        stage: 'analyzing',
        message: 'Analyzing source novel',
        progress: 45
      }
    };
    projects.set(projectId, analyzingProject);

    try {
      if (!isExternalProviderComplete(aiSettings)) {
        throw new Error('需要填写 base URL、模型和 API key');
      }

      const character_cards = buildCharacters();
      const rules = buildRules();
      const worldbook_entries = buildWorldBook(character_cards, rules);
      const readyProject: NovelProject = rebuildProject({
        ...analyzingProject,
        character_cards,
        worldbook_entries,
        rules
      });

      return clone(readyProject.build_status as BuildStatus);
    } catch (error) {
      failProjectBuild(
        analyzingProject,
        '结构解析失败',
        45,
        error instanceof Error ? error.message : '未知错误'
      );
      throw error;
    }
  },

  async get_build_status(projectId: string) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');
    return clone(project.build_status);
  },

  async load_story_package(projectId: string) {
    const storyPackage = packages.get(projectId);
    if (!storyPackage) throw new Error('story package not found');
    return clone(storyPackage);
  },

  async get_project(projectId: string) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');
    return clone(project);
  },

  async find_project_session(projectId: string) {
    return clone(getLatestProjectSession(projectId) ?? null);
  },

  async start_session(projectId: string) {
    const storyPackage = packages.get(projectId);
    if (!storyPackage) throw new Error('story package not found');

    let session: SessionState = {
      session_id: nextId('session'),
      project_id: projectId,
      status: 'active',
      current_scene_id: storyPackage.start_scene_id,
      visited_scenes: [storyPackage.start_scene_id],
      known_facts: [],
      relationship_deltas: {},
      rule_flags: [],
      major_choices: [],
      available_checkpoints: [],
      free_input_history: [],
      ending_report: null,
      story_state: seedStoryState(storyPackage),
      lore_lifecycle: seedLoreLifecycle(storyPackage),
      last_active_rules: []
    };

    const preview = previewActiveLore(storyPackage, storyPackage.start_scene_id, undefined, session.lore_lifecycle);
    session = {
      ...session,
      lore_lifecycle: syncLoreLifecycle(session, storyPackage, preview)
    };
    session.story_state.checkpoints = [];
    session = captureCheckpoint(session, storyPackage.scenes[storyPackage.start_scene_id]);
    sessions.set(session.session_id, session);
    touchSession(session.session_id);
    return clone(session);
  },

  async get_current_scene(sessionId: string) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('session not found');
    const storyPackage = packages.get(session.project_id);
    if (!storyPackage) throw new Error('story package not found');
    return buildPayload(session, storyPackage);
  },

  async get_runtime_snapshot(sessionId: string): Promise<RuntimeSnapshot> {
    return {
      payload: await this.get_current_scene(sessionId),
      codex: await this.get_story_codex(sessionId)
    };
  },

  async submit_choice(sessionId: string, choiceId: string) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('session not found');
    const storyPackage = packages.get(session.project_id);
    if (!storyPackage) throw new Error('story package not found');

    const scene = storyPackage.scenes[session.current_scene_id];
    const choice = scene.candidate_choices.find((item) => item.id === choiceId);
    if (!choice) throw new Error('choice not found');
    if (choice.unlock_conditions.some((condition) => !session.rule_flags.includes(condition))) {
      throw new Error('choice is locked until you expose more truth');
    }

    const eventKind =
      choice.label.includes('开门') || choice.intent_tag.includes('exile')
        ? 'open_gate'
        : choice.label.includes('真相')
          ? 'seek_truth'
          : choice.intent_tag;
    const evaluation = evaluateRules(session.story_state, storyPackage, eventKind, choice.label);

    let nextSession: SessionState = {
      ...session,
      story_state: {
        ...evaluation.story_state,
        current_scene_id: choice.next_scene_id || scene.fallback_next || session.current_scene_id,
        visited_scenes: Array.from(
          new Set([...evaluation.story_state.visited_scenes, choice.next_scene_id || session.current_scene_id])
        )
      },
      last_active_rules: evaluation.active_rules,
      current_scene_id: evaluation.blocked
        ? session.current_scene_id
        : choice.next_scene_id || scene.fallback_next || session.current_scene_id,
      visited_scenes: evaluation.blocked
        ? session.visited_scenes
        : Array.from(new Set([...session.visited_scenes, choice.next_scene_id])),
      major_choices: [
        ...session.major_choices,
        evaluation.blocked ? `尝试：${choice.label}（被规则阻止）` : choice.label
      ],
      status: 'active'
    };

    const nextScene = storyPackage.scenes[nextSession.current_scene_id];
    if (nextScene.ending) {
      nextSession = {
        ...nextSession,
        status: 'ending_reached',
        ending_report: nextScene.ending,
        story_state: {
          ...nextSession.story_state,
          ending_report: nextScene.ending.summary
        }
      };
    }

    const activeLore = previewActiveLore(storyPackage, nextSession.current_scene_id, undefined, nextSession.lore_lifecycle);
    nextSession = {
      ...nextSession,
      lore_lifecycle: syncLoreLifecycle(nextSession, storyPackage, activeLore)
    };
    nextSession.story_state.checkpoints = nextSession.available_checkpoints.map(
      (checkpoint) => checkpoint.checkpoint.id
    );
    nextSession = captureCheckpoint(nextSession, nextScene);
    sessions.set(sessionId, nextSession);
    touchSession(sessionId);
    return buildPayload(nextSession, storyPackage);
  },

  async submit_free_input(sessionId: string, text: string) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('session not found');
    const storyPackage = packages.get(session.project_id);
    if (!storyPackage) throw new Error('story package not found');

    const eventKind = text.includes('发生关系')
      ? 'sexual_relation'
      : text.includes('开门')
        ? 'open_gate'
        : text.includes('真相')
          ? 'seek_truth'
          : 'free_input';
    const evaluation = evaluateRules(session.story_state, storyPackage, eventKind, text);
    const nextSession: SessionState = {
      ...session,
      rule_flags: Array.from(
        new Set([...session.rule_flags, ...(text.includes('真相') ? ['insight:truth'] : [])])
      ),
      known_facts: Array.from(
        new Set([...session.known_facts, ...(text.includes('门') ? ['门是本轮抉择的核心'] : [])])
      ),
      free_input_history: [...session.free_input_history, text],
      major_choices: [...session.major_choices, `自由行动：${text}`],
      story_state: {
        ...evaluation.story_state,
        current_scene_id: session.current_scene_id,
        visited_scenes: [...session.story_state.visited_scenes]
      },
      last_active_rules: evaluation.active_rules
    };
    const activeLore = previewActiveLore(storyPackage, nextSession.current_scene_id, text, nextSession.lore_lifecycle);
    const updated = {
      ...nextSession,
      lore_lifecycle: syncLoreLifecycle(nextSession, storyPackage, activeLore)
    };
    sessions.set(sessionId, updated);
    touchSession(sessionId);
    return buildPayload(updated, storyPackage);
  },

  async get_story_codex(sessionId: string): Promise<StoryCodex> {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('session not found');
    const storyPackage = packages.get(session.project_id);
    if (!storyPackage) throw new Error('story package not found');

    return {
      characters: clone(storyPackage.story_bible.characters),
      locations: clone(storyPackage.story_bible.locations),
      world_rules: clone(storyPackage.story_bible.world_rules),
      relationships: clone(storyPackage.story_bible.relationships),
      timeline: clone(storyPackage.story_bible.timeline),
      recent_choices: [...session.major_choices],
      worldbook_entries: clone(storyPackage.world_model.worldbook_entries),
      rules: clone(storyPackage.world_model.rules)
    };
  },

  async update_character_card(projectId: string, card: CharacterCard) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');
    const next = rebuildProject({
      ...project,
      character_cards: project.character_cards.map((candidate) =>
        candidate.id === card.id ? clone(card) : candidate
      )
    });
    return clone(next.character_cards);
  },

  async upsert_worldbook_entry(projectId: string, entry: WorldBookEntry) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');
    const exists = project.worldbook_entries.some((candidate) => candidate.id === entry.id);
    const next = rebuildProject({
      ...project,
      worldbook_entries: exists
        ? project.worldbook_entries.map((candidate) => (candidate.id === entry.id ? clone(entry) : candidate))
        : [...project.worldbook_entries, clone(entry)]
    });
    return clone(next.worldbook_entries);
  },

  async delete_worldbook_entry(projectId: string, entryId: string) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');
    const next = rebuildProject({
      ...project,
      worldbook_entries: project.worldbook_entries.filter((entry) => entry.id !== entryId)
    });
    return clone(next.worldbook_entries);
  },

  async upsert_rule(projectId: string, rule: RuleDefinition) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');
    const exists = project.rules.some((candidate) => candidate.id === rule.id);
    const next = rebuildProject({
      ...project,
      rules: exists ? project.rules.map((candidate) => (candidate.id === rule.id ? clone(rule) : candidate)) : [...project.rules, clone(rule)]
    });
    return clone(next.rules);
  },

  async delete_rule(projectId: string, ruleId: string) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');
    const next = rebuildProject({
      ...project,
      rules: project.rules.filter((rule) => rule.id !== ruleId)
    });
    return clone(next.rules);
  },

  async preview_active_worldbook(projectId: string, sceneId: string, lastFreeInput?: string) {
    const storyPackage = packages.get(projectId);
    if (!storyPackage) throw new Error('story package not found');
    return previewActiveLore(storyPackage, sceneId, lastFreeInput, seedLoreLifecycle(storyPackage));
  },

  async preview_rule_evaluation(
    projectId: string,
    sceneId: string,
    eventKind: string,
    _actorCharacterId?: string,
    _targetCharacterId?: string,
    inputText?: string
  ) {
    const storyPackage = packages.get(projectId);
    if (!storyPackage) throw new Error('story package not found');
    const scene = storyPackage.scenes[sceneId];
    return evaluateRules(emptyStoryState(scene.id), storyPackage, eventKind, inputText ?? scene.title);
  },

  async preview_review_snapshot(projectId: string, context: ReviewPreviewContext) {
    const storyPackage = packages.get(projectId);
    if (!storyPackage) throw new Error('story package not found');
    const scene = storyPackage.scenes[context.sceneId];
    if (!scene) throw new Error('scene not found');

    const actor = resolvePreviewActor(storyPackage, context.actorCharacterId);
    const target = resolvePreviewTarget(storyPackage, actor.id, context.targetCharacterId);
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
      context.inputText,
      actor.gender,
      target.gender
    );
    const projectedOutcome = buildProjectedOutcome(scene, storyPackage, rulePreview);
    const explanations = buildPreviewExplanations(lorePreview, rulePreview, projectedOutcome);

    return {
      context: clone(context),
      lorePreview,
      rulePreview,
      projectedOutcome,
      explanations
    } satisfies ReviewPreviewSnapshot;
  },

  async save_review_preview_context(projectId: string, context: ReviewPreviewContext) {
    const project = projects.get(projectId);
    if (!project) throw new Error('project not found');
    const updated = {
      ...project,
      review_preview_context: clone(context)
    };
    projects.set(projectId, updated);
    touchProject(projectId);
    return clone(context);
  },

  async rewind_to_checkpoint(sessionId: string, checkpointId: string) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('session not found');
    const storyPackage = packages.get(session.project_id);
    if (!storyPackage) throw new Error('story package not found');
    const checkpoint = session.available_checkpoints.find((item) => item.checkpoint.id === checkpointId);
    if (!checkpoint) throw new Error('checkpoint not found');

    const nextSession: SessionState = {
      ...session,
      current_scene_id: checkpoint.current_scene_id,
      visited_scenes: [...checkpoint.visited_scenes],
      known_facts: [...checkpoint.known_facts],
      relationship_deltas: { ...checkpoint.relationship_deltas },
      rule_flags: [...checkpoint.rule_flags],
      major_choices: [...checkpoint.major_choices],
      status: 'active',
      ending_report: null,
      story_state: clone(checkpoint.story_state),
      lore_lifecycle: clone(checkpoint.lore_lifecycle),
      last_active_rules: clone(checkpoint.last_active_rules)
    };
    sessions.set(sessionId, nextSession);
    touchSession(sessionId);
    return buildPayload(nextSession, storyPackage);
  },

  async finish_session(sessionId: string) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('session not found');
    if (!session.ending_report) {
      return null;
    }

    const archived = {
      ...session,
      status: 'finished' as SessionStatus
    };
    sessions.set(sessionId, archived);
    touchSession(sessionId);
    return clone(archived.ending_report);
  }
};
