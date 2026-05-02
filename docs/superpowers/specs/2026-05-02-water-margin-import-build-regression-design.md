# 《水浒传》导入到构建回归样本设计

## 参考依据

- `README.md`：当前 `v1` 本地闭环支持 `导入 -> 提炼 -> 编译 -> 审阅 -> 游玩`，验证命令为 `pnpm verify`。
- `docs/architecture-guide.md`：导入、提炼、编译、运行时、预览和存储由独立模块承担职责，`StoryPackage` 是工作流交接物。
- `docs/system-specification.md`：导入与预处理应尽可能保留章节边界、段落语义与基础顺序信息，未来应记录导入元数据和文本统计信息。

## 背景与问题

《水浒传》适合作为导入到构建阶段的回归样本，因为它同时包含大体量中文章回文本、`楔子`、中文数字回目、全角空格、长行、古典标点和少量疑似缺字字符。旧导入器只识别 `第X章/节/回` 与 `Chapter N`，会从 `第一回` 才开始建 chunk，导致书名与 `楔子` 内容在有章节命中的情况下被丢弃。

这个问题不是单纯的正则缺口，而是原著结构语义缺口。系统需要把导入结果从“章节数组”提升为兼容的 source unit 模型：仍保留现有 `chapters` 字段，方便当前编译器和 UI 继续工作，但每个 chunk 要携带它在原著结构中的类型和原著回目编号。

## 设计决策

导入器把 `楔子` 识别为 `preface` source unit。它参与后续提炼、编译和 adaptation kernel 快照，但不占用原著回目编号，所以 `第一回` 的 `chapter_number` 仍为 `1`，`第二回` 仍为 `2`。没有明确章节标题的文本继续走原有兜底路径，按段落块生成 `scene` source unit。

`ChapterChunk` 增加：

- `source_unit_kind`: `preface | chapter | scene`
- `chapter_number`: 原著章节/回目编号，`preface` 和兜底 `scene` 为空

`SourceChapterSnapshot` 同步保存这两个字段，让 build 后的 `adaptation_kernel.source_novel.chapters` 能追踪原著结构。旧项目 JSON 通过 serde 默认值保持兼容：未带新字段的历史 chunk 会按普通 `chapter` 处理。

导入后项目保存 `import_diagnostics`，用于记录最小可观测信息：

- 文本字节数、字符数、行数、非空行数
- source unit 数量
- 未归属正文行数
- `□` 疑似缺字数量
- 最大行字符数
- 是否发生 CRLF 规范化

## 回归样本

新增 `docs/fixtures/water-margin-regression-excerpt.txt`，从本地《水浒传》原文裁剪，长度约 6.6K 字符。样本包含：

- 书名行与 `楔子　张天师祈禳瘟疫　洪太尉误走妖魔`
- `第一回　王教头私走延安府　九纹龙大闹史家村`
- `第二回　史大郎夜走华阴县　鲁提辖拳打镇关西`

该样本用于默认快速 Rust 回归测试，覆盖真实古典文本结构而不拖慢常规测试。整本 `docs/水浒传.txt` 可作为后续慢速 gated 样本，目标断言为 `楔子 + 120 回`，不进入默认快速套件。

## 测试策略

Rust importer 单测验证：

- `楔子` 被保留为第一个 `preface` source unit
- 书名行被纳入 `楔子` 内容，不作为未归属正文
- `第一回`、`第二回` 分别保留原著回目编号 `1`、`2`
- excerpt 仍受现有摘要长度限制

ProjectStore 回归测试验证：

- 导入样本后状态进入 `imported`
- `import_diagnostics` 记录 source unit、字符数、缺字数和未归属行数
- build 后 project 和 package 的 adaptation kernel 都包含 `preface` source snapshot
- 编译出的 scene graph 至少包含 `楔子` 场景标题

前端保持轻量：共享类型更新以反映新字段，mock backend 透传 source unit 元数据；UI 不新增目录或诊断面板。

## 非目标

- 不设计 epub、docx、pdf 等多格式导入。
- 不重做 AI 提炼 prompt 或外部 provider 交互。
- 不新增完整书籍目录 UI。
- 不要求当前编译器理解 `preface` 的特殊叙事权重，只要求不丢失且可追踪。
