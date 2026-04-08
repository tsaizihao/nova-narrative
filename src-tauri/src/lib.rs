mod analyzer;
mod compiler;
mod context_builder;
mod error;
mod importer;
mod models;
mod provider;
mod rules;
mod runtime;
mod state;
mod store;
mod worldbook;

use std::{fs, sync::Mutex};

use tauri::{Manager, State};

use crate::{
    error::AppResult,
    models::{
        BuildStatus, EndingReport, NovelProject, ProjectSummary, ScenePayload, SessionState,
        StoryCodex, StoryPackage,
    },
    rules::RuleDefinition,
    store::ProjectStore,
    worldbook::WorldBookEntry,
};

type StoreState = Mutex<ProjectStore>;

#[tauri::command]
fn create_project(state: State<'_, StoreState>, name: String) -> Result<NovelProject, String> {
    with_store(state, move |store| store.create_project(&name))
}

#[tauri::command]
fn import_novel_text(
    state: State<'_, StoreState>,
    project_id: String,
    content: String,
) -> Result<NovelProject, String> {
    with_store(state, move |store| store.import_novel_text(&project_id, &content))
}

#[tauri::command]
fn build_story_package(state: State<'_, StoreState>, project_id: String) -> Result<BuildStatus, String> {
    with_store(state, move |store| store.build_story_package(&project_id))
}

#[tauri::command]
fn get_build_status(state: State<'_, StoreState>, project_id: String) -> Result<BuildStatus, String> {
    with_store(state, move |store| store.get_build_status(&project_id))
}

#[tauri::command]
fn load_story_package(state: State<'_, StoreState>, project_id: String) -> Result<StoryPackage, String> {
    with_store(state, move |store| store.load_story_package(&project_id))
}

#[tauri::command]
fn list_projects(state: State<'_, StoreState>) -> Result<Vec<ProjectSummary>, String> {
    with_store(state, |store| store.list_projects())
}

#[tauri::command]
fn get_recent_project(state: State<'_, StoreState>) -> Result<Option<ProjectSummary>, String> {
    with_store(state, |store| store.get_recent_project())
}

#[tauri::command]
fn get_project(state: State<'_, StoreState>, project_id: String) -> Result<NovelProject, String> {
    with_store(state, move |store| store.get_project(&project_id))
}

#[tauri::command]
fn start_session(state: State<'_, StoreState>, project_id: String) -> Result<SessionState, String> {
    with_store(state, move |store| store.start_session(&project_id))
}

#[tauri::command]
fn get_current_scene(state: State<'_, StoreState>, session_id: String) -> Result<ScenePayload, String> {
    with_store(state, move |store| store.get_current_scene(&session_id))
}

#[tauri::command]
fn submit_choice(
    state: State<'_, StoreState>,
    session_id: String,
    choice_id: String,
) -> Result<ScenePayload, String> {
    with_store(state, move |store| store.submit_choice(&session_id, &choice_id))
}

#[tauri::command]
fn submit_free_input(
    state: State<'_, StoreState>,
    session_id: String,
    text: String,
) -> Result<ScenePayload, String> {
    with_store(state, move |store| store.submit_free_input(&session_id, &text))
}

#[tauri::command]
fn get_story_codex(state: State<'_, StoreState>, session_id: String) -> Result<StoryCodex, String> {
    with_store(state, move |store| store.get_story_codex(&session_id))
}

#[tauri::command]
fn update_character_card(
    state: State<'_, StoreState>,
    project_id: String,
    card: crate::models::CharacterCard,
) -> Result<Vec<crate::models::CharacterCard>, String> {
    with_store(state, move |store| store.update_character_card(&project_id, card))
}

#[tauri::command]
fn upsert_worldbook_entry(
    state: State<'_, StoreState>,
    project_id: String,
    entry: WorldBookEntry,
) -> Result<Vec<WorldBookEntry>, String> {
    with_store(state, move |store| store.upsert_worldbook_entry(&project_id, entry))
}

#[tauri::command]
fn delete_worldbook_entry(
    state: State<'_, StoreState>,
    project_id: String,
    entry_id: String,
) -> Result<Vec<WorldBookEntry>, String> {
    with_store(state, move |store| store.delete_worldbook_entry(&project_id, &entry_id))
}

#[tauri::command]
fn upsert_rule(
    state: State<'_, StoreState>,
    project_id: String,
    rule: RuleDefinition,
) -> Result<Vec<RuleDefinition>, String> {
    with_store(state, move |store| store.upsert_rule(&project_id, rule))
}

#[tauri::command]
fn delete_rule(
    state: State<'_, StoreState>,
    project_id: String,
    rule_id: String,
) -> Result<Vec<RuleDefinition>, String> {
    with_store(state, move |store| store.delete_rule(&project_id, &rule_id))
}

#[tauri::command]
fn preview_active_worldbook(
    state: State<'_, StoreState>,
    project_id: String,
    scene_id: String,
    last_free_input: Option<String>,
) -> Result<Vec<crate::worldbook::ActiveLoreEntry>, String> {
    with_store(state, move |store| {
        store.preview_active_worldbook(&project_id, &scene_id, last_free_input.as_deref())
    })
}

#[tauri::command]
fn preview_rule_evaluation(
    state: State<'_, StoreState>,
    project_id: String,
    scene_id: String,
    event_kind: String,
    actor_character_id: Option<String>,
    target_character_id: Option<String>,
    input_text: Option<String>,
) -> Result<crate::runtime::RuleEvaluationResult, String> {
    with_store(state, move |store| {
        store.preview_rule_evaluation(
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
fn rewind_to_checkpoint(
    state: State<'_, StoreState>,
    session_id: String,
    checkpoint_id: String,
) -> Result<ScenePayload, String> {
    with_store(state, move |store| store.rewind_to_checkpoint(&session_id, &checkpoint_id))
}

#[tauri::command]
fn finish_session(state: State<'_, StoreState>, session_id: String) -> Result<Option<EndingReport>, String> {
    with_store(state, move |store| store.finish_session(&session_id))
}

fn with_store<T, F>(state: State<'_, StoreState>, action: F) -> Result<T, String>
where
    F: FnOnce(&mut ProjectStore) -> AppResult<T>,
{
    let mut guard = state.lock().map_err(|_| "failed to lock project store".to_string())?;
    action(&mut guard).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app
                .path()
                .app_local_data_dir()
                .map_err(|error| std::io::Error::other(error.to_string()))?;
            fs::create_dir_all(&app_dir)?;
            app.manage(Mutex::new(ProjectStore::new(app_dir.join("runtime"))?));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_project,
            import_novel_text,
            build_story_package,
            get_build_status,
            load_story_package,
            list_projects,
            get_recent_project,
            get_project,
            start_session,
            get_current_scene,
            submit_choice,
            submit_free_input,
            get_story_codex,
            update_character_card,
            upsert_worldbook_entry,
            delete_worldbook_entry,
            upsert_rule,
            delete_rule,
            preview_active_worldbook,
            preview_rule_evaluation,
            rewind_to_checkpoint,
            finish_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
