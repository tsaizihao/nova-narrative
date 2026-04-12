# macOS Icon Mask Design

## Goal

将当前应用的 macOS 图标调整为更接近原生 App 的圆角矩形观感，同时保持现有插画内容不变，不影响非 macOS 平台的图标资源。

## Constraints

- 只修改 macOS 使用的 `icon.icns`
- Windows、通用 PNG、ICO 等现有图标外观保持不变
- 保留整张书本插画，不重构图像主体
- 不额外做调色、锐化、发光或重新构图

## Chosen Direction

对现有源图执行一层 macOS 风格的圆角矩形遮罩，并加入适度透明安全边距：

- 图像主体继续使用当前整张插画
- 外层为圆角矩形轮廓，而不是直接输出直角方图
- 图像与边缘之间保留一圈透明留白，让 Dock 中的观感更接近原生应用图标
- 非 macOS 平台继续使用现有无圆角版本

## Asset Strategy

新增一个仅供 macOS 图标生成使用的中间 PNG 资源：

- 以当前书本插画为底图
- 缩放到底板内部，避免主体贴边
- 应用圆角矩形 alpha mask
- 保持透明背景

之后仅用这张中间图重生成 `src-tauri/icons/icon.icns`，不覆盖其它平台图标。

## Implementation Notes

- 使用本地命令行图像工具生成带透明通道的 PNG
- 优先复用现有 `src-tauri/icons` 目录，不引入额外构建依赖
- 如有必要，可将 macOS 专用中间资源保存到 `src-tauri/icons` 目录，便于后续重复生成

## Verification

- 检查生成后的 macOS 图标 PNG 中存在透明通道
- 重建 `icon.icns`
- 运行一次 `pnpm tauri build --debug --no-bundle`
- 在 macOS 上重新启动应用后，确认 Dock / Finder 中图标呈圆角矩形观感

## Non-Goals

- 不修改应用内品牌图形
- 不统一所有平台为圆角矩形图标
- 不引入新的设计主题或重新绘制图标
