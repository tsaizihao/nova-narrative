use std::collections::{BTreeSet, HashMap};

use regex::Regex;

use crate::{
    error::AppResult,
    models::{
        CharacterCard, CoreConflict, LocationCard, NovelProject, RelationshipEdge, StoryBible,
        TimelineEntry, WorldRule,
    },
    rules::{RuleCondition, RuleDefinition, RuleEffect, RuleOperator, RulePriority},
    worldbook::{
        WorldBookCategory, WorldBookEntry, WorldBookInsertionMode, WorldBookSelectiveLogic,
    },
};

pub struct ExtractedWorldModel {
    pub character_cards: Vec<CharacterCard>,
    pub worldbook_entries: Vec<WorldBookEntry>,
    pub rules: Vec<RuleDefinition>,
    pub story_bible: StoryBible,
}

pub trait StoryAiProvider: Send + Sync {
    fn analyze(&self, project: &NovelProject) -> AppResult<ExtractedWorldModel>;
}

#[derive(Default)]
pub struct HeuristicStoryProvider;

impl StoryAiProvider for HeuristicStoryProvider {
    fn analyze(&self, project: &NovelProject) -> AppResult<ExtractedWorldModel> {
        let text = project.raw_text.as_str();
        let character_names = extract_character_names(text);
        let location_names = extract_locations(text);
        let rule_sentences = extract_rule_sentences(text);

        let character_cards = character_names
            .iter()
            .enumerate()
            .map(|(index, name)| CharacterCard {
                id: format!("character-{}", index + 1),
                name: name.clone(),
                gender: match index {
                    0 => "male",
                    1 => "female",
                    _ => "unknown",
                }
                .into(),
                age: Some(20 + index as u16),
                identity: match index {
                    0 => "守门人",
                    1 => "破局者",
                    _ => "见证者",
                }
                .into(),
                faction: if index % 2 == 0 { "临川城" } else { "门外之约" }.into(),
                role: match index {
                    0 => "主视角",
                    1 => "关键同伴",
                    2 => "守门人",
                    _ => "重要角色",
                }
                .into(),
                secrets: vec![format!("{name} 对北门的真正代价知情")],
                traits: vec!["克制".into(), "警觉".into()],
                abilities: vec!["记住规则".into(), "推动剧情".into()],
                mutable_state: [("trust".into(), "1".into())].into_iter().collect(),
                summary: format!("{name} 是故事推进中的关键角色。"),
                desire: match index {
                    0 => "想要在真相与规训之间做出选择",
                    1 => "想要唤醒沉睡的约定",
                    2 => "想要守住故事既有秩序",
                    _ => "想要改写当前局面",
                }
                .into(),
            })
            .collect::<Vec<_>>();

        let locations = location_names
            .iter()
            .enumerate()
            .map(|(index, name)| LocationCard {
                id: format!("location-{}", index + 1),
                name: name.clone(),
                summary: format!("{name} 是当前故事最有戏剧张力的地点之一。"),
            })
            .collect::<Vec<_>>();

        let timeline = project
            .chapters
            .iter()
            .enumerate()
            .map(|(index, chapter)| TimelineEntry {
                id: format!("timeline-{}", index + 1),
                label: chapter.title.clone(),
                order: index + 1,
                summary: chapter.excerpt.clone(),
            })
            .collect::<Vec<_>>();

        let world_rules = rule_sentences
            .iter()
            .enumerate()
            .map(|(index, description)| WorldRule {
                id: format!("rule-{}", index + 1),
                description: description.clone(),
            })
            .collect::<Vec<_>>();

        let protagonist = character_cards
            .first()
            .map(|character| character.name.clone())
            .unwrap_or_else(|| "主角".into());
        let relationships = character_cards
            .iter()
            .skip(1)
            .enumerate()
            .map(|(index, character)| RelationshipEdge {
                source: protagonist.clone(),
                target: character.name.clone(),
                label: match index {
                    0 => "信任与试探",
                    1 => "对立与牵制",
                    _ => "未竟之约",
                }
                .into(),
                strength: 2 - index as i32,
            })
            .collect::<Vec<_>>();

        let core_conflicts = vec![CoreConflict {
            id: "conflict-1".into(),
            title: "秩序与真相".into(),
            summary: if let Some(rule) = world_rules.first() {
                format!("角色必须在“{}”与揭开真相之间做出选择。", rule.description)
            } else {
                "角色必须在守住既有秩序与追索真相之间做出选择。".into()
            },
        }];

        let rules = build_rules();
        let worldbook_entries = build_worldbook_entries(&character_cards, &locations, &rule_sentences, &rules);
        let story_bible = StoryBible {
            title: project.name.clone(),
            characters: character_cards.clone(),
            locations,
            timeline,
            world_rules,
            relationships,
            core_conflicts,
        };

        Ok(ExtractedWorldModel {
            character_cards,
            worldbook_entries,
            rules,
            story_bible,
        })
    }
}

fn build_rules() -> Vec<RuleDefinition> {
    vec![
        RuleDefinition {
            id: "rule-biology-1".into(),
            name: "same-sex-cannot-conceive".into(),
            category: "biology_rule".into(),
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
        },
        RuleDefinition {
            id: "rule-biology-2".into(),
            name: "mixed-sex-can-conceive".into(),
            category: "biology_rule".into(),
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
            explanation: "一男一女发生关系时存在怀孕可能".into(),
        },
        RuleDefinition {
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
            explanation: "午夜之后绝不能打开北门".into(),
        },
    ]
}

fn build_worldbook_entries(
    character_cards: &[CharacterCard],
    locations: &[LocationCard],
    rule_sentences: &[String],
    rules: &[RuleDefinition],
) -> Vec<WorldBookEntry> {
    let mut entries = character_cards
        .iter()
        .enumerate()
        .map(|(index, character)| WorldBookEntry {
            id: format!("lore-character-{}", index + 1),
            title: format!("角色卡：{}", character.name),
            category: WorldBookCategory::Character,
            content: format!("{}，{}，欲望：{}", character.identity, character.summary, character.desire),
            enabled: true,
            keys: vec![character.name.clone()],
            secondary_keys: vec![character.identity.clone()],
            selective_logic: WorldBookSelectiveLogic::AndAny,
            constant: index == 0,
            recursive: false,
            exclude_recursion: false,
            prevent_recursion: false,
            delay_until_recursion: None,
            scan_depth: Some(4),
            case_sensitive: Some(false),
            match_whole_words: Some(false),
            sticky: Some(1),
            cooldown: None,
            delay: None,
            triggers: vec!["scene".into()],
            ignore_budget: index == 0,
            order: index as i32,
            insertion_mode: WorldBookInsertionMode::CodexOnly,
            source: "character_card".into(),
            rule_binding: None,
        })
        .collect::<Vec<_>>();

    entries.extend(locations.iter().enumerate().map(|(index, location)| WorldBookEntry {
        id: format!("lore-location-{}", index + 1),
        title: format!("地点：{}", location.name),
        category: WorldBookCategory::Location,
        content: location.summary.clone(),
        enabled: true,
        keys: vec![location.name.clone()],
        secondary_keys: vec!["雨".into(), "门".into()],
        selective_logic: WorldBookSelectiveLogic::AndAny,
        constant: false,
        recursive: index == 0,
        exclude_recursion: false,
        prevent_recursion: false,
        delay_until_recursion: None,
        scan_depth: Some(4),
        case_sensitive: Some(false),
        match_whole_words: Some(false),
        sticky: None,
        cooldown: Some(1),
        delay: None,
        triggers: vec!["scene".into()],
        ignore_budget: false,
        order: 10 + index as i32,
        insertion_mode: WorldBookInsertionMode::ScenePrelude,
        source: "location".into(),
        rule_binding: None,
    }));

    entries.extend(rule_sentences.iter().enumerate().map(|(index, sentence)| {
        let keys = if sentence.contains("北门") {
            vec!["北门".into(), "门".into()]
        } else if sentence.contains("旧约") {
            vec!["旧约".into(), "真相".into()]
        } else {
            vec!["规则".into()]
        };

        WorldBookEntry {
            id: format!("lore-rule-{}", index + 1),
            title: format!("规则：{}", sentence.chars().take(8).collect::<String>()),
            category: WorldBookCategory::SocialRule,
            content: sentence.clone(),
            enabled: true,
            keys,
            secondary_keys: vec!["午夜".into(), "雾".into()],
            selective_logic: WorldBookSelectiveLogic::AndAny,
            constant: false,
            recursive: true,
            exclude_recursion: false,
            prevent_recursion: false,
            delay_until_recursion: None,
            scan_depth: Some(4),
            case_sensitive: Some(false),
            match_whole_words: Some(false),
            sticky: Some(1),
            cooldown: Some(1),
            delay: None,
            triggers: vec!["scene".into(), "free_input".into()],
            ignore_budget: false,
            order: 20 + index as i32,
            insertion_mode: WorldBookInsertionMode::RulesGuard,
            source: "rule_sentence".into(),
            rule_binding: if sentence.contains("北门") {
                Some("rule-gate-1".into())
            } else {
                None
            },
        }
    }));

    entries.extend(rules.iter().enumerate().map(|(index, rule)| WorldBookEntry {
        id: format!("lore-rulebinding-{}", index + 1),
        title: format!("规则摘要：{}", rule.name),
        category: if rule.category.contains("biology") {
            WorldBookCategory::BiologyRule
        } else {
            WorldBookCategory::SocialRule
        },
        content: rule.explanation.clone(),
        enabled: true,
        keys: match rule.id.as_str() {
            "rule-biology-1" => vec!["男男".into(), "两个男性".into()],
            "rule-biology-2" => vec!["一男一女".into(), "发生关系".into()],
            _ => vec!["午夜".into(), "北门".into()],
        },
        secondary_keys: Vec::new(),
        selective_logic: WorldBookSelectiveLogic::AndAny,
        constant: false,
        recursive: false,
        exclude_recursion: false,
        prevent_recursion: false,
        delay_until_recursion: None,
        scan_depth: Some(4),
        case_sensitive: Some(false),
        match_whole_words: Some(false),
        sticky: None,
        cooldown: None,
        delay: if rule.id == "rule-gate-1" { Some(1) } else { None },
        triggers: vec!["free_input".into(), "choice".into()],
        ignore_budget: false,
        order: 40 + index as i32,
        insertion_mode: WorldBookInsertionMode::RulesGuard,
        source: "rule_definition".into(),
        rule_binding: Some(rule.id.clone()),
    }));

    entries
}

fn extract_character_names(text: &str) -> Vec<String> {
    let stopwords = [
        "临川城", "北门", "旧约", "真相", "钟声", "火把", "午夜", "城规", "名字", "雨幕",
    ]
    .into_iter()
    .collect::<BTreeSet<_>>();
    let speaker_re = Regex::new(
        r"([一-龥]{2,3})(?:说|问|看|听|想|站|走|来到|看见|知道|决定|低声|抬头|守住|打开)",
    )
    .expect("character regex must compile");
    let mut counts = HashMap::<String, usize>::new();
    for capture in speaker_re.captures_iter(text) {
        let candidate = capture[1].to_string();
        if !stopwords.contains(candidate.as_str()) {
            *counts.entry(candidate).or_insert(0) += 1;
        }
    }

    let mut ranked = counts.into_iter().collect::<Vec<_>>();
    ranked.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    let mut names = ranked.into_iter().map(|(name, _)| name).collect::<Vec<_>>();
    if names.is_empty() {
        names = vec!["主角".into(), "引路人".into(), "守门人".into()];
    }
    names.truncate(4);
    names
}

fn extract_locations(text: &str) -> Vec<String> {
    let re = Regex::new(r"([一-龥]{2,8}(?:城|门|河|山|宫|府|楼|镇|村|院))")
        .expect("location regex must compile");
    let mut names = BTreeSet::new();
    for capture in re.captures_iter(text) {
        names.insert(capture[1].to_string());
    }
    let mut locations = names.into_iter().collect::<Vec<_>>();
    if locations.is_empty() {
        locations = vec!["旧都".into(), "边界之门".into()];
    }
    locations.truncate(4);
    locations
}

fn extract_rule_sentences(text: &str) -> Vec<String> {
    let mut rules = text
        .split(['。', '！', '？', '\n'])
        .map(str::trim)
        .filter(|sentence| {
            !sentence.is_empty()
                && ["必须", "不能", "不得", "只要", "规则", "城规", "禁"]
                    .iter()
                    .any(|keyword| sentence.contains(keyword))
        })
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    rules.sort();
    rules.dedup();
    if rules.is_empty() {
        rules.push("必须遵守既有约定，否则代价会立刻显现".into());
    }
    rules.truncate(4);
    rules
}
