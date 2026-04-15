use tauri::State;

use crate::{
    StoreState,
    application::ProjectService,
    commands::shared::{CommandResult, with_store},
    models::{BuildStatus, NovelProject, SavedProjectLibraryEntry, StoryPackage},
};

#[tauri::command]
pub fn create_project(
    state: State<'_, StoreState>,
    name: String,
) -> CommandResult<NovelProject> {
    with_store(state, move |store| ProjectService::create_project(store, &name))
}

#[tauri::command]
pub fn list_projects(state: State<'_, StoreState>) -> CommandResult<Vec<NovelProject>> {
    with_store(state, ProjectService::list_projects)
}

#[tauri::command]
pub fn list_saved_projects(state: State<'_, StoreState>) -> CommandResult<Vec<SavedProjectLibraryEntry>> {
    with_store(state, ProjectService::list_saved_projects)
}

#[tauri::command]
pub fn import_novel_text(
    state: State<'_, StoreState>,
    project_id: String,
    content: String,
) -> CommandResult<NovelProject> {
    with_store(state, move |store| {
        ProjectService::import_novel_text(store, &project_id, &content)
    })
}

#[tauri::command]
pub fn build_story_package(
    state: State<'_, StoreState>,
    project_id: String,
) -> CommandResult<BuildStatus> {
    with_store(state, move |store| ProjectService::build_story_package(store, &project_id))
}

#[tauri::command]
pub fn get_build_status(
    state: State<'_, StoreState>,
    project_id: String,
) -> CommandResult<BuildStatus> {
    with_store(state, move |store| ProjectService::get_build_status(store, &project_id))
}

#[tauri::command]
pub fn load_story_package(
    state: State<'_, StoreState>,
    project_id: String,
) -> CommandResult<StoryPackage> {
    with_store(state, move |store| ProjectService::load_story_package(store, &project_id))
}

#[tauri::command]
pub fn get_project(
    state: State<'_, StoreState>,
    project_id: String,
) -> CommandResult<NovelProject> {
    with_store(state, move |store| ProjectService::get_project(store, &project_id))
}
