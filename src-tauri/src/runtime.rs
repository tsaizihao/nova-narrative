use serde::{Deserialize, Serialize};

use crate::{
    context_builder::{
        activate_worldbook, advance_lifecycle, apply_activation_effects, build_composite_scan_buffer,
    },
    error::{AppError, AppResult},
    models::{
        CharacterCard, CheckpointMarker, CheckpointSnapshot, ChoiceOption, SceneNode, ScenePayload,
        SessionState, StoryPackage,
    },
    rules::{ActiveRuleHit, RuleDefinition, RuleEffect, RuleOperator},
    state::{CharacterRuntimeState, FactRecord, LoreLifecycleRecord, StoryState},
    worldbook::WorldBookInsertionMode,
};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleEvaluationInput {
    pub event_kind: String,
    pub actor_character_id: String,
    pub actor_gender: String,
    pub target_character_id: String,
    pub target_gender: String,
    pub source_text: String,
    pub scene_title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleEvaluationResult {
    pub story_state: StoryState,
    pub active_rules: Vec<ActiveRuleHit>,
    pub blocked: bool,
}

pub struct RuntimeEngine;

impl RuntimeEngine {
    pub fn start_session(project_id: &str, package: &StoryPackage) -> AppResult<SessionState> {
        let start_scene = package
            .scenes
            .get(&package.start_scene_id)
            .ok_or_else(|| AppError::InvalidState("missing start scene".into()))?;
        let mut session = SessionState {
            session_id: format!("session-{project_id}"),
            project_id: project_id.to_string(),
            current_scene_id: start_scene.id.clone(),
            visited_scenes: vec![start_scene.id.clone()],
            story_state: seed_story_state(start_scene, package),
            lore_lifecycle: seed_lore_lifecycle(package),
            ..SessionState::default()
        };
        refresh_scene_runtime(&mut session, package, None)?;
        capture_checkpoint(&mut session, start_scene);
        Ok(session)
    }

    pub fn get_current_scene(session: &SessionState, package: &StoryPackage) -> AppResult<ScenePayload> {
        assemble_scene_payload(session, package, session.free_input_history.last().map(String::as_str))
    }

    pub fn submit_choice(
        session: &mut SessionState,
        package: &StoryPackage,
        choice_id: &str,
    ) -> AppResult<ScenePayload> {
        let scene = package
            .scenes
            .get(&session.current_scene_id)
            .cloned()
            .ok_or_else(|| AppError::InvalidState("current scene is missing".into()))?;
        let choice = scene
            .candidate_choices
            .iter()
            .find(|choice| choice.id == choice_id)
            .cloned()
            .ok_or_else(|| AppError::NotFound(choice_id.to_string()))?;

        for condition in &choice.unlock_conditions {
            if !has_condition(session, condition) {
                return Err(AppError::RuleViolation(format!(
                    "choice {choice_id} requires condition {condition}"
                )));
            }
        }

        let evaluation = evaluate_for_action(
            session,
            package,
            &scene,
            event_kind_from_choice(&choice),
            &choice.label,
            None,
        )?;
        session.story_state = evaluation.story_state.clone();
        session.last_active_rules = evaluation.active_rules.clone();

        if evaluation.blocked {
            session
                .major_choices
                .push(format!("尝试：{}（被规则阻止）", choice.label));
            refresh_scene_runtime(session, package, Some(&choice.label))?;
            return assemble_scene_payload(session, package, Some(&choice.label));
        }

        for effect in &choice.state_effects {
            apply_state_effect(session, &effect.key, effect.delta, "choice_effect");
        }

        session.major_choices.push(choice.label.clone());

        let next_scene_id = if choice.next_scene_id.is_empty() {
            scene.fallback_next.clone().ok_or_else(|| {
                AppError::InvalidState(format!("scene {} has no next scene", scene.id))
            })?
        } else {
            choice.next_scene_id.clone()
        };

        session.current_scene_id = next_scene_id.clone();
        if !session.visited_scenes.iter().any(|visited| visited == &next_scene_id) {
            session.visited_scenes.push(next_scene_id.clone());
        }

        advance_lifecycle(&mut session.lore_lifecycle, &next_scene_id);
        refresh_scene_runtime(session, package, None)?;

        let next_scene = package
            .scenes
            .get(&next_scene_id)
            .cloned()
            .ok_or_else(|| AppError::InvalidState(format!("missing next scene {next_scene_id}")))?;

        if let Some(ending) = next_scene.ending.clone() {
            session.ending_report = Some(ending);
            session.story_state.ending_report = session
                .ending_report
                .as_ref()
                .map(|ending| ending.summary.clone());
        }

        capture_checkpoint(session, &next_scene);
        assemble_scene_payload(session, package, None)
    }

    pub fn submit_free_input(
        session: &mut SessionState,
        package: &StoryPackage,
        text: &str,
    ) -> AppResult<ScenePayload> {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Err(AppError::Validation("free input cannot be empty".into()));
        }

        let current_scene = package
            .scenes
            .get(&session.current_scene_id)
            .cloned()
            .ok_or_else(|| AppError::InvalidState("current scene is missing".into()))?;
        if !current_scene.allow_free_input {
            return Err(AppError::InvalidState("current scene does not accept free input".into()));
        }

        session.free_input_history.push(trimmed.to_string());
        session.major_choices.push(format!("自由行动：{trimmed}"));

        if trimmed.contains("真相") {
            push_unique(&mut session.rule_flags, "insight:truth".into());
        }
        if trimmed.contains("隐瞒") {
            push_unique(&mut session.rule_flags, "stance:conceal".into());
        }
        if trimmed.contains("守") && trimmed.contains("规") {
            push_unique(&mut session.rule_flags, "stance:obey".into());
        }
        if trimmed.contains("门") {
            push_unique(&mut session.known_facts, "门是本轮抉择的核心".into());
            let next_fact_id = session.story_state.fact_records.len() + 1;
            append_fact(
                &mut session.story_state,
                FactRecord {
                    id: format!("fact-{next_fact_id}"),
                    subject: "story".into(),
                    predicate: "mentions".into(),
                    object: "gate".into(),
                    value: "true".into(),
                    timestamp: session.visited_scenes.len().to_string(),
                    source: "free_input".into(),
                },
            );
        }

        let event_kind = event_kind_from_text(trimmed);
        let evaluation = evaluate_for_action(
            session,
            package,
            &current_scene,
            event_kind,
            trimmed,
            Some(trimmed),
        )?;
        session.story_state = evaluation.story_state.clone();
        session.last_active_rules = evaluation.active_rules.clone();

        refresh_scene_runtime(session, package, Some(trimmed))?;
        assemble_scene_payload(session, package, Some(trimmed))
    }

    pub fn rewind_to_checkpoint(
        session: &mut SessionState,
        package: &StoryPackage,
        checkpoint_id: &str,
    ) -> AppResult<ScenePayload> {
        let snapshot = session
            .available_checkpoints
            .iter()
            .find(|snapshot| snapshot.checkpoint.id == checkpoint_id)
            .cloned()
            .ok_or_else(|| AppError::NotFound(checkpoint_id.to_string()))?;

        session.current_scene_id = snapshot.current_scene_id.clone();
        session.visited_scenes = snapshot.visited_scenes.clone();
        session.known_facts = snapshot.known_facts.clone();
        session.relationship_deltas = snapshot.relationship_deltas.clone();
        session.rule_flags = snapshot.rule_flags.clone();
        session.major_choices = snapshot.major_choices.clone();
        session.ending_report = None;
        session.story_state = snapshot.story_state.clone();
        session.lore_lifecycle = snapshot.lore_lifecycle.clone();
        session.last_active_rules = snapshot.last_active_rules.clone();

        assemble_scene_payload(session, package, session.free_input_history.last().map(String::as_str))
    }

    pub fn preview_active_worldbook(
        package: &StoryPackage,
        scene_id: &str,
        last_free_input: Option<&str>,
    ) -> AppResult<Vec<crate::worldbook::ActiveLoreEntry>> {
        let scene = package
            .scenes
            .get(scene_id)
            .ok_or_else(|| AppError::NotFound(scene_id.to_string()))?;
        let session = SessionState {
            current_scene_id: scene.id.clone(),
            story_state: seed_story_state(scene, package),
            ..SessionState::default()
        };
        let buffer = build_composite_scan_buffer(
            scene,
            &session,
            &package.world_model.character_cards,
            last_free_input,
        );
        Ok(activate_worldbook(
            &package.world_model.worldbook_entries,
            &buffer,
            &seed_lore_lifecycle(package),
            &scene.id,
        ))
    }
}

pub fn evaluate_rules(
    story_state: &StoryState,
    rules: &[RuleDefinition],
    input: RuleEvaluationInput,
) -> AppResult<RuleEvaluationResult> {
    let mut next = story_state.clone();
    let mut active_rules = Vec::new();
    let mut blocked = false;

    for rule in rules.iter().filter(|rule| rule.enabled) {
        let matches = rule
            .conditions
            .iter()
            .all(|condition| compare_value(&fact_value(&input, &condition.fact), &condition.operator, &condition.value));

        if !matches {
            continue;
        }

        push_unique(&mut next.unlocked_rules, rule.id.clone());

        for effect in &rule.effects {
            apply_rule_effect(&mut next, effect);
            if effect.key == "event.forbidden" && effect.value == "true" {
                blocked = true;
            }
        }

        active_rules.push(ActiveRuleHit {
            rule_id: rule.id.clone(),
            name: rule.name.clone(),
            priority: rule.priority.clone(),
            explanation: rule.explanation.clone(),
            effects: rule.effects.clone(),
            reason: format!("命中事件 {} 与场景 {}", input.event_kind, input.scene_title),
        });
    }

    dedupe_story_state(&mut next);

    Ok(RuleEvaluationResult {
        story_state: next,
        active_rules,
        blocked,
    })
}

fn assemble_scene_payload(
    session: &SessionState,
    package: &StoryPackage,
    last_free_input: Option<&str>,
) -> AppResult<ScenePayload> {
    let scene = package
        .scenes
        .get(&session.current_scene_id)
        .cloned()
        .ok_or_else(|| AppError::InvalidState("current scene is missing".into()))?;
    let buffer = build_composite_scan_buffer(
        &scene,
        session,
        &package.world_model.character_cards,
        last_free_input,
    );
    let active_lore = activate_worldbook(
        &package.world_model.worldbook_entries,
        &buffer,
        &session.lore_lifecycle,
        &scene.id,
    );

    let mut active_rules = session.last_active_rules.clone();
    for lore in &active_lore {
        if lore.slot != WorldBookInsertionMode::RulesGuard {
            continue;
        }
        let Some(rule_id) = lore.rule_binding.as_deref() else {
            continue;
        };
        if active_rules.iter().any(|rule| rule.rule_id == rule_id) {
            continue;
        }

        if let Some(rule) = package.world_model.rules.iter().find(|rule| rule.id == rule_id) {
            active_rules.push(ActiveRuleHit {
                rule_id: rule.id.clone(),
                name: rule.name.clone(),
                priority: rule.priority.clone(),
                explanation: rule.explanation.clone(),
                effects: rule.effects.clone(),
                reason: format!("由 lore《{}》激活", lore.title),
            });
        }
    }

    Ok(ScenePayload {
        scene,
        session: session.clone(),
        active_lore,
        active_rules,
        story_state: session.story_state.clone(),
    })
}

fn evaluate_for_action(
    session: &SessionState,
    package: &StoryPackage,
    scene: &SceneNode,
    event_kind: String,
    source_text: &str,
    free_input_override: Option<&str>,
) -> AppResult<RuleEvaluationResult> {
    let (actor, target) = default_actor_target(package, scene);
    let (actor_gender, target_gender) = genders_for_action(source_text, &actor, &target);

    evaluate_rules(
        &session.story_state,
        &package.world_model.rules,
        RuleEvaluationInput {
            event_kind,
            actor_character_id: actor.id,
            actor_gender,
            target_character_id: target.id,
            target_gender,
            source_text: free_input_override.unwrap_or(source_text).to_string(),
            scene_title: scene.title.clone(),
        },
    )
}

fn refresh_scene_runtime(
    session: &mut SessionState,
    package: &StoryPackage,
    last_free_input: Option<&str>,
) -> AppResult<()> {
    let scene = package
        .scenes
        .get(&session.current_scene_id)
        .cloned()
        .ok_or_else(|| AppError::InvalidState("current scene is missing".into()))?;

    let buffer = build_composite_scan_buffer(
        &scene,
        session,
        &package.world_model.character_cards,
        last_free_input,
    );
    let active_lore = activate_worldbook(
        &package.world_model.worldbook_entries,
        &buffer,
        &session.lore_lifecycle,
        &scene.id,
    );
    apply_activation_effects(
        &mut session.lore_lifecycle,
        &package.world_model.worldbook_entries,
        &active_lore,
        &scene.id,
    );

    session.story_state.current_scene_id = scene.id;
    session.story_state.relationship_states = session.relationship_deltas.clone();
    session.story_state.visited_scenes = session.visited_scenes.clone();
    session.story_state.checkpoints = session
        .available_checkpoints
        .iter()
        .map(|snapshot| snapshot.checkpoint.id.clone())
        .collect();
    session.story_state.ending_report = session.ending_report.as_ref().map(|ending| ending.summary.clone());
    dedupe_story_state(&mut session.story_state);
    Ok(())
}

fn has_condition(session: &SessionState, condition: &str) -> bool {
    session.rule_flags.iter().any(|flag| flag == condition)
        || session.known_facts.iter().any(|fact| fact == condition)
        || session
            .story_state
            .possibility_flags
            .iter()
            .any(|flag| flag == condition)
        || session
            .story_state
            .event_flags
            .iter()
            .any(|flag| flag == condition)
}

fn apply_state_effect(session: &mut SessionState, key: &str, delta: i32, source: &str) {
    if let Some(flag) = key.strip_prefix("flag:") {
        push_unique(&mut session.rule_flags, flag.to_string());
        push_unique(&mut session.story_state.event_flags, flag.to_string());
        return;
    }

    if let Some(fact) = key.strip_prefix("fact:") {
        push_unique(&mut session.known_facts, fact.to_string());
        let next_fact_id = session.story_state.fact_records.len() + 1;
        append_fact(
            &mut session.story_state,
            FactRecord {
                id: format!("fact-{next_fact_id}"),
                subject: "story".into(),
                predicate: "fact".into(),
                object: fact.to_string(),
                value: "true".into(),
                timestamp: session.visited_scenes.len().to_string(),
                source: source.to_string(),
            },
        );
        return;
    }

    let entry = session
        .relationship_deltas
        .entry(key.to_string())
        .or_insert(0);
    *entry += delta;
    let relation = session
        .story_state
        .relationship_states
        .entry(key.to_string())
        .or_insert(0);
    *relation += delta;
}

fn capture_checkpoint(session: &mut SessionState, scene: &SceneNode) {
    if !scene.checkpoint {
        return;
    }
    let checkpoint_id = format!("checkpoint-{}", scene.id);
    if session
        .available_checkpoints
        .iter()
        .any(|snapshot| snapshot.checkpoint.id == checkpoint_id)
    {
        return;
    }

    session.available_checkpoints.push(CheckpointSnapshot {
        checkpoint: CheckpointMarker {
            id: checkpoint_id,
            label: scene.title.clone(),
            scene_id: scene.id.clone(),
        },
        current_scene_id: scene.id.clone(),
        visited_scenes: session.visited_scenes.clone(),
        known_facts: session.known_facts.clone(),
        relationship_deltas: session.relationship_deltas.clone(),
        rule_flags: session.rule_flags.clone(),
        major_choices: session.major_choices.clone(),
        story_state: session.story_state.clone(),
        lore_lifecycle: session.lore_lifecycle.clone(),
        last_active_rules: session.last_active_rules.clone(),
    });
}

fn seed_story_state(scene: &SceneNode, package: &StoryPackage) -> StoryState {
    StoryState {
        current_scene_id: scene.id.clone(),
        character_states: package
            .world_model
            .character_cards
            .iter()
            .map(|character| CharacterRuntimeState {
                character_id: character.id.clone(),
                status_flags: Vec::new(),
                counters: Default::default(),
            })
            .collect(),
        visited_scenes: vec![scene.id.clone()],
        ..StoryState::default()
    }
}

fn seed_lore_lifecycle(package: &StoryPackage) -> Vec<LoreLifecycleRecord> {
    package
        .world_model
        .worldbook_entries
        .iter()
        .map(|entry| LoreLifecycleRecord {
            entry_id: entry.id.clone(),
            delay_remaining: entry.delay.unwrap_or_default(),
            ..LoreLifecycleRecord::default()
        })
        .collect()
}

fn event_kind_from_choice(choice: &ChoiceOption) -> String {
    if choice.label.contains("开门") || choice.intent_tag.contains("exile") {
        "open_gate".into()
    } else if choice.label.contains("真相") {
        "seek_truth".into()
    } else {
        choice.intent_tag.clone()
    }
}

fn event_kind_from_text(text: &str) -> String {
    if text.contains("发生关系") || text.contains("发生了关系") || text.contains("上床") {
        "sexual_relation".into()
    } else if text.contains("开门") {
        "open_gate".into()
    } else if text.contains("真相") {
        "seek_truth".into()
    } else {
        "free_input".into()
    }
}

fn default_actor_target(package: &StoryPackage, scene: &SceneNode) -> (CharacterCard, CharacterCard) {
    let actor = package
        .world_model
        .character_cards
        .first()
        .cloned()
        .unwrap_or_default();

    let target = scene
        .present_characters
        .iter()
        .find_map(|present| {
            package
                .world_model
                .character_cards
                .iter()
                .find(|character| {
                    (&character.id == present || &character.name == present) && character.id != actor.id
                })
                .cloned()
        })
        .or_else(|| {
            package
                .world_model
                .character_cards
                .iter()
                .find(|character| character.id != actor.id)
                .cloned()
        })
        .unwrap_or_else(|| actor.clone());

    (actor, target)
}

fn genders_for_action(source_text: &str, actor: &CharacterCard, target: &CharacterCard) -> (String, String) {
    if source_text.contains("一男一女") {
        return ("male".into(), "female".into());
    }
    if source_text.contains("两个男性")
        || source_text.contains("两男")
        || source_text.contains("男男")
    {
        return ("male".into(), "male".into());
    }
    (actor.gender.clone(), target.gender.clone())
}

fn fact_value(input: &RuleEvaluationInput, fact: &str) -> String {
    match fact {
        "event.kind" => input.event_kind.clone(),
        "actor.gender" => input.actor_gender.clone(),
        "target.gender" => input.target_gender.clone(),
        "scene.time" => {
            if input.source_text.contains("午夜") || input.scene_title.contains("午夜") {
                "midnight".into()
            } else {
                "day".into()
            }
        }
        "input.text" => input.source_text.clone(),
        "scene.title" => input.scene_title.clone(),
        _ => String::new(),
    }
}

fn compare_value(left: &str, operator: &RuleOperator, right: &str) -> bool {
    match operator {
        RuleOperator::Equals => left == right,
        RuleOperator::NotEquals => left != right,
        RuleOperator::Contains => left.contains(right),
        RuleOperator::GreaterThan => {
            left.parse::<i64>().ok().zip(right.parse::<i64>().ok()).is_some_and(|(l, r)| l > r)
        }
        RuleOperator::LessThan => {
            left.parse::<i64>().ok().zip(right.parse::<i64>().ok()).is_some_and(|(l, r)| l < r)
        }
    }
}

fn apply_rule_effect(story_state: &mut StoryState, effect: &RuleEffect) {
    if effect.key.starts_with("possibility.") {
        push_unique(
            &mut story_state.possibility_flags,
            format!("{}={}", effect.key, effect.value),
        );
    } else {
        push_unique(
            &mut story_state.event_flags,
            format!("{}={}", effect.key, effect.value),
        );
    }
}

fn push_unique(items: &mut Vec<String>, value: String) {
    if !items.iter().any(|item| item == &value) {
        items.push(value);
    }
}

fn append_fact(story_state: &mut StoryState, fact: FactRecord) {
    if story_state
        .fact_records
        .iter()
        .any(|candidate| candidate.subject == fact.subject && candidate.object == fact.object && candidate.value == fact.value)
    {
        return;
    }
    story_state.fact_records.push(fact);
}

fn dedupe_story_state(story_state: &mut StoryState) {
    story_state.event_flags.sort();
    story_state.event_flags.dedup();
    story_state.possibility_flags.sort();
    story_state.possibility_flags.dedup();
    story_state.unlocked_rules.sort();
    story_state.unlocked_rules.dedup();
    story_state.visited_scenes.sort();
    story_state.visited_scenes.dedup();
    story_state.checkpoints.sort();
    story_state.checkpoints.dedup();
}

#[cfg(test)]
mod structured_rule_tests {
    use crate::rules::{
        RuleCondition, RuleDefinition, RuleEffect, RuleOperator, RulePriority,
    };

    use super::{evaluate_rules, RuleEvaluationInput};

    #[test]
    fn same_sex_relation_blocks_conception() {
        let rules = vec![RuleDefinition {
            id: "rule-biology-1".into(),
            name: "same-sex-cannot-conceive".into(),
            category: "biology".into(),
            priority: RulePriority::HardConstraint,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    fact: "event.kind".into(),
                    operator: RuleOperator::Equals,
                    value: "sexual_relation".into(),
                },
                RuleCondition {
                    fact: "actor.gender".into(),
                    operator: RuleOperator::Equals,
                    value: "male".into(),
                },
                RuleCondition {
                    fact: "target.gender".into(),
                    operator: RuleOperator::Equals,
                    value: "male".into(),
                },
            ],
            blockers: Vec::new(),
            effects: vec![RuleEffect {
                key: "possibility.conception".into(),
                value: "false".into(),
            }],
            explanation: "两个男性不能自然生育".into(),
        }];

        let result = evaluate_rules(
            &crate::state::StoryState::default(),
            &rules,
            RuleEvaluationInput {
                event_kind: "sexual_relation".into(),
                actor_character_id: "shen".into(),
                actor_gender: "male".into(),
                target_character_id: "ning".into(),
                target_gender: "male".into(),
                source_text: "两人发生了关系".into(),
                scene_title: "禁忌之门".into(),
            },
        )
        .expect("evaluation");

        assert!(
            result
                .story_state
                .possibility_flags
                .iter()
                .any(|flag| flag == "possibility.conception=false")
        );
        assert!(result.active_rules.iter().any(|hit| hit.rule_id == "rule-biology-1"));
    }

    #[test]
    fn mixed_sex_relation_marks_conception_possible() {
        let rules = vec![RuleDefinition {
            id: "rule-biology-2".into(),
            name: "mixed-sex-can-conceive".into(),
            category: "biology".into(),
            priority: RulePriority::Consequence,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    fact: "event.kind".into(),
                    operator: RuleOperator::Equals,
                    value: "sexual_relation".into(),
                },
                RuleCondition {
                    fact: "actor.gender".into(),
                    operator: RuleOperator::Equals,
                    value: "male".into(),
                },
                RuleCondition {
                    fact: "target.gender".into(),
                    operator: RuleOperator::Equals,
                    value: "female".into(),
                },
            ],
            blockers: Vec::new(),
            effects: vec![RuleEffect {
                key: "possibility.conception".into(),
                value: "true".into(),
            }],
            explanation: "一男一女发生关系时可能怀孕".into(),
        }];

        let result = evaluate_rules(
            &crate::state::StoryState::default(),
            &rules,
            RuleEvaluationInput {
                event_kind: "sexual_relation".into(),
                actor_character_id: "shen".into(),
                actor_gender: "male".into(),
                target_character_id: "ning".into(),
                target_gender: "female".into(),
                source_text: "一男一女发生了关系".into(),
                scene_title: "选择".into(),
            },
        )
        .expect("evaluation");

        assert!(
            result
                .story_state
                .possibility_flags
                .iter()
                .any(|flag| flag == "possibility.conception=true")
        );
        assert!(result.active_rules.iter().any(|hit| hit.rule_id == "rule-biology-2"));
    }

    #[test]
    fn midnight_gate_rule_flags_forbidden_action() {
        let rules = vec![RuleDefinition {
            id: "rule-gate-1".into(),
            name: "north-gate-midnight-forbidden".into(),
            category: "social_rule".into(),
            priority: RulePriority::HardConstraint,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    fact: "event.kind".into(),
                    operator: RuleOperator::Equals,
                    value: "open_gate".into(),
                },
                RuleCondition {
                    fact: "scene.time".into(),
                    operator: RuleOperator::Equals,
                    value: "midnight".into(),
                },
            ],
            blockers: Vec::new(),
            effects: vec![RuleEffect {
                key: "event.forbidden".into(),
                value: "true".into(),
            }],
            explanation: "午夜后绝不能打开北门".into(),
        }];

        let result = evaluate_rules(
            &crate::state::StoryState::default(),
            &rules,
            RuleEvaluationInput {
                event_kind: "open_gate".into(),
                actor_character_id: "shen".into(),
                actor_gender: "male".into(),
                target_character_id: "gate".into(),
                target_gender: "unknown".into(),
                source_text: "我要开门".into(),
                scene_title: "午夜北门".into(),
            },
        )
        .expect("evaluation");

        assert!(result.blocked);
        assert!(result.active_rules.iter().any(|hit| hit.rule_id == "rule-gate-1"));
    }
}
