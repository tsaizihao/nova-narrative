<script lang="ts">
  import type { ReaderSceneBlock } from '$lib/modules/runtime/reader-history';

  interface ReaderActivityItem {
    id: string;
    label: string;
    detail: string;
    tone: 'muted' | 'accent' | 'danger';
  }

  export let blocks: ReaderSceneBlock[] = [];
  export let activity: ReaderActivityItem[] = [];
</script>

<section class="reader-stage" data-flow="longform">
  <div class="paper-sheet">
    {#each blocks as block (block.id)}
      <article class="scene-block" data-current={block.isCurrent ? 'true' : 'false'}>
        <header class="scene-header">
          <p class="eyebrow">第 {block.chapter} 章</p>
          <h2>{block.title}</h2>
          {#if block.summary}
            <p class="scene-summary">{block.summary}</p>
          {/if}
        </header>

        <div class="scene-prose">
          {#each block.narration as paragraph}
            <p>{paragraph}</p>
          {/each}

          {#each block.dialogue as line}
            <p class="dialogue-line">
              <span class="speaker">{line.speaker}</span>
              {#if line.emotion}
                <span class="emotion">{line.emotion}</span>
              {/if}
              {line.text}
            </p>
          {/each}
        </div>

        {#if block.activeRules.length}
          <div class="rule-inline">
            {#each block.activeRules as rule}
              <span>{rule.name}</span>
            {/each}
          </div>
        {/if}
      </article>
    {/each}

    {#if activity.length}
      <section class="activity-feed" aria-label="最近动作结果">
        <h3 class="activity-heading">最近动作结果</h3>
        <ul class="activity-list">
          {#each activity as item (item.id)}
            <li>
              <p class={`tone-${item.tone}`}>
                <strong>{item.label}</strong>
                {item.detail}
              </p>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
</section>

<style>
  .reader-stage {
    min-width: 0;
    height: 100%;
  }

  .paper-sheet {
    display: grid;
    align-content: start;
    gap: 24px;
    min-height: 100%;
    padding: 24px clamp(18px, 3vw, 42px) 32px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    border-radius: 32px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(246, 238, 226, 0.96)),
      rgba(248, 243, 234, 0.98);
    box-shadow: 0 18px 36px rgba(70, 54, 39, 0.08);
  }

  .scene-block {
    display: grid;
    gap: 18px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(121, 103, 81, 0.12);
  }

  .scene-block:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
  }

  .scene-header {
    display: grid;
    gap: 8px;
  }

  .eyebrow {
    margin: 0;
    color: #91765d;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-size: 0.7rem;
  }

  h2,
  .scene-summary,
  .scene-prose p {
    margin: 0;
  }

  h2 {
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(1.8rem, 3vw, 2.6rem);
    color: #2f261d;
  }

  .scene-summary {
    color: rgba(63, 47, 35, 0.72);
    font-size: 0.95rem;
  }

  .scene-prose {
    display: grid;
    gap: 14px;
  }

  .scene-prose p {
    color: rgba(47, 38, 29, 0.9);
    line-height: 1.92;
    font-size: 1.04rem;
  }

  .dialogue-line .speaker {
    margin-right: 10px;
    color: #1f6a57;
    font-weight: 700;
  }

  .dialogue-line .emotion {
    margin-right: 8px;
    color: #9b6d39;
    font-size: 0.82rem;
  }

  .rule-inline,
  .activity-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .activity-feed {
    display: grid;
    gap: 10px;
  }

  .activity-heading {
    margin: 0;
    color: rgba(63, 47, 35, 0.72);
    font-size: 0.82rem;
    letter-spacing: 0.08em;
  }

  .activity-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .activity-list li {
    margin: 0;
  }

  .rule-inline span,
  .activity-feed p {
    margin: 0;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(181, 135, 78, 0.1);
    color: #9b6d39;
    font-size: 0.82rem;
  }

  .activity-feed p.tone-accent {
    background: rgba(31, 106, 87, 0.1);
    color: #1f6a57;
  }

  .activity-feed p.tone-danger {
    background: rgba(177, 77, 59, 0.12);
    color: #b14d3b;
  }
</style>
