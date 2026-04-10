use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("invalid state: {0}")]
    InvalidState(String),
    #[error("rule violation: {0}")]
    RuleViolation(String),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("provider error: {0}")]
    Provider(String),
    #[error("secret store error: {0}")]
    SecretStore(String),
}
