use regex::Regex;

use crate::models::{ChapterChunk, ImportDiagnostics, SourceUnitKind};

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
    let chapter_re = chapter_heading_regex();
    let text = sanitize_text(input);
    if text.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut current_unit: Option<SourceUnitDraft> = None;
    let mut current_lines: Vec<String> = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let heading = classify_heading(&chapter_re, trimmed);
        if let Some(unit) = heading {
            if matches!(unit.kind, SourceUnitKind::Preface) && current_unit.is_none() && chunks.is_empty() {
                current_unit = Some(unit);
                continue;
            }
            if let Some(current) = current_unit.take() {
                if let Some(chunk) = build_chunk(chunks.len() + 1, current, &current_lines) {
                    chunks.push(chunk);
                }
            }
            current_unit = Some(unit);
            current_lines.clear();
        } else {
            current_lines.push(trimmed.to_string());
        }
    }

    if let Some(unit) = current_unit {
        if let Some(chunk) = build_chunk(chunks.len() + 1, unit, &current_lines) {
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
        let unit = SourceUnitDraft {
            title: format!("场景 {}", index + 1),
            kind: SourceUnitKind::Scene,
            chapter_number: None,
        };
        if let Some(chunk) = build_chunk(index + 1, unit, slice) {
            chunks.push(chunk);
        }
    }

    chunks
}

pub fn build_import_diagnostics(input: &str, chapters: &[ChapterChunk]) -> ImportDiagnostics {
    let sanitized = sanitize_text(input);
    let lines = sanitized.lines().collect::<Vec<_>>();
    ImportDiagnostics {
        byte_count: sanitized.len(),
        char_count: sanitized.chars().count(),
        line_count: if sanitized.is_empty() { 0 } else { lines.len() },
        non_empty_line_count: lines.iter().filter(|line| !line.trim().is_empty()).count(),
        source_unit_count: chapters.len(),
        unassigned_line_count: count_unassigned_lines(&sanitized, chapters),
        missing_glyph_count: sanitized.matches('□').count(),
        max_line_char_count: lines
            .iter()
            .map(|line| line.chars().count())
            .max()
            .unwrap_or_default(),
        normalized_crlf: input.contains("\r\n") && !sanitized.contains("\r\n"),
    }
}

#[derive(Debug, Clone)]
struct SourceUnitDraft {
    title: String,
    kind: SourceUnitKind,
    chapter_number: Option<usize>,
}

fn chapter_heading_regex() -> Regex {
    Regex::new(r"^(第([0-9一二三四五六七八九十百千零〇两]+)[章节回].*|Chapter\s+(\d+).*)$")
        .expect("regex must compile")
}

fn classify_heading(chapter_re: &Regex, trimmed: &str) -> Option<SourceUnitDraft> {
    if trimmed.starts_with("楔子") {
        return Some(SourceUnitDraft {
            title: trimmed.to_string(),
            kind: SourceUnitKind::Preface,
            chapter_number: None,
        });
    }

    let captures = chapter_re.captures(trimmed)?;
    let chapter_number = captures
        .get(2)
        .or_else(|| captures.get(3))
        .and_then(|matched| parse_chapter_number(matched.as_str()));

    Some(SourceUnitDraft {
        title: trimmed.to_string(),
        kind: SourceUnitKind::Chapter,
        chapter_number,
    })
}

fn parse_chapter_number(value: &str) -> Option<usize> {
    if let Ok(number) = value.parse::<usize>() {
        return Some(number);
    }

    parse_chinese_number(value)
}

fn parse_chinese_number(value: &str) -> Option<usize> {
    let mut total = 0usize;
    let mut section = 0usize;
    let mut pending_digit: Option<usize> = None;

    for character in value.chars() {
        let digit = match character {
            '零' | '〇' => Some(0),
            '一' => Some(1),
            '二' | '两' => Some(2),
            '三' => Some(3),
            '四' => Some(4),
            '五' => Some(5),
            '六' => Some(6),
            '七' => Some(7),
            '八' => Some(8),
            '九' => Some(9),
            _ => None,
        };

        if let Some(digit) = digit {
            pending_digit = Some(digit);
            continue;
        }

        match character {
            '千' => {
                section += pending_digit.take().unwrap_or(1) * 1000;
            }
            '百' => {
                section += pending_digit.take().unwrap_or(1) * 100;
            }
            '十' => {
                section += pending_digit.take().unwrap_or(1) * 10;
            }
            _ => return None,
        }
    }

    if let Some(digit) = pending_digit {
        section += digit;
    }
    total += section;

    if total == 0 { None } else { Some(total) }
}

fn count_unassigned_lines(sanitized: &str, chapters: &[ChapterChunk]) -> usize {
    if chapters.is_empty() || sanitized.is_empty() {
        return sanitized.lines().filter(|line| !line.trim().is_empty()).count();
    }

    if matches!(
        chapters.first().map(|chapter| &chapter.source_unit_kind),
        Some(SourceUnitKind::Preface)
    ) {
        return 0;
    }

    let Some(first_title) = chapters.first().map(|chapter| chapter.title.as_str()) else {
        return 0;
    };
    let mut count = 0;
    for line in sanitized.lines() {
        let trimmed = line.trim();
        if trimmed == first_title {
            break;
        }
        if !trimmed.is_empty() {
            count += 1;
        }
    }
    count
}

fn build_chunk(order: usize, unit: SourceUnitDraft, lines: &[impl AsRef<str>]) -> Option<ChapterChunk> {
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
        title: unit.title,
        content,
        excerpt,
        source_unit_kind: unit.kind,
        chapter_number: unit.chapter_number,
    })
}

fn abbreviate(value: &str, limit: usize) -> String {
    let mut text = String::new();
    for character in value.chars().take(limit) {
        text.push(character);
    }
    text
}

#[cfg(test)]
mod tests {
    use super::split_novel_into_chapters;
    use crate::models::SourceUnitKind;

    const WATER_MARGIN_EXCERPT: &str =
        include_str!("../../docs/fixtures/water-margin-regression-excerpt.txt");

    #[test]
    fn split_water_margin_excerpt_preserves_preface_as_source_unit() {
        let chapters = split_novel_into_chapters(WATER_MARGIN_EXCERPT);

        assert_eq!(chapters.len(), 3);
        assert_eq!(chapters[0].source_unit_kind, SourceUnitKind::Preface);
        assert_eq!(chapters[0].chapter_number, None);
        assert_eq!(chapters[0].order, 1);
        assert_eq!(chapters[0].title, "楔子　张天师祈禳瘟疫　洪太尉误走妖魔");
        assert!(chapters[0].content.contains("《水浒传》施耐庵"));
        assert!(chapters[0].content.contains("伏魔之殿"));

        assert_eq!(chapters[1].source_unit_kind, SourceUnitKind::Chapter);
        assert_eq!(chapters[1].chapter_number, Some(1));
        assert_eq!(chapters[1].order, 2);
        assert_eq!(chapters[1].title, "第一回　王教头私走延安府　九纹龙大闹史家村");
        assert!(chapters[1].content.contains("姓高，排行第二"));

        assert_eq!(chapters[2].source_unit_kind, SourceUnitKind::Chapter);
        assert_eq!(chapters[2].chapter_number, Some(2));
        assert_eq!(chapters[2].order, 3);
        assert_eq!(chapters[2].title, "第二回　史大郎夜走华阴县　鲁提辖拳打镇关西");
        assert!(chapters[2].content.contains("史进道"));
        assert!(chapters.iter().all(|chapter| chapter.excerpt.chars().count() <= 96));
    }
}
