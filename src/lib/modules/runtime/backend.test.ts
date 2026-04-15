import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeCommand = vi.fn();

vi.mock('$lib/backend/commandClient', () => ({
  invokeCommand
}));

describe('runtime backend', () => {
  beforeEach(() => {
    invokeCommand.mockReset();
  });

  it('requests a unified runtime snapshot through the shared command client', async () => {
    const { getRuntimeSnapshot } = await import('./backend');

    invokeCommand.mockResolvedValueOnce({
      payload: { scene: { id: 'scene-1' } },
      codex: { recent_choices: [] }
    });

    await getRuntimeSnapshot('session-1');

    expect(invokeCommand).toHaveBeenCalledWith('get_runtime_snapshot', {
      sessionId: 'session-1'
    });
  });

  it('submits free input through the shared command client', async () => {
    const { submitFreeInput } = await import('./backend');

    invokeCommand.mockResolvedValueOnce({ scene: { id: 'scene-2' } });

    await submitFreeInput('session-1', '我先稳住对方');

    expect(invokeCommand).toHaveBeenCalledWith('submit_free_input', {
      sessionId: 'session-1',
      text: '我先稳住对方'
    });
  });

  it('looks up a resumable session for the current project through the shared command client', async () => {
    const { findProjectSession } = await import('./backend');

    invokeCommand.mockResolvedValueOnce({
      session_id: 'session-1',
      project_id: 'project-1'
    });

    await findProjectSession('project-1');

    expect(invokeCommand).toHaveBeenCalledWith('find_project_session', {
      projectId: 'project-1'
    });
  });

  it('finishes an ended session through the shared command client', async () => {
    const { finishSession } = await import('./backend');

    invokeCommand.mockResolvedValueOnce({
      ending_type: '守门者结局'
    });

    await finishSession('session-1');

    expect(invokeCommand).toHaveBeenCalledWith('finish_session', {
      sessionId: 'session-1'
    });
  });
});
