# OmniGit - Project Rules & Guidelines

请遵循 [`.agent/context.md`](./context.md) 中定义的完整全局上下文与项目规则。

## 核心摘要速查：
1. **最高安全红线**：严禁自主执行 `git commit` / `git push`（除非用户在对话中明确指示）；严禁执行破坏性 Git 命令（`--force`, `--hard`）；数据库操作严格只读。
2. **环境与端口**：全量工具链自适应系统环境与相对路径；专属开发端口固定为 `5345`；优先调用 `scripts/` 下启停与构建脚本。
3. **编译校验**：前端与主进程变动必须在 `app/` 执行 `npm run build:all` 或 `npm run build`，确保 0 错误 0 警告后方可交付。
4. **交互与语言规范**：对用户的所有回复、方案阐述、问题答复与交互说明必须一律严格使用**中文**；系统与编辑器内的 Git 按钮标签维持标准 IntelliJ IDEA 英文术语。
5. **用户数据与缓存隔离红线**：严禁在任何异常重试（ErrorBoundary）或“清理缓存”逻辑中删除用户的核心数据（包括历史工作空间 `omnigit_saved_workspaces`、工作空间项目关联 `omnigit_ws_paths_*`、最近打开项目 `omnigit_global_recent_projects` 及用户配置）；“清理缓存”操作仅允许清理易失性快照缓存（`omnigit_snap_*`）。所有本地存储写入必须具备配额防爆与磁盘备份恢复机制。
6. **编码要求**：统一 UTF-8 编码（`chcp 65001`）。
