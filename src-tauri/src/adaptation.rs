use crate::models::{
    AdaptationConstraintSet, AdaptationKernelSnapshot, CanonCharacterAnchor, CanonEventAnchor,
    NovelProject, SourceChapterSnapshot, SourceNovelSnapshot, StoryBible,
};

pub fn build_adaptation_kernel(
    project: &NovelProject,
    story_bible: &StoryBible,
) -> AdaptationKernelSnapshot {
    let source_chapters = project
        .chapters
        .iter()
        .map(|chapter| SourceChapterSnapshot {
            chapter_id: chapter.id.clone(),
            title: chapter.title.clone(),
            excerpt: chapter.excerpt.clone(),
        })
        .collect();

    let canon_characters = story_bible
        .characters
        .iter()
        .map(|character| CanonCharacterAnchor {
            character_id: character.id.clone(),
            name: character.name.clone(),
            protected_identity: character.identity.clone(),
            protected_role: character.role.clone(),
            anchor_traits: character.traits.clone(),
            summary: character.summary.clone(),
        })
        .collect();

    let event_graph = project
        .chapters
        .iter()
        .map(|chapter| CanonEventAnchor {
            event_id: format!("event-{}", chapter.id),
            chapter_id: chapter.id.clone(),
            title: chapter.title.clone(),
            summary: chapter.excerpt.clone(),
            locked: true,
        })
        .collect();

    AdaptationKernelSnapshot {
        source_novel: SourceNovelSnapshot {
            title: project.name.clone(),
            chapter_count: project.chapters.len(),
            chapters: source_chapters,
        },
        canon_characters,
        relationship_graph: story_bible.relationships.clone(),
        event_graph,
        world_rules: story_bible.world_rules.clone(),
        constraints: AdaptationConstraintSet {
            preserve_character_core: true,
            allow_relationship_rewire: true,
            allow_player_insert: true,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::build_adaptation_kernel;
    use crate::models::{
        BuildStage, BuildStatus, ChapterChunk, CharacterCard, CoreConflict, NovelProject,
        RelationshipEdge, StoryBible, TimelineEntry, WorldRule,
    };
    use std::collections::BTreeMap;

    fn sample_project() -> NovelProject {
        NovelProject {
            id: "project-1".into(),
            name: "临川夜话".into(),
            raw_text: "第1章 雨夜来客\n\n沈砚站在北门前。".into(),
            chapters: vec![ChapterChunk {
                id: "chapter-1".into(),
                order: 1,
                title: "第1章 雨夜来客".into(),
                content: "沈砚站在北门前。".into(),
                excerpt: "沈砚站在北门前。".into(),
            }],
            build_status: BuildStatus {
                stage: BuildStage::Imported,
                message: "imported".into(),
                progress: 20,
                error: None,
            },
            story_package: None,
            character_cards: vec![CharacterCard {
                id: "project-character-1".into(),
                name: "误导角色".into(),
                gender: "male".into(),
                age: Some(30),
                identity: "项目角色身份".into(),
                faction: "项目阵营".into(),
                role: "项目角色".into(),
                summary: "用于验证不会被映射".into(),
                desire: "干扰测试".into(),
                secrets: vec!["不应出现在 canon_characters".into()],
                traits: vec!["干扰".into()],
                abilities: vec!["误导".into()],
                mutable_state: BTreeMap::new(),
            }],
            worldbook_entries: Vec::new(),
            rules: Vec::new(),
            review_preview_context: None,
            adaptation_kernel: None,
        }
    }

    fn sample_story_bible() -> StoryBible {
        StoryBible {
            title: "临川夜话".into(),
            characters: vec![CharacterCard {
                id: "character-1".into(),
                name: "沈砚".into(),
                gender: "male".into(),
                age: Some(24),
                identity: "守门人".into(),
                faction: "临川城".into(),
                role: "主视角".into(),
                summary: "谨慎而克制".into(),
                desire: "守住边界".into(),
                secrets: vec!["知道北门代价".into()],
                traits: vec!["克制".into(), "警觉".into()],
                abilities: vec!["守门".into()],
                mutable_state: BTreeMap::new(),
            }],
            locations: Vec::new(),
            timeline: vec![TimelineEntry {
                id: "timeline-1".into(),
                label: "第1章 雨夜来客".into(),
                order: 1,
                summary: "沈砚站在北门前。".into(),
            }],
            world_rules: vec![WorldRule {
                id: "world-rule-1".into(),
                description: "午夜之后不能打开北门".into(),
            }],
            relationships: vec![RelationshipEdge {
                source: "沈砚".into(),
                target: "北门".into(),
                label: "守护".into(),
                strength: 3,
            }],
            core_conflicts: vec![CoreConflict {
                id: "conflict-1".into(),
                title: "守门与越界".into(),
                summary: "主角必须决定是否守住边界".into(),
            }],
        }
    }

    #[test]
    fn build_adaptation_kernel_preserves_character_anchors_and_chapter_events() {
        let project = sample_project();
        let bible = sample_story_bible();

        let kernel = build_adaptation_kernel(&project, &bible);

        assert_eq!(kernel.source_novel.title, "临川夜话");
        assert_eq!(kernel.source_novel.chapter_count, 1);
        assert_eq!(kernel.source_novel.chapters.len(), 1);
        assert_eq!(kernel.source_novel.chapters[0].chapter_id, "chapter-1");
        assert_eq!(kernel.source_novel.chapters[0].title, "第1章 雨夜来客");
        assert_eq!(kernel.source_novel.chapters[0].excerpt, "沈砚站在北门前。");
        assert_eq!(kernel.canon_characters.len(), 1);
        assert_eq!(kernel.canon_characters[0].character_id, "character-1");
        assert_eq!(kernel.canon_characters[0].name, "沈砚");
        assert_eq!(kernel.canon_characters[0].protected_identity, "守门人");
        assert_eq!(kernel.canon_characters[0].protected_role, "主视角");
        assert_eq!(kernel.canon_characters[0].summary, "谨慎而克制");
        assert!(kernel.canon_characters[0]
            .anchor_traits
            .iter()
            .any(|trait_name| trait_name == "克制"));
        assert_ne!(kernel.canon_characters[0].character_id, project.character_cards[0].id);
        assert_ne!(kernel.canon_characters[0].name, project.character_cards[0].name);
        assert_eq!(kernel.relationship_graph.len(), 1);
        assert_eq!(kernel.relationship_graph[0].source, "沈砚");
        assert_eq!(kernel.relationship_graph[0].target, "北门");
        assert_eq!(kernel.relationship_graph[0].label, "守护");
        assert_eq!(kernel.relationship_graph[0].strength, 3);
        assert_eq!(kernel.world_rules.len(), 1);
        assert_eq!(kernel.world_rules[0].id, "world-rule-1");
        assert_eq!(kernel.world_rules[0].description, "午夜之后不能打开北门");
        assert_eq!(kernel.event_graph.len(), 1);
        assert_eq!(kernel.event_graph[0].event_id, "event-chapter-1");
        assert_eq!(kernel.event_graph[0].chapter_id, "chapter-1");
        assert_eq!(kernel.event_graph[0].title, "第1章 雨夜来客");
        assert_eq!(kernel.event_graph[0].summary, "沈砚站在北门前。");
        assert!(kernel.event_graph[0].locked);
        assert!(kernel.constraints.preserve_character_core);
        assert!(kernel.constraints.allow_relationship_rewire);
        assert!(kernel.constraints.allow_player_insert);
    }
}
