# OmniGit - Project Rules & Guidelines

请遵循 [`.agent/context.md`](./context.md) 中定义的完整全局上下文与项目规则。

## 核心摘要速查：
1. **最高安全红线**：严禁自主执行 `git commit` / `git push`（除非用户在对话中明确指示）；严禁执行破坏性 Git 命令（`--force`, `--hard`）；数据库操作严格只读。
2. **环境与端口**：全量工具链自适应系统环境与相对路径；专属开发端口固定为 `5345`；优先调用 `scripts/` 下启停与构建脚本。
3. **编译校验**：前端与主进程变动必须在 `app/` 执行 `npm run build:all` 或 `npm run build`，确保 0 错误 0 警告后方可交付。
4. **多语言规范与交互红线**：
   - 对用户的所有回复、方案阐述与日常沟通必须一律严格使用**中文**；
   - 系统支持中英双语（`zh-CN` / `en-US`），严格遵循 `app/src/locales/` 国际化架构：
     - **零硬编码**：严禁在 TSX 组件、Hook 或 Store 中硬编码任何面向用户的文案、占位符、Tooltip 悬浮提示与 Toast 通知；
     - **纯净单语言隔离**：中文模式必须纯正，严禁混杂英文括号尾缀（如禁止 `(Checkout)`、`(Staged)`）；英文模式必须为标准 Git 英文，严禁残留中文；
     - **原生日志例外**：Git CLI 产生的底层原生终端日志（stdout/stderr）保留原生英文，不作干扰。
5. **用户数据与缓存隔离红线**：严禁在任何异常重试（ErrorBoundary）或“清理缓存”逻辑中删除用户的核心数据（包括历史工作空间 `omnigit_saved_workspaces`、工作空间项目关联 `omnigit_ws_paths_*`、最近打开项目 `omnigit_global_recent_projects` 及用户配置）；“清理缓存”操作仅允许清理易失性快照缓存（`omnigit_snap_*`）。所有本地存储写入必须具备配额防爆与磁盘备份恢复机制。
6. **编码要求**：统一 UTF-8 编码（`chcp 65001`）。
