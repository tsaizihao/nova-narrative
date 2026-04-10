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
