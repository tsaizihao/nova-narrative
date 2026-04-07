use std::sync::Arc;

use crate::{
    error::AppResult,
    models::NovelProject,
    provider::{ExtractedWorldModel, StoryAiProvider},
};

pub struct Analyzer {
    provider: Arc<dyn StoryAiProvider>,
}

impl Analyzer {
    pub fn new(provider: Arc<dyn StoryAiProvider>) -> Self {
        Self { provider }
    }

    pub fn analyze(&self, project: &NovelProject) -> AppResult<ExtractedWorldModel> {
        self.provider.analyze(project)
    }
}
