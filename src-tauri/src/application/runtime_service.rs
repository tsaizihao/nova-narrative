use crate::{
    app_api::input_validation::{
        require_checkpoint_id, require_choice_id, require_project_id, require_session_id,
        require_story_text,
    },
    error::AppResult,
    models::{EndingReport, RuntimeSnapshot, ScenePayload, SessionState, StoryCodex},
    store::ProjectStore,
};

pub struct RuntimeService;

impl RuntimeService {
    pub fn start_session(store: &mut ProjectStore, project_id: &str) -> AppResult<SessionState> {
        let project_id = require_project_id(project_id)?;
        store.start_session(project_id)
    }

    pub fn find_project_session(
        store: &mut ProjectStore,
        project_id: &str,
    ) -> AppResult<Option<SessionState>> {
        let project_id = require_project_id(project_id)?;
        store.find_project_session(project_id)
    }

    pub fn get_current_scene(store: &mut ProjectStore, session_id: &str) -> AppResult<ScenePayload> {
        let session_id = require_session_id(session_id)?;
        store.get_current_scene(session_id)
    }

    pub fn get_runtime_snapshot(
        store: &mut ProjectStore,
        session_id: &str,
    ) -> AppResult<RuntimeSnapshot> {
        let session_id = require_session_id(session_id)?;
        store.get_runtime_snapshot(session_id)
    }

    pub fn submit_choice(
        store: &mut ProjectStore,
        session_id: &str,
        choice_id: &str,
    ) -> AppResult<ScenePayload> {
        let session_id = require_session_id(session_id)?;
        let choice_id = require_choice_id(choice_id)?;
        store.submit_choice(session_id, choice_id)
    }

    pub fn submit_free_input(
        store: &mut ProjectStore,
        session_id: &str,
        text: &str,
    ) -> AppResult<ScenePayload> {
        let session_id = require_session_id(session_id)?;
        let text = require_story_text(text)?;
        store.submit_free_input(session_id, text)
    }

    pub fn get_story_codex(store: &mut ProjectStore, session_id: &str) -> AppResult<StoryCodex> {
        let session_id = require_session_id(session_id)?;
        store.get_story_codex(session_id)
    }

    pub fn rewind_to_checkpoint(
        store: &mut ProjectStore,
        session_id: &str,
        checkpoint_id: &str,
    ) -> AppResult<ScenePayload> {
        let session_id = require_session_id(session_id)?;
        let checkpoint_id = require_checkpoint_id(checkpoint_id)?;
        store.rewind_to_checkpoint(session_id, checkpoint_id)
    }

    pub fn finish_session(store: &mut ProjectStore, session_id: &str) -> AppResult<Option<EndingReport>> {
        let session_id = require_session_id(session_id)?;
        store.finish_session(session_id)
    }
}
