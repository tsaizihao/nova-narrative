use std::{
    cmp::Reverse,
    collections::HashMap,
    sync::Arc,
};

use uuid::Uuid;

use crate::{
    analyzer::Analyzer,
    compiler::compile_story_package,
    error::{AppError, AppResult},
    infra::{
        AiSettingsRepository, DiagnosticsLevel, DiagnosticsRepository, PersistedAiSettings,
        ProjectRepository, RuntimeDataPaths, SessionRepository, StorageManifestRepository,
    },
    importer::{sanitize_text, split_novel_into_chapters},
    models::{
        AiProviderKind, AppAiSettingsSnapshot, BuildStage, BuildStatus, CharacterCard, NovelProject,
        ProjectedOutcomePreview, ProjectedSceneChoicePreview, ReviewPreviewContext,
        ReviewPreviewExplanations, ReviewPreviewSnapshot, RuntimeSnapshot, SaveAiSettingsInput,
        SavedProjectActivityKind, SavedProjectLibraryEntry, SceneNode, ScenePayload, SessionState,
        SessionStatus, StoryBible, StoryCodex, StoryPackage, TimelineEntry, WorldRule,
    },
    provider::{
        ChatCompletionsTransport, HeuristicStoryProvider, KeyringSecretStore,
        OpenAiCompatibleProvider, OpenRouterProvider, ReqwestChatCompletionsTransport, SecretStore,
        StoryAiProvider,
    },
    rules::RuleDefinition,
    runtime::{RuleEvaluationInput, RuleEvaluationResult, RuntimeEngine},
    worldbook::{ActiveLoreEntry, WorldBookEntry},
};

pub struct ProjectStore {
    provider: Arc<dyn StoryAiProvider>,
    secret_store: Arc<dyn SecretStore>,
    chat_transport: Arc<dyn ChatCompletionsTransport>,
    project_repository: ProjectRepository,
    session_repository: SessionRepository,
    ai_settings_repository: AiSettingsRepository,
    diagnostics_repository: DiagnosticsRepository,
    ai_settings: PersistedAiSettings,
    projects: HashMap<String, NovelProject>,
    sessions: HashMap<String, SessionState>,
}

impl ProjectStore {
    pub fn new(base_dir: std::path::PathBuf) -> AppResult<Self> {
        let mut store = Self::with_services(
            base_dir,
            Arc::new(HeuristicStoryProvider),
            Arc::new(KeyringSecretStore::default()),
            Arc::new(ReqwestChatCompletionsTransport::default()),
        )?;
        store.load_from_disk()?;
        Ok(store)
    }

    pub fn with_services(
        base_dir: std::path::PathBuf,
        provider: Arc<dyn StoryAiProvider>,
        secret_store: Arc<dyn SecretStore>,
        chat_transport: Arc<dyn ChatCompletionsTransport>,
    ) -> AppResult<Self> {
        let layout = RuntimeDataPaths::new(base_dir);
        StorageManifestRepository::new(layout.clone())?.bootstrap()?;
        let project_repository = ProjectRepository::new(layout.clone())?;
        let session_repository = SessionRepository::new(layout.clone())?;
        let diagnostics_repository = DiagnosticsRepository::new(layout.clone())?;
        let ai_settings_repository = AiSettingsRepository::new(layout)?;
        let ai_settings = ai_settings_repository.load_or_default()?;

        Ok(Self {
            provider,
            secret_store,
            chat_transport,
            project_repository,
            session_repository,
            ai_settings_repository,
            diagnostics_repository,
            ai_settings,
            projects: HashMap::new(),
            sessions: HashMap::new(),
        })
    }

    #[cfg(test)]
    pub fn reload(base_dir: std::path::PathBuf) -> AppResult<Self> {
        let mut store = Self::new(base_dir)?;
        store.load_from_disk()?;
        Ok(store)
    }

    #[cfg(test)]
    pub fn with_secret_store(
        base_dir: std::path::PathBuf,
        secret_store: Arc<dyn SecretStore>,
    ) -> AppResult<Self> {
        Self::with_services(
            base_dir,
            Arc::new(HeuristicStoryProvider),
            secret_store,
            Arc::new(ReqwestChatCompletionsTransport::default()),
        )
    }

    #[cfg(test)]
    pub fn with_secret_store_and_transport(
        base_dir: std::path::PathBuf,
        secret_store: Arc<dyn SecretStore>,
        chat_transport: Arc<dyn ChatCompletionsTransport>,
    ) -> AppResult<Self> {
        Self::with_services(
            base_dir,
            Arc::new(HeuristicStoryProvider),
            secret_store,
            chat_transport,
        )
    }

    #[cfg(test)]
    pub fn reload_with_secret_store(
        base_dir: std::path::PathBuf,
        secret_store: Arc<dyn SecretStore>,
    ) -> AppResult<Self> {
        let mut store = Self::with_secret_store(base_dir, secret_store)?;
        store.load_from_disk()?;
        Ok(store)
    }

    pub fn create_project(&mut self, name: &str) -> AppResult<NovelProject> {
        let project = NovelProject {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            build_status: BuildStatus {
                stage: BuildStage::Created,
                message: "Project created".into(),
                progress: 0,
                error: None,
            },
            ..NovelProject::default()
        };
        self.persist_project(&project)?;
        self.projects.insert(project.id.clone(), project.clone());
        self.log_info("create_project", "created project snapshot", Some(&project.id), None);
        Ok(project)
    }

    pub fn list_projects(&self) -> AppResult<Vec<NovelProject>> {
        let mut projects = self.projects.values().cloned().collect::<Vec<_>>();
        projects.sort_by_key(|project| {
            (
                Reverse(project.story_package.is_some()),
                project.name.clone(),
                project.id.clone(),
            )
        });
        Ok(projects)
    }

    pub fn list_saved_projects(&self) -> AppResult<Vec<SavedProjectLibraryEntry>> {
        let mut entries = Vec::new();

        for project in self.projects.values() {
            if !is_saved_project_candidate(project) {
                continue;
            }

            let latest_session = self.latest_project_session_activity(&project.id)?;
            let project_activity_at = self
                .project_repository
                .last_modified_millis(&project.id)?
                .unwrap_or_default();

            let (session_id, current_scene_title, ending_type, last_activity_at, last_activity_kind) =
                match latest_session {
                    Some((session, session_activity_at)) => {
                        let current_scene_title = project
                            .story_package
                            .as_ref()
                            .and_then(|package| package.scenes.get(&session.current_scene_id))
                            .map(|scene| scene.title.clone());
                        let ending_type = session
                            .ending_report
                            .as_ref()
                            .map(|report| report.ending_type.clone());
                        let activity_kind = if matches!(session.status, SessionStatus::Active) {
                            SavedProjectActivityKind::Session
                        } else {
                            SavedProjectActivityKind::Ending
                        };

                        (
                            Some(session.session_id),
                            current_scene_title,
                            ending_type,
                            session_activity_at,
                            activity_kind,
                        )
                    }
                    None => (
                        None,
                        None,
                        None,
                        project_activity_at,
                        SavedProjectActivityKind::Project,
                    ),
                };

            entries.push(SavedProjectLibraryEntry {
                project: project.clone(),
                session_id,
                current_scene_title,
                ending_type,
                last_activity_at,
                last_activity_kind,
            });
        }

        sort_saved_project_entries(&mut entries);
        Ok(entries)
    }

    pub fn import_novel_text(&mut self, project_id: &str, content: &str) -> AppResult<NovelProject> {
        let sanitized = sanitize_text(content);
        if sanitized.is_empty() {
            self.log_error(
                "import_novel_text",
                "rejected empty imported text",
                Some(project_id),
                None,
            );
            return Err(AppError::Validation("Novel text cannot be empty".into()));
        }
        if !self.projects.contains_key(project_id) {
            self.log_error(
                "import_novel_text",
                "project not found while importing text",
                Some(project_id),
                None,
            );
            return Err(AppError::NotFound(project_id.to_string()));
        }

        self.invalidate_project_sessions(project_id)?;

        let Some(project) = self.projects.get_mut(project_id) else {
            return Err(AppError::NotFound(project_id.to_string()));
        };

        project.raw_text = sanitized;
        project.chapters = split_novel_into_chapters(&project.raw_text);
        clear_build_derived_state(project);
        project.build_status = build_status(BuildStage::Imported, "Novel imported", 20, None);

        let snapshot = project.clone();
        self.persist_project(&snapshot)?;
        self.log_info(
            "import_novel_text",
            format!("imported {} chapters", snapshot.chapters.len()),
            Some(&snapshot.id),
            None,
        );
        Ok(snapshot)
    }

    pub fn build_story_package(&mut self, project_id: &str) -> AppResult<BuildStatus> {
        let settings = self.get_ai_settings()?;
        let Some(mut project) = self.projects.get(project_id).cloned() else {
            return Err(AppError::NotFound(project_id.to_string()));
        };

        if !has_usable_imported_source(&project) {
            let error = AppError::InvalidState("project must contain imported source text before build".into());
            self.persist_failed_build(project, "构建无法开始", 0, &error)?;
            self.log_error(
                "build_story_package",
                "build rejected because imported source is missing",
                Some(project_id),
                None,
            );
            return Err(error);
        }

        project.build_status = build_status(BuildStage::Analyzing, "Analyzing source novel", 45, None);
        self.store_project_snapshot(project.clone())?;
        self.log_info(
            "build_story_package",
            "entered analyzing stage",
            Some(project_id),
            None,
        );

        let extracted = match settings.selected_provider {
            AiProviderKind::Heuristic => {
                let analyzer = Analyzer::new(self.provider.clone());
                analyzer.analyze(&project)
            }
            AiProviderKind::OpenAiCompatible => OpenAiCompatibleProvider::new(self.chat_transport.clone())
                .analyze(&project, &settings, self.secret_store.as_ref()),
            AiProviderKind::OpenRouter => OpenRouterProvider::new(self.chat_transport.clone())
                .analyze(&project, &settings, self.secret_store.as_ref()),
        };
        let extracted = match extracted {
            Ok(extracted) => extracted,
            Err(error) => {
                self.persist_failed_build(project, "结构解析失败", 45, &error)?;
                self.log_error(
                    "build_story_package",
                    format!("analyze/provider stage failed: {}", command_error_message(&error)),
                    Some(project_id),
                    None,
                );
                return Err(error);
            }
        };

        project.character_cards = extracted.character_cards;
        project.worldbook_entries = extracted.worldbook_entries;
        project.rules = extracted.rules;
        project.build_status = build_status(BuildStage::Compiling, "Compiling scene graph", 80, None);
        self.store_project_snapshot(project.clone())?;
        self.log_info(
            "build_story_package",
            "entered compiling stage",
            Some(project_id),
            None,
        );

        let compiled = match validate_compiled_story_package(compile_story_package(&project, extracted.story_bible)) {
            Ok(package) => package,
            Err(error) => {
                self.persist_failed_build(project, "互动编译失败", 80, &error)?;
                self.log_error(
                    "build_story_package",
                    format!("compile stage failed: {}", command_error_message(&error)),
                    Some(project_id),
                    None,
                );
                return Err(error);
            }
        };

        project.story_package = Some(compiled);
        project.build_status = build_status(BuildStage::Ready, "Story package ready", 100, None);
        let status = project.build_status.clone();
        self.store_project_snapshot(project)?;
        self.log_info(
            "build_story_package",
            "build completed with ready story package",
            Some(project_id),
            None,
        );
        Ok(status)
    }

    pub fn get_build_status(&self, project_id: &str) -> AppResult<BuildStatus> {
        self.projects
            .get(project_id)
            .map(|project| project.build_status.clone())
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))
    }

    pub fn get_ai_settings(&self) -> AppResult<AppAiSettingsSnapshot> {
        self.ai_settings.to_snapshot(self.secret_store.as_ref())
    }

    pub fn save_ai_settings(&mut self, input: SaveAiSettingsInput) -> AppResult<AppAiSettingsSnapshot> {
        self.ai_settings.apply_save(&input, self.secret_store.as_ref())?;
        self.persist_ai_settings()?;
        self.get_ai_settings()
    }

    pub fn clear_provider_api_key(&mut self, provider: AiProviderKind) -> AppResult<AppAiSettingsSnapshot> {
        self.secret_store.clear_api_key(provider)?;
        self.persist_ai_settings()?;
        self.get_ai_settings()
    }

    pub fn load_story_package(&self, project_id: &str) -> AppResult<StoryPackage> {
        self.projects
            .get(project_id)
            .and_then(|project| project.story_package.clone())
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))
    }

    pub fn get_project(&self, project_id: &str) -> AppResult<NovelProject> {
        self.projects
            .get(project_id)
            .cloned()
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))
    }

    pub fn start_session(&mut self, project_id: &str) -> AppResult<SessionState> {
        let package = self.load_story_package(project_id)?;
        self.invalidate_project_sessions(project_id)?;
        let session = RuntimeEngine::start_session(project_id, &package)?;
        self.persist_session(&session)?;
        self.sessions.insert(session.session_id.clone(), session.clone());
        self.log_info(
            "start_session",
            format!("started runtime session at {}", session.current_scene_id),
            Some(project_id),
            Some(&session.session_id),
        );
        Ok(session)
    }

    pub fn find_project_session(&self, project_id: &str) -> AppResult<Option<SessionState>> {
        if !self.projects.contains_key(project_id) {
            return Err(AppError::NotFound(project_id.to_string()));
        }

        Ok(self
            .sessions
            .values()
            .filter(|session| session.project_id == project_id)
            .max_by_key(|session| {
                (
                    session_status_rank(&session.status),
                    session.visited_scenes.len(),
                    session.major_choices.len(),
                    session.free_input_history.len(),
                    session.available_checkpoints.len(),
                    session.session_id.clone(),
                )
            })
            .cloned())
    }

    pub fn get_current_scene(&self, session_id: &str) -> AppResult<ScenePayload> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| AppError::NotFound(session_id.to_string()))?;
        let package = self.load_story_package(&session.project_id)?;
        RuntimeEngine::get_current_scene(session, &package)
    }

    pub fn get_runtime_snapshot(&self, session_id: &str) -> AppResult<RuntimeSnapshot> {
        Ok(RuntimeSnapshot {
            payload: self.get_current_scene(session_id)?,
            codex: self.get_story_codex(session_id)?,
        })
    }

    pub fn submit_choice(&mut self, session_id: &str, choice_id: &str) -> AppResult<ScenePayload> {
        let project_id = self
            .sessions
            .get(session_id)
            .map(|session| session.project_id.clone())
            .ok_or_else(|| AppError::NotFound(session_id.to_string()))?;
        let package = self.load_story_package(&project_id)?;
        let Some(session) = self.sessions.get_mut(session_id) else {
            return Err(AppError::NotFound(session_id.to_string()));
        };
        let payload = RuntimeEngine::submit_choice(session, &package, choice_id)?;
        let snapshot = session.clone();
        self.persist_session(&snapshot)?;
        self.log_info(
            "submit_choice",
            format!("advanced runtime choice {choice_id} to {}", snapshot.current_scene_id),
            Some(&project_id),
            Some(session_id),
        );
        Ok(payload)
    }

    pub fn submit_free_input(&mut self, session_id: &str, text: &str) -> AppResult<ScenePayload> {
        let project_id = self
            .sessions
            .get(session_id)
            .map(|session| session.project_id.clone())
            .ok_or_else(|| AppError::NotFound(session_id.to_string()))?;
        let package = self.load_story_package(&project_id)?;
        let Some(session) = self.sessions.get_mut(session_id) else {
            return Err(AppError::NotFound(session_id.to_string()));
        };
        let payload = RuntimeEngine::submit_free_input(session, &package, text)?;
        let snapshot = session.clone();
        self.persist_session(&snapshot)?;
        self.log_info(
            "submit_free_input",
            format!("recorded free input at {}", snapshot.current_scene_id),
            Some(&project_id),
            Some(session_id),
        );
        Ok(payload)
    }

    pub fn get_story_codex(&self, session_id: &str) -> AppResult<StoryCodex> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| AppError::NotFound(session_id.to_string()))?;
        let package = self.load_story_package(&session.project_id)?;
        Ok(StoryCodex {
            characters: package.story_bible.characters,
            locations: package.story_bible.locations,
            world_rules: package.story_bible.world_rules,
            relationships: package.story_bible.relationships,
            timeline: package.story_bible.timeline,
            recent_choices: session.major_choices.clone(),
            worldbook_entries: package.world_model.worldbook_entries,
            rules: package.world_model.rules,
        })
    }

    pub fn update_character_card(
        &mut self,
        project_id: &str,
        card: CharacterCard,
    ) -> AppResult<Vec<CharacterCard>> {
        let project = self
            .projects
            .get_mut(project_id)
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))?;
        let Some(existing) = project
            .character_cards
            .iter_mut()
            .find(|candidate| candidate.id == card.id)
        else {
            return Err(AppError::NotFound(card.id));
        };
        *existing = card;
        rebuild_story_package_from_project(project);
        let snapshot = project.clone();
        self.persist_project(&snapshot)?;
        Ok(snapshot.character_cards)
    }

    pub fn upsert_worldbook_entry(
        &mut self,
        project_id: &str,
        entry: WorldBookEntry,
    ) -> AppResult<Vec<WorldBookEntry>> {
        let project = self
            .projects
            .get_mut(project_id)
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))?;
        if let Some(existing) = project
            .worldbook_entries
            .iter_mut()
            .find(|candidate| candidate.id == entry.id)
        {
            *existing = entry;
        } else {
            project.worldbook_entries.push(entry);
        }
        rebuild_story_package_from_project(project);
        let snapshot = project.clone();
        self.persist_project(&snapshot)?;
        Ok(snapshot.worldbook_entries)
    }

    pub fn delete_worldbook_entry(
        &mut self,
        project_id: &str,
        entry_id: &str,
    ) -> AppResult<Vec<WorldBookEntry>> {
        let project = self
            .projects
            .get_mut(project_id)
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))?;
        project.worldbook_entries.retain(|entry| entry.id != entry_id);
        rebuild_story_package_from_project(project);
        let snapshot = project.clone();
        self.persist_project(&snapshot)?;
        Ok(snapshot.worldbook_entries)
    }

    pub fn upsert_rule(&mut self, project_id: &str, rule: RuleDefinition) -> AppResult<Vec<RuleDefinition>> {
        let project = self
            .projects
            .get_mut(project_id)
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))?;
        if let Some(existing) = project.rules.iter_mut().find(|item| item.id == rule.id) {
            *existing = rule;
        } else {
            project.rules.push(rule);
        }
        rebuild_story_package_from_project(project);
        let snapshot = project.clone();
        self.persist_project(&snapshot)?;
        Ok(snapshot.rules)
    }

    pub fn delete_rule(&mut self, project_id: &str, rule_id: &str) -> AppResult<Vec<RuleDefinition>> {
        let project = self
            .projects
            .get_mut(project_id)
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))?;
        project.rules.retain(|rule| rule.id != rule_id);
        rebuild_story_package_from_project(project);
        let snapshot = project.clone();
        self.persist_project(&snapshot)?;
        Ok(snapshot.rules)
    }

    pub fn preview_active_worldbook(
        &self,
        project_id: &str,
        scene_id: &str,
        last_free_input: Option<&str>,
    ) -> AppResult<Vec<ActiveLoreEntry>> {
        let package = self.load_story_package(project_id)?;
        RuntimeEngine::preview_active_worldbook(&package, scene_id, last_free_input)
    }

    pub fn preview_rule_evaluation(
        &self,
        project_id: &str,
        scene_id: &str,
        event_kind: &str,
        actor_character_id: Option<&str>,
        target_character_id: Option<&str>,
        input_text: Option<&str>,
    ) -> AppResult<RuleEvaluationResult> {
        let package = self.load_story_package(project_id)?;
        let scene = package
            .scenes
            .get(scene_id)
            .ok_or_else(|| AppError::NotFound(scene_id.to_string()))?;

        let actor = actor_character_id
            .and_then(|candidate| package.world_model.character_cards.iter().find(|card| card.id == candidate))
            .cloned()
            .or_else(|| package.world_model.character_cards.first().cloned())
            .unwrap_or_default();
        let target = target_character_id
            .and_then(|candidate| package.world_model.character_cards.iter().find(|card| card.id == candidate))
            .cloned()
            .or_else(|| package.world_model.character_cards.iter().find(|card| card.id != actor.id).cloned())
            .unwrap_or_else(|| actor.clone());

        crate::runtime::evaluate_rules(
            &crate::state::StoryState {
                current_scene_id: scene.id.clone(),
                ..crate::state::StoryState::default()
            },
            &package.world_model.rules,
            RuleEvaluationInput {
                event_kind: event_kind.to_string(),
                actor_character_id: actor.id,
                actor_gender: actor.gender,
                target_character_id: target.id,
                target_gender: target.gender,
                source_text: input_text.unwrap_or_default().to_string(),
                scene_title: scene.title.clone(),
            },
        )
    }

    pub fn preview_review_snapshot(
        &self,
        project_id: &str,
        context: ReviewPreviewContext,
    ) -> AppResult<ReviewPreviewSnapshot> {
        let package = self.load_story_package(project_id)?;
        let scene = package
            .scenes
            .get(&context.scene_id)
            .ok_or_else(|| AppError::NotFound(context.scene_id.clone()))?;

        let actor = resolve_preview_actor(&package, context.actor_character_id.as_deref());
        let target = resolve_preview_target(&package, &actor, context.target_character_id.as_deref());
        let lore_preview = RuntimeEngine::preview_active_worldbook(
            &package,
            &context.scene_id,
            Some(&context.input_text),
        )?;
        let rule_preview = crate::runtime::evaluate_rules(
            &crate::state::StoryState {
                current_scene_id: scene.id.clone(),
                ..crate::state::StoryState::default()
            },
            &package.world_model.rules,
            RuleEvaluationInput {
                event_kind: context.event_kind.clone(),
                actor_character_id: actor.id.clone(),
                actor_gender: actor.gender.clone(),
                target_character_id: target.id.clone(),
                target_gender: target.gender.clone(),
                source_text: context.input_text.clone(),
                scene_title: scene.title.clone(),
            },
        )?;
        let projected_outcome = build_projected_outcome(scene, &package, &rule_preview);
        let explanations =
            build_preview_explanations(&lore_preview, &rule_preview, &projected_outcome);

        Ok(ReviewPreviewSnapshot {
            context,
            lore_preview,
            rule_preview,
            projected_outcome,
            explanations,
        })
    }

    pub fn save_review_preview_context(
        &mut self,
        project_id: &str,
        context: ReviewPreviewContext,
    ) -> AppResult<ReviewPreviewContext> {
        let project = self
            .projects
            .get_mut(project_id)
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))?;
        project.review_preview_context = Some(context.clone());
        let snapshot = project.clone();
        self.persist_project(&snapshot)?;
        Ok(context)
    }

    pub fn rewind_to_checkpoint(&mut self, session_id: &str, checkpoint_id: &str) -> AppResult<ScenePayload> {
        let project_id = self
            .sessions
            .get(session_id)
            .map(|session| session.project_id.clone())
            .ok_or_else(|| AppError::NotFound(session_id.to_string()))?;
        let package = self.load_story_package(&project_id)?;
        let Some(session) = self.sessions.get_mut(session_id) else {
            return Err(AppError::NotFound(session_id.to_string()));
        };
        let payload = RuntimeEngine::rewind_to_checkpoint(session, &package, checkpoint_id)?;
        let snapshot = session.clone();
        self.persist_session(&snapshot)?;
        self.log_info(
            "rewind_to_checkpoint",
            format!("rewound runtime session to checkpoint {checkpoint_id}"),
            Some(&project_id),
            Some(session_id),
        );
        Ok(payload)
    }

    pub fn finish_session(&mut self, session_id: &str) -> AppResult<Option<crate::models::EndingReport>> {
        let (project_id, ending_report, snapshot_to_persist) = {
            let Some(session) = self.sessions.get_mut(session_id) else {
                return Err(AppError::NotFound(session_id.to_string()));
            };
            let project_id = session.project_id.clone();
            let ending_report = session.ending_report.clone();
            let snapshot_to_persist = if ending_report.is_some() && session.status != SessionStatus::Finished {
                session.status = SessionStatus::Finished;
                Some(session.clone())
            } else {
                None
            };

            (project_id, ending_report, snapshot_to_persist)
        };

        if ending_report.is_none() {
            self.log_info(
                "finish_session",
                "finish requested without an ending report",
                Some(&project_id),
                Some(session_id),
            );
            return Ok(None);
        }

        if let Some(snapshot) = snapshot_to_persist {
            self.persist_session(&snapshot)?;
        }

        self.log_info(
            "finish_session",
            "archived ending session",
            Some(&project_id),
            Some(session_id),
        );

        Ok(ending_report)
    }

    fn persist_project(&self, project: &NovelProject) -> AppResult<()> {
        self.project_repository.save(project)
    }

    fn persist_session(&self, session: &SessionState) -> AppResult<()> {
        self.session_repository.save(session)
    }

    fn persist_ai_settings(&self) -> AppResult<()> {
        self.ai_settings_repository.save(&self.ai_settings)
    }

    fn log_info(
        &self,
        operation: &str,
        detail: impl Into<String>,
        project_id: Option<&str>,
        session_id: Option<&str>,
    ) {
        let _ = self
            .diagnostics_repository
            .record(DiagnosticsLevel::Info, operation, detail, project_id, session_id);
    }

    fn log_error(
        &self,
        operation: &str,
        detail: impl Into<String>,
        project_id: Option<&str>,
        session_id: Option<&str>,
    ) {
        let _ = self
            .diagnostics_repository
            .record(DiagnosticsLevel::Error, operation, detail, project_id, session_id);
    }

    fn store_project_snapshot(&mut self, project: NovelProject) -> AppResult<()> {
        self.persist_project(&project)?;
        self.projects.insert(project.id.clone(), project);
        Ok(())
    }

    fn persist_failed_build(
        &mut self,
        mut project: NovelProject,
        message: &str,
        progress: u8,
        error: &AppError,
    ) -> AppResult<()> {
        project.build_status = build_status(
            BuildStage::Failed,
            message,
            progress,
            Some(command_error_message(error)),
        );
        self.store_project_snapshot(project)
    }

    fn latest_project_session_activity(&self, project_id: &str) -> AppResult<Option<(SessionState, i64)>> {
        let mut latest: Option<(SessionState, i64)> = None;

        for session in self.sessions.values().filter(|session| session.project_id == project_id) {
            let activity_at = self
                .session_repository
                .last_modified_millis(&session.session_id)?
                .unwrap_or_default();

            let should_replace = latest
                .as_ref()
                .map(|(current, current_activity_at)| {
                    activity_at > *current_activity_at
                        || (activity_at == *current_activity_at && session.session_id < current.session_id)
                })
                .unwrap_or(true);

            if should_replace {
                latest = Some((session.clone(), activity_at));
            }
        }

        Ok(latest)
    }

    fn invalidate_project_sessions(&mut self, project_id: &str) -> AppResult<()> {
        let session_ids = self
            .sessions
            .iter()
            .filter(|(_, session)| session.project_id == project_id)
            .map(|(session_id, _)| session_id.clone())
            .collect::<Vec<_>>();

        for session_id in session_ids {
            self.sessions.remove(&session_id);
            self.session_repository.delete(&session_id)?;
        }

        Ok(())
    }

    fn load_from_disk(&mut self) -> AppResult<()> {
        self.projects = self.project_repository.load_all()?;
        self.sessions = self.session_repository.load_all()?;
        self.log_info(
            "load_from_disk",
            format!(
                "restored {} projects and {} sessions from disk",
                self.projects.len(),
                self.sessions.len()
            ),
            None,
            None,
        );
        Ok(())
    }
}

fn rebuild_story_package_from_project(project: &mut NovelProject) {
    let story_bible = story_bible_snapshot(project);
    project.story_package = Some(compile_story_package(project, story_bible));
}

fn clear_build_derived_state(project: &mut NovelProject) {
    project.story_package = None;
    project.character_cards.clear();
    project.worldbook_entries.clear();
    project.rules.clear();
}

fn has_usable_imported_source(project: &NovelProject) -> bool {
    !project.raw_text.trim().is_empty() && !project.chapters.is_empty()
}

fn is_saved_project_candidate(project: &NovelProject) -> bool {
    project.build_status.stage == BuildStage::Ready && project.story_package.is_some()
}

fn sort_saved_project_entries(entries: &mut [SavedProjectLibraryEntry]) {
    entries.sort_by(|left, right| {
        right
            .last_activity_at
            .cmp(&left.last_activity_at)
            .then_with(|| left.project.name.cmp(&right.project.name))
            .then_with(|| left.project.id.cmp(&right.project.id))
    });
}

fn session_status_rank(status: &SessionStatus) -> u8 {
    match status {
        SessionStatus::Active => 2,
        SessionStatus::EndingReached => 1,
        SessionStatus::Finished => 0,
    }
}

fn build_status(
    stage: BuildStage,
    message: impl Into<String>,
    progress: u8,
    error: Option<String>,
) -> BuildStatus {
    BuildStatus {
        stage,
        message: message.into(),
        progress,
        error,
    }
}

fn command_error_message(error: &AppError) -> String {
    match error {
        AppError::Io(message) => message.to_string(),
        AppError::Serde(message) => message.to_string(),
        AppError::NotFound(message)
        | AppError::InvalidState(message)
        | AppError::RuleViolation(message)
        | AppError::Validation(message)
        | AppError::Provider(message)
        | AppError::SecretStore(message) => message.clone(),
    }
}

fn validate_compiled_story_package(package: StoryPackage) -> AppResult<StoryPackage> {
    if package.start_scene_id.trim().is_empty() {
        return Err(AppError::InvalidState(
            "compiled story package is missing a start scene".into(),
        ));
    }
    if package.scenes.is_empty() {
        return Err(AppError::InvalidState(
            "compiled story package is missing scenes".into(),
        ));
    }
    if !package.scenes.contains_key(&package.start_scene_id) {
        return Err(AppError::InvalidState(
            "compiled story package start scene does not exist".into(),
        ));
    }
    if package.scenes.values().all(|scene| scene.ending.is_none()) {
        return Err(AppError::InvalidState(
            "compiled story package must contain at least one ending".into(),
        ));
    }

    Ok(package)
}

fn resolve_preview_actor(package: &StoryPackage, explicit_id: Option<&str>) -> CharacterCard {
    explicit_id
        .and_then(|candidate| {
            package
                .world_model
                .character_cards
                .iter()
                .find(|card| card.id == candidate)
        })
        .cloned()
        .or_else(|| package.world_model.character_cards.first().cloned())
        .unwrap_or_default()
}

fn resolve_preview_target(
    package: &StoryPackage,
    actor: &CharacterCard,
    explicit_id: Option<&str>,
) -> CharacterCard {
    explicit_id
        .and_then(|candidate| {
            package
                .world_model
                .character_cards
                .iter()
                .find(|card| card.id == candidate)
        })
        .cloned()
        .or_else(|| {
            package
                .world_model
                .character_cards
                .iter()
                .find(|card| card.id != actor.id)
                .cloned()
        })
        .unwrap_or_else(|| actor.clone())
}

fn build_projected_outcome(
    scene: &SceneNode,
    package: &StoryPackage,
    rule_preview: &RuleEvaluationResult,
) -> ProjectedOutcomePreview {
    if rule_preview.blocked {
        return ProjectedOutcomePreview {
            blocked: true,
            stays_on_scene: true,
            next_scene_id: None,
            next_scene_title: None,
            next_scene_summary: None,
            candidate_choices: Vec::new(),
        };
    }

    let next_scene_id = scene
        .candidate_choices
        .iter()
        .find(|choice| !choice.next_scene_id.trim().is_empty())
        .map(|choice| choice.next_scene_id.clone())
        .or_else(|| scene.fallback_next.clone());

    let Some(next_scene_id) = next_scene_id else {
        return ProjectedOutcomePreview {
            blocked: false,
            stays_on_scene: true,
            next_scene_id: None,
            next_scene_title: None,
            next_scene_summary: None,
            candidate_choices: Vec::new(),
        };
    };

    let next_scene = package.scenes.get(&next_scene_id);
    ProjectedOutcomePreview {
        blocked: false,
        stays_on_scene: false,
        next_scene_id: Some(next_scene_id.clone()),
        next_scene_title: next_scene.map(|scene| scene.title.clone()),
        next_scene_summary: next_scene.map(|scene| scene.summary.clone()),
        candidate_choices: next_scene
            .map(|scene| {
                scene
                    .candidate_choices
                    .iter()
                    .map(|choice| ProjectedSceneChoicePreview {
                        id: choice.id.clone(),
                        label: choice.label.clone(),
                        intent_tag: choice.intent_tag.clone(),
                        next_scene_id: choice.next_scene_id.clone(),
                        unlock_conditions: choice.unlock_conditions.clone(),
                    })
                    .collect()
            })
            .unwrap_or_default(),
    }
}

fn build_preview_explanations(
    lore_preview: &[ActiveLoreEntry],
    rule_preview: &RuleEvaluationResult,
    projected_outcome: &ProjectedOutcomePreview,
) -> ReviewPreviewExplanations {
    let lore_summary = if lore_preview.is_empty() {
        "没有新增 lore 命中".to_string()
    } else {
        format!("命中 {} 条 lore", lore_preview.len())
    };

    let rule_summary = if rule_preview.blocked {
        format!("存在 {} 条激活规则，当前动作会被阻止", rule_preview.active_rules.len())
    } else if rule_preview.active_rules.is_empty() {
        "没有规则阻止当前动作".to_string()
    } else {
        format!("命中 {} 条激活规则，但当前动作允许继续", rule_preview.active_rules.len())
    };

    let outcome_summary = if projected_outcome.blocked {
        "动作会停留在当前场景".to_string()
    } else if projected_outcome.stays_on_scene {
        "当前上下文下不会推进到新场景".to_string()
    } else if let Some(title) = projected_outcome.next_scene_title.as_deref() {
        format!("动作会推进到《{title}》")
    } else if let Some(scene_id) = projected_outcome.next_scene_id.as_deref() {
        format!("动作会推进到 {scene_id}")
    } else {
        "当前上下文下不会推进到新场景".to_string()
    };

    ReviewPreviewExplanations {
        lore_summary,
        rule_summary,
        outcome_summary,
    }
}

fn story_bible_snapshot(project: &NovelProject) -> StoryBible {
    let existing = project.story_package.as_ref().map(|package| package.story_bible.clone());
    StoryBible {
        title: project.name.clone(),
        characters: project.character_cards.clone(),
        locations: existing
            .as_ref()
            .map(|bible| bible.locations.clone())
            .unwrap_or_default(),
        timeline: if let Some(timeline) = existing.as_ref().map(|bible| bible.timeline.clone()) {
            timeline
        } else {
            project
                .chapters
                .iter()
                .enumerate()
                .map(|(index, chapter)| TimelineEntry {
                    id: format!("timeline-{}", index + 1),
                    label: chapter.title.clone(),
                    order: index + 1,
                    summary: chapter.excerpt.clone(),
                })
                .collect()
        },
        world_rules: if project.rules.is_empty() {
            existing
                .as_ref()
                .map(|bible| bible.world_rules.clone())
                .unwrap_or_default()
        } else {
            project
                .rules
                .iter()
                .map(|rule| WorldRule {
                    id: rule.id.clone(),
                    description: rule.explanation.clone(),
                })
                .collect()
        },
        relationships: existing
            .as_ref()
            .map(|bible| bible.relationships.clone())
            .unwrap_or_default(),
        core_conflicts: existing
            .as_ref()
            .map(|bible| bible.core_conflicts.clone())
            .unwrap_or_else(|| {
                vec![crate::models::CoreConflict {
                    id: "conflict-1".into(),
                    title: "秩序与真相".into(),
                    summary: "角色必须在守住规则与推进真相之间做出选择。".into(),
                }]
            }),
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, sync::Arc, thread::sleep, time::Duration};

    use super::ProjectStore;
    use crate::{
        error::AppError,
        infra::{
            CURRENT_STORAGE_VERSION, DiagnosticsRepository, RuntimeDataPaths,
            StorageManifestRepository,
        },
        importer::split_novel_into_chapters,
        models::{
            AiProviderKind, BuildStage, ExternalProviderSettingsInput, ReviewPreviewContext,
            SaveAiSettingsInput, SavedProjectActivityKind, SavedProjectLibraryEntry,
        },
        provider::{FakeChatCompletionsTransport, InMemorySecretStore},
    };
    use crate::worldbook::WorldBookInsertionMode;

    fn default_ai_settings() -> SaveAiSettingsInput {
        SaveAiSettingsInput {
            selected_provider: AiProviderKind::OpenAiCompatible,
            openai_compatible: ExternalProviderSettingsInput {
                base_url: "https://example.com/v1/".into(),
                model: "gpt-4o-mini".into(),
                api_key: Some("sk-openai-test".into()),
            },
            openrouter: ExternalProviderSettingsInput {
                base_url: "https://openrouter.ai/api/v1".into(),
                model: "openai/gpt-4o-mini".into(),
                api_key: None,
            },
        }
    }

    fn openrouter_settings() -> SaveAiSettingsInput {
        SaveAiSettingsInput {
            selected_provider: AiProviderKind::OpenRouter,
            openai_compatible: ExternalProviderSettingsInput::default(),
            openrouter: ExternalProviderSettingsInput {
                base_url: "https://openrouter.ai/api/v1/".into(),
                model: "openai/gpt-4o-mini".into(),
                api_key: Some("sk-openrouter-test".into()),
            },
        }
    }

    fn external_analysis_response() -> String {
        let draft = serde_json::json!({
            "story_bible": {
                "title": "临川夜话",
                "characters": [
                    {
                        "id": "character-1",
                        "name": "沈砚",
                        "gender": "male",
                        "age": 22,
                        "identity": "守门人",
                        "faction": "临川城",
                        "role": "主视角",
                        "summary": "守门人",
                        "desire": "知道真相",
                        "secrets": ["知道北门的代价"],
                        "traits": ["克制"],
                        "abilities": ["守门"],
                        "mutable_state": {"trust": "1"}
                    }
                ],
                "locations": [
                    { "id": "location-1", "name": "临川城", "summary": "雨夜中的城" }
                ],
                "timeline": [
                    { "id": "timeline-1", "label": "第1章 雨夜来客", "order": 1, "summary": "提灯而来" }
                ],
                "world_rules": [
                    { "id": "rule-1", "description": "午夜之后绝不能打开北门" }
                ],
                "relationships": [],
                "core_conflicts": [
                    { "id": "conflict-1", "title": "秩序与真相", "summary": "在规训与真相间选择" }
                ]
            },
            "character_cards": [
                {
                    "name": "沈砚",
                    "gender": "male",
                    "age": 22,
                    "identity": "守门人",
                    "faction": "临川城",
                    "role": "主视角",
                    "summary": "守门人",
                    "desire": "知道真相",
                    "secrets": ["知道北门的代价"],
                    "traits": ["克制"],
                    "abilities": ["守门"],
                    "mutable_state": {"trust": "1"}
                }
            ],
            "worldbook_entries": [
                {
                    "title": "北门禁令",
                    "category": "social_rule",
                    "content": "午夜之后绝不能打开北门。",
                    "enabled": true,
                    "keys": ["北门"],
                    "secondary_keys": ["午夜"],
                    "selective_logic": "and_any",
                    "constant": false,
                    "recursive": false,
                    "exclude_recursion": false,
                    "prevent_recursion": false,
                    "delay_until_recursion": null,
                    "scan_depth": 4,
                    "case_sensitive": false,
                    "match_whole_words": false,
                    "sticky": null,
                    "cooldown": null,
                    "delay": null,
                    "triggers": ["scene"],
                    "ignore_budget": false,
                    "order": 10,
                    "insertion_mode": "rules_guard",
                    "source": "llm",
                    "rule_binding": null
                }
            ],
            "rules": [
                {
                    "name": "north-gate-midnight-forbidden",
                    "category": "social_rule",
                    "priority": "hard_constraint",
                    "enabled": true,
                    "conditions": [
                        { "fact": "event.kind", "operator": "equals", "value": "open_gate" }
                    ],
                    "blockers": [],
                    "effects": [
                        { "key": "event.forbidden", "value": "true" }
                    ],
                    "explanation": "午夜之后绝不能打开北门"
                }
            ]
        });

        serde_json::json!({
            "choices": [
                {
                    "message": {
                        "content": draft.to_string()
                    }
                }
            ]
        })
        .to_string()
    }

    fn sample_novel() -> String {
        [
            "第1章 雨夜来客",
            "",
            "临川城的钟声刚落，沈砚就看见雨幕中有人提灯而来。",
            "他知道城规只有一条，午夜之后绝不能打开北门。",
            "",
            "第2章 禁忌之门",
            "",
            "宁昭低声问他是否还记得旧约，沈砚没有回答。",
            "城中人都说，只要北门打开一次，河上的雾就会吞掉名字。",
            "",
            "第3章 选择",
            "",
            "他们站在门前，火把渐灭，钟声再次响起。",
            "沈砚必须决定，是遵守城规，还是向真相迈进一步。"
        ]
        .join("\n")
    }

    fn build_ready_project(store: &mut ProjectStore, name: &str) -> String {
        let project = store.create_project(name).expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");
        project.id
    }

    fn advance_session_to_ending(store: &mut ProjectStore, session_id: &str) {
        for _ in 0..3 {
            let payload = store.get_current_scene(session_id).expect("current scene");
            if payload.scene.ending.is_some() {
                return;
            }

            let choice = payload
                .scene
                .candidate_choices
                .first()
                .expect("scene should expose a choice");
            store
                .submit_choice(session_id, &choice.id)
                .expect("advance toward ending");
        }
    }

    #[test]
    fn bootstraps_storage_manifest_and_records_diagnostics_events() {
        let dir = tempfile::tempdir().expect("temp dir");
        let runtime_dir = dir.path().to_path_buf();
        let layout = RuntimeDataPaths::new(runtime_dir.clone());

        let mut store = ProjectStore::new(runtime_dir).expect("store");
        let manifest = StorageManifestRepository::new(layout.clone())
            .expect("manifest repo")
            .load()
            .expect("load manifest")
            .expect("manifest present");
        assert_eq!(manifest.version, CURRENT_STORAGE_VERSION);

        let project = store.create_project("临川夜话").expect("project");
        let events = DiagnosticsRepository::new(layout)
            .expect("diagnostics repo")
            .load_all()
            .expect("load diagnostics");

        assert!(events.iter().any(|event| event.operation == "load_from_disk"));
        assert!(events.iter().any(|event| {
            event.operation == "create_project" && event.project_id.as_deref() == Some(project.id.as_str())
        }));
    }

    #[test]
    fn split_into_chapters_preserves_titles_and_ignores_blank_lines() {
        let chapters = split_novel_into_chapters(&sample_novel());

        assert_eq!(chapters.len(), 3);
        assert_eq!(chapters[0].title, "第1章 雨夜来客");
        assert!(chapters[1].content.contains("旧约"));
        assert!(chapters[2].excerpt.contains("沈砚必须决定"));
    }

    #[test]
    fn import_novel_text_rejects_whitespace_only_input_without_mutating_existing_project() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        let imported = store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");

        let error = store
            .import_novel_text(&project.id, "  \n\t  ")
            .expect_err("whitespace import should fail");

        assert!(matches!(error, AppError::Validation(_)));

        let reloaded = store.get_project(&project.id).expect("project");
        assert_eq!(reloaded.raw_text, imported.raw_text);
        assert_eq!(reloaded.chapters.len(), imported.chapters.len());
        assert_eq!(reloaded.build_status.stage, BuildStage::Imported);
        assert_eq!(reloaded.build_status.error, None);
    }

    #[test]
    fn build_story_package_creates_playable_story_bible_and_scene_graph() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("create project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import novel");
        store
            .build_story_package(&project.id)
            .expect("build story package");

        let package = store.load_story_package(&project.id).expect("load package");
        assert!(!package.story_bible.characters.is_empty());
        assert!(!package.story_bible.timeline.is_empty());
        assert!(!package.story_bible.core_conflicts.is_empty());
        assert!(!package.start_scene_id.is_empty());
        assert!(package.scenes.len() >= 4);

        let ending_count = package
            .scenes
            .values()
            .filter(|scene| scene.ending.is_some())
            .count();
        assert!(ending_count >= 2);
    }

    #[test]
    fn build_populates_structured_world_model_and_compiled_snapshot() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");

        let project = store.get_project(&project.id).expect("project");
        assert!(!project.character_cards.is_empty());
        assert!(!project.worldbook_entries.is_empty());
        assert!(!project.rules.is_empty());

        let package = store.load_story_package(&project.id).expect("package");
        assert_eq!(
            package.world_model.character_cards.len(),
            project.character_cards.len()
        );
        assert!(!package.world_model.worldbook_entries.is_empty());
        assert!(!package.world_model.rules.is_empty());
    }

    #[test]
    fn session_flow_supports_choices_free_input_and_checkpoint_rewind() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");

        let session = store.start_session(&project.id).expect("session");
        let payload = store.get_current_scene(&session.session_id).expect("current scene");
        assert!(!payload.scene.candidate_choices.is_empty());

        let first_choice = payload.scene.candidate_choices[0].id.clone();
        let advanced = store
            .submit_choice(&session.session_id, &first_choice)
            .expect("advance scene");
        assert_ne!(advanced.scene.id, payload.scene.id);

        let reacted = store
            .submit_free_input(&session.session_id, "我决定暂时隐瞒真相")
            .expect("free input");
        assert!(reacted.session.free_input_history.iter().any(|item| item.contains("隐瞒真相")));
        assert!(!reacted.session.available_checkpoints.is_empty());

        let checkpoint_id = reacted.session.available_checkpoints[0].checkpoint.id.clone();
        let rewound = store
            .rewind_to_checkpoint(&session.session_id, &checkpoint_id)
            .expect("rewind");
        assert_eq!(rewound.scene.id, reacted.session.available_checkpoints[0].checkpoint.scene_id);
    }

    #[test]
    fn finish_session_marks_ended_sessions_as_finished_and_rewind_reopens_them() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");

        let session = store.start_session(&project.id).expect("session");
        advance_session_to_ending(&mut store, &session.session_id);
        let ending = store
            .get_current_scene(&session.session_id)
            .expect("ending scene");

        assert_eq!(ending.session.status, crate::models::SessionStatus::EndingReached);
        assert!(ending.session.ending_report.is_some());

        let archived = store.finish_session(&session.session_id).expect("finish session");
        assert!(archived.is_some());
        assert_eq!(
            store.get_current_scene(&session.session_id)
                .expect("finished scene")
                .session
                .status,
            crate::models::SessionStatus::Finished
        );

        let checkpoint_id = ending.session.available_checkpoints[0].checkpoint.id.clone();
        let rewound = store
            .rewind_to_checkpoint(&session.session_id, &checkpoint_id)
            .expect("rewind");
        assert_eq!(rewound.session.status, crate::models::SessionStatus::Active);
        assert!(rewound.session.ending_report.is_none());
    }

    #[test]
    fn runtime_snapshot_returns_payload_and_codex_from_the_same_session_state() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");

        let session = store.start_session(&project.id).expect("session");
        let current = store.get_current_scene(&session.session_id).expect("current");
        let advanced = store
            .submit_choice(&session.session_id, &current.scene.candidate_choices[0].id)
            .expect("advance");

        let snapshot = store
            .get_runtime_snapshot(&session.session_id)
            .expect("runtime snapshot");

        assert_eq!(snapshot.payload.session.session_id, session.session_id);
        assert_eq!(snapshot.payload.story_state.current_scene_id, snapshot.payload.session.current_scene_id);
        assert_eq!(snapshot.payload.session.major_choices, snapshot.codex.recent_choices);
        assert_eq!(snapshot.payload.scene.id, advanced.scene.id);
    }

    #[test]
    fn current_scene_exposes_active_lore_rules_and_story_state() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");

        let session = store.start_session(&project.id).expect("session");
        let payload = store.get_current_scene(&session.session_id).expect("payload");

        assert!(!payload.story_state.current_scene_id.is_empty());
        assert!(!payload.active_lore.is_empty());
        assert!(
            payload
                .active_lore
                .iter()
                .any(|entry| entry.slot == WorldBookInsertionMode::RulesGuard)
        );
    }

    #[test]
    fn preview_and_edit_apis_reflect_latest_rule_changes() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");

        let package = store.load_story_package(&project.id).expect("package");
        let scene_id = package.start_scene_id.clone();

        let initial = store
            .preview_rule_evaluation(
                &project.id,
                &scene_id,
                "open_gate",
                None,
                None,
                Some("午夜去开门"),
            )
            .expect("preview");
        assert!(!initial.active_rules.is_empty());

        let mut rule = store.get_project(&project.id).expect("project").rules[0].clone();
        rule.explanation = "更新后的规则说明".into();
        let updated_rules = store.upsert_rule(&project.id, rule).expect("upsert");
        assert!(
            updated_rules
                .iter()
                .any(|candidate| candidate.explanation == "更新后的规则说明")
        );

        let lore_preview = store
            .preview_active_worldbook(&project.id, &scene_id, Some("我在门前犹豫"))
            .expect("lore preview");
        assert!(!lore_preview.is_empty());
        assert!(
            lore_preview
                .iter()
                .all(|entry| !entry.matched_keys.is_empty() && !entry.reason.is_empty())
        );
    }

    #[test]
    fn preview_review_snapshot_uses_explicit_context_and_returns_projected_outcome() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");

        let scene_id = store
            .load_story_package(&project.id)
            .expect("package")
            .start_scene_id;

        let snapshot = store
            .preview_review_snapshot(
                &project.id,
                ReviewPreviewContext {
                    scene_id: scene_id.clone(),
                    event_kind: "open_gate".into(),
                    input_text: "午夜去开门".into(),
                    actor_character_id: Some("character-1".into()),
                    target_character_id: Some("character-2".into()),
                },
            )
            .expect("snapshot");

        assert_eq!(snapshot.context.scene_id, scene_id);
        assert_eq!(snapshot.context.event_kind, "open_gate");
        assert!(!snapshot.explanations.rule_summary.is_empty());
        assert_eq!(snapshot.projected_outcome.blocked, snapshot.rule_preview.blocked);
    }

    #[test]
    fn save_review_preview_context_persists_on_project_and_survives_reload() {
        let dir = tempfile::tempdir().expect("temp dir");
        let project_id = {
            let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");
            let project = store.create_project("临川夜话").expect("project");

            let saved = store
                .save_review_preview_context(
                    &project.id,
                    ReviewPreviewContext {
                        scene_id: "scene-1".into(),
                        event_kind: "open_gate".into(),
                        input_text: "午夜去开门".into(),
                        actor_character_id: Some("character-1".into()),
                        target_character_id: Some("character-2".into()),
                    },
                )
                .expect("saved");

            assert_eq!(saved.event_kind, "open_gate");
            project.id
        };

        let reloaded = ProjectStore::reload(dir.path().to_path_buf()).expect("reload");
        let project = reloaded.get_project(&project_id).expect("project after reload");
        assert_eq!(
            project
                .review_preview_context
                .expect("persisted context")
                .input_text,
            "午夜去开门"
        );
    }

    #[test]
    fn free_input_that_implies_relation_updates_story_possibility_flags() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");

        let session = store.start_session(&project.id).expect("session");
        let second_scene_choice = store
            .get_current_scene(&session.session_id)
            .expect("scene")
            .scene
            .candidate_choices[0]
            .id
            .clone();
        store
            .submit_choice(&session.session_id, &second_scene_choice)
            .expect("move to free input scene");
        store
            .submit_free_input(&session.session_id, "一男一女发生了关系")
            .expect("input");
        let payload = store.get_current_scene(&session.session_id).expect("payload");

        assert!(
            payload
                .story_state
                .possibility_flags
                .iter()
                .any(|flag| flag == "possibility.conception=true")
        );
    }

    #[test]
    fn store_reload_restores_projects_and_sessions_from_disk() {
        let dir = tempfile::tempdir().expect("temp dir");

        let session_id = {
            let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");
            let project = store.create_project("临川夜话").expect("project");
            store
                .import_novel_text(&project.id, &sample_novel())
                .expect("import");
            store.build_story_package(&project.id).expect("build");
            store.start_session(&project.id).expect("session").session_id
        };

        let store = ProjectStore::reload(dir.path().to_path_buf()).expect("reload");
        let payload = store.get_current_scene(&session_id).expect("scene after reload");
        assert!(!payload.scene.title.is_empty());
        assert!(!payload.story_state.current_scene_id.is_empty());
    }

    #[test]
    fn reimport_clears_derived_artifacts_and_invalidates_sessions() {
        let dir = tempfile::tempdir().expect("temp dir");
        let session_id = {
            let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");
            let project = store.create_project("临川夜话").expect("project");
            store
                .import_novel_text(&project.id, &sample_novel())
                .expect("import");
            store.build_story_package(&project.id).expect("build");

            let session = store.start_session(&project.id).expect("session");
            let rewritten = [
                "第1章 新夜",
                "",
                "新的章节把原来的故事替换掉了。",
                "门前只剩下另一种选择。",
            ]
            .join("\n");
            let imported = store
                .import_novel_text(&project.id, &rewritten)
                .expect("re-import");

            assert!(imported.story_package.is_none());
            assert!(imported.character_cards.is_empty());
            assert!(imported.worldbook_entries.is_empty());
            assert!(imported.rules.is_empty());
            assert_eq!(imported.build_status.stage, BuildStage::Imported);
            assert_eq!(imported.build_status.error, None);

            let error = store
                .get_current_scene(&session.session_id)
                .expect_err("session should be invalidated");
            assert!(matches!(error, AppError::NotFound(_)));

            session.session_id
        };

        assert!(!dir.path().join("sessions").join(format!("{session_id}.json")).exists());

        let store = ProjectStore::reload(dir.path().to_path_buf()).expect("reload");
        let error = store
            .get_current_scene(&session_id)
            .expect_err("session should stay removed after reload");
        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn ai_settings_default_to_heuristic_and_persist_without_api_key_in_json() {
        let dir = tempfile::tempdir().expect("temp dir");
        let secrets = Arc::new(InMemorySecretStore::default());
        let mut store = ProjectStore::with_secret_store(dir.path().to_path_buf(), secrets.clone()).expect("store");

        let initial = store.get_ai_settings().expect("initial settings");
        assert_eq!(initial.selected_provider, AiProviderKind::Heuristic);
        assert!(!initial.openai_compatible.has_api_key);
        assert!(!initial.openrouter.has_api_key);

        let saved = store
            .save_ai_settings(default_ai_settings())
            .expect("save settings");
        assert_eq!(saved.selected_provider, AiProviderKind::OpenAiCompatible);
        assert_eq!(saved.openai_compatible.base_url, "https://example.com/v1");
        assert!(saved.openai_compatible.has_api_key);

        let persisted = fs::read_to_string(dir.path().join("ai-settings.json")).expect("settings file");
        assert!(persisted.contains("gpt-4o-mini"));
        assert!(!persisted.contains("sk-openai-test"));

        let reloaded = ProjectStore::reload_with_secret_store(dir.path().to_path_buf(), secrets)
            .expect("reload");
        let reloaded_settings = reloaded.get_ai_settings().expect("reloaded settings");
        assert_eq!(reloaded_settings.selected_provider, AiProviderKind::OpenAiCompatible);
        assert_eq!(reloaded_settings.openai_compatible.base_url, "https://example.com/v1");
        assert!(reloaded_settings.openai_compatible.has_api_key);
    }

    #[test]
    fn clearing_provider_api_key_preserves_non_secret_settings_and_updates_snapshot() {
        let dir = tempfile::tempdir().expect("temp dir");
        let secrets = Arc::new(InMemorySecretStore::default());
        let mut store = ProjectStore::with_secret_store(dir.path().to_path_buf(), secrets).expect("store");
        store
            .save_ai_settings(default_ai_settings())
            .expect("save settings");

        let cleared = store
            .clear_provider_api_key(AiProviderKind::OpenAiCompatible)
            .expect("clear key");
        assert_eq!(cleared.selected_provider, AiProviderKind::OpenAiCompatible);
        assert_eq!(cleared.openai_compatible.model, "gpt-4o-mini");
        assert!(!cleared.openai_compatible.has_api_key);
        assert_eq!(cleared.openrouter.base_url, "https://openrouter.ai/api/v1");
    }

    #[test]
    fn build_story_package_uses_openai_compatible_provider_request_shape() {
        let dir = tempfile::tempdir().expect("temp dir");
        let secrets = Arc::new(InMemorySecretStore::default());
        let transport = Arc::new(FakeChatCompletionsTransport::from_responses(vec![
            Ok(external_analysis_response()),
        ]));
        let mut store = ProjectStore::with_secret_store_and_transport(
            dir.path().to_path_buf(),
            secrets,
            transport.clone(),
        )
        .expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.save_ai_settings(default_ai_settings()).expect("settings");

        let status = store.build_story_package(&project.id).expect("build");
        assert_eq!(status.stage, BuildStage::Ready);

        let requests = transport.requests();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].url, "https://example.com/v1/chat/completions");
        assert_eq!(requests[0].body["model"], "gpt-4o-mini");
        assert_eq!(
            requests[0].headers.get("authorization").map(String::as_str),
            Some("Bearer sk-openai-test")
        );
        assert!(!requests[0].headers.contains_key("x-title"));
    }

    #[test]
    fn build_story_package_uses_openrouter_headers_and_retries_invalid_json_once() {
        let dir = tempfile::tempdir().expect("temp dir");
        let secrets = Arc::new(InMemorySecretStore::default());
        let transport = Arc::new(FakeChatCompletionsTransport::from_responses(vec![
            Ok("not-json".into()),
            Ok(external_analysis_response()),
        ]));
        let mut store = ProjectStore::with_secret_store_and_transport(
            dir.path().to_path_buf(),
            secrets,
            transport.clone(),
        )
        .expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.save_ai_settings(openrouter_settings()).expect("settings");

        store.build_story_package(&project.id).expect("build");

        let requests = transport.requests();
        assert_eq!(requests.len(), 2);
        assert_eq!(requests[0].url, "https://openrouter.ai/api/v1/chat/completions");
        assert_eq!(
            requests[0].headers.get("authorization").map(String::as_str),
            Some("Bearer sk-openrouter-test")
        );
        assert_eq!(
            requests[0].headers.get("x-title").map(String::as_str),
            Some("叙世者")
        );
    }

    #[test]
    fn build_story_package_rejects_external_provider_without_api_key() {
        let dir = tempfile::tempdir().expect("temp dir");
        let secrets = Arc::new(InMemorySecretStore::default());
        let transport = Arc::new(FakeChatCompletionsTransport::default());
        let mut store = ProjectStore::with_secret_store_and_transport(
            dir.path().to_path_buf(),
            secrets,
            transport,
        )
        .expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store
            .save_ai_settings(SaveAiSettingsInput {
                selected_provider: AiProviderKind::OpenAiCompatible,
                openai_compatible: ExternalProviderSettingsInput {
                    base_url: "https://example.com/v1".into(),
                    model: "gpt-4o-mini".into(),
                    api_key: None,
                },
                openrouter: ExternalProviderSettingsInput {
                    base_url: "https://openrouter.ai/api/v1".into(),
                    model: String::new(),
                    api_key: None,
                },
            })
            .expect("settings");

        let error = store
            .build_story_package(&project.id)
            .expect_err("missing key should fail");
        assert!(error.to_string().contains("API key"));
    }

    #[test]
    fn build_story_package_requires_imported_source() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        let error = store
            .build_story_package(&project.id)
            .expect_err("build without import should fail");

        assert!(matches!(error, AppError::InvalidState(_)));
    }

    #[test]
    fn failed_build_persists_failed_status_and_survives_reload() {
        let dir = tempfile::tempdir().expect("temp dir");
        let secrets = Arc::new(InMemorySecretStore::default());
        let transport = Arc::new(FakeChatCompletionsTransport::from_responses(vec![
            Ok("not-json".into()),
            Ok("still-not-json".into()),
        ]));
        let mut store = ProjectStore::with_secret_store_and_transport(
            dir.path().to_path_buf(),
            secrets,
            transport,
        )
        .expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.save_ai_settings(openrouter_settings()).expect("settings");

        let error = store
            .build_story_package(&project.id)
            .expect_err("build should fail");
        assert!(matches!(error, AppError::Provider(_)));

        let failed = store.get_build_status(&project.id).expect("status");
        assert_eq!(failed.stage, BuildStage::Failed);
        assert_eq!(failed.progress, 45);
        assert!(failed.error.as_deref().is_some_and(|message| !message.is_empty()));

        let reloaded = ProjectStore::reload_with_secret_store(
            dir.path().to_path_buf(),
            Arc::new(InMemorySecretStore::default()),
        )
        .expect("reload");
        let failed_after_reload = reloaded.get_build_status(&project.id).expect("status after reload");
        assert_eq!(failed_after_reload.stage, BuildStage::Failed);
        assert_eq!(failed_after_reload.progress, 45);
        assert_eq!(failed_after_reload.error, failed.error);
    }

    #[test]
    fn start_session_resets_the_existing_project_session_state() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project = store.create_project("临川夜话").expect("project");
        store
            .import_novel_text(&project.id, &sample_novel())
            .expect("import");
        store.build_story_package(&project.id).expect("build");

        let first = store.start_session(&project.id).expect("first session");
        let first_scene = store
            .get_current_scene(&first.session_id)
            .expect("first scene before advancing");
        let advanced = store
            .submit_choice(&first.session_id, &first_scene.scene.candidate_choices[0].id)
            .expect("advance existing session");

        let restarted = store.start_session(&project.id).expect("restarted session");
        let current = store
            .get_current_scene(&restarted.session_id)
            .expect("current scene after restart");

        assert_eq!(first.session_id, restarted.session_id);
        assert_ne!(advanced.scene.id, current.scene.id);
        assert_eq!(current.scene.id, first_scene.scene.id);
        assert_eq!(current.session.free_input_history, Vec::<String>::new());
    }

    #[test]
    fn new_store_loads_projects_and_sessions_from_disk_automatically() {
        let dir = tempfile::tempdir().expect("temp dir");
        let (project_id, session_id) = {
            let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");
            let project = store.create_project("临川夜话").expect("project");
            store
                .import_novel_text(&project.id, &sample_novel())
                .expect("import");
            store.build_story_package(&project.id).expect("build");
            let session = store.start_session(&project.id).expect("session");
            (project.id, session.session_id)
        };

        let store = ProjectStore::new(dir.path().to_path_buf()).expect("reloaded store");
        let resumed = store
            .find_project_session(&project_id)
            .expect("session lookup")
            .expect("persisted session");
        let payload = store
            .get_current_scene(&session_id)
            .expect("scene after startup reload");

        assert_eq!(resumed.session_id, session_id);
        assert_eq!(payload.session.session_id, session_id);
    }

    #[test]
    fn list_projects_returns_ready_projects_first() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let imported_only = store.create_project("乙案").expect("imported-only project");
        store
            .import_novel_text(&imported_only.id, &sample_novel())
            .expect("import imported-only project");

        let ready = store.create_project("甲案").expect("ready project");
        store
            .import_novel_text(&ready.id, &sample_novel())
            .expect("import ready project");
        store.build_story_package(&ready.id).expect("build ready project");

        let projects = store.list_projects().expect("list projects");

        assert_eq!(projects[0].id, ready.id);
        assert!(projects.iter().any(|project| project.id == imported_only.id));
    }

    #[test]
    fn list_saved_projects_returns_recent_activity_summary_entries() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut store = ProjectStore::new(dir.path().to_path_buf()).expect("store");

        let project_only_id = build_ready_project(&mut store, "霜桥夜行");
        sleep(Duration::from_millis(20));

        let active_session_project_id = build_ready_project(&mut store, "临川夜话");
        sleep(Duration::from_millis(20));
        let active_session = store
            .start_session(&active_session_project_id)
            .expect("active session");
        let active_scene_title = store
            .get_current_scene(&active_session.session_id)
            .expect("active scene")
            .scene
            .title;
        sleep(Duration::from_millis(20));

        let ending_project_id = build_ready_project(&mut store, "归潮纪");
        sleep(Duration::from_millis(20));
        let ending_session = store.start_session(&ending_project_id).expect("ending session");
        advance_session_to_ending(&mut store, &ending_session.session_id);

        let summaries = store.list_saved_projects().expect("saved project summaries");
        let ordered_ids = summaries
            .iter()
            .map(|entry| entry.project.id.clone())
            .collect::<Vec<_>>();

        assert_eq!(
            ordered_ids,
            vec![
                ending_project_id.clone(),
                active_session_project_id.clone(),
                project_only_id.clone(),
            ]
        );

        let project_only = summaries
            .iter()
            .find(|entry| entry.project.id == project_only_id)
            .expect("project-only entry");
        assert_eq!(project_only.last_activity_kind, SavedProjectActivityKind::Project);
        assert_eq!(project_only.session_id, None);
        assert_eq!(project_only.last_activity_at, store
            .project_repository
            .last_modified_millis(&project_only_id)
            .expect("project mtime")
            .expect("project file should exist"));

        let active = summaries
            .iter()
            .find(|entry| entry.project.id == active_session_project_id)
            .expect("active-session entry");
        assert_eq!(active.last_activity_kind, SavedProjectActivityKind::Session);
        assert_eq!(active.session_id.as_deref(), Some(active_session.session_id.as_str()));
        assert_eq!(active.current_scene_title.as_deref(), Some(active_scene_title.as_str()));
        assert_eq!(active.last_activity_at, store
            .session_repository
            .last_modified_millis(&active_session.session_id)
            .expect("session mtime")
            .expect("session file should exist"));

        let ending = summaries
            .iter()
            .find(|entry| entry.project.id == ending_project_id)
            .expect("ending entry");
        assert_eq!(ending.last_activity_kind, SavedProjectActivityKind::Ending);
        assert_eq!(ending.session_id.as_deref(), Some(ending_session.session_id.as_str()));
        assert!(ending.ending_type.is_some());
        assert_eq!(ending.last_activity_at, store
            .session_repository
            .last_modified_millis(&ending_session.session_id)
            .expect("ending session mtime")
            .expect("ending session file should exist"));
    }

    #[test]
    fn sort_saved_project_entries_breaks_activity_ties_by_name_then_id() {
        let entry = |id: &str, name: &str| SavedProjectLibraryEntry {
            project: crate::models::NovelProject {
                id: id.into(),
                name: name.into(),
                ..crate::models::NovelProject::default()
            },
            session_id: None,
            current_scene_title: None,
            ending_type: None,
            last_activity_at: 42,
            last_activity_kind: SavedProjectActivityKind::Project,
        };

        let mut entries = vec![entry("project-b", "北门"), entry("project-a", "北门"), entry("project-c", "临川")];
        super::sort_saved_project_entries(&mut entries);

        let ordered = entries
            .into_iter()
            .map(|entry| (entry.project.name, entry.project.id))
            .collect::<Vec<_>>();
        assert_eq!(
            ordered,
            vec![
                ("临川".into(), "project-c".into()),
                ("北门".into(), "project-a".into()),
                ("北门".into(), "project-b".into()),
            ]
        );
    }
}
