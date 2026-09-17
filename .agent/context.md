# OmniGit - Agent 全局上下文与项目规则

## 1. 最高优先级安全红线 (Project Safety Rules)

- **禁止自动提交 Git 代码**：
  - **严禁** Agent 自主执行 `git commit` 或 `git push` 等代码提交与推送命令（除非用户在对话中明确要求）。
  - 代码修改与验证通过后，仅向用户清晰汇报修改的文件列表、改动逻辑与构建校验结果，保留修改处于 staged 或 unstaged 状态，由用户自行手动提交。
- **严禁自主执行破坏性 Git 操作**：
  - **严禁**自主执行 `git push --force`、`git reset --hard`、`git clean -f`、`git branch -D` 等可能导致用户本地未保存代码丢失的高危命令。
  - 若排查或修复确实需要破坏性操作，必须将拟执行的命令以规范代码块形式清晰提示用户，由用户确认并手动执行。
- **数据库/持久层操作严格只读**：
  - 若后续涉及 SQLite 或轻量嵌入式存储，Agent 仅允许执行只读查询（如 `SELECT`、元数据查看等）。严禁自主执行任何写操作或表结构破坏性变更。

---

## 2. 项目结构与技术栈 (Project Architecture)

- **项目定位**：轻量级、高性能桌面 Git 客户端（首发 Windows，架构支持跨平台）。深度对标并提炼 IntelliJ IDEA 的核心 Git 操作习惯（提交工作台、未更新代码检测、分支流转）。
- **技术栈**：
  - **后端引擎**：Electron 30 + Express Git API 服务（本地无感守护进程，封装调用系统原生 Git CLI）。
  - **前端界面**：Vite 6 + React 18 + TypeScript + Tailwind CSS + Zustand。
  - **编辑器内核**：`@monaco-editor/react`（双栏差异比对，支持右侧直接实时编辑）。
- **目录布局**：
  - `app/`：前端应用与 Electron 桌面端主工程
    - `app/src/`：React 前端源码（`features/`、`store/`、`components/`）
    - `app/electron/`：Electron 主进程与预加载脚本（`main.ts`、`preload.ts`）
    - `app/src/server/`：轻量级 Git 服务与 API 路由调度核心
  - `scripts/`：统一英文命名的打包与启停脚本目录（`build_desktop.bat`, `start_desktop.bat`, `start_dev.bat`, `stop_dev.bat` 等）
  - `docs/`：产品设计与技术架构文档（`OmniGit_PRD.md`）

---

## 3. 本地环境与端口规范 (Environment & Port Isolation)

- **环境规范与相对路径调用**：
  - 脚本与工程统一支持相对路径执行，环境工具链优先读取系统全局 PATH，自适应开发者电脑环境；
  - 便携版 NSIS 编译器已内置于 `scripts/tools/nsis/`，跨机克隆即用，免额外配置。
- **专属端口绑定**：
  - 前端开发服务严格绑定端口 **`5345`**，严禁使用 5173 或随意占用其他端口，避免与用户本地其他微服务冲突。
- **脚本优先原则**：
  - 服务启停与打包流水线必须优先通过 `scripts/` 目录下的批处理或 PowerShell 脚本执行。

---

## 4. 前后端代码修改与编译校验规则

- **前端与主进程修改规则 (`app/src/`, `app/electron/`)**：
  - 若仅为纯样式（CSS）微调或文案变动，无需强制触发构建。
  - 若涉及 TypeScript 语法、类型定义、组件 Props 接口、Zustand Store 状态、Electron 主进程或新依赖引入，**必须**在 `app/` 目录下执行构建校验（`npm run build:all` 或 `npm run build`），确保 0 错误 0 警告后方可交付。

---

## 5. 编码与通用规范

- **统一 UTF-8 编码（防乱码红线）**：
  - Windows 控制台执行脚本或构建时显式设置 `chcp 65001`；
  - 所有源码与文档文件必须统一保存为 `UTF-8` 编码。
- **交互规范**：
  - **必须一律严格使用中文回复用户**：无论是方案说明、问题解答、思考过程阐述、修改总结还是日常沟通，均必须使用中文回复；
  - 界面操作与 Git 功能按钮按用户要求保持标准 IntelliJ IDEA 英文术语；
  - 遵循“设计先于编码”与苏格拉底对齐原则，重大变更先在 PRD/实施计划中确认后再开工。

---

## 6. 用户数据安全与存储防爆红线 (Data Persistence & Cache Safety)

- **工作空间与历史资产永不丢失红线**：
  - **严禁**在任何异常处理（如 `ErrorBoundary`）或“清理本地缓存”逻辑中通过前缀匹配（如 `key.startsWith('omnigit_')`）通配删除所有键。
  - **永久保留资产白名单**：
    - `omnigit_saved_workspaces`（已保存的工作空间列表）
    - `omnigit_ws_paths_*`（各工作空间关联的仓库本地路径）
    - `omnigit_global_recent_projects`（全局最近打开的项目历史）
    - `omnigit_last_active_*`（最后活动窗口/工程定位状态）
    - `omnigit_theme`、`omnigit_language`、`omnigit_startup_behavior`、`omnigit_new_window_behavior`、`omnigit_custom_git_accounts`（用户系统偏好与配置）
  - **允许清理的易失性临时缓存**：
    - `omnigit_snap_*`（运行时轻量仓库状态快照）
    - `omnigit_commit_draft_*`（Commit 提交说明临时草稿）
    - `omnigit_fav_branches_*`（分支星标快捷缓存，必要时可重置）
- **三级缓存分层架构与数据下沉机制 (Three-Tier Cache Architecture)**：
  - **L1 内存堆缓存 (In-Memory Heap Cache)**：
    - 纳秒级响应（0ms），保存当前活跃与近期工程/分支的完整运行时状态（全量变更文件、50~200 条 Commit 日志、Diff 状态），支撑高频秒切。
  - **L2 本地轻量存储 (Web Storage / `localStorage`)**：
    - 受配额保护，仅保存永久配置白名单以及最近工程的极轻量骨架快照（前 10 条日志摘要），单工程严格控制在 3KB 内；
    - 所有写入必须通过 `safeLocalStorageSetItem` 执行，超限自动淘汰旧快照，绝不向外抛异常。
  - **L3 本地磁盘独立文件夹存储 (Disk Directory Storage)**：
    - 位于用户本地持久化缓存目录（如用户自定义目录下的 `snapshots/`），无 5MB 限制；
    - **淘汰下沉**：L2 或 L1 淘汰下来的大型数据（深度 Commit 日志、文件状态）自动沉淀至磁盘独立文件存储，绝不直接丢弃；
    - **秒级回捞**：切换工程或分支时，若 L2 无全量数据，系统直接从 L3 磁盘文件夹秒级回捞（3~5ms）并升温进 L1 内存，避免等待缓慢的 Git CLI 原生命令；
  - **工作空间磁盘双重容灾与无感恢复**：
    - 工作空间配置必须异步备份写入磁盘 `workspaces_backup.json`；若前端存储为空，自动从磁盘无感恢复，做到双保险防丢。
