use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum RulePriority {
    HardConstraint,
    SoftConstraint,
    #[default]
    Consequence,
    NarrativeGate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum RuleOperator {
    #[default]
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    Contains,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleCondition {
    pub fact: String,
    pub operator: RuleOperator,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleEffect {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleDefinition {
    pub id: String,
    pub name: String,
    pub category: String,
    pub priority: RulePriority,
    pub enabled: bool,
    pub conditions: Vec<RuleCondition>,
    pub blockers: Vec<RuleCondition>,
    pub effects: Vec<RuleEffect>,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ActiveRuleHit {
    pub rule_id: String,
    pub name: String,
    pub priority: RulePriority,
    pub explanation: String,
    pub effects: Vec<RuleEffect>,
    pub reason: String,
}
