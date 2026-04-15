use tauri::State;

use crate::{
    StoreState,
    application::ReviewService,
    commands::shared::{CommandResult, with_store},
    models::{CharacterCard, ReviewPreviewContext, ReviewPreviewSnapshot},
    rules::RuleDefinition,
    runtime::RuleEvaluationResult,
    worldbook::{ActiveLoreEntry, WorldBookEntry},
};

#[tauri::command]
pub fn update_character_card(
    state: State<'_, StoreState>,
    project_id: String,
    card: CharacterCard,
) -> CommandResult<Vec<CharacterCard>> {
    with_store(state, move |store| ReviewService::update_character_card(store, &project_id, card))
}

#[tauri::command]
pub fn upsert_worldbook_entry(
    state: State<'_, StoreState>,
    project_id: String,
    entry: WorldBookEntry,
) -> CommandResult<Vec<WorldBookEntry>> {
    with_store(state, move |store| {
        ReviewService::upsert_worldbook_entry(store, &project_id, entry)
    })
}

#[tauri::command]
pub fn delete_worldbook_entry(
    state: State<'_, StoreState>,
    project_id: String,
    entry_id: String,
) -> CommandResult<Vec<WorldBookEntry>> {
    with_store(state, move |store| {
        ReviewService::delete_worldbook_entry(store, &project_id, &entry_id)
    })
}

#[tauri::command]
pub fn upsert_rule(
    state: State<'_, StoreState>,
    project_id: String,
    rule: RuleDefinition,
) -> CommandResult<Vec<RuleDefinition>> {
    with_store(state, move |store| ReviewService::upsert_rule(store, &project_id, rule))
}

#[tauri::command]
pub fn delete_rule(
    state: State<'_, StoreState>,
    project_id: String,
    rule_id: String,
) -> CommandResult<Vec<RuleDefinition>> {
    with_store(state, move |store| ReviewService::delete_rule(store, &project_id, &rule_id))
}

#[tauri::command]
pub fn preview_active_worldbook(
    state: State<'_, StoreState>,
    project_id: String,
    scene_id: String,
    last_free_input: Option<String>,
) -> CommandResult<Vec<ActiveLoreEntry>> {
    with_store(state, move |store| {
        ReviewService::preview_active_worldbook(
            store,
            &project_id,
            &scene_id,
            last_free_input.as_deref(),
        )
    })
}

#[tauri::command]
pub fn preview_rule_evaluation(
    state: State<'_, StoreState>,
    project_id: String,
    scene_id: String,
    event_kind: String,
    actor_character_id: Option<String>,
    target_character_id: Option<String>,
    input_text: Option<String>,
) -> CommandResult<RuleEvaluationResult> {
    with_store(state, move |store| {
        ReviewService::preview_rule_evaluation(
            store,
            &project_id,
            &scene_id,
            &event_kind,
            actor_character_id.as_deref(),
            target_character_id.as_deref(),
            input_text.as_deref(),
        )
    })
}

#[tauri::command]
pub fn preview_review_snapshot(
    state: State<'_, StoreState>,
    project_id: String,
    context: ReviewPreviewContext,
) -> CommandResult<ReviewPreviewSnapshot> {
    with_store(state, move |store| {
        ReviewService::preview_review_snapshot(store, &project_id, context)
    })
}

#[tauri::command]
pub fn save_review_preview_context(
    state: State<'_, StoreState>,
    project_id: String,
    context: ReviewPreviewContext,
) -> CommandResult<ReviewPreviewContext> {
    with_store(state, move |store| {
        ReviewService::save_review_preview_context(store, &project_id, context)
    })
}
