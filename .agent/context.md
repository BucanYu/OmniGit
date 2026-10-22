# OmniGit - Agent 全局上下文与项目规则

## 1. 最高优先级安全红线 (Project Safety Rules)

- **代码自动提交铁律（用户明确授权指令）**：
  - 用户已明确指示：**后续每次修改完毕且自主测试验证通过后，必须自动执行 `git commit` 将改动提交到本地 Git**，无需等待用户手动提交。
  - Commit 提交信息必须规范清晰（遵循 Conventional Commits，如 `feat:`, `fix:`, `refactor:`），准确概括本次改动的核心逻辑与影响文件。
  - 除非用户明确要求 push，默认仅在本地完成 commit 提交，确保用户的远程分支保持可控安全。
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

## 4. 前后端代码修改与编译校验规则 (Build & Verification Redline)

- **前端与主进程修改规则 (`app/src/`, `app/electron/`)**：
  - 若仅为纯样式（CSS）微调或文案变动，无需强制触发构建。
  - 若涉及 TypeScript 语法、类型定义、组件 Props 接口、Zustand Store 状态、Electron 主进程或新依赖引入，**必须**在 `app/` 目录下执行构建校验（`npm run build:all` 或 `npm run typecheck`），确保 **0 错误、0 警告**后方可交付。

- **历史经验与教训备忘（根因2：构建校验空跑导致未定义变量致命崩溃）**：
  - **惨痛教训**：
    1. `app/package.json` 此前配置为 `"build": "tsc && vite build"`。
    2. 根目录 `tsconfig.json` 配置为 Solution 引用工程（含有 `"files": []`），当裸跑 `tsc` 时，编译器在 0.01 秒内仅扫描空数组并立即以退出码 0 返回（虚假的通过！）。
    3. Vite 默认采用 esbuild 转译，esbuild 仅负责剥离 TypeScript 类型生成 JS，**完全不执行类型校验和变量作用域检查**。
    4. 结果导致多个 Slice 文件中漏写的 `import`（如 `repoSnapshotCache`、`syncRuntime`）被原样打包进 bundle，在桌面端和浏览器运行时瞬间抛出 `Uncaught ReferenceError: repoSnapshotCache is not defined`，导致 `initApp()` 致命崩溃、旧工作空间打不开、点击卡片毫无反应。
  - **防假通过强制流水线规约 (Anti-Deceptive Verification Protocol)**：
    1. **强制显式指定配置文件**：
       - 前端代码校验必须显式指定子工程：`tsc -p tsconfig.app.json --noEmit`；
       - Electron 主进程校验必须显式指定：`tsc -p electron/tsconfig.json --noEmit`；
       - 统一校验脚本：`npm run typecheck`（已同时包含上述两条指令）。
    2. **构建脚本物理绑定**：
       - `package.json` 中的 `"build"` 指令强制设定为 `"tsc -p tsconfig.app.json --noEmit && vite build"`，只要存在任何 1 个未导入变量或类型报错，构建流水线立即报错中断，严禁产出打包文件。
    3. **交付前自动化核验铁律**：
       - Agent 和开发者在交付任何代码改动、生成安装包或向用户汇报完成前，必须在控制台完整运行 `tsc -p tsconfig.app.json --noEmit`，亲自确认其输出为 `exit code 0` 且无任何报错信息后，才允许向用户汇报！

---

## 5. 编码与通用规范

- **统一 UTF-8 编码（防乱码红线）**：
  - Windows 控制台执行脚本或构建时显式设置 `chcp 65001`；
  - 所有源码与文档文件必须统一保存为 `UTF-8` 编码。
- **交互规范与多语言（i18n）开发强制红线**：
  - **沟通语言**：无论是方案说明、问题解答、思考过程阐述还是日常沟通，均**必须一律严格使用中文**回复用户；
  - **零硬编码原则**：严禁在 TSX、Hook、Modal 或 Store 中硬编码任何面向用户的文案（标题、按钮、占位符、Tooltip 悬浮提示与 Toast 通知）。所有文本必须统一在 `app/src/locales/` 中维护（`types.ts` 定义类型，`zh-CN.ts` 与 `en-US.ts` 分别录入）；
  - **纯净单语言隔离**：中文模式（`zh-CN`）必须为纯正中文，严禁夹杂英文括号后缀（如禁止 `(Checkout)`、`(Staged)` 等）；英文模式（`en-US`）必须为标准 Git 英文 Terminology，严禁残留任何中文字符；
  - **标准调用范式**：
    - React 组件内：`const { t } = useTranslation();` -> 使用 `t.*`；
    - Zustand Store / 纯逻辑模块：`const t = getLocale(get().language);` -> 使用 `t.notifications.*`；
  - **合理例外豁免**：Git CLI 原始运行终端流（`stdout`/`stderr`，如 `git pull` 详细日志）保持 Git 原生英文输出，无需翻译；
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

---

## 7. 代码文件体量与大文件拆分治理红线 (File Size & Modular Architecture Protocol)

- **文件行数体量分级标准**：
  - **健康标准 (Optimal)**：单个源文件（TSX / TS / JS）代码行数建议控制在 **400 行以内**。小而美、职责单一、上下文紧凑，便于开发者与 AI 模型快速阅读和准确定位。
  - **大文件警告线 (Warning)**：超过 **500 行** 视为偏大文件。日常需求迭代时，严禁继续无节制向该文件中塞入新功能，应开始梳理其职责，考虑抽取子组件、提取自定义 Hook 或抽取公共函数。
  - **巨型文件重构拆分红线 (Hard Limit)**：超过 **800 行** 判定为超标巨型文件（Monolithic File）。此类文件维护风险极高、协作容易引发冲突，**必须主动分文件拆分**！禁止向 800+ 行的大文件中继续累加逻辑。

- **分文件与架构解耦规范**：
  - **零破坏与门面模式 (Facade / Barrel Pattern)**：
    - 原文件作为主入口（或通过同目录 `index.ts`），将拆分移出的类型、子方法、子组件统一进行 `export` 重新导出（re-export）。
    - 严禁因文件拆分破坏其余模块对移出方法的现有 `import` 路径，坚决避免因漏导或改名导致其他文件引发 `Uncaught ReferenceError` 或构建失败。
  - **UI 巨石组件拆分范式 (React Monolith Decomposition)**：
    - **视觉区块组件化**：将视觉上相对独立或自成一体的区块抽离为同级 `components/` 目录下的子组件（如 `StatusHeader.tsx`, `CommitBox.tsx`, `MergeBanner.tsx` 等），每个子组件行数控制在 100~300 行；
    - **状态与交互 Hook 化**：将复杂的手势、快捷键监听、拖拽、过滤筛选等副作用逻辑抽离为 `hooks/`（如 `useStatusPanelActions.ts`, `useFileTreeNavigation.ts`）；
    - **逻辑与纯计算工具化**：树形目录递归转换、时间格式化、图标映射等纯函数抽离至 `utils/` 或 `helpers.ts`；
    - **数据模型类型收拢**：内部专用接口与数据类型抽离至 `types.ts`。
  - **服务端与逻辑模块拆分范式 (Service / Store Decomposition)**：
    - 针对体积庞大的业务引擎（如 `gitService.ts`、巨型 Slice），按业务领域与操作维度（如 Status、Branch、Commit、Diff、Remote、Conflict 等）建立子模块分治，主模块作为 Facade 进行组装与向后兼容导出。

- **自验证交付闭环铁律 (Self-Contained Verification Guarantee)**：
  - 代码拆分或调整后，开发者/Agent 必须严格执行 `npm run typecheck` 确保全局 0 错误、0 警告；
  - 必须由开发者/Agent 自主启动测试服务或无头浏览器 E2E 脚本进行全功能验证，亲自核验控制台 0 报错、0 警告、无渲染白屏，严禁未经自主验证直接把半成品抛给用户测试！

---

## 8. 跨平台路径与文件系统兼容开发规范 (Cross-Platform Path Protocol)

- **避坑历史与详细指南**：统一归档在独立规范文档中，禁止将琐碎细节堆砌在主上下文中：👉 [`.agent/cross-platform-path-guide.md`](./cross-platform-path-guide.md)；
- **核心规约速查**：
  1. **物理路径第一守卫**：Windows 盘符路径（`^[a-zA-Z]:[/\\]`）、UNC 共享路径（`^\\\\`）与 macOS/Linux POSIX 根路径（`^\/`）属于操作系统的物理绝对路径，享有最高优先级保护，坚决禁止送入 Git 相对路径转义解码器；
  2. **Git C-Quote 严格守卫**：只有被英文双引号包裹（`"..."`）的路径才属于 Git CLI C-Quote 格式；未带引号的普通路径坚决禁止反斜杠转义解析，杜绝将普通路径字符误转为 ASCII 控制符；
  3. **非破坏性持久化铁律**：水合恢复与异步加载阶段如果单项文件读取失败，坚决禁止将其从用户打开的持久化数据中删除，只有当用户显式点击关闭时才允许移除；
  4. **跨平台换行与快捷键适配**：保存文件时保留原始换行符（CRLF / LF）；键盘快捷键监听统一使用 `e.ctrlKey || e.metaKey`，保证 Windows / macOS 体验完全一致。

---

## 9. 全局代码安全防御与漏洞防范红线 (Security & Vulnerability Prevention Protocol)

- **外部进程调用防命令注入 (Anti-Command Injection)**：
  - **严禁**使用 `child_process.exec()` 或 `shell: true` 进行字符串拼接执行外部命令；
  - 凡调用系统外部命令或原生 Git CLI，必须使用 `execFile` 或 `spawn`，以参数数组（`args: string[]`）形式传递参数，从根本上杜绝参数逃逸与任意命令注入风险；
  - 在 Electron 桌面环境下唤起系统外部应用（如文件管理器、外部编辑器）时，优先采用 Electron 内置安全 API（`shell.openPath`、`shell.showItemInFolder`）。

- **视图渲染防 XSS 攻击 (Anti-XSS Defense)**：
  - **严禁**使用 `dangerouslySetInnerHTML` 直接渲染未经清洗的用户输入或外部不可信文档（如 Markdown、文件 Diff、Git Commit 提交信息）；
  - 凡涉及 HTML 字符串渲染，必须强制通过 `DOMPurify.sanitize()` 进行白名单过滤清洗，严格拦截过滤 `<script>`、`onerror`、`onload`、`javascript:` 等恶意向量，防止通过恶意仓库或提交信息发起 XSS 提权。

- **本地内嵌服务安全隔离 (Anti-CSRF & DNS Rebinding)**：
  - OmniGit 本地启动的 HTTP 服务（如 `127.0.0.1:5345`）必须严格实施安全白名单校验：
    - **Host 校验**：严格限定 Host 只能为 `localhost`、`127.0.0.1`、`::1` 或私有局域网 IP，全面阻断恶意网页的 DNS Rebinding 攻击；
    - **Origin / Cross-Site 校验**：严格阻断未受信任的跨源请求与 `Sec-Fetch-Site: cross-site` 恶意交互，严禁在后端服务对未授权域开放 `Access-Control-Allow-Origin: *`。

- **文件系统沙箱与路径穿越防御 (Anti-Path Traversal)**：
  - 静态资源与本地文件服务接口在读取或写入文件时，必须严格执行目录包含沙箱校验（`filePath.startsWith(baseDir)`），防止使用 `../` 越界读取或覆写系统敏感文件。
