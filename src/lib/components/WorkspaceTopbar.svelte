<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PhaseStepper from './PhaseStepper.svelte';

  type Phase = 'import' | 'building' | 'review' | 'reader';

  export let eyebrow = '叙世者';
  export let title = '';
  export let metaLabel = '';
  export let phase: Phase = 'import';
  export let labels: string[] = [];
  export let showStepper = true;
  export let showSettingsAction = false;
  export let settingsActive = false;

  const dispatch = createEventDispatcher<{
    openSettings: void;
  }>();
</script>

<header class="workspace-topbar" data-reader={!showStepper && !showSettingsAction ? 'true' : 'false'}>
  <div class="brand-copy">
    <p>{eyebrow}</p>
    <strong>{title}</strong>
  </div>

  <div class="workspace-meta">
    {#if metaLabel}
      <span>{metaLabel}</span>
    {/if}

    <div class="meta-actions">
      {#if showStepper}
        <PhaseStepper {phase} {labels} />
      {/if}

      {#if showSettingsAction}
        <button
          type="button"
          class="settings-action"
          class:active={settingsActive}
          aria-pressed={settingsActive}
          on:click={() => dispatch('openSettings')}
        >
          设置
        </button>
      {/if}
    </div>
  </div>
</header>

<style>
  .workspace-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    padding: 16px 20px;
    border-radius: 24px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(250, 246, 239, 0.86);
    box-shadow: 0 16px 36px rgba(70, 54, 39, 0.08);
    backdrop-filter: blur(14px);
  }

  .brand-copy p,
  .brand-copy strong,
  .workspace-meta span {
    margin: 0;
  }

  .brand-copy p {
    font-size: 0.72rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #91765d;
  }

  .brand-copy strong {
    display: block;
    margin-top: 5px;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.35rem;
    color: #2f261d;
  }

  .workspace-meta {
    display: grid;
    justify-items: end;
    gap: 10px;
  }

  .meta-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
  }

  .workspace-meta span {
    color: rgba(63, 47, 35, 0.64);
    font-size: 0.9rem;
  }

  .settings-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 0 16px;
    border: 1px solid rgba(31, 106, 87, 0.16);
    border-radius: 999px;
    background: rgba(255, 253, 252, 0.92);
    color: rgba(63, 47, 35, 0.82);
    font: inherit;
    font-size: 0.9rem;
    line-height: 1;
    cursor: pointer;
    transition:
      border-color 160ms ease,
      background-color 160ms ease,
      color 160ms ease,
      box-shadow 160ms ease;
  }

  .settings-action:hover {
    border-color: rgba(31, 106, 87, 0.28);
    background: rgba(247, 242, 234, 0.96);
  }

  .settings-action:focus-visible {
    outline: none;
    border-color: #1f6a57;
    box-shadow: 0 0 0 3px rgba(31, 106, 87, 0.14);
  }

  .settings-action.active,
  .settings-action[aria-pressed='true'] {
    border-color: rgba(31, 106, 87, 0.42);
    background: rgba(228, 240, 236, 0.96);
    color: #1f6a57;
  }

  .workspace-topbar[data-reader='true'] .workspace-meta {
    gap: 0;
  }

  .workspace-topbar[data-reader='true'] .workspace-meta span {
    display: inline-flex;
    align-items: center;
    min-height: 38px;
    padding: 0 14px;
    border-radius: 999px;
    background: rgba(121, 103, 81, 0.08);
  }

  @media (max-width: 1200px) {
    .workspace-topbar {
      display: grid;
      grid-template-columns: 1fr;
      align-items: flex-start;
    }

    .workspace-meta {
      justify-items: start;
    }

    .meta-actions {
      justify-content: flex-start;
    }
  }
</style>
