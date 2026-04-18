import type { ActiveRuleHit, DialogueLine, RuntimeSnapshot } from '$lib/types';

export interface ReaderSceneBlock {
  id: string;
  sceneId: string;
  chapter: number;
  title: string;
  summary: string;
  narration: string[];
  dialogue: DialogueLine[];
  activeRules: ActiveRuleHit[];
  visitedCount: number;
  isCurrent: boolean;
}

export interface ReaderHistoryState {
  blocks: ReaderSceneBlock[];
  currentSceneId: string | null;
}

function toSceneBlock(snapshot: RuntimeSnapshot): ReaderSceneBlock {
  const { payload } = snapshot;
  return {
    id: `${payload.scene.id}-${payload.session.visited_scenes.length}`,
    sceneId: payload.scene.id,
    chapter: payload.scene.chapter,
    title: payload.scene.title,
    summary: payload.scene.summary,
    narration: payload.scene.narration,
    dialogue: payload.scene.dialogue,
    activeRules: payload.active_rules,
    visitedCount: payload.session.visited_scenes.length,
    isCurrent: true
  };
}

function markCurrent(blocks: ReaderSceneBlock[]) {
  const currentIndex = blocks.length - 1;
  return blocks.map((block, index) => ({
    ...block,
    isCurrent: index === currentIndex
  }));
}

export function createReaderHistory(snapshot: RuntimeSnapshot): ReaderHistoryState {
  const block = toSceneBlock(snapshot);
  return {
    blocks: [block],
    currentSceneId: block.sceneId
  };
}

export function appendReaderSnapshot(
  state: ReaderHistoryState,
  snapshot: RuntimeSnapshot
): ReaderHistoryState {
  const nextBlock = toSceneBlock(snapshot);

  if (!state.blocks.length) {
    return createReaderHistory(snapshot);
  }

  if (state.currentSceneId === nextBlock.sceneId) {
    return {
      blocks: markCurrent([...state.blocks.slice(0, -1), nextBlock]),
      currentSceneId: nextBlock.sceneId
    };
  }

  return {
    blocks: markCurrent([...state.blocks, nextBlock]),
    currentSceneId: nextBlock.sceneId
  };
}

export function resetReaderHistory(snapshot: RuntimeSnapshot): ReaderHistoryState {
  return createReaderHistory(snapshot);
}
