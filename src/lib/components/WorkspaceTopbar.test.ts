import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import WorkspaceTopbar from './WorkspaceTopbar.svelte';

describe('WorkspaceTopbar', () => {
  it('shows the phase stepper for authoring phases', () => {
    render(WorkspaceTopbar, {
      props: {
        eyebrow: '叙世者',
        title: '小说改编工作台',
        metaLabel: '临川夜话',
        phase: 'import',
        labels: ['导入', '构建', '审阅', '游玩'],
        showStepper: true
      }
    });

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('导入')).toBeInTheDocument();
  });

  it('keeps reader chrome focused by hiding the workflow stepper', () => {
    render(WorkspaceTopbar, {
      props: {
        eyebrow: 'reader',
        title: '互动游玩',
        metaLabel: '临川夜话',
        phase: 'reader',
        labels: ['导入', '构建', '审阅', '游玩'],
        showStepper: false
      }
    });

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('导入')).not.toBeInTheDocument();
    expect(screen.getByText('临川夜话')).toBeInTheDocument();
  });

  it('shows a settings action for workspace phases and emits openSettings when clicked', async () => {
    const openSettings = vi.fn();

    render(WorkspaceTopbar, {
      props: {
        eyebrow: '叙世者',
        title: '小说改编工作台',
        metaLabel: '临川夜话',
        phase: 'import',
        labels: ['导入', '构建', '审阅', '游玩'],
        showStepper: true,
        showSettingsAction: true,
        settingsActive: false
      },
      events: {
        openSettings
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: '设置' }));

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('marks the settings action as active on the settings page', () => {
    render(WorkspaceTopbar, {
      props: {
        eyebrow: '叙世者',
        title: 'AI 设置',
        metaLabel: '全局配置',
        phase: 'import',
        labels: ['导入', '构建', '审阅', '游玩'],
        showStepper: false,
        showSettingsAction: true,
        settingsActive: true
      }
    });

    expect(screen.getByRole('button', { name: '设置' })).toHaveAttribute('aria-pressed', 'true');
  });
});
