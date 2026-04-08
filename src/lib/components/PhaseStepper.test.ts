import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import PhaseStepper from './PhaseStepper.svelte';

describe('PhaseStepper', () => {
  it('marks the active stage and keeps later stages pending', () => {
    render(PhaseStepper, {
      props: {
        phase: 'review',
        labels: ['导入', '构建', '审阅', '游玩']
      }
    });

    expect(screen.getByRole('list')).toHaveTextContent('审阅');
    expect(screen.getByText('审阅').closest('li')).toHaveAttribute('data-state', 'current');
    expect(screen.getByText('游玩').closest('li')).toHaveAttribute('data-state', 'upcoming');
  });
});
