use tauri::State;

use crate::{
    error::{AppResult, CommandErrorPayload, map_app_error_to_command_error},
    store::ProjectStore,
    StoreState,
};

pub type CommandResult<T> = Result<T, CommandErrorPayload>;

pub fn with_store<T, F>(state: State<'_, StoreState>, action: F) -> CommandResult<T>
where
    F: FnOnce(&mut ProjectStore) -> AppResult<T>,
{
    let mut guard = state.lock().map_err(|_| CommandErrorPayload {
        code: "state_lock_error",
        message: "failed to lock project store".to_string(),
    })?;

    action(&mut guard).map_err(map_app_error_to_command_error)
}
