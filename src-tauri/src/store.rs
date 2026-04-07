use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::Arc,
};

#[cfg(test)]
use std::path::Path;

use uuid::Uuid;

use crate::{
    analyzer::Analyzer,
    compiler::compile_story_package,
    error::{AppError, AppResult},
    importer::{sanitize_text, split_novel_into_chapters},
    models::{
        BuildStage, BuildStatus, CharacterCard, NovelProject, ScenePayload, SessionState,
        StoryBible, StoryCodex, StoryPackage, TimelineEntry, WorldRule,
    },
    provider::{HeuristicStoryProvider, StoryAiProvider},
    rules::RuleDefinition,
    runtime::{RuleEvaluationInput, RuleEvaluationResult, RuntimeEngine},
    worldbook::{ActiveLoreEntry, WorldBookEntry},
};

pub struct ProjectStore {
    base_dir: PathBuf,
    provider: Arc<dyn StoryAiProvider>,
    projects: HashMap<String, NovelProject>,
    sessions: HashMap<String, SessionState>,
}

impl ProjectStore {
    pub fn new(base_dir: PathBuf) -> AppResult<Self> {
        Self::with_provider(base_dir, Arc::new(HeuristicStoryProvider))
    }

    pub fn with_provider(base_dir: PathBuf, provider: Arc<dyn StoryAiProvider>) -> AppResult<Self> {
        fs::create_dir_all(base_dir.join("projects"))?;
        fs::create_dir_all(base_dir.join("sessions"))?;

        Ok(Self {
            base_dir,
            provider,
            projects: HashMap::new(),
            sessions: HashMap::new(),
        })
    }

    #[cfg(test)]
    pub fn reload(base_dir: PathBuf) -> AppResult<Self> {
        let mut store = Self::new(base_dir)?;
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
        Ok(project)
    }

    pub fn import_novel_text(&mut self, project_id: &str, content: &str) -> AppResult<NovelProject> {
        let Some(project) = self.projects.get_mut(project_id) else {
            return Err(AppError::NotFound(project_id.to_string()));
        };

        project.raw_text = sanitize_text(content);
        project.chapters = split_novel_into_chapters(&project.raw_text);
        project.story_package = None;
        project.character_cards.clear();
        project.worldbook_entries.clear();
        project.rules.clear();
        project.build_status = BuildStatus {
            stage: BuildStage::Imported,
            message: "Novel imported".into(),
            progress: 20,
            error: None,
        };

        let snapshot = project.clone();
        self.persist_project(&snapshot)?;
        Ok(snapshot)
    }

    pub fn build_story_package(&mut self, project_id: &str) -> AppResult<BuildStatus> {
        let Some(project) = self.projects.get_mut(project_id) else {
            return Err(AppError::NotFound(project_id.to_string()));
        };

        project.build_status = BuildStatus {
            stage: BuildStage::Analyzing,
            message: "Analyzing source novel".into(),
            progress: 45,
            error: None,
        };

        let analyzer = Analyzer::new(self.provider.clone());
        let extracted = analyzer.analyze(project)?;
        project.character_cards = extracted.character_cards;
        project.worldbook_entries = extracted.worldbook_entries;
        project.rules = extracted.rules;
        project.build_status = BuildStatus {
            stage: BuildStage::Compiling,
            message: "Compiling scene graph".into(),
            progress: 80,
            error: None,
        };
        project.story_package = Some(compile_story_package(project, extracted.story_bible));
        project.build_status = BuildStatus {
            stage: BuildStage::Ready,
            message: "Story package ready".into(),
            progress: 100,
            error: None,
        };

        let snapshot = project.clone();
        self.persist_project(&snapshot)?;
        Ok(snapshot.build_status)
    }

    pub fn get_build_status(&self, project_id: &str) -> AppResult<BuildStatus> {
        self.projects
            .get(project_id)
            .map(|project| project.build_status.clone())
            .ok_or_else(|| AppError::NotFound(project_id.to_string()))
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
        let session = RuntimeEngine::start_session(project_id, &package)?;
        self.persist_session(&session)?;
        self.sessions.insert(session.session_id.clone(), session.clone());
        Ok(session)
    }

    pub fn get_current_scene(&self, session_id: &str) -> AppResult<ScenePayload> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| AppError::NotFound(session_id.to_string()))?;
        let package = self.load_story_package(&session.project_id)?;
        RuntimeEngine::get_current_scene(session, &package)
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
        Ok(payload)
    }

    pub fn finish_session(&self, session_id: &str) -> AppResult<Option<crate::models::EndingReport>> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| AppError::NotFound(session_id.to_string()))?;
        Ok(session.ending_report.clone())
    }

    fn project_path(&self, id: &str) -> PathBuf {
        self.base_dir.join("projects").join(format!("{id}.json"))
    }

    fn session_path(&self, id: &str) -> PathBuf {
        self.base_dir.join("sessions").join(format!("{id}.json"))
    }

    fn persist_project(&self, project: &NovelProject) -> AppResult<()> {
        let content = serde_json::to_string_pretty(project)?;
        fs::write(self.project_path(&project.id), content)?;
        Ok(())
    }

    fn persist_session(&self, session: &SessionState) -> AppResult<()> {
        let content = serde_json::to_string_pretty(session)?;
        fs::write(self.session_path(&session.session_id), content)?;
        Ok(())
    }

    #[cfg(test)]
    fn load_from_disk(&mut self) -> AppResult<()> {
        self.projects = load_objects::<NovelProject>(&self.base_dir.join("projects"))?;
        self.sessions = load_objects::<SessionState>(&self.base_dir.join("sessions"))?;
        Ok(())
    }
}

fn rebuild_story_package_from_project(project: &mut NovelProject) {
    let story_bible = story_bible_snapshot(project);
    project.story_package = Some(compile_story_package(project, story_bible));
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
fn load_objects<T>(dir: &Path) -> AppResult<HashMap<String, T>>
where
    T: serde::de::DeserializeOwned + Clone,
{
    let mut objects = HashMap::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let raw = fs::read_to_string(entry.path())?;
        let object: T = serde_json::from_str(&raw)?;
        objects.insert(
            entry
                .file_name()
                .to_string_lossy()
                .trim_end_matches(".json")
                .to_string(),
            object,
        );
    }
    Ok(objects)
}

#[cfg(test)]
mod tests {
    use super::ProjectStore;
    use crate::importer::split_novel_into_chapters;
    use crate::worldbook::WorldBookInsertionMode;

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

    #[test]
    fn split_into_chapters_preserves_titles_and_ignores_blank_lines() {
        let chapters = split_novel_into_chapters(&sample_novel());

        assert_eq!(chapters.len(), 3);
        assert_eq!(chapters[0].title, "第1章 雨夜来客");
        assert!(chapters[1].content.contains("旧约"));
        assert!(chapters[2].excerpt.contains("沈砚必须决定"));
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
}
