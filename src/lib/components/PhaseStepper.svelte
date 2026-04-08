<script lang="ts">
  type Phase = 'import' | 'building' | 'review' | 'reader';

  export let phase: Phase;
  export let labels: string[] = [];

  const order: Phase[] = ['import', 'building', 'review', 'reader'];
  $: activeIndex = order.indexOf(phase);
</script>

<ol class="stepper">
  {#each labels as label, index}
    <li
      data-state={index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'upcoming'}
    >
      <span>{index + 1}</span>
      <strong>{label}</strong>
    </li>
  {/each}
</ol>

<style>
  .stepper {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 42px;
    padding: 0 14px 0 10px;
    border-radius: 999px;
    background: rgba(98, 82, 61, 0.08);
    color: #6b5c4a;
  }

  li span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: rgba(98, 82, 61, 0.12);
    font-size: 0.78rem;
    font-weight: 700;
  }

  li strong {
    font-size: 0.9rem;
  }

  li[data-state='current'] {
    background: #1f6a57;
    color: #f6f3eb;
  }

  li[data-state='current'] span {
    background: rgba(246, 243, 235, 0.2);
  }

  li[data-state='done'] {
    background: rgba(31, 106, 87, 0.14);
    color: #1f6a57;
  }

  li[data-state='upcoming'] {
    color: rgba(107, 92, 74, 0.76);
  }
</style>
