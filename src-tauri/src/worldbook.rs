use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum WorldBookCategory {
    Character,
    Location,
    SocialRule,
    BiologyRule,
    SupernaturalRule,
    Organization,
    EventMemory,
    #[default]
    Miscellaneous,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum WorldBookInsertionMode {
    ScenePrelude,
    RulesGuard,
    #[default]
    CodexOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum WorldBookSelectiveLogic {
    #[default]
    AndAny,
    NotAll,
    NotAny,
    AndAll,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum LoreLifecycleState {
    #[default]
    Ready,
    Sticky,
    CoolingDown,
    Delayed,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorldBookEntry {
    pub id: String,
    pub title: String,
    pub category: WorldBookCategory,
    pub content: String,
    pub enabled: bool,
    pub keys: Vec<String>,
    pub secondary_keys: Vec<String>,
    pub selective_logic: WorldBookSelectiveLogic,
    pub constant: bool,
    pub recursive: bool,
    pub exclude_recursion: bool,
    pub prevent_recursion: bool,
    pub delay_until_recursion: Option<u8>,
    pub scan_depth: Option<usize>,
    pub case_sensitive: Option<bool>,
    pub match_whole_words: Option<bool>,
    pub sticky: Option<u16>,
    pub cooldown: Option<u16>,
    pub delay: Option<u16>,
    pub triggers: Vec<String>,
    pub ignore_budget: bool,
    pub order: i32,
    pub insertion_mode: WorldBookInsertionMode,
    pub source: String,
    pub rule_binding: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ActiveLoreEntry {
    pub entry_id: String,
    pub title: String,
    pub slot: WorldBookInsertionMode,
    pub matched_keys: Vec<String>,
    pub reason: String,
    pub lifecycle_state: LoreLifecycleState,
    pub content: String,
    pub source: String,
    pub rule_binding: Option<String>,
}
