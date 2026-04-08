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

    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
</section>

<style>
  .stage {
    display: grid;
    gap: 18px;
    padding: 24px;
    border-radius: 30px;
    border: 1px solid rgba(255, 243, 214, 0.08);
    background:
      linear-gradient(180deg, rgba(10, 10, 14, 0.42), rgba(10, 10, 14, 0.82)),
      radial-gradient(circle at top, rgba(227, 196, 129, 0.14), transparent 35%),
      rgba(10, 10, 14, 0.92);
    box-shadow: 0 22px 48px rgba(0, 0, 0, 0.26);
  }

  .stage.warning {
    background:
      linear-gradient(180deg, rgba(10, 10, 14, 0.46), rgba(10, 10, 14, 0.86)),
      radial-gradient(circle at top, rgba(213, 140, 52, 0.18), transparent 35%),
      rgba(10, 10, 14, 0.92);
  }

  .stage.reveal {
    background:
      linear-gradient(180deg, rgba(10, 10, 14, 0.4), rgba(10, 10, 14, 0.84)),
      radial-gradient(circle at top, rgba(210, 184, 132, 0.2), transparent 38%),
      rgba(10, 10, 14, 0.92);
  }

  .stage-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.68rem;
  }

  h2 {
    margin: 0;
    max-width: 12ch;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2.2rem, 4vw, 3.4rem);
    color: #fff4dd;
  }

  .tool-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .tool-pills span {
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255, 248, 230, 0.06);
    color: rgba(255, 243, 214, 0.74);
    font-size: 0.8rem;
  }

  .story-surface {
    display: grid;
    gap: 16px;
    padding: 24px;
    border-radius: 26px;
    background:
      linear-gradient(180deg, rgba(19, 18, 21, 0.7), rgba(19, 18, 21, 0.88)),
      rgba(14, 11, 9, 0.74);
    min-height: 420px;
  }

  .narration {
    display: grid;
    gap: 14px;
  }

  .narration p {
    margin: 0;
    line-height: 1.92;
    font-size: 1.04rem;
    color: rgba(255, 244, 221, 0.9);
  }

  .dialogue-strip {
    display: grid;
    gap: 12px;
  }

  .dialogue-strip article {
    padding: 16px;
    border-radius: 18px;
    background: rgba(255, 248, 230, 0.05);
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
    color: rgba(255, 244, 221, 0.84);
    line-height: 1.7;
  }

  .rule-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .rule-pills span {
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(213, 140, 52, 0.16);
    border: 1px solid rgba(213, 140, 52, 0.2);
    color: #ffdca8;
    font-size: 0.8rem;
  }

  .decision-sheet {
    display: grid;
    gap: 16px;
    padding: 18px;
    border-radius: 24px;
    background: rgba(19, 18, 21, 0.92);
    border: 1px solid rgba(255, 238, 207, 0.08);
  }

  .choices {
    display: grid;
    gap: 12px;
  }

  .choices button,
  .secondary {
    border: 1px solid rgba(255, 238, 207, 0.08);
    border-radius: 20px;
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
    border-color: rgba(240, 198, 126, 0.22);
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

  .free-input {
    display: grid;
    gap: 12px;
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

  .secondary {
    min-height: 46px;
  }

  .error {
    margin: 0;
    color: #ffb2a6;
  }

  @media (max-width: 720px) {
    .stage-header {
      display: grid;
    }

    .tool-pills {
      justify-content: flex-start;
    }
  }
</style>
