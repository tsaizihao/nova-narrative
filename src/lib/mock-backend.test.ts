import { describe, expect, it } from 'vitest';

import { mockBackend } from './mock-backend';

describe('mockBackend AI settings', () => {
  it('persists AI settings snapshots without echoing API keys', async () => {
    const initial = await mockBackend.get_ai_settings();
    expect(initial.selected_provider).toBe('heuristic');
    expect(initial.openai_compatible.has_api_key).toBe(false);

    const saved = await mockBackend.save_ai_settings({
      selected_provider: 'openai_compatible',
      openai_compatible: {
        base_url: 'https://example.com/v1/',
        model: 'gpt-4o-mini',
        api_key: 'sk-openai-test'
      },
      openrouter: {
        base_url: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o-mini'
      }
    });

    expect(saved.selected_provider).toBe('openai_compatible');
    expect(saved.openai_compatible.base_url).toBe('https://example.com/v1');
    expect(saved.openai_compatible.model).toBe('gpt-4o-mini');
    expect(saved.openai_compatible.has_api_key).toBe(true);
  });

  it('clears a provider key without resetting the saved base URL or model', async () => {
    await mockBackend.save_ai_settings({
      selected_provider: 'openrouter',
      openai_compatible: {
        base_url: '',
        model: ''
      },
      openrouter: {
        base_url: 'https://openrouter.ai/api/v1/',
        model: 'openai/gpt-4o-mini',
        api_key: 'sk-openrouter-test'
      }
    });

    const cleared = await mockBackend.clear_provider_api_key('openrouter');
    expect(cleared.selected_provider).toBe('openrouter');
    expect(cleared.openrouter.base_url).toBe('https://openrouter.ai/api/v1');
    expect(cleared.openrouter.model).toBe('openai/gpt-4o-mini');
    expect(cleared.openrouter.has_api_key).toBe(false);
  });
});

describe('mockBackend import/build flow', () => {
  it('builds adaptation kernel snapshots for the project and package', async () => {
    await mockBackend.save_ai_settings({
      selected_provider: 'heuristic',
      openai_compatible: {
        base_url: '',
        model: ''
      },
      openrouter: {
        base_url: 'https://openrouter.ai/api/v1',
        model: ''
      }
    });

    const project = await mockBackend.create_project('临川夜话');
    await mockBackend.import_novel_text(
      project.id,
      ['第1章 雨夜', '', '沈砚听见了钟声。'].join('\n')
    );
    await mockBackend.build_story_package(project.id);

    const builtProject = await mockBackend.get_project(project.id);
    expect(builtProject.adaptation_kernel?.source_novel.title).toBe('临川夜话');
    expect(builtProject.adaptation_kernel?.canon_characters.length).toBeGreaterThan(0);

    const storyPackage = await mockBackend.load_story_package(project.id);
    expect(storyPackage.adaptation_kernel?.source_novel.chapter_count).toBe(
      builtProject.chapters.length
    );
    expect(storyPackage.adaptation_kernel?.canon_characters[0]?.name).toBe(
      builtProject.character_cards[0]?.name
    );
  });

  it('rejects whitespace-only imports without mutating the current project snapshot', async () => {
    const project = await mockBackend.create_project('临川夜话');
    const imported = await mockBackend.import_novel_text(
      project.id,
      ['第1章 雨夜', '', '沈砚听见了钟声。'].join('\n')
    );

    await expect(mockBackend.import_novel_text(project.id, '   \n\t  ')).rejects.toThrow();

    const current = await mockBackend.get_project(project.id);
    expect(current.raw_text).toBe(imported.raw_text);
    expect(current.chapters).toHaveLength(imported.chapters.length);
    expect(current.build_status.stage).toBe('imported');
  });

  it('re-import clears derived artifacts and invalidates existing sessions', async () => {
    await mockBackend.save_ai_settings({
      selected_provider: 'heuristic',
      openai_compatible: {
        base_url: '',
        model: ''
      },
      openrouter: {
        base_url: 'https://openrouter.ai/api/v1',
        model: ''
      }
    });

    const project = await mockBackend.create_project('临川夜话');
    await mockBackend.import_novel_text(
      project.id,
      ['第1章 雨夜', '', '沈砚听见了钟声。'].join('\n')
    );
    await mockBackend.build_story_package(project.id);

    const session = await mockBackend.start_session(project.id);
    const reimported = await mockBackend.import_novel_text(
      project.id,
      ['第1章 新夜', '', '另一段故事开始了。'].join('\n')
    );

    expect(reimported.story_package).toBeNull();
    expect(reimported.adaptation_kernel).toBeNull();
    expect(reimported.character_cards).toHaveLength(0);
    expect(reimported.worldbook_entries).toHaveLength(0);
    expect(reimported.rules).toHaveLength(0);
    expect(reimported.build_status.stage).toBe('imported');

    await expect(mockBackend.get_current_scene(session.session_id)).rejects.toThrow();
  });

  it('persists failed build status when external provider configuration is incomplete', async () => {
    const project = await mockBackend.create_project('临川夜话');
    await mockBackend.import_novel_text(
      project.id,
      ['第1章 雨夜', '', '沈砚听见了钟声。'].join('\n')
    );
    await mockBackend.save_ai_settings({
      selected_provider: 'openai_compatible',
      openai_compatible: {
        base_url: 'https://example.com/v1',
        model: '',
        api_key: ''
      },
      openrouter: {
        base_url: 'https://openrouter.ai/api/v1',
        model: ''
      }
    });

    await expect(mockBackend.build_story_package(project.id)).rejects.toThrow();

    const failed = await mockBackend.get_build_status(project.id);
    expect(failed.stage).toBe('failed');
    expect(failed.error).toBeTruthy();
  });

  it('returns a runtime snapshot whose codex and payload come from the same session state', async () => {
    await mockBackend.save_ai_settings({
      selected_provider: 'heuristic',
      openai_compatible: {
        base_url: '',
        model: ''
      },
      openrouter: {
        base_url: 'https://openrouter.ai/api/v1',
        model: ''
      }
    });

    const project = await mockBackend.create_project('临川夜话');
    await mockBackend.import_novel_text(
      project.id,
      ['第1章 雨夜', '', '沈砚听见了钟声。'].join('\n')
    );
    await mockBackend.build_story_package(project.id);

    const session = await mockBackend.start_session(project.id);
    const current = await mockBackend.get_current_scene(session.session_id);
    await mockBackend.submit_choice(session.session_id, current.scene.candidate_choices[0].id);

    const snapshot = await mockBackend.get_runtime_snapshot(session.session_id);

    expect(snapshot.payload.session.session_id).toBe(session.session_id);
    expect(snapshot.payload.session.major_choices).toEqual(snapshot.codex.recent_choices);
    expect(snapshot.payload.story_state.current_scene_id).toBe(
      snapshot.payload.session.current_scene_id
    );
  });

  it('round-trips aggregated review preview context without persisting snapshots', async () => {
    await mockBackend.save_ai_settings({
      selected_provider: 'heuristic',
      openai_compatible: {
        base_url: '',
        model: ''
      },
      openrouter: {
        base_url: 'https://openrouter.ai/api/v1',
        model: ''
      }
    });

    const project = await mockBackend.create_project('临川夜话');
    await mockBackend.import_novel_text(
      project.id,
      ['第1章 雨夜', '', '沈砚在午夜来到北门。'].join('\n')
    );
    await mockBackend.build_story_package(project.id);

    const context = {
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: 'character-1',
      targetCharacterId: 'character-2'
    };

    const preview = await mockBackend.preview_review_snapshot(project.id, context);
    const saved = await mockBackend.save_review_preview_context(project.id, preview.context);
    const reloaded = await mockBackend.get_project(project.id);

    expect(preview.context.sceneId).toBe('scene-1');
    expect(preview.explanations.outcomeSummary).toBeTruthy();
    expect(saved).toEqual(context);
    expect(reloaded.review_preview_context).toEqual(context);
  });
});
