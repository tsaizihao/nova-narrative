import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeCommand = vi.fn();

vi.mock('$lib/backend/commandClient', () => ({
  invokeCommand
}));

describe('projects backend', () => {
  beforeEach(() => {
    invokeCommand.mockReset();
  });

  it('creates projects through the shared command client', async () => {
    const { createProject } = await import('./backend');

    invokeCommand.mockResolvedValueOnce({ id: 'project-1' });

    await createProject('北门夜话');

    expect(invokeCommand).toHaveBeenCalledWith('create_project', {
      name: '北门夜话'
    });
  });

  it('loads the persisted project library through the shared command client', async () => {
    const { listProjects } = await import('./backend');

    invokeCommand.mockResolvedValueOnce([{ id: 'project-1' }]);

    await listProjects();

    expect(invokeCommand).toHaveBeenCalledWith('list_projects', {});
  });

  it('loads saved project summaries through the shared command client', async () => {
    const { listSavedProjects } = await import('./backend');

    invokeCommand.mockResolvedValueOnce([{ project: { id: 'project-1' } }]);

    await listSavedProjects();

    expect(invokeCommand).toHaveBeenCalledWith('list_saved_projects', {});
  });
});
