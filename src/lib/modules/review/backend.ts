import { invokeCommand } from '$lib/backend/commandClient';
import type {
  ActiveLoreEntry,
  CharacterCard,
  ReviewPreviewContext,
  ReviewPreviewSnapshot,
  RuleDefinition,
  RuleEvaluationResult,
  WorldBookEntry
} from '$lib/types';

export const updateCharacterCard = (
  projectId: string,
  card: CharacterCard
): Promise<CharacterCard[]> => invokeCommand('update_character_card', { projectId, card });

export const upsertWorldBookEntry = (
  projectId: string,
  entry: WorldBookEntry
): Promise<WorldBookEntry[]> => invokeCommand('upsert_worldbook_entry', { projectId, entry });

export const deleteWorldBookEntry = (
  projectId: string,
  entryId: string
): Promise<WorldBookEntry[]> => invokeCommand('delete_worldbook_entry', { projectId, entryId });

export const upsertRule = (projectId: string, rule: RuleDefinition): Promise<RuleDefinition[]> =>
  invokeCommand('upsert_rule', { projectId, rule });

export const deleteRule = (projectId: string, ruleId: string): Promise<RuleDefinition[]> =>
  invokeCommand('delete_rule', { projectId, ruleId });

export const previewActiveWorldbook = (
  projectId: string,
  sceneId: string,
  lastFreeInput?: string
): Promise<ActiveLoreEntry[]> =>
  invokeCommand('preview_active_worldbook', {
    projectId,
    sceneId,
    lastFreeInput
  });

export const previewRuleEvaluation = (
  projectId: string,
  sceneId: string,
  eventKind: string,
  actorCharacterId?: string,
  targetCharacterId?: string,
  inputText?: string
): Promise<RuleEvaluationResult> =>
  invokeCommand('preview_rule_evaluation', {
    projectId,
    sceneId,
    eventKind,
    actorCharacterId,
    targetCharacterId,
    inputText
  });

export const previewReviewSnapshot = (
  projectId: string,
  context: ReviewPreviewContext
): Promise<ReviewPreviewSnapshot> =>
  invokeCommand('preview_review_snapshot', {
    projectId,
    context
  });

export const saveReviewPreviewContext = (
  projectId: string,
  context: ReviewPreviewContext
): Promise<ReviewPreviewContext> =>
  invokeCommand('save_review_preview_context', {
    projectId,
    context
  });
