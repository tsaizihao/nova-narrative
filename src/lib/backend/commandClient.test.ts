import { describe, expect, it, vi } from 'vitest';

import {
  CommandClientError,
  type CommandClientOptions,
  createCommandClient,
  normalizeCommandError
} from './commandClient';

describe('normalizeCommandError', () => {
  it('extracts code and message from structured command payloads', () => {
    const error = normalizeCommandError({
      code: 'validation_error',
      message: '项目 ID 不能为空'
    });

    expect(error).toBeInstanceOf(CommandClientError);
    expect(error.code).toBe('validation_error');
    expect(error.message).toBe('项目 ID 不能为空');
  });

  it('falls back to native Error messages', () => {
    const error = normalizeCommandError(new Error('network exploded'));

    expect(error.code).toBeUndefined();
    expect(error.message).toBe('network exploded');
  });
});

describe('createCommandClient', () => {
  it('routes commands through the mock handler outside tauri', async () => {
    const mockHandler = vi.fn(async (command: string, payload?: Record<string, unknown>) => ({
      command,
      payload
    })) as unknown as CommandClientOptions['mockHandler'];
    const invokeImpl = vi.fn() as unknown as CommandClientOptions['invokeImpl'];
    const client = createCommandClient({
      invokeImpl,
      mockHandler,
      isTauri: () => false
    });

    const result = await client.invokeCommand<{ command: string; payload?: Record<string, unknown> }>(
      'create_project',
      { name: '北门夜话' }
    );

    expect(mockHandler).toHaveBeenCalledWith('create_project', { name: '北门夜话' });
    expect(invokeImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      command: 'create_project',
      payload: { name: '北门夜话' }
    });
  });

  it('normalizes invoke errors inside tauri', async () => {
    const client = createCommandClient({
      invokeImpl: vi.fn(async () => {
        throw {
          code: 'not_found',
          message: 'missing session'
        };
      }) as unknown as CommandClientOptions['invokeImpl'],
      mockHandler: vi.fn() as unknown as CommandClientOptions['mockHandler'],
      isTauri: () => true
    });

    await expect(client.invokeCommand('get_current_scene', { sessionId: 'missing' })).rejects.toMatchObject({
      code: 'not_found',
      message: 'missing session'
    });
  });
});
