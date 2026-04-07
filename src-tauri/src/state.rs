use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::worldbook::LoreLifecycleState;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FactRecord {
    pub id: String,
    pub subject: String,
    pub predicate: String,
    pub object: String,
    pub value: String,
    pub timestamp: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CharacterRuntimeState {
    pub character_id: String,
    pub status_flags: Vec<String>,
    pub counters: BTreeMap<String, i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoryState {
    pub current_scene_id: String,
    pub character_states: Vec<CharacterRuntimeState>,
    pub fact_records: Vec<FactRecord>,
    pub relationship_states: BTreeMap<String, i32>,
    pub event_flags: Vec<String>,
    pub possibility_flags: Vec<String>,
    pub unlocked_rules: Vec<String>,
    pub visited_scenes: Vec<String>,
    pub checkpoints: Vec<String>,
    pub ending_report: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoreLifecycleRecord {
    pub entry_id: String,
    pub sticky_remaining: u16,
    pub cooldown_remaining: u16,
    pub delay_remaining: u16,
    pub state: LoreLifecycleState,
    pub last_scene_id: Option<String>,
}
