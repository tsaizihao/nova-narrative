use std::collections::BTreeMap;

use crate::models::{
    ChoiceOption, DialogueLine, EndingReport, NovelProject, SceneNode, StateEffect, StoryBible,
    StoryPackage, WorldModelSnapshot,
};

pub fn compile_story_package(project: &NovelProject, story_bible: StoryBible) -> StoryPackage {
    let chapters = if project.chapters.is_empty() {
        vec![crate::models::ChapterChunk {
            id: "chapter-1".into(),
            order: 1,
            title: "序章".into(),
            content: project.raw_text.clone(),
            excerpt: project.raw_text.chars().take(96).collect(),
        }]
    } else {
        project.chapters.clone()
    };

    let protagonist = story_bible
        .characters
        .first()
        .map(|character| character.name.clone())
        .unwrap_or_else(|| "主角".into());
    let counterpart = story_bible
        .characters
        .get(1)
        .map(|character| character.name.clone())
        .unwrap_or_else(|| "关键人物".into());

    let decision_index = chapters.len().min(3);
    StoryPackage {
        story_bible,
        world_model: WorldModelSnapshot {
            character_cards: project.character_cards.clone(),
            worldbook_entries: project.worldbook_entries.clone(),
            rules: project.rules.clone(),
        },
        adaptation_kernel: project.adaptation_kernel.clone(),
        start_scene_id: "scene-1".into(),
        scenes: build_scenes(&chapters, decision_index, &protagonist, &counterpart),
    }
}

fn build_scenes(
    chapters: &[crate::models::ChapterChunk],
    decision_index: usize,
    protagonist: &str,
    counterpart: &str,
) -> BTreeMap<String, SceneNode> {
    let mut scenes = BTreeMap::new();
    let main_count = decision_index.max(2);

    for index in 0..main_count {
        let chapter = chapters
            .get(index)
            .cloned()
            .unwrap_or_else(|| chapters.last().cloned().expect("at least one chapter exists"));
        let scene_id = format!("scene-{}", index + 1);
        let next_scene_id = format!("scene-{}", index + 2);
        let narration = chapter
            .content
            .split('\n')
            .map(str::trim)
            .filter(|paragraph| !paragraph.is_empty())
            .take(3)
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();

        let mut scene = SceneNode {
            id: scene_id.clone(),
            chapter: index + 1,
            title: chapter.title.clone(),
            summary: chapter.excerpt.clone(),
            narration,
            dialogue: vec![
                DialogueLine {
                    speaker: protagonist.into(),
                    text: format!("{}，我已经走到这一步。", chapter.excerpt),
                    emotion: if index == 0 { "警觉".into() } else { "迟疑".into() },
                },
                DialogueLine {
                    speaker: counterpart.into(),
                    text: if index + 1 == main_count {
                        "这一次，你必须亲自决定故事的走向。".into()
                    } else {
                        "线索已经浮出水面，但代价也越来越近。".into()
                    },
                    emotion: "克制".into(),
                },
            ],
            entry_conditions: Vec::new(),
            present_characters: vec![protagonist.into(), counterpart.into()],
            candidate_choices: Vec::new(),
            fallback_next: None,
            allow_free_input: index == 1 || (main_count == 2 && index == 0),
            checkpoint: index == 0 || index + 1 == main_count,
            ending: None,
        };

        if index + 1 < main_count {
            scene.fallback_next = Some(next_scene_id.clone());
            scene.candidate_choices = vec![
                ChoiceOption {
                    id: format!("{scene_id}-steady"),
                    label: "谨慎推进".into(),
                    intent_tag: "steady".into(),
                    state_effects: vec![StateEffect {
                        key: "relationship:秩序".into(),
                        delta: 1,
                        note: "更稳地靠近下一幕".into(),
                    }],
                    unlock_conditions: Vec::new(),
                    next_scene_id: next_scene_id.clone(),
                },
                ChoiceOption {
                    id: format!("{scene_id}-probe"),
                    label: "追问真相".into(),
                    intent_tag: "probe".into(),
                    state_effects: vec![StateEffect {
                        key: "flag:insight:truth".into(),
                        delta: 1,
                        note: "留下关于真相的执念".into(),
                    }],
                    unlock_conditions: Vec::new(),
                    next_scene_id: next_scene_id.clone(),
                },
                ChoiceOption {
                    id: format!("{scene_id}-conceal"),
                    label: "暂时隐瞒".into(),
                    intent_tag: "conceal".into(),
                    state_effects: vec![StateEffect {
                        key: "flag:stance:conceal".into(),
                        delta: 1,
                        note: "把真正意图藏起来".into(),
                    }],
                    unlock_conditions: Vec::new(),
                    next_scene_id,
                },
            ];
        } else {
            scene.fallback_next = Some("ending-covenant".into());
            scene.candidate_choices = vec![
                ChoiceOption {
                    id: "choice-covenant".into(),
                    label: "守住规则，留下余地".into(),
                    intent_tag: "covenant".into(),
                    state_effects: vec![StateEffect {
                        key: "relationship:秩序".into(),
                        delta: 2,
                        note: "继续维持既有秩序".into(),
                    }],
                    unlock_conditions: Vec::new(),
                    next_scene_id: "ending-covenant".into(),
                },
                ChoiceOption {
                    id: "choice-truth".into(),
                    label: "揭开真相，改写结局".into(),
                    intent_tag: "truth".into(),
                    state_effects: vec![StateEffect {
                        key: "flag:ending:truth".into(),
                        delta: 1,
                        note: "将真相推到台前".into(),
                    }],
                    unlock_conditions: vec!["insight:truth".into()],
                    next_scene_id: "ending-revelation".into(),
                },
                ChoiceOption {
                    id: "choice-exile".into(),
                    label: "不顾代价，强行开门".into(),
                    intent_tag: "exile".into(),
                    state_effects: vec![StateEffect {
                        key: "flag:ending:exile".into(),
                        delta: 1,
                        note: "选择越界".into(),
                    }],
                    unlock_conditions: Vec::new(),
                    next_scene_id: "ending-exile".into(),
                },
            ];
        }

        scenes.insert(scene_id, scene);
    }

    for ending in build_endings(protagonist, counterpart) {
        scenes.insert(ending.id.clone(), ending);
    }

    scenes
}

fn build_endings(protagonist: &str, counterpart: &str) -> Vec<SceneNode> {
    vec![
        SceneNode {
            id: "ending-covenant".into(),
            chapter: 99,
            title: "余烬中的守约".into(),
            summary: "你守住了边界，代价是把真正的答案留在门后。".into(),
            narration: vec![
                "钟声停下时，北门仍旧关闭。".into(),
                format!("{protagonist} 没有跨出那一步，但故事里仍留下了未被说破的空白。"),
            ],
            dialogue: vec![DialogueLine {
                speaker: counterpart.into(),
                text: "你守住了今晚，也守住了故事最后一层余温。".into(),
                emotion: "释然".into(),
            }],
            entry_conditions: Vec::new(),
            present_characters: vec![protagonist.into(), counterpart.into()],
            candidate_choices: Vec::new(),
            fallback_next: None,
            allow_free_input: false,
            checkpoint: false,
            ending: Some(EndingReport {
                ending_type: "守约结局".into(),
                summary: "你选择让秩序延续，换来一个带着遗憾但可承受的夜晚。".into(),
                decisive_turns: vec!["守住规则".into()],
                unresolved_threads: vec!["门后的真相仍未完全揭开".into()],
            }),
        },
        SceneNode {
            id: "ending-revelation".into(),
            chapter: 100,
            title: "雾散之后".into(),
            summary: "你选择面对真相，旧约终于被重新书写。".into(),
            narration: vec![
                "门被缓缓推开，雾没有吞掉名字，反而把沉默多年的真相吐回人间。".into(),
                format!("{protagonist} 终于明白，真正需要改变的不是命运，而是恐惧本身。"),
            ],
            dialogue: vec![DialogueLine {
                speaker: counterpart.into(),
                text: "你没有背叛这座城，你只是让它第一次看见自己。".into(),
                emotion: "震动".into(),
            }],
            entry_conditions: Vec::new(),
            present_characters: vec![protagonist.into(), counterpart.into()],
            candidate_choices: Vec::new(),
            fallback_next: None,
            allow_free_input: false,
            checkpoint: false,
            ending: Some(EndingReport {
                ending_type: "真相结局".into(),
                summary: "你揭开禁忌，代价巨大，但故事终于摆脱了重复。".into(),
                decisive_turns: vec!["追问真相".into(), "改写结局".into()],
                unresolved_threads: vec!["旧秩序的反扑仍在酝酿".into()],
            }),
        },
        SceneNode {
            id: "ending-exile".into(),
            chapter: 101,
            title: "门外之人".into(),
            summary: "你用最激烈的方式打破规则，也被规则反噬。".into(),
            narration: vec![
                "门开得过猛，风先一步把火把和名字都吹散。".into(),
                format!("{protagonist} 冲出了故事原本的边框，却也失去了继续留下的资格。"),
            ],
            dialogue: vec![DialogueLine {
                speaker: counterpart.into(),
                text: "你赢得了选择，却输掉了归处。".into(),
                emotion: "悲恸".into(),
            }],
            entry_conditions: Vec::new(),
            present_characters: vec![protagonist.into(), counterpart.into()],
            candidate_choices: Vec::new(),
            fallback_next: None,
            allow_free_input: false,
            checkpoint: false,
            ending: Some(EndingReport {
                ending_type: "流放结局".into(),
                summary: "你越界而行，换来一个锋利、孤独但真实的结局。".into(),
                decisive_turns: vec!["强行开门".into()],
                unresolved_threads: vec!["门外世界究竟通向哪里仍是未知".into()],
            }),
        },
    ]
}
