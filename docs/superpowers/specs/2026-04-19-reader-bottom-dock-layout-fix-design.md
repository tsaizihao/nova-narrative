# Reader Bottom Dock Layout Fix

## Background
Current reader mode still places the control dock inside the same document flow as the longform story paper. The dock uses `position: sticky`, so it only sticks within the content flow instead of behaving like a true viewport-bottom interaction bar.

That produces three user-visible problems:

- the bottom interaction area is not truly attached to the viewport bottom
- the story paper and the dock can visually collide because the content area does not reserve stable bottom space
- reader mode renders two layers of top chrome: the outer workspace topbar plus the inner reader header

The result feels like a page with stacked cards instead of a visual-novel reading shell.

## Confirmed Direction
This redesign stays within the current warm paper aesthetic and keeps the existing runtime behavior. We are not changing story data, scene actions, drawers, or runtime APIs.

The confirmed layout is:

1. a single lightweight reader header inside the reader shell
2. a scrollable longform reading area
3. a bottom-attached control dock rendered outside the reading flow
4. reader-specific safe-area spacing so the paper never hides behind the dock

## Goals

### Experience Goals
- Make the interaction area feel like a real visual-novel bottom bar
- Keep the story paper readable all the way to the final paragraph
- Remove duplicated top chrome in reader mode
- Preserve the existing warm palette, rounded paper surfaces, and understated controls

### Engineering Goals
- Fix the problem through layout structure first, not one-off offsets
- Keep desktop and mobile shells aligned around the same regions: header, body, dock, drawers
- Preserve current runtime events and props so this remains a shell-only refactor
- Make the new structure testable with stable DOM semantics

## Non-goals
- No backend or runtime contract changes
- No redesign of the review stage or import flow
- No new animation system or scene-art layer
- No conversion to a dark chat-style interface

## Structural Changes

### 1. Reader shell becomes a two-zone layout
Each reader shell should expose:

- `reader-head`: the only visible top chrome in reader mode
- `reader-body`: the scrollable content zone that contains the reading stage and reserves bottom safe space
- `reader-dock-shell`: the bottom-fixed container for the interaction dock

The dock must no longer live inside the same flow container as `ReaderStage`.

### 2. The dock becomes viewport-bottom chrome
`ReaderControlDock` should be styled as the visual dock surface, but the shell owns the fixed-bottom positioning. This keeps the dock reusable while making desktop/mobile shells responsible for layout.

The shell should reserve bottom padding using a shared custom property so the stage remains readable even when the dock grows because of choices, helper text, or multiline input.

### 3. Reader mode removes outer workspace chrome
The outer `WorkspaceTopbar` should not render during `phase === 'reader'`.

Reader mode already has its own scene-aware header. Keeping the outer bar creates duplicate hierarchy and wastes vertical space.

## Testable Semantics
The new layout should expose stable DOM hooks:

- the dock shell uses a dedicated class and a `data-layout="fixed-bottom"` marker
- the reader body uses a `data-safe-area="bottom-dock"` marker
- page-level reader mode no longer renders `.workspace-topbar`

These hooks allow tests to verify the structure without relying on browser layout calculations.

## Files in Scope
- `src/lib/components/ReaderControlDock.svelte`
- `src/lib/components/ReaderDesktopShell.svelte`
- `src/lib/components/ReaderMobileShell.svelte`
- `src/routes/+page.svelte`
- reader-related tests under `src/lib/components` and `src/routes`

## Acceptance Criteria
- In reader mode, the control dock is rendered in a dedicated bottom-attached shell rather than under the story paper
- The longform reading area explicitly reserves bottom safe space for the dock
- Reader mode renders only one top header
- Existing reader actions still work: continue, multi-choice branching, retry, autoplay, clear input, and free input
- Desktop and mobile reader shells share the same structural layout rules
