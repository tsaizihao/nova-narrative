<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let projectName = '';
  export let novelText = '';
  export let busy = false;
  export let error = '';

  const dispatch = createEventDispatcher<{
    submit: void;
    sample: void;
    updateProjectName: string;
    updateNovelText: string;
  }>();
</script>

<section class="hero">
  <div class="copy">
    <p class="eyebrow">Desktop Story Foundry</p>
    <h1>把一本小说唤醒成可参与的视觉故事</h1>
    <p class="lede">
      导入中文纯文本后，系统会自动抽取人物、时间、地点、规则和冲突，把它编译成一个可以重玩的互动视觉小说。
    </p>
    <div class="feature-grid">
      <article>
        <span>01</span>
        <strong>结构化解析</strong>
        <p>人物、规则、地点与时间线会被整理成 Story Bible。</p>
      </article>
      <article>
        <span>02</span>
        <strong>半结构化分支</strong>
        <p>关键节点稳定，局部演出与自由输入由 AI 驱动。</p>
      </article>
      <article>
        <span>03</span>
        <strong>可回溯结局</strong>
        <p>每一次抉择都进入侧栏记录，你可以从关键节点重写命运。</p>
      </article>
    </div>
  </div>

  <div class="composer">
    <div class="section-head">
      <div>
        <p class="label">新项目</p>
        <h2>导入小说文本</h2>
      </div>
      <button type="button" class="ghost" on:click={() => dispatch('sample')} disabled={busy}>
        载入示例
      </button>
    </div>

    <label>
      <span>项目名称</span>
      <input
        value={projectName}
        on:input={(event) => dispatch('updateProjectName', event.currentTarget.value)}
        placeholder="例如：临川夜话"
        disabled={busy}
      />
    </label>

    <label>
      <span>小说正文</span>
      <textarea
        value={novelText}
        on:input={(event) => dispatch('updateNovelText', event.currentTarget.value)}
        placeholder="粘贴 txt 或 markdown 纯文本内容"
        disabled={busy}
      ></textarea>
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button
      type="button"
      class="primary"
      on:click={() => dispatch('submit')}
      disabled={busy || !projectName.trim() || !novelText.trim()}
    >
      {busy ? '故事准备中...' : '开始解析与改编'}
    </button>
  </div>
</section>

<style>
  .hero {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 28px;
  }

  .copy,
  .composer {
    border-radius: 30px;
    border: 1px solid rgba(255, 243, 214, 0.11);
    background: rgba(14, 11, 9, 0.72);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
  }

  .copy {
    padding: 42px;
  }

  .composer {
    padding: 32px;
    display: grid;
    gap: 16px;
  }

  .eyebrow,
  .label {
    margin: 0 0 12px;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.72rem;
  }

  h1,
  h2 {
    margin: 0;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
  }

  h1 {
    font-size: clamp(2.4rem, 4.2vw, 4.4rem);
    line-height: 1.02;
  }

  h2 {
    font-size: 1.8rem;
  }

  .lede {
    margin: 18px 0 0;
    max-width: 62ch;
    font-size: 1.02rem;
    line-height: 1.85;
    color: rgba(253, 245, 228, 0.8);
  }

  .feature-grid {
    margin-top: 28px;
    display: grid;
    gap: 14px;
  }

  .feature-grid article {
    padding: 18px 20px;
    border-radius: 18px;
    background: linear-gradient(145deg, rgba(80, 49, 34, 0.58), rgba(29, 22, 18, 0.68));
    border: 1px solid rgba(255, 232, 191, 0.08);
  }

  .feature-grid span {
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.4rem;
    color: #efc97f;
  }

  .feature-grid strong,
  .feature-grid p {
    display: block;
    margin-top: 6px;
  }

  .feature-grid p {
    margin-bottom: 0;
    line-height: 1.7;
    color: rgba(255, 245, 228, 0.72);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  label {
    display: grid;
    gap: 10px;
  }

  label span {
    font-size: 0.82rem;
    color: rgba(244, 226, 193, 0.82);
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid rgba(255, 238, 207, 0.12);
    border-radius: 18px;
    background: rgba(24, 18, 14, 0.92);
    color: #fff4dd;
    font: inherit;
    padding: 14px 16px;
    resize: none;
  }

  input {
    min-height: 52px;
  }

  textarea {
    min-height: 320px;
    line-height: 1.72;
  }

  .primary,
  .ghost {
    border: none;
    border-radius: 999px;
    font: inherit;
    cursor: pointer;
    transition:
      transform 160ms ease,
      opacity 160ms ease,
      background 160ms ease;
  }

  .primary {
    min-height: 54px;
    background: linear-gradient(135deg, #d8a34e, #f3d89e);
    color: #26180f;
    font-weight: 700;
  }

  .ghost {
    padding: 11px 18px;
    background: rgba(255, 244, 219, 0.08);
    color: #f7e5bf;
  }

  .primary:hover,
  .ghost:hover {
    transform: translateY(-1px);
  }

  .error {
    margin: 0;
    color: #ffb2a6;
  }

  @media (max-width: 980px) {
    .hero {
      grid-template-columns: 1fr;
    }

    .copy,
    .composer {
      padding: 26px;
    }
  }
</style>

