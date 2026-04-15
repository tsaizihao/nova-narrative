import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeCommand = vi.fn();

vi.mock('$lib/backend/commandClient', () => ({
  invokeCommand
}));

describe('settings backend', () => {
  beforeEach(() => {
    invokeCommand.mockReset();
  });

  it('saves AI settings through the shared command client', async () => {
    const { saveAiSettings } = await import('./backend');

    invokeCommand.mockResolvedValueOnce({ ok: true });

    await saveAiSettings({
      selected_provider: 'heuristic',
      openai_compatible: {
        base_url: '',
        model: '',
        api_key: ''
      },
      openrouter: {
        base_url: 'https://openrouter.ai/api/v1',
        model: '',
        api_key: ''
      }
    });

    expect(invokeCommand).toHaveBeenCalledWith('save_ai_settings', {
      input: expect.objectContaining({
        selected_provider: 'heuristic'
      })
    });
  });
});
