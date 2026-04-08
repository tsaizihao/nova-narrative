<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';

  export let title = '';
  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();
  let drawerElement: HTMLDivElement | null = null;

  function closeDrawer() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDrawer();
    }
  }

  $: if (open) {
    tick().then(() => drawerElement?.focus());
  }
</script>

{#if open}
  <div class="overlay">
    <button type="button" class="scrim" aria-label={`关闭${title}`} on:click={closeDrawer}></button>
    <div
      bind:this={drawerElement}
      class="drawer"
      role="dialog"
      aria-label={title}
      aria-modal="true"
      tabindex="-1"
      on:keydown={handleKeydown}
    >
      <header>
        <strong>{title}</strong>
        <button type="button" aria-label="关闭" on:click={closeDrawer}>关闭</button>
      </header>
      <div class="drawer-body">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    padding: 16px;
  }

  .scrim {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(7, 7, 10, 0.48);
    backdrop-filter: blur(6px);
    cursor: pointer;
  }

  .drawer {
    position: relative;
    z-index: 1;
    width: min(100%, 420px);
    margin-left: auto;
    display: grid;
    grid-template-rows: auto 1fr;
    border-radius: 24px;
    border: 1px solid rgba(255, 243, 214, 0.08);
    background: rgba(10, 10, 14, 0.96);
    overflow: hidden;
    outline: none;
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(255, 243, 214, 0.08);
  }

  strong {
    color: #fff4dd;
    font-size: 1rem;
  }

  button {
    min-height: 34px;
    padding: 0 12px;
    border: none;
    border-radius: 999px;
    background: rgba(255, 248, 230, 0.08);
    color: #f7e5bf;
    font: inherit;
    cursor: pointer;
  }

  .drawer-body {
    overflow: auto;
    padding: 12px;
  }
</style>
