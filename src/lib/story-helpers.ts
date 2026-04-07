import type { BuildStatus, StageCard } from '$lib/types';

const ORDER: Array<{ key: StageCard['key']; label: string; threshold: number }> = [
  { key: 'imported', label: '文本导入', threshold: 20 },
  { key: 'analyzing', label: '结构解析', threshold: 45 },
  { key: 'compiling', label: '互动编译', threshold: 80 },
  { key: 'ready', label: '进入故事', threshold: 100 }
];

export function buildStageCards(buildStatus: BuildStatus): StageCard[] {
  if (buildStatus.stage === 'failed') {
    return [
      ...ORDER.filter((stage) => buildStatus.progress >= stage.threshold).map(
        (stage): StageCard => ({
          key: stage.key,
          label: stage.label,
          status: 'done'
        })
      ),
      {
        key: 'failed',
        label: '生成失败',
        status: 'error'
      }
    ];
  }

  const currentIndex = ORDER.findIndex((stage) => stage.key === buildStatus.stage);
  const fallbackIndex = ORDER.findIndex((stage) => buildStatus.progress <= stage.threshold);
  const activeIndex = currentIndex >= 0 ? currentIndex : Math.max(fallbackIndex, 0);

  return ORDER.map(
    (stage, index): StageCard => ({
      key: stage.key,
      label: stage.label,
      status: index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'upcoming'
    })
  );
}

export function stageHeadline(stage: BuildStatus['stage']): string {
  return (
    {
      created: '等待新的故事',
      imported: '文本已导入',
      analyzing: 'AI 正在解析世界设定',
      compiling: 'AI 正在编译互动场景',
      ready: '故事已经苏醒',
      failed: '生成中断'
    }[stage] ?? '故事处理中'
  );
}

export function sceneEmotionTint(sceneTitle: string): string {
  if (sceneTitle.includes('门') || sceneTitle.includes('雾')) {
    return 'warning';
  }
  if (sceneTitle.includes('真相') || sceneTitle.includes('散')) {
    return 'reveal';
  }
  return 'calm';
}
