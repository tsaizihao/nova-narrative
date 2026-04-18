mod app_api;
mod analyzer;
mod adaptation;
mod application;
mod commands;
mod compiler;
mod context_builder;
mod error;
mod infra;
mod importer;
mod models;
mod provider;
mod rules;
mod runtime;
mod state;
mod store;
mod worldbook;

use std::{fs, sync::Mutex};

use tauri::Manager;

use crate::{commands::*, store::ProjectStore};

pub(crate) type StoreState = Mutex<ProjectStore>;

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
            list_projects,
            list_saved_projects,
            import_novel_text,
            build_story_package,
            get_ai_settings,
            save_ai_settings,
            clear_provider_api_key,
            get_build_status,
            load_story_package,
            get_project,
            start_session,
            find_project_session,
            get_current_scene,
            get_runtime_snapshot,
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
            preview_review_snapshot,
            save_review_preview_context,
            rewind_to_checkpoint,
            finish_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
