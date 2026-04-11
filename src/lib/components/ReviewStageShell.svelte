<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import PhaseStepper from '$lib/components/PhaseStepper.svelte';
  import ReviewWorkspace from '$lib/components/ReviewWorkspace.svelte';
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
  export let busy = false;

  const dispatch = createEventDispatcher<{
    enterStory: void;
    saveCharacter: CharacterCard;
    saveWorldBook: WorldBookEntry;
    deleteWorldBook: string;
    saveRule: RuleDefinition;
    deleteRule: string;
  }>();

  const phaseLabels = ['导入', '构建', '审阅', '游玩'];
</script>

<div class="review-stage-shell" data-testid="review-stage-shell">
  <header class="review-stage-topbar">
    <div class="topbar-copy">
      <p class="eyebrow">审阅</p>
      <strong>{project.name}</strong>
    </div>
    <PhaseStepper phase="review" labels={phaseLabels} />
  </header>

  <section class="review-stage-strip" data-testid="review-stage-strip">
    <div class="strip-copy">
      <p class="eyebrow">Review</p>
      <h2>先校正世界模型，再进入故事</h2>
      <p>
        这一轮可以轻量修改角色卡、世界书和规则。右侧预览会直接反映这些结构化结果如何影响
        lore 激活和规则判断。
      </p>
    </div>
    <button type="button" on:click={() => dispatch('enterStory')} disabled={busy}>
      进入互动故事
    </button>
  </section>

  <ReviewWorkspace
    {project}
    {lorePreview}
    {rulePreview}
    {error}
    on:saveCharacter={(event) => dispatch('saveCharacter', event.detail)}
    on:saveWorldBook={(event) => dispatch('saveWorldBook', event.detail)}
    on:deleteWorldBook={(event) => dispatch('deleteWorldBook', event.detail)}
    on:saveRule={(event) => dispatch('saveRule', event.detail)}
    on:deleteRule={(event) => dispatch('deleteRule', event.detail)}
  />
</div>

<style>
  .review-stage-shell {
    display: grid;
    gap: 16px;
    width: min(1440px, 100%);
    margin: 0 auto;
  }

  .review-stage-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-radius: 24px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(250, 246, 239, 0.86);
    box-shadow: 0 16px 36px rgba(70, 54, 39, 0.08);
  }

  .topbar-copy strong {
    display: block;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.35rem;
  }

  .review-stage-strip {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(248, 243, 234, 0.94);
    box-shadow: 0 14px 28px rgba(65, 49, 35, 0.06);
  }

  .strip-copy h2 {
    margin: 0;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2rem, 4vw, 3rem);
    color: #2f261d;
  }

  .strip-copy p {
    margin: 12px 0 0;
    max-width: 640px;
    line-height: 1.7;
    color: rgba(63, 47, 35, 0.74);
  }

  .review-stage-strip button {
    min-width: 180px;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    border: none;
    background: #1f6a57;
    color: #f6f3eb;
    cursor: pointer;
  }

  .eyebrow {
    margin: 0;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.68rem;
  }

  @media (max-width: 900px) {
    .review-stage-strip {
      flex-direction: column;
      align-items: stretch;
    }

    .review-stage-strip button {
      align-self: flex-start;
    }
  }
</style>
