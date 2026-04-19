<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import type { ChoiceOption, SceneNode } from '$lib/types';

  export let scene: SceneNode;
  export let ruleFlags: string[] = [];
  export let freeInput = '';
  export let busy = false;
  export let busyLabel = '';
  export let error = '';
  export let autoplay = false;
  export let retryAvailable = false;

  const dispatch = createEventDispatcher<{
    choose: string;
    freeInputChange: string;
    submitFreeInput: void;
    clearInput: void;
    retry: void;
    toggleAutoplay: void;
  }>();

  function choiceUnlocked(choice: ChoiceOption) {
    return choice.unlock_conditions.every((condition) => ruleFlags.includes(condition));
  }

  $: multipleChoices = scene.candidate_choices.length > 1;
  $: primaryChoice = scene.candidate_choices.length === 1 ? scene.candidate_choices[0] : null;
  $: freeInputAllowed = scene.allow_free_input !== false;
  $: inputMode = freeInputAllowed ? 'interactive' : 'staged';
  $: submitDisabled = busy || !freeInputAllowed || !freeInput.trim();
</script>

<section class="reader-control-dock" data-tone="paper" data-input-mode={inputMode}>
  <div class="dock-main">
    {#if multipleChoices}
      <div class="choice-row">
        {#each scene.candidate_choices as choice}
          <button
            type="button"
            class="choice-button"
            aria-label={choice.label}
            disabled={busy || !choiceUnlocked(choice)}
            on:click={() => dispatch('choose', choice.id)}
          >
            <span class="choice-copy">
              <strong>{choice.label}</strong>
              <small>{choice.intent_tag}</small>
            </span>
          </button>
        {/each}
      </div>
    {:else if primaryChoice}
      <button
        type="button"
        class="continue-button"
        aria-label="继续"
        disabled={busy || !choiceUnlocked(primaryChoice)}
        on:click={() => dispatch('choose', primaryChoice.id)}
      >
        继续
      </button>
    {/if}
  </div>

  <div class="dock-secondary">
    <button type="button" aria-label="自动播放" aria-pressed={autoplay} on:click={() => dispatch('toggleAutoplay')}>
      自动播放
    </button>
    <button
      type="button"
      aria-label="重试"
      data-state={error ? 'alert' : 'idle'}
      disabled={!retryAvailable || busy}
      on:click={() => dispatch('retry')}
    >
      重试
    </button>
    <button type="button" aria-label="清除输入" disabled={busy || !freeInput.trim()} on:click={() => dispatch('clearInput')}>
      清除输入
    </button>
    {#if error}
      <p class="dock-status" role="status" aria-live="polite">{error}</p>
    {/if}
  </div>

  <label class="dock-input">
    {#if !freeInputAllowed}
      <small>当前场景只能按既定选项推进，自由输入会保留但暂不提交。</small>
    {/if}
    <textarea
      aria-label="自由输入"
      rows={freeInputAllowed ? 3 : 1}
      value={freeInput}
      disabled={busy}
      maxlength="240"
      on:input={(event) => dispatch('freeInputChange', event.currentTarget.value)}
      placeholder="例如：我暂时不揭穿真相，先看对方接下来会做什么。"
    ></textarea>
    {#if freeInputAllowed}
      <div class="dock-input-actions">
        <button
          type="button"
          class="submit-button"
          disabled={submitDisabled}
          on:click={() => dispatch('submitFreeInput')}
        >
          {#if busy && busyLabel}
            {busyLabel}
          {:else}
            把这句话写进故事
          {/if}
        </button>
      </div>
    {/if}
  </label>
</section>

<style>
  .reader-control-dock {
    display: grid;
    gap: 10px;
    width: 100%;
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px));
    border: 1px solid rgba(121, 103, 81, 0.14);
    border-radius: 24px;
    background:
      linear-gradient(180deg, rgba(255, 253, 249, 0.92), rgba(247, 239, 228, 0.98)),
      rgba(248, 243, 234, 0.98);
    box-shadow: 0 -10px 24px rgba(70, 54, 39, 0.08);
  }

  .dock-main,
  .dock-secondary,
  .dock-input-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .choice-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    width: 100%;
  }

  .choice-button,
  .continue-button,
  .submit-button,
  .dock-secondary button {
    min-height: 42px;
    border-radius: 999px;
    border: 1px solid rgba(121, 103, 81, 0.16);
    font: inherit;
    cursor: pointer;
  }

  .continue-button,
  .submit-button {
    padding: 0 18px;
    background: rgba(31, 106, 87, 0.12);
    color: #1f6a57;
  }

  .choice-button {
    display: flex;
    align-items: center;
    padding: 8px 14px;
    background: rgba(255, 250, 244, 0.94);
    color: #2f261d;
  }

  .choice-copy {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .choice-copy strong,
  .choice-copy small {
    display: block;
  }

  .choice-copy strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .choice-copy small {
    color: rgba(145, 118, 93, 0.92);
    font-size: 0.78rem;
    text-transform: lowercase;
  }

  .dock-secondary button {
    padding: 0 14px;
    background: rgba(244, 236, 225, 0.86);
    color: #2f261d;
  }

  .dock-secondary button[data-state='alert'] {
    border-color: rgba(177, 77, 59, 0.28);
    color: #b14d3b;
  }

  .dock-status {
    margin: 0;
    align-self: center;
    color: #8c3a2c;
    font-size: 0.84rem;
  }

  .dock-input {
    display: grid;
    gap: 6px;
  }

  .dock-input small {
    color: rgba(155, 109, 57, 0.86);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .dock-input textarea {
    width: 100%;
    min-height: 72px;
    max-height: 164px;
    resize: none;
    overflow: auto;
    border-radius: 18px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    padding: 12px 14px;
    background: rgba(255, 252, 248, 0.96);
    color: #2f261d;
    font: inherit;
    line-height: 1.6;
  }

  .dock-input-actions {
    justify-content: flex-end;
  }

  .reader-control-dock[data-input-mode='staged'] {
    gap: 8px;
  }

  .reader-control-dock[data-input-mode='staged'] .dock-input textarea {
    min-height: 52px;
    padding-block: 10px;
  }

  @media (max-width: 900px) {
    .reader-control-dock {
      padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));
    }

    .dock-input textarea {
      min-height: 64px;
    }

    .choice-copy {
      gap: 6px;
      flex-wrap: wrap;
    }
  }
</style>
