<script lang="ts">
  import { buildStageCards, stageHeadline } from '$lib/story-helpers';
  import type { BuildStatus } from '$lib/types';

  export let projectName = '';
  export let buildStatus: BuildStatus;

  $: cards = buildStageCards(buildStatus);
</script>

<section class="build-shell">
  <div class="intro">
    <p class="eyebrow">Build</p>
    <h2>{stageHeadline(buildStatus.stage)}</h2>
    <p>{projectName} 正在被整理成一个可审阅、可游玩的互动故事项目。</p>
  </div>

  <div class="meter">
    <div class="meter-fill" style={`width: ${Math.max(buildStatus.progress, 8)}%`}></div>
  </div>
  <p class="meter-text">{buildStatus.progress}% · {buildStatus.message}</p>

  <ol class="stage-list">
    {#each cards as card}
      <li class:done={card.status === 'done'} class:current={card.status === 'current'} class:error={card.status === 'error'}>
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
      </li>
    {/each}
  </ol>
</section>

<style>
  .build-shell {
    display: grid;
    gap: 24px;
    width: min(920px, 100%);
    margin: 0 auto;
    padding: 38px;
    border-radius: 30px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(248, 243, 234, 0.95);
    box-shadow: 0 18px 42px rgba(65, 49, 35, 0.08);
  }

  .eyebrow {
    margin: 0 0 12px;
    color: #91765d;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.72rem;
  }

  h2 {
    margin: 0 0 12px;
    color: #2f261d;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2rem, 4vw, 3rem);
  }

  .intro p:last-child,
  .meter-text {
    margin: 0;
    color: rgba(63, 47, 35, 0.7);
  }

  .meter {
    position: relative;
    min-height: 14px;
    border-radius: 999px;
    background: rgba(121, 103, 81, 0.12);
    overflow: hidden;
  }

  .meter-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: linear-gradient(90deg, #1f6a57 0%, #3b8f78 100%);
    box-shadow: 0 0 18px rgba(59, 143, 120, 0.2);
    animation: pulse 1.8s ease-in-out infinite;
  }

  .stage-list {
    display: grid;
    gap: 14px;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    padding: 18px 20px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid rgba(121, 103, 81, 0.12);
  }

  li.done {
    border-color: rgba(31, 106, 87, 0.22);
  }

  li.current {
    background: rgba(31, 106, 87, 0.1);
    border-color: rgba(31, 106, 87, 0.28);
  }

  li.error {
    border-color: rgba(177, 77, 59, 0.28);
  }

  li span {
    font-size: 1rem;
    color: #2f261d;
  }

  li strong {
    color: #1f6a57;
    font-size: 0.85rem;
  }

  @keyframes pulse {
    0%,
    100% {
      filter: saturate(1);
    }
    50% {
      filter: saturate(1.08);
    }
  }
</style>
