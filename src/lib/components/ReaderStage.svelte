<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { sceneEmotionTint } from '$lib/story-helpers';
  import type { ScenePayload } from '$lib/types';

  export let payload: ScenePayload;
  export let busy = false;
  export let error = '';
  export let freeInput = '';

  const dispatch = createEventDispatcher<{
    choose: string;
    freeInputChange: string;
    submitFreeInput: void;
  }>();

  $: tint = sceneEmotionTint(payload.scene.title);
</script>

<section class={`stage ${tint}`}>
  <div class="back-panel">
    <div>
      <p class="eyebrow">Chapter {payload.scene.chapter}</p>
      <h2>{payload.scene.title}</h2>
    </div>
    <div class="status-pills">
      <span>{payload.session.visited_scenes.length} 个场景</span>
      <span>{payload.session.major_choices.length} 次选择</span>
    </div>
  </div>

  <div class="narration">
    {#each payload.scene.narration as paragraph}
      <p>{paragraph}</p>
    {/each}
  </div>

  {#if payload.active_rules.length}
    <div class="rule-strip">
      {#each payload.active_rules as rule}
        <p>{rule.explanation}</p>
      {/each}
    </div>
  {/if}

  {#if payload.scene.dialogue.length}
    <div class="dialogue-strip">
      {#each payload.scene.dialogue as line}
        <article>
          <strong>{line.speaker}</strong>
          <span>{line.emotion}</span>
          <p>{line.text}</p>
        </article>
      {/each}
    </div>
  {/if}

  {#if payload.scene.allow_free_input}
    <div class="free-input">
      <label>
        <span>自由行动</span>
        <textarea
          value={freeInput}
          on:input={(event) => dispatch('freeInputChange', event.currentTarget.value)}
          placeholder="例如：我决定暂时隐瞒真相，先稳住对方。"
          maxlength="120"
          disabled={busy}
        ></textarea>
      </label>
      <button
        type="button"
        class="secondary"
        on:click={() => dispatch('submitFreeInput')}
        disabled={busy || !freeInput.trim()}
      >
        把这句话写进故事
      </button>
    </div>
  {/if}

  <div class="choices">
    {#each payload.scene.candidate_choices as choice}
      <button
        type="button"
        class:locked={choice.unlock_conditions.length > 0 && !choice.unlock_conditions.every((condition) => payload.session.rule_flags.includes(condition))}
        on:click={() => dispatch('choose', choice.id)}
        disabled={busy}
      >
        <strong>{choice.label}</strong>
        <span>
          {#if choice.unlock_conditions.length}
            需要条件：{choice.unlock_conditions.join(' / ')}
          {:else}
            {choice.intent_tag}
          {/if}
        </span>
      </button>
    {/each}
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}
</section>

<style>
  .stage {
    display: grid;
    gap: 18px;
    padding: 28px;
    border-radius: 28px;
    border: 1px solid rgba(255, 243, 214, 0.1);
    background:
      radial-gradient(circle at top left, rgba(245, 220, 171, 0.08), transparent 34%),
      rgba(14, 11, 9, 0.82);
  }

  .stage.warning {
    background:
      radial-gradient(circle at top left, rgba(218, 149, 58, 0.13), transparent 34%),
      rgba(14, 11, 9, 0.82);
  }

  .stage.reveal {
    background:
      radial-gradient(circle at top left, rgba(231, 209, 161, 0.16), transparent 34%),
      rgba(14, 11, 9, 0.82);
  }

  .back-panel {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.68rem;
  }

  h2 {
    margin: 0;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2rem, 4vw, 3.2rem);
  }

  .status-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .status-pills span {
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255, 248, 230, 0.05);
    color: rgba(255, 243, 214, 0.74);
    font-size: 0.82rem;
  }

  .narration {
    display: grid;
    gap: 14px;
    padding: 20px;
    border-radius: 22px;
    background: rgba(27, 20, 16, 0.82);
  }

  .narration p {
    margin: 0;
    line-height: 1.9;
    font-size: 1.03rem;
    color: rgba(255, 244, 221, 0.88);
  }

  .dialogue-strip {
    display: grid;
    gap: 12px;
  }

  .rule-strip {
    display: grid;
    gap: 10px;
    padding: 16px 18px;
    border-radius: 20px;
    border: 1px solid rgba(255, 212, 156, 0.12);
    background: rgba(62, 35, 23, 0.66);
  }

  .rule-strip p {
    margin: 0;
    color: #ffdca8;
    line-height: 1.6;
  }

  .dialogue-strip article {
    padding: 18px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(79, 48, 32, 0.72), rgba(26, 19, 15, 0.9));
    border: 1px solid rgba(255, 238, 207, 0.08);
  }

  .dialogue-strip strong,
  .dialogue-strip span,
  .dialogue-strip p {
    display: block;
  }

  .dialogue-strip span {
    margin-top: 4px;
    color: #efc97f;
    font-size: 0.82rem;
  }

  .dialogue-strip p {
    margin: 10px 0 0;
    line-height: 1.7;
  }

  .free-input {
    display: grid;
    gap: 12px;
    padding: 18px;
    border-radius: 22px;
    border: 1px solid rgba(255, 238, 207, 0.08);
    background: rgba(23, 17, 13, 0.84);
  }

  label {
    display: grid;
    gap: 8px;
  }

  label span {
    font-size: 0.82rem;
    color: rgba(255, 243, 214, 0.78);
  }

  textarea {
    min-height: 94px;
    border-radius: 18px;
    border: 1px solid rgba(255, 238, 207, 0.1);
    background: rgba(15, 11, 9, 0.92);
    color: #fff4dd;
    font: inherit;
    padding: 14px 16px;
    resize: vertical;
  }

  .choices {
    display: grid;
    gap: 12px;
  }

  .choices button,
  .secondary {
    border: 1px solid rgba(255, 238, 207, 0.08);
    border-radius: 22px;
    background: rgba(255, 248, 230, 0.04);
    color: #fff4dd;
    font: inherit;
    cursor: pointer;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  .choices button {
    text-align: left;
    padding: 16px 18px;
  }

  .choices button:hover,
  .secondary:hover {
    transform: translateY(-1px);
    border-color: rgba(240, 198, 126, 0.24);
    background: rgba(255, 248, 230, 0.08);
  }

  .choices button strong,
  .choices button span {
    display: block;
  }

  .choices button span {
    margin-top: 6px;
    color: rgba(255, 243, 214, 0.6);
    font-size: 0.82rem;
  }

  .choices button.locked {
    border-color: rgba(212, 116, 91, 0.26);
  }

  .secondary {
    min-height: 46px;
  }

  .error {
    margin: 0;
    color: #ffb2a6;
  }
</style>
