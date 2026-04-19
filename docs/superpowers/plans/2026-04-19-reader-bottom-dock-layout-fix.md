# Reader Bottom Dock Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert reader mode into a true bottom-dock layout by separating the dock from the longform story flow, reserving reader safe space, and removing duplicated top chrome in reader mode.

**Architecture:** Keep the runtime data flow untouched. The change happens at the reader shell boundary: `ReaderDesktopShell` and `ReaderMobileShell` become responsible for rendering a body region plus a fixed-bottom dock shell, while `ReaderControlDock` becomes the dock surface rendered inside that shell. `+page.svelte` stops rendering `WorkspaceTopbar` in reader mode so only the reader header remains.

**Tech Stack:** Svelte 5, SvelteKit, TypeScript, Vitest, @testing-library/svelte, jsdom, pnpm

---

## File structure

- Modify: `src/lib/components/ReaderControlDock.svelte`
- Modify: `src/lib/components/ReaderShell.test.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/page-flow.test.ts`
- Modify: `src/lib/components/RuntimeStageShell.test.ts`
- Modify: `src/lib/components/ReaderDesktopShell.svelte`
- Modify: `src/lib/components/ReaderMobileShell.svelte`

## Task 1: Add failing tests for the new reader layout semantics

**Files:**
- Modify: `src/lib/components/ReaderShell.test.ts`
- Modify: `src/routes/page-flow.test.ts`

- [ ] **Step 1: Add shell-level assertions for fixed-bottom layout semantics**

Check that both reader shells render:

- a body container marked with `data-safe-area="bottom-dock"`
- a dock shell marked with `data-layout="fixed-bottom"`
- the dock shell as a sibling of the body, not nested inside the stage

- [ ] **Step 2: Add page-level assertion for reader chrome cleanup**

Update the reader entry flow test so that after entering the story:

- `.workspace-topbar` is not present
- the reader heading still renders
- bottom-dock controls remain available

- [ ] **Step 3: Run the targeted tests and confirm RED**

Run:

```bash
rtk pnpm test -- ReaderShell page-flow
```

Expected: FAIL because the current shells still place the dock inside the stage flow and the page still renders `WorkspaceTopbar` in reader mode.

## Task 2: Implement the bottom-dock reader structure

**Files:**
- Modify: `src/lib/components/ReaderDesktopShell.svelte`
- Modify: `src/lib/components/ReaderMobileShell.svelte`
- Modify: `src/lib/components/ReaderControlDock.svelte`

- [ ] **Step 1: Move the dock into a dedicated shell-owned bottom container**

Desktop and mobile reader shells should render:

- the existing header
- a new body wrapper around `ReaderStage`
- a new dock shell after the body

- [ ] **Step 2: Give the body a stable bottom safe area**

Add a shared custom property for dock clearance and apply it to the body wrapper so the final story block remains visible above the dock.

- [ ] **Step 3: Convert the dock component into a reusable dock surface**

Remove shell-level positioning from `ReaderControlDock` and keep only surface styling, internal spacing, and responsive controls.

## Task 3: Remove reader-phase duplicate top chrome

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/page-flow.test.ts`

- [ ] **Step 1: Stop rendering `WorkspaceTopbar` for `phase === 'reader'`**

The topbar should remain for import and building, stay hidden for review as it is today, and also be hidden in reader mode.

- [ ] **Step 2: Keep page-level spacing intact after the reader topbar is removed**

Adjust the reader frame spacing only if needed so the page still breathes without the outer topbar card.

## Task 4: Verify the integrated reader flow

**Files:**
- Modify: `src/lib/components/RuntimeStageShell.test.ts`
- Modify: `src/lib/components/ReaderShell.test.ts`
- Modify: `src/routes/page-flow.test.ts`

- [ ] **Step 1: Run targeted tests**

```bash
rtk pnpm test -- ReaderShell page-flow RuntimeStageShell
```

Expected: PASS

- [ ] **Step 2: Run the frontend verification sweep**

```bash
rtk pnpm verify:wave3
```

Expected: PASS

- [ ] **Step 3: Manually confirm the reader layout in the browser**

Check that:

- the dock visually hugs the viewport bottom
- the story paper does not disappear behind the dock
- reader mode shows only one top header
