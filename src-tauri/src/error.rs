use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandErrorPayload {
    pub code: &'static str,
    pub message: String,
}

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

pub fn map_app_error_to_command_error(error: AppError) -> CommandErrorPayload {
    let (code, message) = match error {
        AppError::Validation(message) => ("validation_error", message),
        AppError::NotFound(message) => ("not_found", message),
        AppError::InvalidState(message) => ("invalid_state", message),
        AppError::RuleViolation(message) => ("rule_violation", message),
        AppError::Provider(message) => ("provider_error", message),
        AppError::SecretStore(message) => ("secret_store_error", message),
        AppError::Io(message) => ("io_error", message.to_string()),
        AppError::Serde(message) => ("serde_error", message.to_string()),
    };

    CommandErrorPayload { code, message }
}

#[cfg(test)]
mod tests {
    use super::{AppError, map_app_error_to_command_error};

    #[test]
    fn validation_errors_map_to_structured_command_payloads() {
        let payload = map_app_error_to_command_error(AppError::Validation("bad input".into()));

        assert_eq!(payload.code, "validation_error");
        assert_eq!(payload.message, "bad input");
    }

    #[test]
    fn not_found_errors_map_to_structured_command_payloads() {
        let payload = map_app_error_to_command_error(AppError::NotFound("project-1".into()));

        assert_eq!(payload.code, "not_found");
        assert_eq!(payload.message, "project-1");
    }
}
