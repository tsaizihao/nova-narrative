<script lang="ts">
  import type { AdaptationKernelSnapshot } from '$lib/types';

  export let kernel: AdaptationKernelSnapshot | null = null;
</script>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">Canon</p>
      <p class="panel-title">原著内核</p>
    </div>
    <p class="count">{kernel ? `${kernel.canon_characters.length} 位核心人物` : '只读视图'}</p>
  </div>

  {#if kernel}
    <article class="card">
      <h4>源小说</h4>
      <p>
        <strong>{kernel.source_novel.title}</strong>
        · {kernel.source_novel.chapter_count} 章
      </p>
      {#if kernel.source_novel.chapters.length}
        <ul>
          {#each kernel.source_novel.chapters as chapter}
            <li>{chapter.title}：{chapter.excerpt}</li>
          {/each}
        </ul>
      {/if}
    </article>

    <article class="card">
      <h4>人物性格锚点</h4>
      {#if kernel.canon_characters.length}
        <ul>
          {#each kernel.canon_characters as character}
            <li>
              <strong>{character.name}</strong>
              · {character.protected_identity} · {character.protected_role}
              <div class="meta">
                {#if character.anchor_traits.length}
                  <span>{character.anchor_traits.join(' / ')}</span>
                {/if}
                <span>{character.summary}</span>
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">暂无人物锚点。</p>
      {/if}
    </article>

    <article class="card">
      <h4>关系图</h4>
      {#if kernel.relationship_graph.length}
        <ul>
          {#each kernel.relationship_graph as edge}
            <li>{edge.source} → {edge.target} · {edge.label}（强度 {edge.strength}）</li>
          {/each}
        </ul>
      {:else}
        <p class="empty">暂无关系锚点。</p>
      {/if}
    </article>

    <article class="card">
      <h4>事件锚点</h4>
      {#if kernel.event_graph.length}
        <ul>
          {#each kernel.event_graph as event}
            <li>{event.title} · {event.locked ? '锁定' : '可变更'} · {event.summary}</li>
          {/each}
        </ul>
      {:else}
        <p class="empty">暂无事件锚点。</p>
      {/if}
    </article>

    <article class="card">
      <h4>世界规则</h4>
      {#if kernel.world_rules.length}
        <ul>
          {#each kernel.world_rules as rule}
            <li>{rule.description}</li>
          {/each}
        </ul>
      {:else}
        <p class="empty">暂无世界规则。</p>
      {/if}
    </article>

    <article class="card">
      <h4>改编约束</h4>
      <ul>
        <li><strong>保留人物核心</strong>：{kernel.constraints.preserve_character_core ? '是' : '否'}</li>
        <li><strong>允许关系重构</strong>：{kernel.constraints.allow_relationship_rewire ? '是' : '否'}</li>
        <li><strong>允许玩家插入</strong>：{kernel.constraints.allow_player_insert ? '是' : '否'}</li>
      </ul>
    </article>
  {:else}
    <p class="empty">尚未生成原著内核快照。</p>
  {/if}
</section>

<style>
  .panel {
    display: grid;
    gap: 12px;
    padding: 20px;
    border-radius: 20px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    background: rgba(248, 243, 234, 0.9);
    box-shadow: 0 10px 22px rgba(65, 49, 35, 0.05);
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .eyebrow {
    margin: 0 0 6px;
    color: rgba(63, 47, 35, 0.52);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.64rem;
  }

  .panel-title,
  h4,
  p,
  ul {
    margin: 0;
  }

  .panel-title {
    color: #2f261d;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.32rem;
  }

  .count {
    color: rgba(63, 47, 35, 0.58);
    font-size: 0.8rem;
    padding-top: 4px;
  }

  .card {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    background: rgba(255, 255, 255, 0.8);
  }

  h4 {
    color: #2f261d;
    font-size: 0.92rem;
  }

  p,
  li {
    color: rgba(63, 47, 35, 0.84);
    font-size: 0.84rem;
    line-height: 1.5;
  }

  ul {
    padding-left: 18px;
    display: grid;
    gap: 6px;
  }

  .meta {
    display: grid;
    gap: 2px;
    color: rgba(63, 47, 35, 0.66);
    font-size: 0.8rem;
  }

  .empty {
    color: rgba(63, 47, 35, 0.58);
    font-size: 0.84rem;
  }
</style>
