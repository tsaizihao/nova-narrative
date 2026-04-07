<script lang="ts">
  import { buildStageCards, stageHeadline } from '$lib/story-helpers';
  import type { BuildStatus } from '$lib/types';

  export let projectName = '';
  export let buildStatus: BuildStatus;

  $: cards = buildStageCards(buildStatus);
</script>

<section class="build-shell">
  <div class="intro">
    <p class="eyebrow">Compiling Story Package</p>
    <h2>{stageHeadline(buildStatus.stage)}</h2>
    <p>{projectName} 正在被拆解成可互动的世界模型、场景图和结局骨架。</p>
  </div>

  <div class="meter">
    <div class="meter-fill" style={`width: ${Math.max(buildStatus.progress, 8)}%`}></div>
  </div>
  <p class="meter-text">{buildStatus.progress}% · {buildStatus.message}</p>

  <div class="stages">
    {#each cards as card}
      <article class:done={card.status === 'done'} class:current={card.status === 'current'} class:error={card.status === 'error'}>
        <span>{card.label}</span>
        <strong>
          {#if card.status === 'done'}
            已完成
          {:else if card.status === 'current'}
            进行中
          {:else if card.status === 'error'}
            失败
          {:else}
            等待中
          {/if}
        </strong>
      </article>
    {/each}
  </div>
</section>

<style>
  .build-shell {
    display: grid;
    gap: 24px;
    padding: 38px;
    border-radius: 30px;
    border: 1px solid rgba(255, 243, 214, 0.11);
    background: rgba(14, 11, 9, 0.78);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
  }

  .eyebrow {
    margin: 0 0 12px;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.72rem;
  }

  h2 {
    margin: 0 0 12px;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2rem, 4vw, 3rem);
  }

  .intro p:last-child,
  .meter-text {
    margin: 0;
    color: rgba(255, 243, 214, 0.74);
  }

  .meter {
    position: relative;
    min-height: 12px;
    border-radius: 999px;
    background: rgba(255, 241, 210, 0.08);
    overflow: hidden;
  }

  .meter-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: linear-gradient(90deg, #c57a37 0%, #f0c67e 50%, #f6e6bb 100%);
    box-shadow: 0 0 28px rgba(240, 198, 126, 0.4);
    animation: pulse 1.8s ease-in-out infinite;
  }

  .stages {
    display: grid;
    gap: 14px;
  }

  article {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    padding: 18px 20px;
    border-radius: 18px;
    background: rgba(27, 20, 16, 0.88);
    border: 1px solid rgba(255, 238, 207, 0.08);
  }

  article.done {
    border-color: rgba(212, 183, 118, 0.25);
  }

  article.current {
    background: linear-gradient(135deg, rgba(87, 51, 28, 0.76), rgba(28, 20, 15, 0.92));
    border-color: rgba(240, 198, 126, 0.3);
  }

  article.error {
    border-color: rgba(255, 161, 143, 0.28);
  }

  article span {
    font-size: 1rem;
  }

  article strong {
    color: #f0cf8d;
    font-size: 0.85rem;
  }

  @keyframes pulse {
    0%,
    100% {
      filter: saturate(1);
    }
    50% {
      filter: saturate(1.2);
    }
  }
</style>

