# 叙世者

> “叙述世界的人”——你就是这个世界的主宰，AI 帮你搭台。

`叙世者` 是一个本地优先的 `Svelte + Tauri + Rust` 桌面应用，用来把中文小说整理成可审阅、可修订、可游玩的互动故事。

## 当前状态

当前仓库已经具备 `v1` 本地闭环基线：

- 支持 `导入 -> 提炼 -> 编译 -> 审阅 -> 游玩`
- 支持 review workspace、聚合预览、reader runtime snapshot
- 支持 session 的 `active -> ending_reached -> finished` 生命周期
- 支持本地存储清单、基础迁移入口和 diagnostics 日志

它仍然是快速迭代中的桌面应用，不包含账号、云同步、插件生态、多格式导入或资产工作流。

## 快速开始

```bash
pnpm install
pnpm tauri dev
```

如果只想验证代码基线，运行：

```bash
pnpm verify
```

这会依次执行：

- `pnpm test`
- `pnpm check`
- `cargo test --manifest-path src-tauri/Cargo.toml`

## 运行时数据

应用运行时数据保存在本地 runtime 目录，当前约定包括：

- `projects/*.json`
- `sessions/*.json`
- `ai-settings.json`
- `storage-manifest.json`
- `diagnostics.log`

其中 provider 密钥仍保存在 secret store，不写入 `ai-settings.json`。

## 文档入口

- 架构主入口：[docs/architecture-guide.md](docs/architecture-guide.md)
- 实施路线主入口：[docs/implementation-roadmap-v1.md](docs/implementation-roadmap-v1.md)
- 系统语义与术语参考：[docs/system-specification.md](docs/system-specification.md)
