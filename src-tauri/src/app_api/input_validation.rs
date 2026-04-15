use crate::error::AppError;

pub fn require_trimmed_non_empty<'a>(value: &'a str, label: &str) -> Result<&'a str, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Err(AppError::Validation(format!("{label} cannot be empty")))
    } else {
        Ok(trimmed)
    }
}

pub fn require_project_id(project_id: &str) -> Result<&str, AppError> {
    require_trimmed_non_empty(project_id, "project_id")
}

pub fn require_session_id(session_id: &str) -> Result<&str, AppError> {
    require_trimmed_non_empty(session_id, "session_id")
}

pub fn require_scene_id(scene_id: &str) -> Result<&str, AppError> {
    require_trimmed_non_empty(scene_id, "scene_id")
}

pub fn require_choice_id(choice_id: &str) -> Result<&str, AppError> {
    require_trimmed_non_empty(choice_id, "choice_id")
}

pub fn require_checkpoint_id(checkpoint_id: &str) -> Result<&str, AppError> {
    require_trimmed_non_empty(checkpoint_id, "checkpoint_id")
}

pub fn require_project_name(name: &str) -> Result<&str, AppError> {
    require_trimmed_non_empty(name, "project_name")
}

pub fn require_story_text(content: &str) -> Result<&str, AppError> {
    require_trimmed_non_empty(content, "content")
}

pub fn require_event_kind(event_kind: &str) -> Result<&str, AppError> {
    require_trimmed_non_empty(event_kind, "event_kind")
}

#[cfg(test)]
mod tests {
    use super::{require_project_name, require_story_text};

    #[test]
    fn project_name_is_trimmed() {
        assert_eq!(require_project_name("  北门夜话 ").unwrap(), "北门夜话");
    }

    #[test]
    fn story_text_cannot_be_empty() {
        assert_eq!(
            require_story_text("   ").unwrap_err().to_string(),
            "validation error: content cannot be empty"
        );
    }
}
