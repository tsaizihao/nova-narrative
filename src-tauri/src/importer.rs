use regex::Regex;

use crate::models::ChapterChunk;

pub fn sanitize_text(input: &str) -> String {
    input
        .replace("\r\n", "\n")
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

pub fn split_novel_into_chapters(input: &str) -> Vec<ChapterChunk> {
    let chapter_re =
        Regex::new(r"^(第[0-9一二三四五六七八九十百千零〇两]+[章节回].*|Chapter\s+\d+.*)$")
            .expect("regex must compile");
    let text = sanitize_text(input);
    if text.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut current_title: Option<String> = None;
    let mut current_lines: Vec<String> = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if chapter_re.is_match(trimmed) {
            if let Some(title) = current_title.take() {
                if let Some(chunk) = build_chunk(chunks.len() + 1, title, &current_lines) {
                    chunks.push(chunk);
                }
            }
            current_title = Some(trimmed.to_string());
            current_lines.clear();
        } else {
            current_lines.push(trimmed.to_string());
        }
    }

    if let Some(title) = current_title {
        if let Some(chunk) = build_chunk(chunks.len() + 1, title, &current_lines) {
            chunks.push(chunk);
        }
    }

    if !chunks.is_empty() {
        return chunks;
    }

    let paragraphs = text
        .split('\n')
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();

    for (index, slice) in paragraphs.chunks(4).enumerate() {
        if let Some(chunk) = build_chunk(index + 1, format!("场景 {}", index + 1), slice) {
            chunks.push(chunk);
        }
    }

    chunks
}

fn build_chunk(order: usize, title: String, lines: &[impl AsRef<str>]) -> Option<ChapterChunk> {
    let paragraphs = lines
        .iter()
        .map(AsRef::as_ref)
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if paragraphs.is_empty() {
        return None;
    }

    let content = paragraphs.join("\n");
    let excerpt = abbreviate(&content, 96);
    Some(ChapterChunk {
        id: format!("chapter-{order}"),
        order,
        title,
        content,
        excerpt,
    })
}

fn abbreviate(value: &str, limit: usize) -> String {
    let mut text = String::new();
    for character in value.chars().take(limit) {
        text.push(character);
    }
    text
}
