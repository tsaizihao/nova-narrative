use crate::{
    app_api::input_validation::{require_project_id, require_scene_id, require_event_kind},
    error::AppResult,
    models::{CharacterCard, ReviewPreviewContext, ReviewPreviewSnapshot},
    rules::RuleDefinition,
    runtime::RuleEvaluationResult,
    store::ProjectStore,
    worldbook::{ActiveLoreEntry, WorldBookEntry},
};

pub struct ReviewService;

impl ReviewService {
    pub fn update_character_card(
        store: &mut ProjectStore,
        project_id: &str,
        card: CharacterCard,
    ) -> AppResult<Vec<CharacterCard>> {
        let project_id = require_project_id(project_id)?;
        store.update_character_card(project_id, card)
    }

    pub fn upsert_worldbook_entry(
        store: &mut ProjectStore,
        project_id: &str,
        entry: WorldBookEntry,
    ) -> AppResult<Vec<WorldBookEntry>> {
        let project_id = require_project_id(project_id)?;
        store.upsert_worldbook_entry(project_id, entry)
    }

    pub fn delete_worldbook_entry(
        store: &mut ProjectStore,
        project_id: &str,
        entry_id: &str,
    ) -> AppResult<Vec<WorldBookEntry>> {
        let project_id = require_project_id(project_id)?;
        store.delete_worldbook_entry(project_id, entry_id)
    }

    pub fn upsert_rule(
        store: &mut ProjectStore,
        project_id: &str,
        rule: RuleDefinition,
    ) -> AppResult<Vec<RuleDefinition>> {
        let project_id = require_project_id(project_id)?;
        store.upsert_rule(project_id, rule)
    }

    pub fn delete_rule(
        store: &mut ProjectStore,
        project_id: &str,
        rule_id: &str,
    ) -> AppResult<Vec<RuleDefinition>> {
        let project_id = require_project_id(project_id)?;
        store.delete_rule(project_id, rule_id)
    }

    pub fn preview_active_worldbook(
        store: &mut ProjectStore,
        project_id: &str,
        scene_id: &str,
        last_free_input: Option<&str>,
    ) -> AppResult<Vec<ActiveLoreEntry>> {
        let project_id = require_project_id(project_id)?;
        let scene_id = require_scene_id(scene_id)?;
        store.preview_active_worldbook(project_id, scene_id, last_free_input)
    }

    pub fn preview_rule_evaluation(
        store: &mut ProjectStore,
        project_id: &str,
        scene_id: &str,
        event_kind: &str,
        actor_character_id: Option<&str>,
        target_character_id: Option<&str>,
        input_text: Option<&str>,
    ) -> AppResult<RuleEvaluationResult> {
        let project_id = require_project_id(project_id)?;
        let scene_id = require_scene_id(scene_id)?;
        let event_kind = require_event_kind(event_kind)?;
        store.preview_rule_evaluation(
            project_id,
            scene_id,
            event_kind,
            actor_character_id,
            target_character_id,
            input_text,
        )
    }

    pub fn preview_review_snapshot(
        store: &mut ProjectStore,
        project_id: &str,
        context: ReviewPreviewContext,
    ) -> AppResult<ReviewPreviewSnapshot> {
        let project_id = require_project_id(project_id)?;
        require_scene_id(&context.scene_id)?;
        require_event_kind(&context.event_kind)?;
        store.preview_review_snapshot(project_id, context)
    }

    pub fn save_review_preview_context(
        store: &mut ProjectStore,
        project_id: &str,
        context: ReviewPreviewContext,
    ) -> AppResult<ReviewPreviewContext> {
        let project_id = require_project_id(project_id)?;
        require_scene_id(&context.scene_id)?;
        require_event_kind(&context.event_kind)?;
        store.save_review_preview_context(project_id, context)
    }
}
