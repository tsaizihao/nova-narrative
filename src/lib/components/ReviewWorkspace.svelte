<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import CanonReviewPanel from './CanonReviewPanel.svelte';
  import CharacterReviewPanel from './CharacterReviewPanel.svelte';
  import ReviewPreviewPanel from './ReviewPreviewPanel.svelte';
  import RuleBookPanel from './RuleBookPanel.svelte';
  import WorldBookPanel from './WorldBookPanel.svelte';
  import { REVIEW_SECTIONS, type ReviewSectionId } from '$lib/ui-layout';
  import type { CharacterCard, RuleDefinition, WorldBookEntry } from '$lib/types';
  import type { ReviewWorkspaceState } from '$lib/modules/review/workspace';

  export let state: ReviewWorkspaceState;

  const dispatch = createEventDispatcher<{
    setActiveSection: ReviewSectionId;
    selectCharacter: string;
    selectWorldBookEntry: string;
    selectRule: string;
    updateCharacterDraft: CharacterCard;
    updateWorldBookDraft: WorldBookEntry;
    updateRuleDraft: RuleDefinition;
    updatePreviewContext: Partial<{
      sceneId: string;
      eventKind: string;
      inputText: string;
      actorCharacterId: string | null;
      targetCharacterId: string | null;
    }>;
    saveCharacter: void;
    saveWorldBook: void;
    deleteWorldBook: void;
    saveRule: void;
    deleteRule: void;
    refreshPreview: void;
  }>();

  $: activeCount =
    state.activeSection === 'canon'
      ? state.project.adaptation_kernel?.canon_characters.length ?? 0
      : state.activeSection === 'characters'
      ? state.project.character_cards.length
      : state.activeSection === 'worldbook'
        ? state.project.worldbook_entries.length
        : state.project.rules.length;

  $: sectionTitle =
    state.activeSection === 'canon'
      ? '原著内核'
      : state.activeSection === 'characters'
      ? '角色编辑'
      : state.activeSection === 'worldbook'
        ? '世界书编辑'
        : '规则编辑';

  $: sceneOptions = Object.values(state.project.story_package?.scenes ?? {}).map((scene) => ({
    id: scene.id,
    title: scene.title
  }));

  $: characterOptions = state.project.character_cards.map((card) => ({
    id: card.id,
    name: card.name
  }));
</script>

<section class="workspace-shell">
  <div class="workspace-main" data-testid="review-editor-column">
    <div class="workspace-header">
      <h3>{sectionTitle}</h3>
      <span>{activeCount} 个条目</span>
    </div>

    <nav class="section-tabs" aria-label="审阅分类">
      {#each REVIEW_SECTIONS as section}
        <button
          type="button"
          class:active={section.id === state.activeSection}
          on:click={() => dispatch('setActiveSection', section.id)}
        >
          {section.label}
        </button>
      {/each}
    </nav>

    {#if state.error}
      <p class="workspace-error" role="alert">{state.error}</p>
    {/if}

    {#if state.activeSection === 'canon'}
      <CanonReviewPanel kernel={state.project.adaptation_kernel ?? null} />
    {:else if state.activeSection === 'characters'}
      <CharacterReviewPanel
        cards={state.project.character_cards}
        activeId={state.activeSelection.characters}
        draft={state.activeSelection.characters
          ? state.drafts.characters[state.activeSelection.characters] ?? null
          : null}
        dirty={state.activeSelection.characters
          ? state.dirty.characters[state.activeSelection.characters] ?? false
          : false}
        saveBusy={state.saveBusySection === 'characters'}
        on:select={(event) => dispatch('selectCharacter', event.detail)}
        on:change={(event) => dispatch('updateCharacterDraft', event.detail)}
        on:save={() => dispatch('saveCharacter')}
      />
    {:else if state.activeSection === 'worldbook'}
      <WorldBookPanel
        entries={state.project.worldbook_entries}
        activeId={state.activeSelection.worldbook}
        draft={state.activeSelection.worldbook
          ? state.drafts.worldbook[state.activeSelection.worldbook] ?? null
          : null}
        dirty={state.activeSelection.worldbook
          ? state.dirty.worldbook[state.activeSelection.worldbook] ?? false
          : false}
        saveBusy={state.saveBusySection === 'worldbook'}
        deleteBusy={state.deleteBusySection === 'worldbook'}
        on:select={(event) => dispatch('selectWorldBookEntry', event.detail)}
        on:change={(event) => dispatch('updateWorldBookDraft', event.detail)}
        on:save={() => dispatch('saveWorldBook')}
        on:remove={() => dispatch('deleteWorldBook')}
      />
    {:else}
      <RuleBookPanel
        rules={state.project.rules}
        activeId={state.activeSelection.rules}
        draft={state.activeSelection.rules ? state.drafts.rules[state.activeSelection.rules] ?? null : null}
        dirty={state.activeSelection.rules
          ? state.dirty.rules[state.activeSelection.rules] ?? false
          : false}
        saveBusy={state.saveBusySection === 'rules'}
        deleteBusy={state.deleteBusySection === 'rules'}
        on:select={(event) => dispatch('selectRule', event.detail)}
        on:change={(event) => dispatch('updateRuleDraft', event.detail)}
        on:save={() => dispatch('saveRule')}
        on:remove={() => dispatch('deleteRule')}
      />
    {/if}
  </div>

  <ReviewPreviewPanel
    draftContext={state.preview.previewContextDraft}
    appliedContext={state.preview.appliedPreviewContext}
    sceneOptions={sceneOptions}
    characterOptions={characterOptions}
    previewSnapshot={state.preview.previewSnapshot}
    status={state.preview.previewStatus}
    refreshError={state.preview.previewError}
    on:updateContext={(event) => dispatch('updatePreviewContext', event.detail)}
    on:refresh={() => dispatch('refreshPreview')}
  />
</section>

<style>
  .workspace-shell {
    display: grid;
    grid-template-columns: minmax(0, 1.75fr) minmax(260px, 0.72fr);
    gap: 16px;
    align-items: start;
  }

  .workspace-main {
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .workspace-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
    padding: 10px 24px 0;
  }

  h3,
  .workspace-header span,
  .workspace-error {
    margin: 0;
  }

  h3 {
    color: #2f261d;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(1.2rem, 2.1vw, 1.6rem);
  }

  .workspace-header span {
    color: rgba(63, 47, 35, 0.62);
    font-size: 0.8rem;
  }

  .section-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 0 24px;
  }

  .section-tabs button {
    min-height: 42px;
    padding: 0 16px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    border-radius: 999px;
    background: rgba(248, 243, 234, 0.74);
    color: #5f4f3e;
    font: inherit;
    cursor: pointer;
  }

  .section-tabs button.active {
    border-color: rgba(31, 106, 87, 0.22);
    background: #1f6a57;
    color: #f6f3eb;
  }

  .workspace-error {
    padding: 0 24px;
    color: #b14d3b;
    font-size: 0.84rem;
  }

  @media (max-width: 1120px) {
    .workspace-shell {
      grid-template-columns: 1fr;
    }
  }
</style>
