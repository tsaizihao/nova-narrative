use std::collections::{BTreeMap, BTreeSet};

use crate::{
    models::{CharacterCard, SceneNode, SessionState},
    state::LoreLifecycleRecord,
    worldbook::{
        ActiveLoreEntry, LoreLifecycleState, WorldBookEntry, WorldBookSelectiveLogic,
    },
};

const DEFAULT_BUDGET: usize = 8;
const MAX_RECURSION_DEPTH: usize = 2;

#[derive(Debug, Clone, Default)]
pub struct CompositeScanBuffer {
    pub segments: Vec<String>,
    pub flattened: String,
    pub recursion_buffer: Vec<String>,
}

pub fn build_composite_scan_buffer(
    scene: &SceneNode,
    session: &SessionState,
    characters: &[CharacterCard],
    last_free_input: Option<&str>,
) -> CompositeScanBuffer {
    let present_summaries = characters
        .iter()
        .filter(|character| {
            scene.present_characters.iter().any(|present| {
                present == &character.id || present == &character.name
            })
        })
        .map(|character| format!("{}：{}", character.name, character.summary))
        .collect::<Vec<_>>();

    let mut segments = vec![scene.title.clone(), scene.summary.clone()];
    if !scene.narration.is_empty() {
        segments.push(scene.narration.join("\n"));
    }
    if !present_summaries.is_empty() {
        segments.push(present_summaries.join("\n"));
    }
    if !session.major_choices.is_empty() {
        segments.push(session.major_choices.iter().rev().take(3).cloned().collect::<Vec<_>>().join("\n"));
    }
    if let Some(input) = last_free_input {
        segments.push(input.to_string());
    }
    if !session.known_facts.is_empty() {
        segments.push(session.known_facts.join("\n"));
    }

    let flattened = segments.join("\n");
    CompositeScanBuffer {
        recursion_buffer: Vec::new(),
        segments,
        flattened,
    }
}

pub fn advance_lifecycle(records: &mut [LoreLifecycleRecord], next_scene_id: &str) {
    for record in records.iter_mut() {
        if record.last_scene_id.as_deref() == Some(next_scene_id) {
            continue;
        }

        if record.delay_remaining > 0 {
            record.delay_remaining -= 1;
            record.state = LoreLifecycleState::Delayed;
        } else if record.cooldown_remaining > 0 {
            record.cooldown_remaining -= 1;
            record.state = LoreLifecycleState::CoolingDown;
        } else if record.sticky_remaining > 0 {
            record.sticky_remaining -= 1;
            record.state = LoreLifecycleState::Sticky;
        } else {
            record.state = LoreLifecycleState::Ready;
        }
    }
}

pub fn apply_activation_effects(
    records: &mut Vec<LoreLifecycleRecord>,
    entries: &[WorldBookEntry],
    active_entries: &[ActiveLoreEntry],
    scene_id: &str,
) {
    let mut by_id = records
        .iter()
        .cloned()
        .map(|record| (record.entry_id.clone(), record))
        .collect::<BTreeMap<_, _>>();

    for entry in entries {
        by_id.entry(entry.id.clone()).or_insert_with(|| LoreLifecycleRecord {
            entry_id: entry.id.clone(),
            delay_remaining: entry.delay.unwrap_or_default(),
            ..LoreLifecycleRecord::default()
        });
    }

    let active_ids = active_entries
        .iter()
        .map(|entry| entry.entry_id.clone())
        .collect::<BTreeSet<_>>();

    for entry in entries {
        let Some(record) = by_id.get_mut(&entry.id) else {
            continue;
        };

        if active_ids.contains(&entry.id) {
            if let Some(sticky) = entry.sticky {
                record.sticky_remaining = sticky.saturating_add(1);
                record.state = LoreLifecycleState::Sticky;
            } else {
                record.state = LoreLifecycleState::Ready;
            }
            if let Some(cooldown) = entry.cooldown {
                record.cooldown_remaining = cooldown.saturating_add(1);
            }
            record.last_scene_id = Some(scene_id.to_string());
        } else if record.last_scene_id.as_deref() == Some(scene_id) {
            if let Some(cooldown) = entry.cooldown {
                record.cooldown_remaining = cooldown.saturating_add(1);
                record.state = LoreLifecycleState::CoolingDown;
            }
        }
    }

    *records = by_id.into_values().collect();
}

pub fn activate_worldbook(
    entries: &[WorldBookEntry],
    buffer: &CompositeScanBuffer,
    lifecycle: &[LoreLifecycleRecord],
    scene_id: &str,
) -> Vec<ActiveLoreEntry> {
    let mut by_id = lifecycle
        .iter()
        .map(|record| (record.entry_id.as_str(), record))
        .collect::<BTreeMap<_, _>>();
    let mut active = entries
        .iter()
        .filter(|entry| entry.enabled)
        .filter_map(|entry| {
            let record = by_id.remove(entry.id.as_str());
            evaluate_entry(entry, buffer, record, scene_id)
        })
        .collect::<Vec<_>>();

    for depth in 0..MAX_RECURSION_DEPTH {
        let recursive_seed = active
            .iter()
            .filter(|entry| {
                entries
                    .iter()
                    .find(|candidate| candidate.id == entry.entry_id)
                    .is_some_and(|candidate| candidate.recursive && !candidate.prevent_recursion)
            })
            .map(|entry| entry.content.clone())
            .collect::<Vec<_>>();

        if recursive_seed.is_empty() {
            break;
        }

        let mut recursive_buffer = buffer.clone();
        recursive_buffer.recursion_buffer = recursive_seed.clone();
        recursive_buffer.flattened = format!("{}\n{}", recursive_buffer.flattened, recursive_seed.join("\n"));

        let existing_ids = active
            .iter()
            .map(|entry| entry.entry_id.clone())
            .collect::<BTreeSet<_>>();

        let recursive_matches = entries
            .iter()
            .filter(|entry| !existing_ids.contains(&entry.id))
            .filter(|entry| entry.enabled && !entry.exclude_recursion)
            .filter_map(|entry| {
                let record = lifecycle.iter().find(|record| record.entry_id == entry.id);
                evaluate_entry(entry, &recursive_buffer, record, scene_id).map(|mut match_entry| {
                    match_entry.reason = format!("递归激活（第 {} 层）：{}", depth + 1, match_entry.reason);
                    match_entry
                })
            })
            .collect::<Vec<_>>();

        if recursive_matches.is_empty() {
            break;
        }

        active.extend(recursive_matches);
    }

    active.sort_by(|left, right| {
        let left_order = entries
            .iter()
            .find(|entry| entry.id == left.entry_id)
            .map(|entry| entry.order)
            .unwrap_or_default();
        let right_order = entries
            .iter()
            .find(|entry| entry.id == right.entry_id)
            .map(|entry| entry.order)
            .unwrap_or_default();
        left_order
            .cmp(&right_order)
            .then_with(|| left.title.cmp(&right.title))
    });

    let mut budgeted = Vec::new();
    for entry in active {
        let ignore_budget = entries
            .iter()
            .find(|candidate| candidate.id == entry.entry_id)
            .is_some_and(|candidate| candidate.ignore_budget);
        if ignore_budget || budgeted.len() < DEFAULT_BUDGET {
            budgeted.push(entry);
        }
    }
    budgeted
}

fn evaluate_entry(
    entry: &WorldBookEntry,
    buffer: &CompositeScanBuffer,
    record: Option<&LoreLifecycleRecord>,
    scene_id: &str,
) -> Option<ActiveLoreEntry> {
    let current_text = build_scannable_text(entry, buffer);
    let matched_keys = match_primary_keys(entry, &current_text);
    let sticky_active = record.is_some_and(|record| record.sticky_remaining > 0);

    if record.is_some_and(|record| {
        record.delay_remaining > 0 && record.last_scene_id.as_deref() != Some(scene_id)
    }) {
        return None;
    }
    if record.is_some_and(|record| {
        record.cooldown_remaining > 0
            && record.last_scene_id.as_deref() != Some(scene_id)
            && !sticky_active
    }) {
        return None;
    }

    let matched = entry.constant || !matched_keys.is_empty();
    let secondaries_match = secondary_keys_match(entry, &current_text);

    if !(matched && secondaries_match) && !sticky_active {
        return None;
    }

    let lifecycle_state = if sticky_active && !matched {
        LoreLifecycleState::Sticky
    } else if record.is_some_and(|record| record.cooldown_remaining > 0) {
        LoreLifecycleState::CoolingDown
    } else if record.is_some_and(|record| record.delay_remaining > 0) {
        LoreLifecycleState::Delayed
    } else {
        LoreLifecycleState::Ready
    };

    let reason = if entry.constant {
        "常驻条目".to_string()
    } else if sticky_active && matched_keys.is_empty() {
        "sticky 持续生效".to_string()
    } else {
        format!("命中关键词：{}", matched_keys.join(" / "))
    };

    Some(ActiveLoreEntry {
        entry_id: entry.id.clone(),
        title: entry.title.clone(),
        slot: entry.insertion_mode.clone(),
        matched_keys,
        reason,
        lifecycle_state,
        content: entry.content.clone(),
        source: entry.source.clone(),
        rule_binding: entry.rule_binding.clone(),
    })
}

fn build_scannable_text(entry: &WorldBookEntry, buffer: &CompositeScanBuffer) -> String {
    if let Some(scan_depth) = entry.scan_depth {
        buffer
            .segments
            .iter()
            .rev()
            .take(scan_depth)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n")
    } else {
        buffer.flattened.clone()
    }
}

fn match_primary_keys(entry: &WorldBookEntry, current_text: &str) -> Vec<String> {
    let haystack = normalize_text(current_text, entry.case_sensitive.unwrap_or(false));
    entry
        .keys
        .iter()
        .filter(|key| contains_key(&haystack, key, entry))
        .cloned()
        .collect()
}

fn secondary_keys_match(entry: &WorldBookEntry, current_text: &str) -> bool {
    if entry.secondary_keys.is_empty() {
        return true;
    }

    let haystack = normalize_text(current_text, entry.case_sensitive.unwrap_or(false));
    let matches = entry
        .secondary_keys
        .iter()
        .filter(|key| contains_key(&haystack, key, entry))
        .count();

    match entry.selective_logic {
        WorldBookSelectiveLogic::AndAny => matches > 0,
        WorldBookSelectiveLogic::AndAll => matches == entry.secondary_keys.len(),
        WorldBookSelectiveLogic::NotAny => matches == 0,
        WorldBookSelectiveLogic::NotAll => matches < entry.secondary_keys.len(),
    }
}

fn contains_key(haystack: &str, key: &str, entry: &WorldBookEntry) -> bool {
    let normalized_key = normalize_text(key, entry.case_sensitive.unwrap_or(false));
    if entry.match_whole_words.unwrap_or(false) {
        haystack
            .split(|character: char| !character.is_alphanumeric() && !character.is_ascii_punctuation())
            .any(|segment| segment == normalized_key)
    } else {
        haystack.contains(&normalized_key)
    }
}

fn normalize_text(value: &str, case_sensitive: bool) -> String {
    if case_sensitive {
        value.to_string()
    } else {
        value.to_lowercase()
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        state::LoreLifecycleRecord,
        worldbook::{
            LoreLifecycleState, WorldBookCategory, WorldBookEntry, WorldBookInsertionMode,
        },
    };

    use super::{
        activate_worldbook, advance_lifecycle, apply_activation_effects, CompositeScanBuffer,
    };

    #[test]
    fn sticky_entries_remain_active_after_primary_keyword_disappears() {
        let entry = WorldBookEntry {
            id: "sticky".into(),
            title: "北门余波".into(),
            category: WorldBookCategory::EventMemory,
            content: "北门余波仍在".into(),
            enabled: true,
            keys: vec!["北门".into()],
            sticky: Some(1),
            insertion_mode: WorldBookInsertionMode::ScenePrelude,
            source: "test".into(),
            ..WorldBookEntry::default()
        };

        let first = activate_worldbook(
            &[entry.clone()],
            &CompositeScanBuffer {
                segments: vec!["北门打开".into()],
                flattened: "北门打开".into(),
                recursion_buffer: Vec::new(),
            },
            &[],
            "scene-1",
        );
        let mut lifecycle = vec![LoreLifecycleRecord::default()];
        apply_activation_effects(&mut lifecycle, &[entry.clone()], &first, "scene-1");
        advance_lifecycle(&mut lifecycle, "scene-2");
        let second = activate_worldbook(
            &[entry],
            &CompositeScanBuffer {
                segments: vec!["雨夜".into()],
                flattened: "雨夜".into(),
                recursion_buffer: Vec::new(),
            },
            &lifecycle,
            "scene-2",
        );

        assert_eq!(second.len(), 1);
        assert_eq!(second[0].lifecycle_state, LoreLifecycleState::Sticky);
    }

    #[test]
    fn cooldown_entries_do_not_immediately_reactivate() {
        let entry = WorldBookEntry {
            id: "cooldown".into(),
            title: "北门戒律".into(),
            category: WorldBookCategory::SocialRule,
            content: "午夜后不能开门".into(),
            enabled: true,
            keys: vec!["北门".into()],
            cooldown: Some(1),
            insertion_mode: WorldBookInsertionMode::RulesGuard,
            source: "test".into(),
            ..WorldBookEntry::default()
        };

        let first = activate_worldbook(
            &[entry.clone()],
            &CompositeScanBuffer {
                segments: vec!["北门".into()],
                flattened: "北门".into(),
                recursion_buffer: Vec::new(),
            },
            &[],
            "scene-1",
        );
        let mut lifecycle = Vec::new();
        apply_activation_effects(&mut lifecycle, &[entry.clone()], &first, "scene-1");
        advance_lifecycle(&mut lifecycle, "scene-2");
        let second = activate_worldbook(
            &[entry],
            &CompositeScanBuffer {
                segments: vec!["北门".into()],
                flattened: "北门".into(),
                recursion_buffer: Vec::new(),
            },
            &lifecycle,
            "scene-2",
        );

        assert!(second.is_empty());
    }

    #[test]
    fn delayed_entries_wait_for_scene_advancement() {
        let entry = WorldBookEntry {
            id: "delay".into(),
            title: "雾中回声".into(),
            category: WorldBookCategory::EventMemory,
            content: "雾会吞掉名字".into(),
            enabled: true,
            keys: vec!["雾".into()],
            delay: Some(1),
            insertion_mode: WorldBookInsertionMode::CodexOnly,
            source: "test".into(),
            ..WorldBookEntry::default()
        };

        let mut lifecycle = vec![LoreLifecycleRecord {
            entry_id: entry.id.clone(),
            delay_remaining: 1,
            state: LoreLifecycleState::Delayed,
            ..LoreLifecycleRecord::default()
        }];

        let first = activate_worldbook(
            &[entry.clone()],
            &CompositeScanBuffer {
                segments: vec!["雾".into()],
                flattened: "雾".into(),
                recursion_buffer: Vec::new(),
            },
            &lifecycle,
            "scene-1",
        );
        assert!(first.is_empty());

        advance_lifecycle(&mut lifecycle, "scene-2");
        let second = activate_worldbook(
            &[entry],
            &CompositeScanBuffer {
                segments: vec!["雾".into()],
                flattened: "雾".into(),
                recursion_buffer: Vec::new(),
            },
            &lifecycle,
            "scene-2",
        );
        assert_eq!(second.len(), 1);
    }
}
