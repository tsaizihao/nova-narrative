<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import CharacterReviewPanel from './CharacterReviewPanel.svelte';
  import ReviewPreviewPanel from './ReviewPreviewPanel.svelte';
  import RuleBookPanel from './RuleBookPanel.svelte';
  import WorldBookPanel from './WorldBookPanel.svelte';
  import { REVIEW_SECTIONS, type ReviewSectionId } from '$lib/ui-layout';
  import type {
    ActiveLoreEntry,
    CharacterCard,
    NovelProject,
    RuleDefinition,
    RuleEvaluationResult,
    WorldBookEntry
  } from '$lib/types';

  export let project: NovelProject;
  export let lorePreview: ActiveLoreEntry[] = [];
  export let rulePreview: RuleEvaluationResult | null = null;
  export let error = '';

  let activeSection: ReviewSectionId = 'characters';

  const dispatch = createEventDispatcher<{
    saveCharacter: CharacterCard;
    saveWorldBook: WorldBookEntry;
    deleteWorldBook: string;
    saveRule: RuleDefinition;
    deleteRule: string;
  }>();

  $: activeCount =
    activeSection === 'characters'
      ? project.character_cards.length
      : activeSection === 'worldbook'
        ? project.worldbook_entries.length
        : project.rules.length;
</script>

<section class="workspace-shell">
  <div class="workspace-main">
    <div class="workspace-header">
      <div>
        <p class="eyebrow">Review Workspace</p>
        <h3>一次只专注一类结构化实体</h3>
      </div>
      <span>{activeCount} 个条目</span>
    </div>

    <nav class="section-tabs" aria-label="审阅分类">
      {#each REVIEW_SECTIONS as section}
        <button
          type="button"
          class:active={section.id === activeSection}
          on:click={() => (activeSection = section.id)}
        >
          {section.label}
        </button>
      {/each}
    </nav>

    {#if activeSection === 'characters'}
      <CharacterReviewPanel
        cards={project.character_cards}
        on:save={(event) => dispatch('saveCharacter', event.detail)}
      />
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

  <ReviewPreviewPanel {lorePreview} {rulePreview} {error} />
</section>

<style>
  .workspace-shell {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.8fr);
    gap: 18px;
    align-items: start;
  }

  .workspace-main {
    display: grid;
    gap: 16px;
    align-content: start;
  }

  .workspace-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    padding: 22px 24px 0;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #91765d;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.68rem;
  }

  h3,
  .workspace-header span {
    margin: 0;
  }

  h3 {
    color: #2f261d;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(1.6rem, 3vw, 2.2rem);
  }

  .workspace-header span {
    color: rgba(63, 47, 35, 0.62);
    font-size: 0.86rem;
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

  @media (max-width: 1120px) {
    .workspace-shell {
      grid-template-columns: 1fr;
    }
  }
</style>
