<script lang="ts">
  import PhaseStepper from './PhaseStepper.svelte';

  type Phase = 'import' | 'building' | 'review' | 'reader';

  export let eyebrow = '叙世者';
  export let title = '';
  export let metaLabel = '';
  export let phase: Phase = 'import';
  export let labels: string[] = [];
  export let showStepper = true;
</script>

<header class="workspace-topbar" data-reader={showStepper ? 'false' : 'true'}>
  <div class="brand-copy">
    <p>{eyebrow}</p>
    <strong>{title}</strong>
  </div>

  <div class="workspace-meta">
    {#if metaLabel}
      <span>{metaLabel}</span>
    {/if}

    {#if showStepper}
      <PhaseStepper {phase} {labels} />
    {/if}
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

  .workspace-meta span {
    color: rgba(63, 47, 35, 0.64);
    font-size: 0.9rem;
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
  }
</style>
