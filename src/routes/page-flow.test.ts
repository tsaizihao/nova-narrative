import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AppAiSettingsSnapshot,
  BuildStatus,
  NovelProject,
  RuleEvaluationResult,
  RuntimeSnapshot,
  ScenePayload,
  StoryCodex
} from '$lib/types';

const mocks = vi.hoisted(() => ({
  projectBackend: {
    createProject: vi.fn(),
    importNovelText: vi.fn(),
    buildStoryPackage: vi.fn(),
    getProject: vi.fn(),
    listProjects: vi.fn(),
    listSavedProjects: vi.fn()
  },
  reviewBackend: {
    previewReviewSnapshot: vi.fn(),
    saveReviewPreviewContext: vi.fn(),
    updateCharacterCard: vi.fn(),
    upsertWorldBookEntry: vi.fn(),
    deleteWorldBookEntry: vi.fn(),
    upsertRule: vi.fn(),
    deleteRule: vi.fn()
  },
  runtimeBackend: {
    startSession: vi.fn(),
    findProjectSession: vi.fn(),
    getRuntimeSnapshot: vi.fn(),
    getCurrentScene: vi.fn(),
    submitChoice: vi.fn(),
    submitFreeInput: vi.fn(),
    getStoryCodex: vi.fn(),
    rewindToCheckpoint: vi.fn()
  },
  settingsBackend: {
    getAiSettings: vi.fn(),
    saveAiSettings: vi.fn(),
    clearProviderApiKey: vi.fn()
  }
}));

vi.mock('$lib/modules/projects/backend', () => mocks.projectBackend);
vi.mock('$lib/modules/review/backend', () => mocks.reviewBackend);
vi.mock('$lib/modules/runtime/backend', () => mocks.runtimeBackend);
vi.mock('$lib/modules/settings/backend', () => mocks.settingsBackend);

import Page from './+page.svelte';
import { CommandClientError } from '$lib/backend/commandClient';
import { SAMPLE_NOVEL, SAMPLE_PROJECT_NAME } from '$lib/sample-novel';

const aiSettings: AppAiSettingsSnapshot = {
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

function createProjectSnapshot(overrides: Partial<NovelProject> = {}): NovelProject {
  return {
    id: 'project-1',
    name: '示例小说',
    raw_text: '第1章 雨夜来客',
    chapters: [
      {
        id: 'chapter-1',
        order: 1,
        title: '第1章 雨夜来客',
        content: '临川城的钟声刚落。',
        excerpt: '临川城的钟声刚落。'
      }
    ],
    build_status: {
      stage: 'created',
      message: 'Project created',
      progress: 0
    },
    story_package: null,
    character_cards: [
      {
        id: 'char-1',
        name: '沈砚',
        gender: '男',
        age: 27,
        identity: '巡夜人',
        faction: '巡城司',
        role: '主角',
        summary: '在雨夜追查失踪案。',
        desire: '找回妹妹',
        secrets: ['曾与嫌疑人合作'],
        traits: ['冷静'],
        abilities: ['追踪'],
        mutable_state: {}
      }
    ],
    worldbook_entries: [],
    rules: [],
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function createScenePayload(overrides: Partial<ScenePayload> = {}): ScenePayload {
  return {
    scene: {
      id: 'scene-1',
      chapter: 1,
      title: '北门之夜',
      summary: '夜色压城',
      narration: ['第一段'],
      dialogue: [],
      entry_conditions: [],
      present_characters: [],
      candidate_choices: [
        {
          id: 'choice-1',
          label: '前往北门',
          intent_tag: 'inspect',
          state_effects: [],
          unlock_conditions: [],
          next_scene_id: 'scene-2'
        }
      ],
      fallback_next: null,
      allow_free_input: true,
      checkpoint: true,
      ending: null
    },
    session: {
      session_id: 'session-1',
      project_id: 'project-1',
      current_scene_id: 'scene-1',
      visited_scenes: ['scene-1'],
      known_facts: [],
      relationship_deltas: {},
      rule_flags: [],
      major_choices: [],
      available_checkpoints: [],
      free_input_history: [],
      ending_report: null,
      story_state: {
        current_scene_id: 'scene-1',
        character_states: [],
        fact_records: [],
        relationship_states: {},
        event_flags: [],
        possibility_flags: [],
        unlocked_rules: [],
        visited_scenes: ['scene-1'],
        checkpoints: []
      },
      lore_lifecycle: [],
      last_active_rules: []
    },
    active_lore: [],
    active_rules: [],
    story_state: {
      current_scene_id: 'scene-1',
      character_states: [],
      fact_records: [],
      relationship_states: {},
      event_flags: [],
      possibility_flags: [],
      unlocked_rules: [],
      visited_scenes: ['scene-1'],
      checkpoints: []
    },
    ...overrides
  };
}

function createStoryCodex(overrides: Partial<StoryCodex> = {}): StoryCodex {
  return {
    characters: [],
    locations: [],
    world_rules: [],
    relationships: [],
    timeline: [],
    recent_choices: [],
    worldbook_entries: [],
    rules: [],
    ...overrides
  };
}

function createRuntimeSnapshot(overrides: Partial<RuntimeSnapshot> = {}): RuntimeSnapshot {
  return {
    payload: createScenePayload(),
    codex: createStoryCodex(),
    ...overrides
  };
}

describe('+page build flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.settingsBackend.getAiSettings.mockResolvedValue(aiSettings);
    mocks.settingsBackend.saveAiSettings.mockResolvedValue(aiSettings);
    mocks.settingsBackend.clearProviderApiKey.mockResolvedValue(aiSettings);
    mocks.projectBackend.listProjects.mockResolvedValue([]);
    mocks.projectBackend.listSavedProjects.mockResolvedValue([]);
    mocks.runtimeBackend.findProjectSession.mockResolvedValue(null);

    mocks.reviewBackend.previewReviewSnapshot.mockResolvedValue({
      context: {
        sceneId: 'scene-1',
        eventKind: 'open_gate',
        inputText: '午夜去开门',
        actorCharacterId: null,
        targetCharacterId: null
      },
      lorePreview: [],
      rulePreview: {
        story_state: {
          current_scene_id: 'scene-1',
          character_states: [],
          fact_records: [],
          relationship_states: {},
          event_flags: [],
          possibility_flags: [],
          unlocked_rules: [],
          visited_scenes: ['scene-1'],
          checkpoints: []
        },
        active_rules: [],
        blocked: false
      } satisfies RuleEvaluationResult,
      projectedOutcome: {
        blocked: false,
        staysOnScene: true,
        nextSceneId: null,
        nextSceneTitle: null,
        nextSceneSummary: null,
        candidateChoices: []
      },
      explanations: {
        loreSummary: '没有新增 lore 命中',
        ruleSummary: '没有规则阻止当前动作',
        outcomeSummary: '当前上下文下不会推进到新场景'
      }
    });
    mocks.reviewBackend.saveReviewPreviewContext.mockResolvedValue({
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: null,
      targetCharacterId: null
    });
  });

  it('starts with an empty import form until the user explicitly loads the sample', async () => {
    render(Page);

    const projectNameInput = await screen.findByRole('textbox', { name: '项目名称' });
    const novelTextInput = screen.getByRole('textbox', { name: '小说正文' });
    const submitButton = screen.getByRole('button', { name: '开始解析与改编' });

    expect(projectNameInput).toHaveValue('');
    expect(novelTextInput).toHaveValue('');
    expect(submitButton).toBeDisabled();
    expect(screen.queryByDisplayValue(SAMPLE_PROJECT_NAME)).not.toBeInTheDocument();
  });

  it('shows imported build status immediately and then enters review with the real build result', async () => {
    const buildReady: BuildStatus = {
      stage: 'ready',
      message: 'Story package ready',
      progress: 100
    };
    const importedProject = createProjectSnapshot({
      build_status: {
        stage: 'imported',
        message: 'Novel imported',
        progress: 20
      }
    });
    const builtProject = createProjectSnapshot({
      build_status: buildReady,
      story_package: {
        story_bible: {
          title: '示例小说',
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {}
      }
    });
    const build = deferred<BuildStatus>();

    mocks.projectBackend.createProject.mockResolvedValue(createProjectSnapshot());
    mocks.projectBackend.importNovelText.mockResolvedValue(importedProject);
    mocks.projectBackend.buildStoryPackage.mockReturnValue(build.promise);
    mocks.projectBackend.getProject.mockResolvedValue(builtProject);

    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: '载入示例' }));
    await fireEvent.click(screen.getByRole('button', { name: '开始解析与改编' }));

    expect(await screen.findByText('文本已导入')).toBeInTheDocument();
    expect(screen.getByText('20% · Novel imported')).toBeInTheDocument();

    build.resolve(buildReady);

    await waitFor(() => {
      expect(screen.getByTestId('review-stage-shell')).toBeInTheDocument();
    });
    expect(mocks.projectBackend.getProject).toHaveBeenCalledWith('project-1');
  });

  it('reuses an identical saved project instead of creating a duplicate one', async () => {
    const builtProject = createProjectSnapshot({
      id: 'project-existing',
      name: SAMPLE_PROJECT_NAME,
      raw_text: SAMPLE_NOVEL,
      build_status: {
        stage: 'ready',
        message: 'Story package ready',
        progress: 100
      },
      story_package: {
        story_bible: {
          title: SAMPLE_PROJECT_NAME,
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {}
      }
    });

    mocks.projectBackend.listSavedProjects.mockResolvedValue([
      {
        project: builtProject,
        session_id: null,
        current_scene_title: null,
        ending_type: null,
        last_activity_at: Date.now(),
        last_activity_kind: 'project'
      }
    ]);

    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: '载入示例' }));
    await fireEvent.click(screen.getByRole('button', { name: '开始解析与改编' }));

    await screen.findByTestId('review-stage-shell');

    expect(mocks.projectBackend.createProject).not.toHaveBeenCalled();
    expect(mocks.projectBackend.importNovelText).not.toHaveBeenCalled();
    expect(mocks.projectBackend.buildStoryPackage).not.toHaveBeenCalled();
    expect(mocks.projectBackend.getProject).not.toHaveBeenCalled();
    expect(screen.getByText(SAMPLE_PROJECT_NAME)).toBeInTheDocument();
  });

  it('keeps the build screen visible when the real build request fails', async () => {
    const importedProject = createProjectSnapshot({
      build_status: {
        stage: 'imported',
        message: 'Novel imported',
        progress: 20
      }
    });

    mocks.projectBackend.createProject.mockResolvedValue(createProjectSnapshot());
    mocks.projectBackend.importNovelText.mockResolvedValue(importedProject);
    mocks.projectBackend.buildStoryPackage.mockRejectedValue(
      new CommandClientError({
        code: 'provider_error',
        message: 'provider unavailable'
      })
    );

    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: '载入示例' }));
    await fireEvent.click(screen.getByRole('button', { name: '开始解析与改编' }));

    expect(await screen.findByText('生成中断')).toBeInTheDocument();
    expect(screen.getByText('生成失败')).toBeInTheDocument();
    expect(screen.queryByTestId('review-stage-shell')).not.toBeInTheDocument();
  });

  it('enters review with aggregated preview owned by the review workspace', async () => {
    const buildReady: BuildStatus = {
      stage: 'ready',
      message: 'Story package ready',
      progress: 100
    };
    const importedProject = createProjectSnapshot({
      build_status: {
        stage: 'imported',
        message: 'Novel imported',
        progress: 20
      }
    });
    const builtProject = createProjectSnapshot({
      build_status: buildReady,
      story_package: {
        story_bible: {
          title: '示例小说',
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {}
      }
    });

    mocks.projectBackend.createProject.mockResolvedValue(createProjectSnapshot());
    mocks.projectBackend.importNovelText.mockResolvedValue(importedProject);
    mocks.projectBackend.buildStoryPackage.mockResolvedValue(buildReady);
    mocks.projectBackend.getProject.mockResolvedValue(builtProject);
    mocks.reviewBackend.updateCharacterCard.mockResolvedValue(builtProject.character_cards);

    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: '载入示例' }));
    await fireEvent.click(screen.getByRole('button', { name: '开始解析与改编' }));

    await waitFor(() => {
      expect(screen.getByTestId('review-stage-shell')).toBeInTheDocument();
    });

    expect(mocks.reviewBackend.previewReviewSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.reviewBackend.saveReviewPreviewContext).toHaveBeenCalledTimes(1);
    expect(screen.getByText('预览已就绪')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '刷新预览' }));

    expect(mocks.reviewBackend.previewReviewSnapshot).toHaveBeenCalledTimes(2);
    expect(mocks.reviewBackend.saveReviewPreviewContext).toHaveBeenCalledTimes(2);
  });

  it('hydrates reader state from a unified runtime snapshot when entering the story', async () => {
    const buildReady: BuildStatus = {
      stage: 'ready',
      message: 'Story package ready',
      progress: 100
    };
    const importedProject = createProjectSnapshot({
      build_status: {
        stage: 'imported',
        message: 'Novel imported',
        progress: 20
      }
    });
    const builtProject = createProjectSnapshot({
      build_status: buildReady,
      story_package: {
        story_bible: {
          title: '示例小说',
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {}
      }
    });

    mocks.projectBackend.createProject.mockResolvedValue(createProjectSnapshot());
    mocks.projectBackend.importNovelText.mockResolvedValue(importedProject);
    mocks.projectBackend.buildStoryPackage.mockResolvedValue(buildReady);
    mocks.projectBackend.getProject.mockResolvedValue(builtProject);
    mocks.runtimeBackend.startSession.mockResolvedValue({
      session_id: 'session-1',
      project_id: 'project-1'
    });
    mocks.runtimeBackend.getRuntimeSnapshot.mockResolvedValue(createRuntimeSnapshot());

    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: '载入示例' }));
    await fireEvent.click(screen.getByRole('button', { name: '开始解析与改编' }));
    await screen.findByTestId('review-stage-shell');

    await fireEvent.click(screen.getByRole('button', { name: '进入互动故事' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '北门之夜', level: 1 })).toBeInTheDocument();
    });
    expect(screen.getAllByText('示例小说').length).toBeGreaterThan(0);
    const readerStage = document.querySelector('.reader-stage');
    expect(readerStage).not.toBeNull();
    expect(readerStage).toHaveAttribute('data-flow', 'longform');
    expect(document.querySelector('.workspace-topbar')).toBeNull();
    expect(document.querySelector('.reader-body')).toHaveAttribute('data-reader-region', 'story-scroll');
    expect(document.querySelector('.reader-body')).toHaveAttribute('data-safe-area', 'bottom-dock');
    expect(document.querySelector('.reader-dock-shell')).toHaveAttribute('data-layout', 'fixed-bottom');
    expect(screen.getByRole('button', { name: '自动播放' })).toBeInTheDocument();
    expect(mocks.runtimeBackend.startSession).toHaveBeenCalledWith('project-1');
    expect(mocks.runtimeBackend.getRuntimeSnapshot).toHaveBeenCalledWith('session-1');
    expect(screen.queryByTestId('review-stage-shell')).not.toBeInTheDocument();
  });

  it('returns to review and resumes the active session without starting a new one', async () => {
    const buildReady: BuildStatus = {
      stage: 'ready',
      message: 'Story package ready',
      progress: 100
    };
    const importedProject = createProjectSnapshot({
      build_status: {
        stage: 'imported',
        message: 'Novel imported',
        progress: 20
      }
    });
    const builtProject = createProjectSnapshot({
      build_status: buildReady,
      story_package: {
        story_bible: {
          title: '示例小说',
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {}
      }
    });

    mocks.projectBackend.createProject.mockResolvedValue(createProjectSnapshot());
    mocks.projectBackend.importNovelText.mockResolvedValue(importedProject);
    mocks.projectBackend.buildStoryPackage.mockResolvedValue(buildReady);
    mocks.projectBackend.getProject.mockResolvedValue(builtProject);
    mocks.runtimeBackend.startSession.mockResolvedValue({
      session_id: 'session-1',
      project_id: 'project-1'
    });
    mocks.runtimeBackend.getRuntimeSnapshot.mockResolvedValue(createRuntimeSnapshot());

    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: '载入示例' }));
    await fireEvent.click(screen.getByRole('button', { name: '开始解析与改编' }));
    await screen.findByTestId('review-stage-shell');

    await fireEvent.click(screen.getByRole('button', { name: '进入互动故事' }));
    await screen.findByRole('heading', { name: '北门之夜', level: 1 });

    await fireEvent.click(screen.getByRole('button', { name: '返回审阅台' }));
    await screen.findByTestId('review-stage-shell');
    expect(screen.getByRole('button', { name: '继续互动故事' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '继续互动故事' }));
    await screen.findByRole('heading', { name: '北门之夜', level: 1 });

    expect(mocks.runtimeBackend.startSession).toHaveBeenCalledTimes(1);
    expect(mocks.runtimeBackend.getRuntimeSnapshot).toHaveBeenCalledTimes(2);
  });

  it('resumes an existing persisted session from review without starting a new one', async () => {
    const buildReady: BuildStatus = {
      stage: 'ready',
      message: 'Story package ready',
      progress: 100
    };
    const importedProject = createProjectSnapshot({
      build_status: {
        stage: 'imported',
        message: 'Novel imported',
        progress: 20
      }
    });
    const builtProject = createProjectSnapshot({
      build_status: buildReady,
      story_package: {
        story_bible: {
          title: '示例小说',
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {}
      }
    });

    mocks.projectBackend.createProject.mockResolvedValue(createProjectSnapshot());
    mocks.projectBackend.importNovelText.mockResolvedValue(importedProject);
    mocks.projectBackend.buildStoryPackage.mockResolvedValue(buildReady);
    mocks.projectBackend.getProject.mockResolvedValue(builtProject);
    mocks.runtimeBackend.findProjectSession.mockResolvedValue({
      session_id: 'session-resume',
      project_id: 'project-1'
    });
    mocks.runtimeBackend.getRuntimeSnapshot.mockResolvedValue(createRuntimeSnapshot());

    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: '载入示例' }));
    await fireEvent.click(screen.getByRole('button', { name: '开始解析与改编' }));
    await screen.findByTestId('review-stage-shell');

    expect(screen.getByRole('button', { name: '继续互动故事' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '继续互动故事' }));

    await screen.findByRole('heading', { name: '北门之夜', level: 1 });
    expect(mocks.runtimeBackend.startSession).not.toHaveBeenCalled();
    expect(mocks.runtimeBackend.findProjectSession).toHaveBeenCalledWith('project-1');
    expect(mocks.runtimeBackend.getRuntimeSnapshot).toHaveBeenCalledWith('session-resume');
  });

  it('does not label a finished session as resumable in the review shell', async () => {
    const buildReady: BuildStatus = {
      stage: 'ready',
      message: 'Story package ready',
      progress: 100
    };
    const importedProject = createProjectSnapshot({
      build_status: {
        stage: 'imported',
        message: 'Novel imported',
        progress: 20
      }
    });
    const builtProject = createProjectSnapshot({
      build_status: buildReady,
      story_package: {
        story_bible: {
          title: '示例小说',
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {}
      }
    });

    mocks.projectBackend.createProject.mockResolvedValue(createProjectSnapshot());
    mocks.projectBackend.importNovelText.mockResolvedValue(importedProject);
    mocks.projectBackend.buildStoryPackage.mockResolvedValue(buildReady);
    mocks.projectBackend.getProject.mockResolvedValue(builtProject);
    mocks.runtimeBackend.findProjectSession.mockResolvedValue({
      session_id: 'session-finished',
      project_id: 'project-1',
      status: 'finished'
    });

    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: '载入示例' }));
    await fireEvent.click(screen.getByRole('button', { name: '开始解析与改编' }));
    await screen.findByTestId('review-stage-shell');

    expect(screen.getByRole('button', { name: '进入互动故事' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '继续互动故事' })).not.toBeInTheDocument();
  });

  it('opens a persisted ready project from the import screen and enters review', async () => {
    const builtProject = createProjectSnapshot({
      build_status: {
        stage: 'ready',
        message: 'Story package ready',
        progress: 100
      },
      story_package: {
        story_bible: {
          title: '示例小说',
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {}
      }
    });

    mocks.projectBackend.listSavedProjects.mockResolvedValue([
      {
        project: builtProject,
        session_id: null,
        current_scene_title: null,
        ending_type: null,
        last_activity_at: Date.now(),
        last_activity_kind: 'project'
      }
    ]);

    render(Page);

    await screen.findByText('继续已有项目');
    await fireEvent.click(screen.getByRole('button', { name: '进入审阅示例小说' }));

    await screen.findByTestId('review-stage-shell');
    expect(screen.getByText('示例小说')).toBeInTheDocument();
    expect(mocks.projectBackend.listSavedProjects).toHaveBeenCalledTimes(1);
    expect(mocks.runtimeBackend.findProjectSession).not.toHaveBeenCalled();
  });

  it('opens a persisted project with a saved session directly into the reader', async () => {
    const builtProject = createProjectSnapshot({
      build_status: {
        stage: 'ready',
        message: 'Story package ready',
        progress: 100
      },
      story_package: {
        story_bible: {
          title: '示例小说',
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {}
      }
    });

    mocks.projectBackend.listSavedProjects.mockResolvedValue([
      {
        project: builtProject,
        session_id: 'session-resume',
        current_scene_title: '北门之夜',
        ending_type: null,
        last_activity_at: Date.now(),
        last_activity_kind: 'session'
      }
    ]);
    mocks.runtimeBackend.getRuntimeSnapshot.mockResolvedValue(createRuntimeSnapshot());

    render(Page);

    await screen.findByText('继续已有项目');
    await fireEvent.click(screen.getByRole('button', { name: '继续互动示例小说' }));

    await screen.findByRole('heading', { name: '北门之夜', level: 1 });
    expect(mocks.runtimeBackend.startSession).not.toHaveBeenCalled();
    expect(mocks.runtimeBackend.findProjectSession).not.toHaveBeenCalled();
    expect(mocks.runtimeBackend.getRuntimeSnapshot).toHaveBeenCalledWith('session-resume');
  });

  it('opens a persisted finished project and lands on the ending screen', async () => {
    const builtProject = createProjectSnapshot({
      build_status: {
        stage: 'ready',
        message: 'Story package ready',
        progress: 100
      },
      story_package: {
        story_bible: {
          title: '示例小说',
          characters: [],
          locations: [],
          timeline: [],
          world_rules: [],
          relationships: [],
          core_conflicts: []
        },
        world_model: {
          character_cards: [],
          worldbook_entries: [],
          rules: []
        },
        start_scene_id: 'scene-1',
        scenes: {
          'scene-9': {
            id: 'scene-9',
            chapter: 9,
            title: '归潮时刻',
            summary: '结局场景',
            narration: [],
            dialogue: [],
            entry_conditions: [],
            present_characters: [],
            candidate_choices: [],
            fallback_next: null,
            allow_free_input: false,
            checkpoint: false,
            ending: null
          }
        }
      }
    });

    mocks.projectBackend.listSavedProjects.mockResolvedValue([
      {
        project: builtProject,
        session_id: 'session-ending',
        current_scene_title: '归潮时刻',
        ending_type: '灰烬归档',
        last_activity_at: Date.now(),
        last_activity_kind: 'ending'
      }
    ]);
    mocks.runtimeBackend.getRuntimeSnapshot.mockResolvedValue(
      createRuntimeSnapshot({
        payload: createScenePayload({
          scene: {
            id: 'scene-9',
            chapter: 9,
            title: '归潮时刻',
            summary: '结局场景',
            narration: [],
            dialogue: [],
            entry_conditions: [],
            present_characters: [],
            candidate_choices: [],
            fallback_next: null,
            allow_free_input: false,
            checkpoint: false,
            ending: null
          },
          session: {
            session_id: 'session-ending',
            project_id: builtProject.id,
            current_scene_id: 'scene-9',
            visited_scenes: ['scene-1', 'scene-9'],
            known_facts: [],
            relationship_deltas: {},
            rule_flags: [],
            major_choices: [],
            available_checkpoints: [],
            free_input_history: [],
            ending_report: {
              ending_type: '灰烬归档',
              summary: '一切在火焰后归于沉寂。',
              decisive_turns: ['雨夜的迟疑'],
              unresolved_threads: ['北门的真相']
            },
            story_state: {
              current_scene_id: 'scene-9',
              character_states: [],
              fact_records: [],
              relationship_states: {},
              event_flags: [],
              possibility_flags: [],
              unlocked_rules: [],
              visited_scenes: ['scene-1', 'scene-9'],
              checkpoints: []
            },
            lore_lifecycle: [],
            last_active_rules: []
          }
        })
      })
    );

    render(Page);

    await screen.findByText('继续已有项目');
    await fireEvent.click(screen.getByRole('button', { name: '查看结局示例小说' }));

    await screen.findByRole('heading', { name: '灰烬归档' });
    expect(mocks.runtimeBackend.startSession).not.toHaveBeenCalled();
    expect(mocks.runtimeBackend.findProjectSession).not.toHaveBeenCalled();
    expect(mocks.runtimeBackend.getRuntimeSnapshot).toHaveBeenCalledWith('session-ending');
  });
});
