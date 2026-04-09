import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(async ({ mode }) => {
  const plugins = [...(await sveltekit())];

  // Keep the regular dev server independent from Vitest-only helpers.
  if (mode === 'test') {
    const { svelteTesting } = await import('@testing-library/svelte/vite');
    plugins.push(svelteTesting());
  }

  return {
    plugins,
    test: {
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{ts,js}'],
      setupFiles: ['src/test/setup.ts']
    }
  };
});
