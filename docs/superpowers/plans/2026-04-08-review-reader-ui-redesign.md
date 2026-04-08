# Review + Reader UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the app shell so `import/build/review` behave like a simple authoring workspace while `reader` becomes a story-first stage with distinct desktop and mobile layouts.

**Architecture:** Keep the existing SvelteKit single-page flow and current Tauri API contract, but introduce a small UI-layout layer that decides which shell to render and move phase-specific layout concerns into focused components. `review` becomes a segmented workspace with one primary editing surface and one preview rail; `reader` becomes two shells that consume the same `ScenePayload`, one with lightweight desktop side rails and one with mobile drawers.

**Tech Stack:** Svelte 5, SvelteKit, Vitest, @testing-library/svelte, jsdom, TypeScript, pnpm

---

## File structure

### Shared UI shell
- Create: `src/lib/ui-layout.ts`
- Create: `src/lib/ui-layout.test.ts`
- Create: `src/lib/components/PhaseStepper.svelte`
- Create: `src/lib/components/PhaseStepper.test.ts`
- Create: `src/test/setup.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`

### Workspace phases
- Create: `src/lib/components/ReviewWorkspace.svelte`
- Create: `src/lib/components/ReviewPreviewPanel.svelte`
- Create: `src/lib/components/ReviewWorkspace.test.ts`
- Modify: `src/lib/components/ImportScreen.svelte`
- Modify: `src/lib/components/BuildProgressScreen.svelte`
- Modify: `src/lib/components/CharacterReviewPanel.svelte`
- Modify: `src/lib/components/WorldBookPanel.svelte`
- Modify: `src/lib/components/RuleBookPanel.svelte`
- Modify: `src/routes/+page.svelte`

### Reader shells
- Create: `src/lib/components/ReaderDesktopShell.svelte`
- Create: `src/lib/components/ReaderMobileShell.svelte`
- Create: `src/lib/components/ReaderOverlayDrawer.svelte`
- Create: `src/lib/components/ReaderShell.test.ts`
- Modify: `src/lib/components/ReaderStage.svelte`
- Modify: `src/lib/components/StoryCodexPanel.svelte`
- Modify: `src/lib/components/StoryStatePanel.svelte`
- Modify: `src/routes/+page.svelte`

### Task 1: Add a UI layout layer and component-test harness

**Files:**
- Create: `src/test/setup.ts`
- Create: `src/lib/ui-layout.ts`
- Create: `src/lib/ui-layout.test.ts`
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Add component test dependencies and jsdom setup**

Update `package.json` dev dependencies and test script support:

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/svelte": "^5.2.8",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1"
  }
}
```

Update `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,js}'],
    setupFiles: ['src/test/setup.ts']
  }
});
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write the failing layout tests**

Create `src/lib/ui-layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { REVIEW_SECTIONS, resolveReaderLayoutMode } from './ui-layout';

describe('resolveReaderLayoutMode', () => {
  it('returns mobile for narrow widths', () => {
    expect(resolveReaderLayoutMode(767)).toBe('mobile');
  });

  it('returns desktop for wider widths', () => {
    expect(resolveReaderLayoutMode(1024)).toBe('desktop');
  });
});

describe('REVIEW_SECTIONS', () => {
  it('keeps the authoring tabs in the intended order', () => {
    expect(REVIEW_SECTIONS.map((section) => section.id)).toEqual([
      'characters',
      'worldbook',
      'rules'
    ]);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run:

```bash
pnpm test -- ui-layout
```

Expected: FAIL because `src/lib/ui-layout.ts` does not exist yet.

- [ ] **Step 4: Implement the shared layout module**

Create `src/lib/ui-layout.ts`:

```ts
export type ReaderLayoutMode = 'desktop' | 'mobile';
export type ReviewSectionId = 'characters' | 'worldbook' | 'rules';
export const READER_MOBILE_BREAKPOINT = 768;

export const REVIEW_SECTIONS = [
  { id: 'characters', label: '角色', eyebrow: 'Characters' },
  { id: 'worldbook', label: '世界书', eyebrow: 'Worldbook' },
  { id: 'rules', label: '规则', eyebrow: 'Rules' }
] as const satisfies ReadonlyArray<{
  id: ReviewSectionId;
  label: string;
  eyebrow: string;
}>;

export function resolveReaderLayoutMode(width: number): ReaderLayoutMode {
  return width < READER_MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
}
```

- [ ] **Step 5: Re-run the layout tests and verify they pass**

Run:

```bash
pnpm test -- ui-layout
```

Expected: PASS with two `resolveReaderLayoutMode` assertions and one `REVIEW_SECTIONS` assertion.

- [ ] **Step 6: Commit the harness and layout helper**

```bash
git add package.json vite.config.ts src/test/setup.ts src/lib/ui-layout.ts src/lib/ui-layout.test.ts
git commit -m "test: add ui layout harness"
```

---

### Task 2: Rebuild import/build around a shared workspace shell

**Files:**
- Create: `src/lib/components/PhaseStepper.svelte`
- Create: `src/lib/components/PhaseStepper.test.ts`
- Modify: `src/lib/components/ImportScreen.svelte`
- Modify: `src/lib/components/BuildProgressScreen.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Write the failing phase-stepper component test**

Create `src/lib/components/PhaseStepper.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:

```bash
pnpm test -- PhaseStepper
```

Expected: FAIL because `src/lib/components/PhaseStepper.svelte` does not exist yet.

- [ ] **Step 3: Implement the phase stepper and wire it into the page shell**

Create `src/lib/components/PhaseStepper.svelte`:

```svelte
<script lang="ts">
  type Phase = 'import' | 'building' | 'review' | 'reader';

  export let phase: Phase;
  export let labels: string[] = [];

  const order: Phase[] = ['import', 'building', 'review', 'reader'];

  function stateFor(index: number) {
    const activeIndex = order.indexOf(phase);
    if (index < activeIndex) return 'done';
    if (index === activeIndex) return 'current';
    return 'upcoming';
  }
</script>

<ol class="stepper">
  {#each labels as label, index}
    <li data-state={stateFor(index)}>
      <span>{index + 1}</span>
      <strong>{label}</strong>
    </li>
  {/each}
</ol>
```

Update `src/routes/+page.svelte` to use the shared shell:

```svelte
<script lang="ts">
  import PhaseStepper from '$lib/components/PhaseStepper.svelte';

  const phaseLabels = ['导入', '构建', '审阅', '游玩'];
</script>

<header class="topbar">
  <div>
    <p>Nova Narrative</p>
    <strong>小说改编工作台</strong>
  </div>
  <PhaseStepper phase={phase === 'ending' ? 'reader' : phase} labels={phaseLabels} />
</header>
```

Simplify `src/lib/components/ImportScreen.svelte` so it uses one hero column and one composer column without the three-card feature grid:

```svelte
<section class="workspace-hero">
  <div class="copy">
    <p class="eyebrow">Import</p>
    <h1>先导入小说，再让系统开始改编</h1>
    <p class="lede">
      把纯文本贴进来，下一步就是解析人物、世界、规则和可互动场景。
    </p>
  </div>

  <div class="composer">
    <label>
      <span>项目名称</span>
      <input
        value={projectName}
        on:input={(event) => dispatch('updateProjectName', event.currentTarget.value)}
        placeholder="例如：临川夜话"
        disabled={busy}
      />
    </label>

    <label>
      <span>小说正文</span>
      <textarea
        value={novelText}
        on:input={(event) => dispatch('updateNovelText', event.currentTarget.value)}
        placeholder="粘贴 txt 或 markdown 纯文本内容"
        disabled={busy}
      ></textarea>
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button
      type="button"
      class="primary"
      on:click={() => dispatch('submit')}
      disabled={busy || !projectName.trim() || !novelText.trim()}
    >
      {busy ? '故事准备中' : '开始解析与改编'}
    </button>
  </div>
</section>
```

Simplify `src/lib/components/BuildProgressScreen.svelte` so it reads like one progress panel plus one quiet status list:

```svelte
<section class="build-shell">
  <div class="intro">
    <p class="eyebrow">Build</p>
    <h2>{stageHeadline(buildStatus.stage)}</h2>
    <p>{projectName} 正在被整理成一个可审阅、可游玩的互动故事项目。</p>
  </div>

  <div class="meter">
    <div class="meter-fill" style={`width: ${Math.max(buildStatus.progress, 8)}%`}></div>
  </div>

  <ol class="stage-list">
    {#each cards as card}
      <li class:done={card.status === 'done'} class:current={card.status === 'current'} class:error={card.status === 'error'}>
        <span>{card.label}</span>
        <strong>
          {#if card.status === 'done'}
            已完成
          {:else if card.status === 'current'}
            进行中
          {:else if card.status === 'error'}
            失败
          {:else}
            等待中
          {/if}
        </strong>
      </li>
    {/each}
  </ol>
</section>
```

- [ ] **Step 4: Re-run tests and type checks**

Run:

```bash
pnpm test -- PhaseStepper
pnpm check
```

Expected:
- `pnpm test -- PhaseStepper` PASS
- `pnpm check` PASS without `PhaseStepper` prop errors

- [ ] **Step 5: Commit the workspace shell changes**

```bash
git add src/lib/components/PhaseStepper.svelte src/lib/components/PhaseStepper.test.ts src/lib/components/ImportScreen.svelte src/lib/components/BuildProgressScreen.svelte src/routes/+page.svelte
git commit -m "feat: simplify workspace shell"
```

---

### Task 3: Turn review into a segmented editing workspace

**Files:**
- Create: `src/lib/components/ReviewPreviewPanel.svelte`
- Create: `src/lib/components/ReviewWorkspace.svelte`
- Create: `src/lib/components/ReviewWorkspace.test.ts`
- Modify: `src/lib/components/CharacterReviewPanel.svelte`
- Modify: `src/lib/components/WorldBookPanel.svelte`
- Modify: `src/lib/components/RuleBookPanel.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Write the failing review-workspace test**

Create `src/lib/components/ReviewWorkspace.test.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ReviewWorkspace from './ReviewWorkspace.svelte';

const project = {
  character_cards: [{ id: 'c1', name: '阿遥', identity: '医生', gender: '女', summary: '冷静', desire: '', secrets: [] }],
  worldbook_entries: [{ id: 'w1', title: '北门', insertion_mode: 'rules_guard', enabled: true, content: '午夜不可开', source: 'extractor' }],
  rules: [{ id: 'r1', name: '午夜禁令', priority: 'hard_constraint', enabled: true, explanation: '午夜不能开北门', conditions: [], effects: [] }]
};

describe('ReviewWorkspace', () => {
  it('shows one section at a time and keeps the preview visible', async () => {
    render(ReviewWorkspace, {
      props: {
        project,
        lorePreview: [{ id: 'l1', title: '北门禁令', slot: 'rules_guard', reason: '命中北门', lifecycle_state: 'fresh', matched_keys: ['北门'] }],
        rulePreview: { active_rules: [], story_state: { event_flags: [], possibility_flags: [], character_states: [], visited_scenes: [] } }
      }
    });

    expect(screen.getByRole('heading', { name: '角色卡' })).toBeInTheDocument();
    expect(screen.getByText('lore 预览')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '世界书' }));

    expect(screen.getByRole('heading', { name: '世界书' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '角色卡' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:

```bash
pnpm test -- ReviewWorkspace
```

Expected: FAIL because `src/lib/components/ReviewWorkspace.svelte` does not exist yet.

- [ ] **Step 3: Build the review workspace and compact editor panels**

Create `src/lib/components/ReviewPreviewPanel.svelte`:

```svelte
<script lang="ts">
  import { loreLifecycleTone, loreSlotLabel, ruleBadgeTone } from '$lib/rule-helpers';
  import type { ActiveLoreEntry, RuleEvaluationResult } from '$lib/types';

  export let lorePreview: ActiveLoreEntry[] = [];
  export let rulePreview: RuleEvaluationResult | null = null;
  export let error = '';
</script>

<aside class="preview-rail">
  <section>
    <strong>lore 预览</strong>
    {#each lorePreview as lore}
      <article>
        <p>{lore.title}</p>
        <span class={`tone-${loreLifecycleTone(lore.lifecycle_state)}`}>
          {loreSlotLabel(lore.slot)} · {lore.reason}
        </span>
      </article>
    {/each}
  </section>

  <section>
    <strong>规则预览</strong>
    {#if rulePreview}
      {#each rulePreview.active_rules as rule}
        <article>
          <p>{rule.name}</p>
          <span class={`tone-${ruleBadgeTone(rule.priority)}`}>{rule.explanation}</span>
        </article>
      {/each}
    {/if}
  </section>
</aside>
```

Create `src/lib/components/ReviewWorkspace.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import CharacterReviewPanel from './CharacterReviewPanel.svelte';
  import ReviewPreviewPanel from './ReviewPreviewPanel.svelte';
  import RuleBookPanel from './RuleBookPanel.svelte';
  import WorldBookPanel from './WorldBookPanel.svelte';
  import { REVIEW_SECTIONS, type ReviewSectionId } from '$lib/ui-layout';
  import type { ActiveLoreEntry, NovelProject, RuleDefinition, RuleEvaluationResult, WorldBookEntry, CharacterCard } from '$lib/types';

  export let project: NovelProject;
  export let lorePreview: ActiveLoreEntry[] = [];
  export let rulePreview: RuleEvaluationResult | null = null;
  export let activeSection: ReviewSectionId = 'characters';

  const dispatch = createEventDispatcher<{
    saveCharacter: CharacterCard;
    saveWorldBook: WorldBookEntry;
    deleteWorldBook: string;
    saveRule: RuleDefinition;
    deleteRule: string;
  }>();
</script>

<section class="review-shell">
  <div class="review-main">
    <nav class="section-tabs">
      {#each REVIEW_SECTIONS as section}
        <button type="button" class:active={section.id === activeSection} on:click={() => (activeSection = section.id)}>
          {section.label}
        </button>
      {/each}
    </nav>

    {#if activeSection === 'characters'}
      <CharacterReviewPanel cards={project.character_cards} on:save={(event) => dispatch('saveCharacter', event.detail)} />
    {:else if activeSection === 'worldbook'}
      <WorldBookPanel
        entries={project.worldbook_entries}
        on:save={(event) => dispatch('saveWorldBook', event.detail)}
        on:remove={(event) => dispatch('deleteWorldBook', event.detail)}
      />
    {:else}
      <RuleBookPanel
        rules={project.rules}
        on:save={(event) => dispatch('saveRule', event.detail)}
        on:remove={(event) => dispatch('deleteRule', event.detail)}
      />
    {/if}
  </div>

  <ReviewPreviewPanel {lorePreview} {rulePreview} />
</section>
```

Compact each edit panel so there is one active card body and one primary action. Example for `src/lib/components/CharacterReviewPanel.svelte`:

```svelte
<script lang="ts">
  let activeIndex = 0;
</script>

<div class="panel-head">
  <div>
    <p class="eyebrow">Review</p>
    <h3>角色卡</h3>
  </div>
  <p>{cards.length} 位角色</p>
</div>

<div class="card-list">
  {#each drafts as card, index}
    <article class:selected={index === activeIndex}>
      <button type="button" class="entity-tab" on:click={() => (activeIndex = index)}>
        <strong>{card.name}</strong>
        <span>{card.identity}</span>
      </button>

      {#if index === activeIndex}
        <div class="editor-body">
          <label>
            <span>姓名</span>
            <input bind:value={drafts[index].name} />
          </label>
          <label>
            <span>身份</span>
            <input bind:value={drafts[index].identity} />
          </label>
          <label>
            <span>摘要</span>
            <textarea bind:value={drafts[index].summary} rows="3"></textarea>
          </label>
          <label>
            <span>秘密（用 `；` 分隔）</span>
            <textarea
              value={drafts[index].secrets.join('；')}
              rows="2"
              on:input={(event) => {
                drafts[index].secrets = event.currentTarget.value
                  .split('；')
                  .map((item) => item.trim())
                  .filter(Boolean);
                drafts = drafts;
              }}
            ></textarea>
          </label>
          <button type="button" class="primary" on:click={() => dispatch('save', drafts[index])}>
            保存并刷新预览
          </button>
        </div>
      {/if}
    </article>
  {/each}
</div>
```

Wire `src/routes/+page.svelte` to use the workspace instead of the three-column review grid:

```svelte
<ReviewWorkspace
  {project}
  {lorePreview}
  {rulePreview}
  on:saveCharacter={saveCharacter}
  on:saveWorldBook={saveWorldBook}
  on:deleteWorldBook={deleteWorldBook}
  on:saveRule={saveRule}
  on:deleteRule={deleteRule}
/>
```

- [ ] **Step 4: Re-run the review tests and type checks**

Run:

```bash
pnpm test -- ReviewWorkspace
pnpm check
```

Expected:
- `pnpm test -- ReviewWorkspace` PASS
- `pnpm check` PASS with no missing event or prop typings

- [ ] **Step 5: Commit the review workspace**

```bash
git add src/lib/components/ReviewPreviewPanel.svelte src/lib/components/ReviewWorkspace.svelte src/lib/components/ReviewWorkspace.test.ts src/lib/components/CharacterReviewPanel.svelte src/lib/components/WorldBookPanel.svelte src/lib/components/RuleBookPanel.svelte src/routes/+page.svelte
git commit -m "feat: redesign review workspace"
```

---

### Task 4: Rebuild the desktop reader as a centered stage with quiet side rails

**Files:**
- Create: `src/lib/components/ReaderDesktopShell.svelte`
- Create: `src/lib/components/ReaderShell.test.ts`
- Modify: `src/lib/components/ReaderStage.svelte`
- Modify: `src/lib/components/StoryCodexPanel.svelte`
- Modify: `src/lib/components/StoryStatePanel.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Write the failing desktop-reader test**

Create `src/lib/components/ReaderShell.test.ts`:

```ts
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ReaderDesktopShell from './ReaderDesktopShell.svelte';

const payload = {
  scene: {
    id: 'scene-1',
    chapter: 1,
    title: '北门之夜',
    narration: ['第一段', '第二段'],
    dialogue: [],
    allow_free_input: true,
    candidate_choices: []
  },
  active_lore: [{ id: 'l1', title: '北门禁令', slot: 'rules_guard', reason: '北门', lifecycle_state: 'fresh', matched_keys: ['北门'] }],
  active_rules: [{ id: 'r1', name: '午夜禁令', priority: 'hard_constraint', explanation: '午夜不能开北门' }],
  story_state: { event_flags: ['night'], possibility_flags: [], character_states: [], visited_scenes: [] },
  session: { visited_scenes: [], major_choices: [], known_facts: [], available_checkpoints: [], rule_flags: [] }
};

describe('ReaderDesktopShell', () => {
  it('renders the main stage before the world and state rails', () => {
    render(ReaderDesktopShell, {
      props: {
        payload,
        codex: null,
        session: payload.session,
        freeInput: '',
        busy: false,
        error: ''
      }
    });

    expect(screen.getByRole('heading', { name: '北门之夜' })).toBeInTheDocument();
    expect(screen.getByText('世界侧栏')).toBeInTheDocument();
    expect(screen.getByText('世界状态')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:

```bash
pnpm test -- ReaderShell
```

Expected: FAIL because `src/lib/components/ReaderDesktopShell.svelte` does not exist yet.

- [ ] **Step 3: Implement the desktop reader shell and soften the side panels**

Create `src/lib/components/ReaderDesktopShell.svelte`:

```svelte
<script lang="ts">
  import ReaderStage from './ReaderStage.svelte';
  import StoryCodexPanel from './StoryCodexPanel.svelte';
  import StoryStatePanel from './StoryStatePanel.svelte';
  import type { ScenePayload, SessionState, StoryCodex } from '$lib/types';

  export let payload: ScenePayload;
  export let codex: StoryCodex | null = null;
  export let session: SessionState;
  export let freeInput = '';
  export let busy = false;
  export let error = '';
</script>

<section class="reader-desktop">
  <aside class="left-rail">
    <StoryCodexPanel
      {codex}
      {session}
      activeLore={payload.active_lore}
      activeRules={payload.active_rules}
    />
  </aside>

  <div class="stage-column">
    <ReaderStage {payload} {freeInput} {busy} {error} />
  </div>

  <aside class="right-rail">
    <StoryStatePanel storyState={payload.story_state} activeRules={payload.active_rules} />
  </aside>
</section>
```

Refactor `src/lib/components/ReaderStage.svelte` so the stage is narrow, image-friendly, and uses a bottom decision sheet:

```svelte
<section class={`stage ${tint}`}>
  <div class="stage-header">
    <div>
      <p class="eyebrow">Chapter {payload.scene.chapter}</p>
      <h2>{payload.scene.title}</h2>
    </div>
    <div class="tool-pills">
      <span>{payload.session.visited_scenes.length} 个场景</span>
      <span>{payload.active_rules.length} 条规则命中</span>
    </div>
  </div>

  <div class="story-surface">
    <div class="narration">
      {#each payload.scene.narration as paragraph}
        <p>{paragraph}</p>
      {/each}
    </div>

    {#if payload.active_rules.length}
      <div class="rule-pills">
        {#each payload.active_rules as rule}
          <span>{rule.name}</span>
        {/each}
      </div>
    {/if}
  </div>

  <div class="decision-sheet">
    <div class="choices">
      {#each payload.scene.candidate_choices as choice}
        <button
          type="button"
          class:locked={choice.unlock_conditions.length > 0 && !choice.unlock_conditions.every((condition) => payload.session.rule_flags.includes(condition))}
          on:click={() => dispatch('choose', choice.id)}
          disabled={busy}
        >
          <strong>{choice.label}</strong>
          <span>{choice.unlock_conditions.length ? `需要条件：${choice.unlock_conditions.join(' / ')}` : choice.intent_tag}</span>
        </button>
      {/each}
    </div>
    {#if payload.scene.allow_free_input}
      <div class="free-input">
        <label>
          <span>自由行动</span>
          <textarea
            value={freeInput}
            on:input={(event) => dispatch('freeInputChange', event.currentTarget.value)}
            placeholder="例如：我暂时隐瞒真相，先稳住对方。"
            maxlength="120"
            disabled={busy}
          ></textarea>
        </label>
        <button type="button" class="secondary" on:click={() => dispatch('submitFreeInput')} disabled={busy || !freeInput.trim()}>
          把这句话写进故事
        </button>
      </div>
    {/if}
  </div>
</section>
```

Compact `src/lib/components/StoryCodexPanel.svelte` and `src/lib/components/StoryStatePanel.svelte` so they read as quiet rails instead of equal-weight cards:

```svelte
<aside class="rail-panel">
  <div class="rail-head">
    <p class="eyebrow">World</p>
    <h3>世界侧栏</h3>
  </div>
  <div class="rail-stack">
    {#each activeLore as lore}
      <article>
        <strong>{lore.title}</strong>
        <span>{lore.slot} · {lore.lifecycle_state}</span>
        <p>{lore.reason}</p>
      </article>
    {/each}
    {#each activeRules as rule}
      <article>
        <strong>{rule.name}</strong>
        <p>{rule.explanation}</p>
      </article>
    {/each}
  </div>
</aside>
```

- [ ] **Step 4: Re-run desktop reader tests and checks**

Run:

```bash
pnpm test -- ReaderShell
pnpm check
```

Expected:
- `pnpm test -- ReaderShell` PASS
- `pnpm check` PASS with no reader-shell prop mismatches

- [ ] **Step 5: Commit the desktop reader redesign**

```bash
git add src/lib/components/ReaderDesktopShell.svelte src/lib/components/ReaderShell.test.ts src/lib/components/ReaderStage.svelte src/lib/components/StoryCodexPanel.svelte src/lib/components/StoryStatePanel.svelte src/routes/+page.svelte
git commit -m "feat: redesign desktop reader"
```

---

### Task 5: Add the mobile reader shell and drawer-based world/state access

**Files:**
- Create: `src/lib/components/ReaderOverlayDrawer.svelte`
- Create: `src/lib/components/ReaderMobileShell.svelte`
- Modify: `src/lib/components/ReaderShell.test.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/ui-layout.ts`

- [ ] **Step 1: Extend the reader-shell test for mobile mode**

Update `src/lib/components/ReaderShell.test.ts`:

```ts
import { fireEvent } from '@testing-library/svelte';

import ReaderMobileShell from './ReaderMobileShell.svelte';

describe('ReaderMobileShell', () => {
  it('keeps lore and state hidden until their drawers are opened', async () => {
    render(ReaderMobileShell, {
      props: {
        payload,
        codex: null,
        freeInput: '',
        busy: false,
        error: ''
      }
    });

    expect(screen.queryByText('世界状态')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '打开世界信息' }));
    expect(screen.getByText('世界侧栏')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '打开状态信息' }));
    expect(screen.getByText('世界状态')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:

```bash
pnpm test -- ReaderShell
```

Expected: FAIL because `src/lib/components/ReaderMobileShell.svelte` and its drawer controls do not exist yet.

- [ ] **Step 3: Implement mobile drawers and viewport-based shell switching**

Create `src/lib/components/ReaderOverlayDrawer.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title = '';
  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();
</script>

{#if open}
  <div class="overlay">
    <section class="drawer" role="dialog" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <button type="button" aria-label="关闭" on:click={() => dispatch('close')}>关闭</button>
      </header>
      <slot />
    </section>
  </div>
{/if}
```

Create `src/lib/components/ReaderMobileShell.svelte`:

```svelte
<script lang="ts">
  import ReaderOverlayDrawer from './ReaderOverlayDrawer.svelte';
  import ReaderStage from './ReaderStage.svelte';
  import StoryCodexPanel from './StoryCodexPanel.svelte';
  import StoryStatePanel from './StoryStatePanel.svelte';
  import type { ScenePayload, StoryCodex } from '$lib/types';

  export let payload: ScenePayload;
  export let codex: StoryCodex | null = null;
  export let freeInput = '';
  export let busy = false;
  export let error = '';

  let worldOpen = false;
  let stateOpen = false;
</script>

<section class="reader-mobile">
  <div class="mobile-tools">
    <button type="button" aria-label="打开世界信息" on:click={() => (worldOpen = true)}>世界</button>
    <button type="button" aria-label="打开状态信息" on:click={() => (stateOpen = true)}>状态</button>
  </div>

  <ReaderStage {payload} {freeInput} {busy} {error} />

  <ReaderOverlayDrawer title="世界侧栏" open={worldOpen} on:close={() => (worldOpen = false)}>
    <StoryCodexPanel {codex} session={payload.session} activeLore={payload.active_lore} activeRules={payload.active_rules} />
  </ReaderOverlayDrawer>

  <ReaderOverlayDrawer title="世界状态" open={stateOpen} on:close={() => (stateOpen = false)}>
    <StoryStatePanel storyState={payload.story_state} activeRules={payload.active_rules} />
  </ReaderOverlayDrawer>
</section>
```

Update `src/routes/+page.svelte` so the reader shell is chosen by viewport width:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import ReaderDesktopShell from '$lib/components/ReaderDesktopShell.svelte';
  import ReaderMobileShell from '$lib/components/ReaderMobileShell.svelte';
  import {
    resolveReaderLayoutMode,
    type ReaderLayoutMode
  } from '$lib/ui-layout';

  let readerLayoutMode: ReaderLayoutMode = 'desktop';

  onMount(() => {
    const update = () => {
      readerLayoutMode = resolveReaderLayoutMode(window.innerWidth);
    };

    update();
    window.addEventListener('resize', update);

    return () => window.removeEventListener('resize', update);
  });
</script>

{#if readerLayoutMode === 'desktop'}
  <ReaderDesktopShell
    {payload}
    codex={codex}
    session={activeSession}
    {freeInput}
    {busy}
    {error}
    on:choose={(event) => choose(event.detail)}
    on:freeInputChange={(event) => (freeInput = event.detail)}
    on:submitFreeInput={submitFreeInput}
  />
{:else}
  <ReaderMobileShell
    {payload}
    codex={codex}
    {freeInput}
    {busy}
    {error}
    on:choose={(event) => choose(event.detail)}
    on:freeInputChange={(event) => (freeInput = event.detail)}
    on:submitFreeInput={submitFreeInput}
  />
{/if}
```

- [ ] **Step 4: Re-run tests and checks**

Run:

```bash
pnpm test -- ReaderShell
pnpm check
```

Expected:
- `pnpm test -- ReaderShell` PASS for both desktop and mobile cases
- `pnpm check` PASS with no `window` usage errors outside `onMount`

- [ ] **Step 5: Commit the mobile reader shell**

```bash
git add src/lib/components/ReaderOverlayDrawer.svelte src/lib/components/ReaderMobileShell.svelte src/lib/components/ReaderShell.test.ts src/lib/ui-layout.ts src/routes/+page.svelte
git commit -m "feat: add mobile reader shell"
```

---

### Task 6: Run the full regression pass and smoke-check the new phase transitions

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/components/ImportScreen.svelte`
- Modify: `src/lib/components/BuildProgressScreen.svelte`
- Modify: `src/lib/components/ReviewWorkspace.svelte`
- Modify: `src/lib/components/ReaderDesktopShell.svelte`
- Modify: `src/lib/components/ReaderMobileShell.svelte`

- [ ] **Step 1: Run the frontend unit suite**

Run:

```bash
pnpm test
```

Expected: PASS including:
- `src/lib/rule-helpers.test.ts`
- `src/lib/story-helpers.test.ts`
- `src/lib/ui-layout.test.ts`
- `src/lib/components/PhaseStepper.test.ts`
- `src/lib/components/ReviewWorkspace.test.ts`
- `src/lib/components/ReaderShell.test.ts`

- [ ] **Step 2: Run Svelte type-checking**

Run:

```bash
pnpm check
```

Expected: PASS with no missing prop, event, or DOM typing issues.

- [ ] **Step 3: Run the production build**

Run:

```bash
pnpm build
```

Expected: PASS and emit the static site bundle without reader-layout compile errors.

- [ ] **Step 4: Manually smoke-check the four critical flows**

Use `pnpm dev` and verify:

```text
1. Import phase shows one main input area and one primary CTA.
2. Build phase centers progress and no longer looks like a dashboard.
3. Review phase only shows one editor category at a time while the preview rail stays visible.
4. Reader uses desktop rails above 768px and drawer-based mobile UI below 768px.
```

- [ ] **Step 5: Commit the final polish and verification pass**

```bash
git add src/routes/+page.svelte src/lib/components/ImportScreen.svelte src/lib/components/BuildProgressScreen.svelte src/lib/components/ReviewWorkspace.svelte src/lib/components/ReaderDesktopShell.svelte src/lib/components/ReaderMobileShell.svelte
git commit -m "feat: finalize ui redesign"
```
