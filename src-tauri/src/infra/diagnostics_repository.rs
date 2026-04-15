use std::{
    fs::{self, OpenOptions},
    io::Write,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use crate::{error::AppResult, infra::RuntimeDataPaths};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticsLevel {
    Info,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiagnosticsEvent {
    pub timestamp_ms: i64,
    pub level: DiagnosticsLevel,
    pub operation: String,
    pub detail: String,
    pub project_id: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DiagnosticsRepository {
    layout: RuntimeDataPaths,
}

impl DiagnosticsRepository {
    pub fn new(layout: RuntimeDataPaths) -> AppResult<Self> {
        layout.ensure_layout()?;
        Ok(Self { layout })
    }

    pub fn append(&self, event: &DiagnosticsEvent) -> AppResult<()> {
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.layout.diagnostics_path())?;
        serde_json::to_writer(&mut file, event)?;
        file.write_all(b"\n")?;
        Ok(())
    }

    pub fn record(
        &self,
        level: DiagnosticsLevel,
        operation: &str,
        detail: impl Into<String>,
        project_id: Option<&str>,
        session_id: Option<&str>,
    ) -> AppResult<DiagnosticsEvent> {
        let event = DiagnosticsEvent {
            timestamp_ms: current_timestamp_ms(),
            level,
            operation: operation.into(),
            detail: detail.into(),
            project_id: project_id.map(str::to_string),
            session_id: session_id.map(str::to_string),
        };
        self.append(&event)?;
        Ok(event)
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn load_all(&self) -> AppResult<Vec<DiagnosticsEvent>> {
        let path = self.layout.diagnostics_path();
        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(path)?;
        content
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(serde_json::from_str)
            .collect::<Result<Vec<_>, _>>()
            .map_err(Into::into)
    }
}

fn current_timestamp_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::infra::{DiagnosticsLevel, RuntimeDataPaths};

    use super::DiagnosticsRepository;

    #[test]
    fn appends_and_reloads_diagnostics_events() {
        let dir = tempdir().expect("temp dir");
        let layout = RuntimeDataPaths::new(dir.path().to_path_buf());
        let repository = DiagnosticsRepository::new(layout.clone()).expect("repo");

        repository
            .record(
                DiagnosticsLevel::Info,
                "create_project",
                "created project snapshot",
                Some("project-1"),
                None,
            )
            .expect("record event");

        let events = repository.load_all().expect("load events");

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].operation, "create_project");
        assert_eq!(events[0].project_id.as_deref(), Some("project-1"));
        assert!(layout.diagnostics_path().exists());
    }
}
