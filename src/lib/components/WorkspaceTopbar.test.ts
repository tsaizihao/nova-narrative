import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

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
});
