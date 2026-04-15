use tauri::State;

use crate::{
    StoreState,
    application::RuntimeService,
    commands::shared::{CommandResult, with_store},
    models::{EndingReport, RuntimeSnapshot, ScenePayload, SessionState, StoryCodex},
};

#[tauri::command]
pub fn start_session(
    state: State<'_, StoreState>,
    project_id: String,
) -> CommandResult<SessionState> {
    with_store(state, move |store| RuntimeService::start_session(store, &project_id))
}

#[tauri::command]
pub fn find_project_session(
    state: State<'_, StoreState>,
    project_id: String,
) -> CommandResult<Option<SessionState>> {
    with_store(state, move |store| RuntimeService::find_project_session(store, &project_id))
}

#[tauri::command]
pub fn get_current_scene(
    state: State<'_, StoreState>,
    session_id: String,
) -> CommandResult<ScenePayload> {
    with_store(state, move |store| RuntimeService::get_current_scene(store, &session_id))
}

#[tauri::command]
pub fn get_runtime_snapshot(
    state: State<'_, StoreState>,
    session_id: String,
) -> CommandResult<RuntimeSnapshot> {
    with_store(state, move |store| RuntimeService::get_runtime_snapshot(store, &session_id))
}

#[tauri::command]
pub fn submit_choice(
    state: State<'_, StoreState>,
    session_id: String,
    choice_id: String,
) -> CommandResult<ScenePayload> {
    with_store(state, move |store| RuntimeService::submit_choice(store, &session_id, &choice_id))
}

#[tauri::command]
pub fn submit_free_input(
    state: State<'_, StoreState>,
    session_id: String,
    text: String,
) -> CommandResult<ScenePayload> {
    with_store(state, move |store| RuntimeService::submit_free_input(store, &session_id, &text))
}

#[tauri::command]
pub fn get_story_codex(
    state: State<'_, StoreState>,
    session_id: String,
) -> CommandResult<StoryCodex> {
    with_store(state, move |store| RuntimeService::get_story_codex(store, &session_id))
}

#[tauri::command]
pub fn rewind_to_checkpoint(
    state: State<'_, StoreState>,
    session_id: String,
    checkpoint_id: String,
) -> CommandResult<ScenePayload> {
    with_store(state, move |store| {
        RuntimeService::rewind_to_checkpoint(store, &session_id, &checkpoint_id)
    })
}

#[tauri::command]
pub fn finish_session(
    state: State<'_, StoreState>,
    session_id: String,
) -> CommandResult<Option<EndingReport>> {
    with_store(state, move |store| RuntimeService::finish_session(store, &session_id))
}
