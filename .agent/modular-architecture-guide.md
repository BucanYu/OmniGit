# 模块化架构寻址、性能基线与扩展规约指南 (Modular Architecture & Performance Protocol)

> **何时阅读本文档**：当你需要新增或修改后端 Git 能力、调整 Zustand 状态切片、修改微服务运行器（Web HTTP / Electron IPC）、或扩展 Data Tools 离线开发工具箱时，请按需查阅本指南。

---

## 一、 领域子模块寻址目录 (Domain Module Routing Map)

为遵守单文件 `<= 800` 行红线，核心巨型模块已按职责拆解为 Facade + 领域子模块结构。**新增或修改功能时，必须直接定位并写入对应领域子模块，严禁将实现代码重新堆砌回 Facade 入口文件**。

### 1. 后端 Git 引擎 (`app/src/server/`)
- **Facade 入口**：`app/src/server/gitService.ts`（仅 60 行，只做聚合导出与向后兼容 re-export，禁止写入业务逻辑）
- **7 大领域子模块 (`app/src/server/git/`)**：
  - `gitExec.ts`：Git 子进程并发信号量队列（`runGit`）、进程树强制清理（`killProcessTree`）、克隆进度解析、冲突标记扫描（`hasGitConflictMarkers` / `parseConflictMarkers`）
  - `gitStatusIdentityOps.ts`：仓库状态检测（`getStatus`）、Git 身份/凭据探测、仓库文件变更监听（`repoWatchers`）
  - `gitLogHistoryOps.ts`：提交历史分页查询（`getCommitLogs`，含 `%P` 拓扑父节点）、提交详情、单文件历史轨迹、Revert / Reset
  - `gitBranchPushOps.ts`：分支列表、新建/切换/删除/重命名分支、Pull / Push、待推送提交（Outgoing）统计
  - `gitMergeConflictOps.ts`：分支合并（`mergeBranch`）、三方冲突块提取（`getConflictDetails`）与冲突解决写回
  - `gitWorkspaceCloneOps.ts`：目录递归扫描 Git 仓库、流式克隆（`startCloneStream`）、工作空间备份与快照缓存读写
  - `gitBatchStashBlameOps.ts`：多仓库批量协同（`batchPull` / `batchFetch` / `batchCheckout`）、Git Stash 暂存架管理（List/Save/Apply/Pop/Drop）、行级 `git blame` 解析

### 2. 前端 Zustand 状态库 (`app/src/store/`)
- **核心辅助与三级缓存**：`app/src/store/storeHelpers.ts`（路径归一化、`setL1SnapshotCache`、L1/L2/L3 快照读写、跨窗口事件广播）
- **状态切片 (`app/src/store/slices/`)**：
  - `workspaceSlice.ts` + `workspaceSavedGroupsSlice.ts`（工作空间分组、最近打开项目、窗口新建与切换）
  - `gitStatusSlice.ts` + `gitCommitActionsSlice.ts`（工作区文件状态、勾选暂存、Commit / Amend / Discard 动作）
  - `gitBranchSlice.ts` + `gitPushSlice.ts`（分支操作与 Push 流转弹窗状态）
  - `gitLogSlice.ts`（提交历史、搜索过滤、版本对比）
  - `gitConflictSlice.ts`（三方合并冲突状态）
  - `uiSlice.ts`（主题、语言、全局弹窗与通知状态）

### 3. 微服务运行器与 UI 拆分子组件
- **微服务状态与持久化**：
  - `app/src/features/services/useServicesStore.ts`：Zustand 运行时状态、启停编排（支持 `startDelayMs` 顺序延时）、端口释放重启
  - `app/src/features/services/serviceStorage.ts`：`StreamLogBuffer` 流式日志缓冲、本地/磁盘持久化、HTTP 与 Electron IPC 双端请求封装、端口冲突日志嗅探
- **重点 UI 子组件拆分映射**：
  - `DiffEditorPanel.tsx` -> 子组件位于 `DiffEditorSubcomponents.tsx`
  - `BranchMenu.tsx` -> 悬浮子菜单位于 `BranchFlyoutSubmenu.tsx`
  - `WelcomeWorkspaceView.tsx` -> 个性化设置标签页位于 `WelcomeCustomizeTab.tsx`
  - `SystemSettingsModal.tsx` -> 关于/更新与性能参数子组件位于 `SystemSettingsAboutTab.tsx`
  - `AddRepoModal.tsx` -> 远程克隆表单位于 `AddRepoCloneSection.tsx`
  - `ThreeWayMergeModal.tsx` -> 冲突块渲染子组件位于 `ThreeWayMergeSubcomponents.tsx`
- **高水位线预警文件（約 750~795 行）**：
  - `gitApiHandler.ts`、`workspaceSlice.ts`、`workspaceSavedGroupsSlice.ts`、`useServicesStore.ts`、`serviceStorage.ts`、`SystemSettingsModal.tsx`、`nodeServiceProcessManager.ts`。向这些文件新增超过 20 行的逻辑时，**必须**抽离为独立 helper 或子模块。

---

## 二、 编译、性能与并发硬基线 (TypeScript & Runtime Guardrails)

1. **`verbatimModuleSyntax` 严格类型导入**：
   - `tsconfig.app.json` 已启用 `verbatimModuleSyntax: true`。跨模块导入纯 TypeScript `interface` 或 `type` 时，**必须**显式使用 `import type { ... }` 或 `import { type ... }`，否则 `npm run typecheck` 会报 `TS1484` 错误。
2. **Git 子进程信号量限流（禁止裸调 `execFile`）**：
   - 后端所有 Git CLI 调用必须统一经由 `app/src/server/git/gitExec.ts` 的 `runGit(args, cwd, timeout)` 执行；
   - `runGit` 内置本地操作最大并发 `6`、远程网络操作最大并发 `3` 的信号量队列，并自动注入 `GIT_OPTIONAL_LOCKS=0` 与 `-c core.quotepath=false`，防止多仓库并发引发进程风暴或 `.git/index.lock` 争用。
3. **L1 内存缓存 LRU 与元数据防抖**：
   - 写入内存快照统一调用 `setL1SnapshotCache(normPath, snapshot)`（强制 20 个仓库 LRU 上限，单仓 `commitLogs <= 120`、`commitHistory <= 30`）；
   - 低频仓库元数据（Authors、RecentMessages、LastCommit）受 `repoMetadataFreshness`（30 秒 TTL）保护，切换项目时避免重复请求。
4. **高频流式日志节流（32ms 合并刷新）**：
   - 终端 stdout/stderr 流必须通过 `StreamLogBuffer.append(chunk)` 增量解析新增分片，并以 `LOG_FLUSH_INTERVAL_MS = 32` 节流合并更新 Zustand 状态，严禁每次收到 chunk 时对 2000 行历史数组做全量重拼或同步触发 React 渲染。

---

## 三、 双端通道对齐与 Data Tools 扩展契约

1. **Web HTTP 与 Electron IPC 双端对齐**：
   - 微服务运行器同时支持 Web 模式（`app/src/server/gitApiHandler.ts`）与 Electron 桌面模式（`app/electron/serviceProcessManager.ts` + `app/electron/preload.ts`）；
   - 新增进程控制接口（如端口检测、杀进程、启停服务）时，必须同步在 HTTP 路由与 Electron IPC 中注册，并在 `serviceStorage.ts` 中封装统一的调用函数。
2. **Data Tools 离线开发工具 4 步扩展契约 (`app/src/features/data-tools/`)**：
   - **Step 1**：在 `types.ts` 的 `DataFormat` 联合类型中注册新格式标识；
   - **Step 2**：在 `formatters/` 下新增纯前端同步计算模块，返回 `{ parsed, formattedJson }`；
   - **Step 3**：在 `analyzer.ts` 与 `useDataToolsStore.ts` 中接入该 formatter，并调用 `buildJsonTree(parsed)` 生成树节点（右侧 Tree 视图与 Table 视图将自动渲染结构化结果）；
   - **Step 4**：在 `defaultSamples.ts`、`DataToolsHeader.tsx`、`DataToolsTabBar.tsx` 中补充示例数据与格式徽章配置。
