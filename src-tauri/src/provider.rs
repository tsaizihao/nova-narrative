use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    sync::Arc,
};

#[cfg(test)]
use std::{collections::VecDeque, sync::Mutex};

use regex::Regex;
use serde::Deserialize;

use crate::{
    error::{AppError, AppResult},
    models::{
        AiProviderKind, AppAiSettingsSnapshot, CharacterCard, CoreConflict, LocationCard,
        NovelProject, RelationshipEdge, StoryBible, TimelineEntry, WorldRule,
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

pub trait SecretStore: Send + Sync {
    fn get_api_key(&self, provider: AiProviderKind) -> AppResult<Option<String>>;
    fn set_api_key(&self, provider: AiProviderKind, api_key: &str) -> AppResult<()>;
    fn clear_api_key(&self, provider: AiProviderKind) -> AppResult<()>;
}

#[cfg(test)]
#[derive(Default)]
pub struct InMemorySecretStore {
    values: Mutex<HashMap<String, String>>,
}

#[cfg(test)]
impl SecretStore for InMemorySecretStore {
    fn get_api_key(&self, provider: AiProviderKind) -> AppResult<Option<String>> {
        let values = self
            .values
            .lock()
            .map_err(|_| AppError::SecretStore("failed to lock in-memory secret store".into()))?;
        Ok(values.get(provider_key(&provider)).cloned())
    }

    fn set_api_key(&self, provider: AiProviderKind, api_key: &str) -> AppResult<()> {
        let mut values = self
            .values
            .lock()
            .map_err(|_| AppError::SecretStore("failed to lock in-memory secret store".into()))?;
        values.insert(provider_key(&provider).into(), api_key.to_string());
        Ok(())
    }

    fn clear_api_key(&self, provider: AiProviderKind) -> AppResult<()> {
        let mut values = self
            .values
            .lock()
            .map_err(|_| AppError::SecretStore("failed to lock in-memory secret store".into()))?;
        values.remove(provider_key(&provider));
        Ok(())
    }
}

pub struct KeyringSecretStore {
    service_name: String,
}

impl Default for KeyringSecretStore {
    fn default() -> Self {
        Self {
            service_name: "com.nova.narrative.ai".into(),
        }
    }
}

impl KeyringSecretStore {
    fn entry(&self, provider: &AiProviderKind) -> AppResult<keyring::Entry> {
        keyring::Entry::new(&self.service_name, provider_key(provider))
            .map_err(|error| AppError::SecretStore(error.to_string()))
    }
}

impl SecretStore for KeyringSecretStore {
    fn get_api_key(&self, provider: AiProviderKind) -> AppResult<Option<String>> {
        let entry = self.entry(&provider)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(AppError::SecretStore(error.to_string())),
        }
    }

    fn set_api_key(&self, provider: AiProviderKind, api_key: &str) -> AppResult<()> {
        let entry = self.entry(&provider)?;
        entry
            .set_password(api_key)
            .map_err(|error| AppError::SecretStore(error.to_string()))
    }

    fn clear_api_key(&self, provider: AiProviderKind) -> AppResult<()> {
        let entry = self.entry(&provider)?;
        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(AppError::SecretStore(error.to_string())),
        }
    }
}

fn provider_key(provider: &AiProviderKind) -> &'static str {
    match provider {
        AiProviderKind::Heuristic => "heuristic",
        AiProviderKind::OpenAiCompatible => "openai_compatible",
        AiProviderKind::OpenRouter => "openrouter",
    }
}

pub trait StoryAiProvider: Send + Sync {
    fn analyze(&self, project: &NovelProject) -> AppResult<ExtractedWorldModel>;
}

#[derive(Debug, Clone)]
pub struct ChatCompletionsRequest {
    pub url: String,
    pub headers: BTreeMap<String, String>,
    pub body: serde_json::Value,
}

pub trait ChatCompletionsTransport: Send + Sync {
    fn execute(&self, request: ChatCompletionsRequest) -> AppResult<String>;
}

pub struct ReqwestChatCompletionsTransport {
    client: reqwest::blocking::Client,
}

impl Default for ReqwestChatCompletionsTransport {
    fn default() -> Self {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("reqwest client should build");
        Self { client }
    }
}

impl ChatCompletionsTransport for ReqwestChatCompletionsTransport {
    fn execute(&self, request: ChatCompletionsRequest) -> AppResult<String> {
        let mut builder = self.client.post(&request.url);
        for (key, value) in &request.headers {
            builder = builder.header(key, value);
        }

        let response = builder
            .json(&request.body)
            .send()
            .and_then(reqwest::blocking::Response::error_for_status)
            .map_err(|error| AppError::Provider(error.to_string()))?;

        response
            .text()
            .map_err(|error| AppError::Provider(error.to_string()))
    }
}

#[cfg(test)]
#[derive(Debug, Clone)]
pub struct CapturedChatCompletionsRequest {
    pub url: String,
    pub headers: BTreeMap<String, String>,
    pub body: serde_json::Value,
}

#[cfg(test)]
#[derive(Default)]
pub struct FakeChatCompletionsTransport {
    requests: Mutex<Vec<CapturedChatCompletionsRequest>>,
    responses: Mutex<VecDeque<Result<String, String>>>,
}

#[cfg(test)]
impl FakeChatCompletionsTransport {
    pub fn from_responses(responses: Vec<Result<String, String>>) -> Self {
        Self {
            requests: Mutex::new(Vec::new()),
            responses: Mutex::new(responses.into()),
        }
    }

    pub fn requests(&self) -> Vec<CapturedChatCompletionsRequest> {
        self.requests.lock().expect("requests lock").clone()
    }
}

#[cfg(test)]
impl ChatCompletionsTransport for FakeChatCompletionsTransport {
    fn execute(&self, request: ChatCompletionsRequest) -> AppResult<String> {
        self.requests
            .lock()
            .map_err(|_| AppError::Provider("failed to capture fake transport request".into()))?
            .push(CapturedChatCompletionsRequest {
                url: request.url,
                headers: request.headers,
                body: request.body,
            });

        let next = self
            .responses
            .lock()
            .map_err(|_| AppError::Provider("failed to lock fake transport responses".into()))?
            .pop_front()
            .unwrap_or_else(|| Err("no fake response queued".into()));

        next.map_err(AppError::Provider)
    }
}

pub struct OpenAiCompatibleProvider {
    transport: Arc<dyn ChatCompletionsTransport>,
}

impl OpenAiCompatibleProvider {
    pub fn new(transport: Arc<dyn ChatCompletionsTransport>) -> Self {
        Self { transport }
    }

    pub fn analyze(
        &self,
        project: &NovelProject,
        settings: &AppAiSettingsSnapshot,
        secret_store: &dyn SecretStore,
    ) -> AppResult<ExtractedWorldModel> {
        analyze_external_provider(
            project,
            settings,
            secret_store,
            AiProviderKind::OpenAiCompatible,
            self.transport.as_ref(),
        )
    }
}

pub struct OpenRouterProvider {
    transport: Arc<dyn ChatCompletionsTransport>,
}

impl OpenRouterProvider {
    pub fn new(transport: Arc<dyn ChatCompletionsTransport>) -> Self {
        Self { transport }
    }

    pub fn analyze(
        &self,
        project: &NovelProject,
        settings: &AppAiSettingsSnapshot,
        secret_store: &dyn SecretStore,
    ) -> AppResult<ExtractedWorldModel> {
        analyze_external_provider(
            project,
            settings,
            secret_store,
            AiProviderKind::OpenRouter,
            self.transport.as_ref(),
        )
    }
}

fn analyze_external_provider(
    project: &NovelProject,
    settings: &AppAiSettingsSnapshot,
    secret_store: &dyn SecretStore,
    provider_kind: AiProviderKind,
    transport: &dyn ChatCompletionsTransport,
) -> AppResult<ExtractedWorldModel> {
    let provider_settings = match provider_kind {
        AiProviderKind::OpenAiCompatible => &settings.openai_compatible,
        AiProviderKind::OpenRouter => &settings.openrouter,
        AiProviderKind::Heuristic => {
            return Err(AppError::Validation(
                "heuristic provider does not use external API settings".into(),
            ));
        }
    };

    if provider_settings.base_url.trim().is_empty() {
        return Err(AppError::Validation(
            "External provider base URL is required".into(),
        ));
    }
    if provider_settings.model.trim().is_empty() {
        return Err(AppError::Validation(
            "External provider model is required".into(),
        ));
    }

    let api_key = secret_store
        .get_api_key(provider_kind.clone())?
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::Validation("External provider API key is required".into()))?;

    let request = build_chat_request(project, provider_kind, provider_settings, &api_key);
    let mut last_error = None;

    for attempt in 0..2 {
        let raw_response = transport.execute(request.clone())?;
        match parse_external_analysis(project, &raw_response) {
            Ok(model) => return Ok(model),
            Err(error) if attempt == 0 => last_error = Some(error),
            Err(error) => return Err(error),
        }
    }

    Err(last_error
        .unwrap_or_else(|| AppError::Provider("failed to parse provider response".into())))
}

fn build_chat_request(
    project: &NovelProject,
    provider_kind: AiProviderKind,
    provider_settings: &crate::models::ExternalProviderSettingsSnapshot,
    api_key: &str,
) -> ChatCompletionsRequest {
    let mut headers = BTreeMap::from([
        ("authorization".into(), format!("Bearer {api_key}")),
        ("content-type".into(), "application/json".into()),
    ]);

    if provider_kind == AiProviderKind::OpenRouter {
        headers.insert("x-title".into(), "叙世者".into());
    }

    let url = format!("{}/chat/completions", provider_settings.base_url);
    let body = serde_json::json!({
        "model": provider_settings.model,
        "messages": [
            {
                "role": "system",
                "content": "你是中文小说互动改编助手。请只返回一个 JSON 对象，不要输出 markdown、解释或代码块。"
            },
            {
                "role": "user",
                "content": build_analysis_prompt(project)
            }
        ]
    });

    ChatCompletionsRequest { url, headers, body }
}

fn build_analysis_prompt(project: &NovelProject) -> String {
    format!(
        concat!(
            "请从下面的中文小说文本中抽取结构化故事模型，",
            "并只返回 JSON，对象字段必须包含 story_bible、character_cards、worldbook_entries、rules。\n\n",
            "story_bible 需要包含 title、characters、locations、timeline、world_rules、relationships、core_conflicts。\n",
            "character_cards 需要包含 name、gender、age、identity、faction、role、summary、desire、secrets、traits、abilities、mutable_state。\n",
            "worldbook_entries 需要包含 title、category、content、enabled、keys、secondary_keys、selective_logic、constant、recursive、exclude_recursion、prevent_recursion、delay_until_recursion、scan_depth、case_sensitive、match_whole_words、sticky、cooldown、delay、triggers、ignore_budget、order、insertion_mode、source、rule_binding。\n",
            "rules 需要包含 name、category、priority、enabled、conditions、blockers、effects、explanation。\n",
            "如果字段未知，请给出合理默认值，不要省略对象本身。\n\n",
            "项目名：{name}\n\n小说正文：\n{text}"
        ),
        name = project.name,
        text = project.raw_text
    )
}

#[derive(Debug, Deserialize)]
struct ChatCompletionEnvelope {
    choices: Vec<ChatCompletionChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionChoice {
    message: ChatCompletionMessage,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionMessage {
    content: String,
}

#[derive(Debug, Default, Deserialize)]
struct AiAnalysisDraft {
    #[serde(default)]
    story_bible: StoryBibleDraft,
    #[serde(default)]
    character_cards: Vec<CharacterCardDraft>,
    #[serde(default)]
    worldbook_entries: Vec<WorldBookEntryDraft>,
    #[serde(default)]
    rules: Vec<RuleDefinitionDraft>,
}

#[derive(Debug, Default, Deserialize)]
struct StoryBibleDraft {
    #[serde(default)]
    title: String,
    #[serde(default)]
    characters: Vec<CharacterCardDraft>,
    #[serde(default)]
    locations: Vec<LocationCard>,
    #[serde(default)]
    timeline: Vec<TimelineEntry>,
    #[serde(default)]
    world_rules: Vec<WorldRule>,
    #[serde(default)]
    relationships: Vec<RelationshipEdge>,
    #[serde(default)]
    core_conflicts: Vec<CoreConflict>,
}

#[derive(Debug, Default, Deserialize)]
struct CharacterCardDraft {
    #[serde(default)]
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    gender: String,
    age: Option<u16>,
    #[serde(default)]
    identity: String,
    #[serde(default)]
    faction: String,
    #[serde(default)]
    role: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    desire: String,
    #[serde(default)]
    secrets: Vec<String>,
    #[serde(default)]
    traits: Vec<String>,
    #[serde(default)]
    abilities: Vec<String>,
    #[serde(default)]
    mutable_state: BTreeMap<String, String>,
}

#[derive(Debug, Default, Deserialize)]
struct WorldBookEntryDraft {
    #[serde(default)]
    id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    category: WorldBookCategory,
    #[serde(default)]
    content: String,
    enabled: Option<bool>,
    #[serde(default)]
    keys: Vec<String>,
    #[serde(default)]
    secondary_keys: Vec<String>,
    #[serde(default)]
    selective_logic: WorldBookSelectiveLogic,
    constant: Option<bool>,
    recursive: Option<bool>,
    exclude_recursion: Option<bool>,
    prevent_recursion: Option<bool>,
    delay_until_recursion: Option<u8>,
    scan_depth: Option<usize>,
    case_sensitive: Option<bool>,
    match_whole_words: Option<bool>,
    sticky: Option<u16>,
    cooldown: Option<u16>,
    delay: Option<u16>,
    #[serde(default)]
    triggers: Vec<String>,
    ignore_budget: Option<bool>,
    order: Option<i32>,
    #[serde(default)]
    insertion_mode: WorldBookInsertionMode,
    #[serde(default)]
    source: String,
    rule_binding: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct RuleDefinitionDraft {
    #[serde(default)]
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    priority: RulePriority,
    enabled: Option<bool>,
    #[serde(default)]
    conditions: Vec<RuleCondition>,
    #[serde(default)]
    blockers: Vec<RuleCondition>,
    #[serde(default)]
    effects: Vec<RuleEffect>,
    #[serde(default)]
    explanation: String,
}

fn parse_external_analysis(
    project: &NovelProject,
    raw_response: &str,
) -> AppResult<ExtractedWorldModel> {
    let envelope: ChatCompletionEnvelope = serde_json::from_str(raw_response)
        .map_err(|error| AppError::Provider(error.to_string()))?;
    let content = envelope
        .choices
        .first()
        .map(|choice| choice.message.content.as_str())
        .ok_or_else(|| {
            AppError::Provider("provider response did not include any choices".into())
        })?;

    let draft_json = unwrap_json_payload(content);
    let draft: AiAnalysisDraft =
        serde_json::from_str(draft_json).map_err(|error| AppError::Provider(error.to_string()))?;

    materialize_analysis(project, draft)
}

fn unwrap_json_payload(content: &str) -> &str {
    let trimmed = content.trim();
    if let Some(inner) = trimmed
        .strip_prefix("```json")
        .and_then(|value| value.strip_suffix("```"))
    {
        inner.trim()
    } else if let Some(inner) = trimmed
        .strip_prefix("```")
        .and_then(|value| value.strip_suffix("```"))
    {
        inner.trim()
    } else {
        trimmed
    }
}

fn materialize_analysis(
    project: &NovelProject,
    draft: AiAnalysisDraft,
) -> AppResult<ExtractedWorldModel> {
    let character_cards =
        materialize_character_cards(&draft.character_cards, &draft.story_bible.characters)?;
    if character_cards.is_empty() {
        return Err(AppError::Provider(
            "provider response did not include any character cards".into(),
        ));
    }

    let worldbook_entries = materialize_worldbook_entries(draft.worldbook_entries)?;
    if worldbook_entries.is_empty() {
        return Err(AppError::Provider(
            "provider response did not include any worldbook entries".into(),
        ));
    }

    let rules = materialize_rules(draft.rules)?;
    if rules.is_empty() {
        return Err(AppError::Provider(
            "provider response did not include any rules".into(),
        ));
    }

    let story_bible = StoryBible {
        title: if draft.story_bible.title.trim().is_empty() {
            project.name.clone()
        } else {
            draft.story_bible.title.trim().to_string()
        },
        characters: character_cards.clone(),
        locations: materialize_locations(draft.story_bible.locations),
        timeline: materialize_timeline(project, draft.story_bible.timeline),
        world_rules: materialize_world_rules(&rules, draft.story_bible.world_rules),
        relationships: draft.story_bible.relationships,
        core_conflicts: materialize_core_conflicts(draft.story_bible.core_conflicts),
    };

    Ok(ExtractedWorldModel {
        character_cards,
        worldbook_entries,
        rules,
        story_bible,
    })
}

fn materialize_character_cards(
    cards: &[CharacterCardDraft],
    fallback_cards: &[CharacterCardDraft],
) -> AppResult<Vec<CharacterCard>> {
    let source = if cards.is_empty() {
        fallback_cards
    } else {
        cards
    };
    let mut materialized = Vec::new();

    for (index, card) in source.iter().enumerate() {
        let name = card.name.trim();
        if name.is_empty() {
            continue;
        }
        materialized.push(CharacterCard {
            id: if card.id.trim().is_empty() {
                format!("character-{}", index + 1)
            } else {
                card.id.trim().to_string()
            },
            name: name.to_string(),
            gender: normalize_gender_label(&fallback_string(&card.gender, "未知")),
            age: card.age,
            identity: card.identity.trim().to_string(),
            faction: card.faction.trim().to_string(),
            role: card.role.trim().to_string(),
            summary: card.summary.trim().to_string(),
            desire: card.desire.trim().to_string(),
            secrets: trim_vec(&card.secrets),
            traits: trim_vec(&card.traits),
            abilities: trim_vec(&card.abilities),
            mutable_state: card.mutable_state.clone(),
        });
    }

    Ok(materialized)
}

fn materialize_worldbook_entries(
    entries: Vec<WorldBookEntryDraft>,
) -> AppResult<Vec<WorldBookEntry>> {
    Ok(entries
        .into_iter()
        .enumerate()
        .filter_map(|(index, entry)| {
            let title = entry.title.trim().to_string();
            if title.is_empty() {
                return None;
            }
            Some(WorldBookEntry {
                id: if entry.id.trim().is_empty() {
                    format!("worldbook-{}", index + 1)
                } else {
                    entry.id.trim().to_string()
                },
                title,
                category: entry.category,
                content: entry.content.trim().to_string(),
                enabled: entry.enabled.unwrap_or(true),
                keys: trim_vec(&entry.keys),
                secondary_keys: trim_vec(&entry.secondary_keys),
                selective_logic: entry.selective_logic,
                constant: entry.constant.unwrap_or(false),
                recursive: entry.recursive.unwrap_or(false),
                exclude_recursion: entry.exclude_recursion.unwrap_or(false),
                prevent_recursion: entry.prevent_recursion.unwrap_or(false),
                delay_until_recursion: entry.delay_until_recursion,
                scan_depth: entry.scan_depth.or(Some(4)),
                case_sensitive: Some(entry.case_sensitive.unwrap_or(false)),
                match_whole_words: Some(entry.match_whole_words.unwrap_or(false)),
                sticky: entry.sticky,
                cooldown: entry.cooldown,
                delay: entry.delay,
                triggers: trim_vec(&entry.triggers),
                ignore_budget: entry.ignore_budget.unwrap_or(false),
                order: entry.order.unwrap_or(index as i32),
                insertion_mode: entry.insertion_mode,
                source: fallback_string(&entry.source, "llm"),
                rule_binding: entry.rule_binding.map(|value| value.trim().to_string()),
            })
        })
        .collect())
}

fn materialize_rules(entries: Vec<RuleDefinitionDraft>) -> AppResult<Vec<RuleDefinition>> {
    Ok(entries
        .into_iter()
        .enumerate()
        .filter_map(|(index, rule)| {
            let name = rule.name.trim().to_string();
            if name.is_empty() {
                return None;
            }
            Some(RuleDefinition {
                id: if rule.id.trim().is_empty() {
                    format!("rule-{}", index + 1)
                } else {
                    rule.id.trim().to_string()
                },
                name,
                category: fallback_string(&rule.category, "miscellaneous"),
                priority: rule.priority,
                enabled: rule.enabled.unwrap_or(true),
                conditions: rule.conditions,
                blockers: rule.blockers,
                effects: rule.effects,
                explanation: fallback_string(&rule.explanation, "外部模型生成的规则"),
            })
        })
        .collect())
}

fn materialize_locations(locations: Vec<LocationCard>) -> Vec<LocationCard> {
    locations
        .into_iter()
        .enumerate()
        .filter_map(|(index, mut location)| {
            if location.name.trim().is_empty() {
                return None;
            }
            if location.id.trim().is_empty() {
                location.id = format!("location-{}", index + 1);
            }
            location.name = location.name.trim().to_string();
            location.summary = location.summary.trim().to_string();
            Some(location)
        })
        .collect()
}

fn materialize_timeline(
    project: &NovelProject,
    timeline: Vec<TimelineEntry>,
) -> Vec<TimelineEntry> {
    if !timeline.is_empty() {
        return timeline
            .into_iter()
            .enumerate()
            .map(|(index, mut entry)| {
                if entry.id.trim().is_empty() {
                    entry.id = format!("timeline-{}", index + 1);
                }
                if entry.order == 0 {
                    entry.order = index + 1;
                }
                entry.label = entry.label.trim().to_string();
                entry.summary = entry.summary.trim().to_string();
                entry
            })
            .collect();
    }

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
}

fn materialize_world_rules(
    rules: &[RuleDefinition],
    world_rules: Vec<WorldRule>,
) -> Vec<WorldRule> {
    if !world_rules.is_empty() {
        return world_rules
            .into_iter()
            .enumerate()
            .map(|(index, mut item)| {
                if item.id.trim().is_empty() {
                    item.id = format!("world-rule-{}", index + 1);
                }
                item.description = item.description.trim().to_string();
                item
            })
            .collect();
    }

    rules
        .iter()
        .enumerate()
        .map(|(index, rule)| WorldRule {
            id: format!("world-rule-{}", index + 1),
            description: rule.explanation.clone(),
        })
        .collect()
}

fn materialize_core_conflicts(conflicts: Vec<CoreConflict>) -> Vec<CoreConflict> {
    if conflicts.is_empty() {
        return vec![CoreConflict {
            id: "conflict-1".into(),
            title: "秩序与真相".into(),
            summary: "角色必须在守住规则与推进真相之间做出选择。".into(),
        }];
    }

    conflicts
        .into_iter()
        .enumerate()
        .filter_map(|(index, mut conflict)| {
            if conflict.title.trim().is_empty() {
                return None;
            }
            if conflict.id.trim().is_empty() {
                conflict.id = format!("conflict-{}", index + 1);
            }
            conflict.title = conflict.title.trim().to_string();
            conflict.summary = conflict.summary.trim().to_string();
            Some(conflict)
        })
        .collect()
}

fn fallback_string(value: &str, default: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default.to_string()
    } else {
        trimmed.to_string()
    }
}

fn trim_vec(values: &[String]) -> Vec<String> {
    values
        .iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect()
}

fn normalize_gender_label(value: &str) -> String {
    match value.trim() {
        "male" | "男" => "男".into(),
        "female" | "女" => "女".into(),
        "unknown" | "未知" | "" => "未知".into(),
        other => other.to_string(),
    }
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
                gender: infer_gender(text, name),
                age: None,
                identity: infer_identity(text, name),
                faction: infer_faction(text, name),
                role: infer_role(index),
                secrets: infer_secrets(text, name),
                traits: infer_traits(text, name),
                abilities: infer_abilities(text, name),
                mutable_state: [("trust".into(), "1".into())].into_iter().collect(),
                summary: infer_character_summary(text, name),
                desire: infer_desire(text, name),
            })
            .collect::<Vec<_>>();

        let locations = location_names
            .iter()
            .enumerate()
            .map(|(index, name)| LocationCard {
                id: format!("location-{}", index + 1),
                name: name.clone(),
                summary: infer_location_summary(text, name),
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

        let rules = build_rules(&rule_sentences);
        let worldbook_entries =
            build_worldbook_entries(&character_cards, &locations, &rule_sentences, &rules);
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

fn build_rules(rule_sentences: &[String]) -> Vec<RuleDefinition> {
    let mut rules = rule_sentences
        .iter()
        .enumerate()
        .map(|(index, sentence)| {
            let event_kind = infer_rule_event_kind(sentence);
            let blocked = sentence.contains("不能")
                || sentence.contains("不得")
                || sentence.contains("不可")
                || sentence.contains("严禁")
                || sentence.contains("绝不");
            let priority = if blocked {
                RulePriority::HardConstraint
            } else if sentence.contains("必须") || sentence.contains("须") {
                RulePriority::SoftConstraint
            } else {
                RulePriority::Consequence
            };
            let mut conditions = vec![RuleCondition {
                fact: "event.kind".into(),
                operator: RuleOperator::Equals,
                value: event_kind.clone(),
            }];

            if sentence.contains("午夜") || sentence.contains("夜里") || sentence.contains("夜间")
            {
                conditions.push(RuleCondition {
                    fact: "scene.time".into(),
                    operator: RuleOperator::Equals,
                    value: "midnight".into(),
                });
            }

            RuleDefinition {
                id: format!("rule-{}", index + 1),
                name: format!("heuristic-rule-{}", index + 1),
                category: if sentence.contains("男") && sentence.contains("女") {
                    "biology_rule".into()
                } else {
                    "social_rule".into()
                },
                priority,
                enabled: true,
                conditions,
                blockers: Vec::new(),
                effects: vec![RuleEffect {
                    key: if blocked {
                        "event.forbidden".into()
                    } else {
                        "event.notice".into()
                    },
                    value: if blocked {
                        "true".into()
                    } else {
                        "active".into()
                    },
                }],
                explanation: sentence.clone(),
            }
        })
        .collect::<Vec<_>>();

    if rules.is_empty() {
        rules.push(RuleDefinition {
            id: "rule-1".into(),
            name: "heuristic-rule-1".into(),
            category: "social_rule".into(),
            priority: RulePriority::SoftConstraint,
            enabled: true,
            conditions: vec![RuleCondition {
                fact: "input.text".into(),
                operator: RuleOperator::Contains,
                value: "规则".into(),
            }],
            blockers: Vec::new(),
            effects: vec![RuleEffect {
                key: "event.notice".into(),
                value: "active".into(),
            }],
            explanation: "正文里提到需要遵守某些规矩或约束。".into(),
        });
    }

    rules
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
            content: format!(
                "{}，{}，欲望：{}",
                character.identity, character.summary, character.desire
            ),
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

    entries.extend(
        locations
            .iter()
            .enumerate()
            .map(|(index, location)| WorldBookEntry {
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
            }),
    );

    entries.extend(rule_sentences.iter().enumerate().map(|(index, sentence)| {
        let keys = extract_keywords(sentence, 3);
        let rule_binding = rules.get(index).map(|rule| rule.id.clone());

        WorldBookEntry {
            id: format!("lore-rule-{}", index + 1),
            title: format!("规则：{}", sentence.chars().take(8).collect::<String>()),
            category: WorldBookCategory::SocialRule,
            content: sentence.clone(),
            enabled: true,
            keys: if keys.is_empty() {
                vec!["规则".into()]
            } else {
                keys
            },
            secondary_keys: Vec::new(),
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
            rule_binding,
        }
    }));

    entries.extend(rules.iter().enumerate().map(|(index, rule)| {
        WorldBookEntry {
            id: format!("lore-rulebinding-{}", index + 1),
            title: format!("规则摘要：{}", rule.name),
            category: if rule.category.contains("biology") {
                WorldBookCategory::BiologyRule
            } else {
                WorldBookCategory::SocialRule
            },
            content: rule.explanation.clone(),
            enabled: true,
            keys: {
                let extracted = extract_keywords(&rule.explanation, 3);
                if extracted.is_empty() {
                    vec!["规则".into()]
                } else {
                    extracted
                }
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
            delay: if rule
                .effects
                .iter()
                .any(|effect| effect.key == "event.forbidden" && effect.value == "true")
            {
                Some(1)
            } else {
                None
            },
            triggers: vec!["free_input".into(), "choice".into()],
            ignore_budget: false,
            order: 40 + index as i32,
            insertion_mode: WorldBookInsertionMode::RulesGuard,
            source: "rule_definition".into(),
            rule_binding: Some(rule.id.clone()),
        }
    }));

    entries
}

fn infer_gender(text: &str, name: &str) -> String {
    let context = collect_character_context(text, name);
    if context.contains("娘子")
        || context.contains("夫人")
        || context.contains("小姐")
        || context.contains("她")
    {
        return "女".into();
    }
    if context.contains("汉子")
        || context.contains("哥哥")
        || context.contains("好汉")
        || context.contains("他")
    {
        return "男".into();
    }
    "未知".into()
}

fn infer_identity(text: &str, name: &str) -> String {
    extract_identity_from_context(text, name).unwrap_or_else(|| "书中人物".into())
}

fn infer_faction(text: &str, name: &str) -> String {
    extract_location_near_name(text, name).unwrap_or_else(|| "所属势力待考".into())
}

fn infer_role(index: usize) -> String {
    match index {
        0 => "核心人物".into(),
        1 => "关键人物".into(),
        _ => "相关人物".into(),
    }
}

fn infer_character_summary(text: &str, name: &str) -> String {
    first_sentence_for_name(text, name)
        .unwrap_or_else(|| format!("{name} 是正文中反复出现的角色。"))
}

fn infer_desire(text: &str, name: &str) -> String {
    let context = collect_character_context(text, name);
    if context.contains("要") || context.contains("欲") || context.contains("想") {
        for marker in ["想", "要", "欲"] {
            if let Some((_, tail)) = context.split_once(marker) {
                let candidate = tail.trim();
                if !candidate.is_empty() {
                    return format!("希望{}", candidate.chars().take(18).collect::<String>());
                }
            }
        }
    }
    "其主要动机仍需结合正文细化。".into()
}

fn infer_secrets(text: &str, name: &str) -> Vec<String> {
    let context = collect_character_context(text, name);
    if context.contains("暗") || context.contains("密") || context.contains("不敢") {
        vec![format!("{name} 似乎藏有未明说的内情。")]
    } else {
        Vec::new()
    }
}

fn infer_traits(text: &str, name: &str) -> Vec<String> {
    let context = collect_character_context(text, name);
    let mut traits = Vec::new();
    if context.contains("喝道") || context.contains("叫道") {
        traits.push("刚烈".into());
    }
    if context.contains("笑道") {
        traits.push("从容".into());
    }
    if context.contains("低声") || context.contains("沉吟") {
        traits.push("谨慎".into());
    }
    traits
}

fn infer_abilities(text: &str, name: &str) -> Vec<String> {
    let context = collect_character_context(text, name);
    let mut abilities = Vec::new();
    if context.contains("商议") || context.contains("说道") {
        abilities.push("议事".into());
    }
    if context.contains("喝道") || context.contains("拿下") {
        abilities.push("应战".into());
    }
    abilities
}

fn infer_location_summary(text: &str, name: &str) -> String {
    first_sentence_for_name(text, name)
        .unwrap_or_else(|| format!("{name} 是正文中被反复提及的地点。"))
}

fn infer_rule_event_kind(sentence: &str) -> String {
    if sentence.contains("开门") || sentence.contains("门前") || sentence.contains("入门") {
        "open_gate".into()
    } else if sentence.contains("发生关系") || sentence.contains("男") && sentence.contains("女")
    {
        "sexual_relation".into()
    } else {
        "free_input".into()
    }
}

fn extract_keywords(sentence: &str, limit: usize) -> Vec<String> {
    let keyword_re = Regex::new(r"[一-龥]{2,6}").expect("keyword regex must compile");
    let stopwords = [
        "必须", "不能", "不得", "不可", "只要", "然后", "于是", "众人", "有人", "规则", "正文",
    ]
    .into_iter()
    .collect::<BTreeSet<_>>();
    let mut keywords = Vec::new();
    for capture in keyword_re.captures_iter(sentence) {
        let candidate = capture[0].trim();
        if stopwords.contains(candidate) {
            continue;
        }
        if keywords.iter().any(|existing| existing == candidate) {
            continue;
        }
        keywords.push(candidate.to_string());
        if keywords.len() >= limit {
            break;
        }
    }
    keywords
}

fn collect_character_context(text: &str, name: &str) -> String {
    text.lines()
        .filter(|line| line.contains(name))
        .take(3)
        .collect::<Vec<_>>()
        .join(" ")
}

fn first_sentence_for_name(text: &str, name: &str) -> Option<String> {
    text.split(['。', '！', '？', '\n'])
        .map(str::trim)
        .find(|sentence| !sentence.is_empty() && sentence.contains(name))
        .map(|sentence| sentence.to_string())
}

fn extract_identity_from_context(text: &str, name: &str) -> Option<String> {
    let context = collect_character_context(text, name);
    for suffix in [
        "教头", "头领", "寨主", "好汉", "员外", "太守", "知府", "军师", "都头", "英雄",
    ] {
        let pattern = format!("{name}{suffix}");
        if context.contains(&pattern) {
            return Some(suffix.to_string());
        }
    }
    None
}

fn extract_location_near_name(text: &str, name: &str) -> Option<String> {
    let location_re = Regex::new(r"([一-龥]{1,8}(?:山寨|梁山泊|东京|州|府|县|庄|寺|堂|寨|营|关))")
        .expect("location-near-name regex must compile");
    for line in text.lines().filter(|line| line.contains(name)) {
        if let Some(capture) = location_re.captures(line) {
            return Some(capture[1].to_string());
        }
    }
    None
}

fn extract_character_names(text: &str) -> Vec<String> {
    let stopwords = [
        "临川城",
        "北门",
        "旧约",
        "真相",
        "钟声",
        "火把",
        "午夜",
        "城规",
        "名字",
        "雨幕",
        "他们",
        "她们",
        "我们",
        "你们",
        "有人",
        "众人",
        "自己",
        "城中",
        "门前",
        "门外",
    ]
    .into_iter()
    .collect::<BTreeSet<_>>();
    let speaker_re = Regex::new(
        r"([一-龥]{2,4})(?:就|便|还|又|再|仍|都)?(?:说|问|看|听|想|站|走|来到|看见|知道|决定|低声问|低声|抬头|守住|打开|道|喝道|叫道|说道|笑道|骂道|答道|商议)",
    )
    .expect("character regex must compile");
    let titled_name_re =
        Regex::new(r"(?:教头|头领|寨主|好汉|员外|太守|知府|军师|都头)([一-龥]{2,3})")
            .expect("titled name regex must compile");
    let listed_name_re =
        Regex::new(r"([一-龥]{2,3})(?:、|，)").expect("listed name regex must compile");
    let mut counts = HashMap::<String, usize>::new();
    for capture in speaker_re.captures_iter(text) {
        let Some(candidate) = sanitize_character_candidate(&capture[1], &stopwords) else {
            continue;
        };
        if !stopwords.contains(candidate.as_str()) {
            *counts.entry(candidate).or_insert(0) += 1;
        }
    }

    for capture in titled_name_re.captures_iter(text) {
        let Some(candidate) = sanitize_character_candidate(&capture[1], &stopwords) else {
            continue;
        };
        if !stopwords.contains(candidate.as_str()) {
            *counts.entry(candidate).or_insert(0) += 2;
        }
    }

    for capture in listed_name_re.captures_iter(text) {
        let Some(candidate) = sanitize_character_candidate(&capture[1], &stopwords) else {
            continue;
        };
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
    names.truncate(12);
    names
}

fn extract_locations(text: &str) -> Vec<String> {
    let re = Regex::new(r"([一-龥]{1,4}(?:城|门|河|山|宫|府|楼|镇|村|院))")
        .expect("location regex must compile");
    let mut names = BTreeSet::new();
    for capture in re.captures_iter(text) {
        if let Some(candidate) = sanitize_location_candidate(&capture[1]) {
            names.insert(candidate);
        }
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
                && [
                    "必须", "不能", "不得", "只要", "规则", "城规", "禁", "不可", "须", "不许",
                    "严禁",
                ]
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
    rules.truncate(12);
    rules
}

fn sanitize_character_candidate(candidate: &str, stopwords: &BTreeSet<&str>) -> Option<String> {
    let trimmed = candidate.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut normalized = trimmed.to_string();
    for suffix in [
        "说道", "喝道", "叫道", "笑道", "骂道", "答道", "商议", "低声", "说道", "嚷道", "说道",
        "喝", "叫", "说", "嚷", "道",
    ] {
        if normalized.ends_with(suffix) {
            normalized = normalized.trim_end_matches(suffix).to_string();
        }
    }

    let chars = normalized.chars().collect::<Vec<_>>();
    normalized = if chars.len() >= 3 && "就便还又再仍都".contains(*chars.last().unwrap_or(&' '))
    {
        chars[..chars.len() - 1].iter().collect::<String>()
    } else {
        normalized
    };

    if normalized.chars().count() > 3 {
        let first = normalized.chars().next()?;
        if COMMON_CHINESE_SURNAMES.contains(first) {
            normalized = normalized.chars().take(3).collect();
        }
    }

    if !(2..=4).contains(&normalized.chars().count()) {
        return None;
    }
    if stopwords.contains(normalized.as_str()) {
        return None;
    }

    let first = normalized.chars().next()?;
    if !COMMON_CHINESE_SURNAMES.contains(first) {
        return None;
    }

    Some(normalized)
}

fn sanitize_location_candidate(candidate: &str) -> Option<String> {
    let mut normalized = candidate.trim().to_string();
    if normalized.is_empty() {
        return None;
    }

    for prefix in [
        "打开", "站在", "走到", "来到", "知道", "守住", "进入", "回到", "离开", "前往", "之后",
        "之前", "他们", "她们", "我们", "你们", "有人", "众人", "自己", "城中", "只要", "绝不",
        "不能", "不得", "必须",
    ] {
        if normalized.starts_with(prefix) {
            normalized = normalized.trim_start_matches(prefix).to_string();
        }
    }

    if !(2..=4).contains(&normalized.chars().count()) {
        return None;
    }
    if ["知道城", "打开门", "站在门"].contains(&normalized.as_str()) {
        return None;
    }

    Some(normalized)
}

const COMMON_CHINESE_SURNAMES: &str = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐丘骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧";

#[cfg(test)]
mod tests {
    use super::{
        HeuristicStoryProvider, StoryAiProvider, extract_character_names, extract_locations,
    };
    use crate::models::{BuildStatus, ChapterChunk, NovelProject};

    fn sample_text() -> &'static str {
        "第1章 雨夜来客\n\n临川城的钟声刚落，沈砚就看见雨幕中有人提灯而来。\n他知道城规只有一条，午夜之后绝不能打开北门。\n\n第2章 禁忌之门\n\n宁昭低声问他是否还记得旧约，沈砚没有回答。\n城中人都说，只要北门打开一次，河上的雾就会吞掉名字。\n\n第3章 选择\n\n他们站在门前，火把渐灭，钟声再次响起。\n沈砚必须决定，是遵守城规，还是向真相迈进一步。"
    }

    #[test]
    fn extract_character_names_prefers_named_characters_over_sentence_fragments() {
        let names = extract_character_names(sample_text());

        assert!(names.iter().any(|name| name == "沈砚"));
        assert!(names.iter().any(|name| name == "宁昭"));
        assert!(names.iter().all(|name| name != "他们"));
        assert!(names.iter().all(|name| name != "中人都"));
    }

    #[test]
    fn extract_locations_avoids_absorbing_entire_sentences() {
        let locations = extract_locations(sample_text());

        assert!(locations.iter().any(|name| name == "临川城"));
        assert!(locations.iter().any(|name| name == "北门"));
        assert!(locations.iter().all(|name| name != "之后绝不能打开北门"));
        assert!(locations.iter().all(|name| name != "他们站在门"));
    }

    fn heuristic_project(raw_text: &str) -> NovelProject {
        NovelProject {
            id: "project-1".into(),
            name: "水浒传".into(),
            raw_text: raw_text.into(),
            chapters: vec![ChapterChunk {
                id: "chapter-1".into(),
                order: 1,
                title: "第一回".into(),
                content: raw_text.into(),
                excerpt: raw_text.chars().take(40).collect(),
                ..ChapterChunk::default()
            }],
            build_status: BuildStatus::default(),
            ..NovelProject::default()
        }
    }

    #[test]
    fn heuristic_provider_outputs_chinese_gender_and_avoids_demo_world_defaults() {
        let raw_text = [
            "话说东京八十万禁军教头林冲，正自与鲁智深、武松、李逵、宋江商议梁山泊事务。",
            "宋江道，梁山泊上下须守忠义，不可坏了弟兄情分。",
            "武松喝道，若有奸邪作祟，须当即拿下。",
            "李逵叫道，俺也去。",
        ]
        .join("\n");
        let provider = HeuristicStoryProvider;
        let result = provider
            .analyze(&heuristic_project(&raw_text))
            .expect("heuristic analysis");

        assert!(!result.character_cards.is_empty());
        assert!(
            result
                .character_cards
                .iter()
                .all(|card| matches!(card.gender.as_str(), "男" | "女" | "未知"))
        );
        assert!(
            result
                .character_cards
                .iter()
                .all(|card| card.identity != "守门人" && card.identity != "破局者")
        );
        assert!(
            result
                .character_cards
                .iter()
                .all(|card| card.faction != "临川城" && card.faction != "门外之约")
        );
        assert!(
            result
                .story_bible
                .world_rules
                .iter()
                .all(|rule| !rule.description.contains("北门"))
        );
    }

    #[test]
    fn heuristic_provider_does_not_truncate_large_chinese_cast_or_rules_to_four() {
        let raw_text = [
            "宋江道，忠义为先，梁山泊上下不可自相残害。",
            "林冲喝道，若有军令，众人不得违拗。",
            "武松说道，见了不平之事，须当拔刀相助。",
            "鲁智深叫道，山寨门前不得滋事，不许伤及百姓。",
            "李逵嚷道，若有奸人潜入，必须立刻拿下。",
            "吴用说道，但凡调兵遣将，须先禀明寨主。",
            "柴进道，众头领不得私藏财货。",
        ]
        .join("\n");
        let provider = HeuristicStoryProvider;
        let result = provider
            .analyze(&heuristic_project(&raw_text))
            .expect("heuristic analysis");
        let extracted_names = result
            .character_cards
            .iter()
            .map(|card| card.name.as_str())
            .collect::<Vec<_>>();

        assert!(extracted_names.contains(&"宋江"));
        assert!(extracted_names.contains(&"林冲"));
        assert!(extracted_names.contains(&"武松"));
        assert!(extracted_names.contains(&"鲁智深"));
        assert!(extracted_names.contains(&"李逵"));
        assert!(result.character_cards.len() > 4);
        assert!(result.story_bible.world_rules.len() > 4);
    }
}
