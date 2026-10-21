# OmniGit - Project Rules & Guidelines

请遵循 [`.agent/context.md`](./context.md) 中定义的完整全局上下文与项目规则。

## 核心摘要速查：
1. **代码提交与最高安全红线**：根据用户明确授权指令，**后续每次修改完毕且通过编译与完整测试后，必须自动执行 `git commit` 提交代码**，无需等待用户手动提交；严禁自主执行破坏性 Git 命令（`--force`, `--hard`）；数据库操作严格只读。
2. **环境与端口**：全量工具链自适应系统环境与相对路径；专属开发端口固定为 `5345`；优先调用 `scripts/` 下启停与构建脚本。
3. **编译校验与类型防欺骗红线 (Strict Type-Check & Anti-Deceptive Build)**：
   - **绝对禁止空跑假通过**：`app/` 根目录 `tsconfig.json` 为 Solution 引用模式，裸跑 `tsc` 仅校验空数组（0.01s 假通过退出码 0）。所有开发校验必须严格指定子工程配置：
     - 前端应用：`tsc -p tsconfig.app.json --noEmit`
     - Electron 主进程：`tsc -p electron/tsconfig.json --noEmit`
     - 或统一运行命令：`npm run typecheck`（或 `npm run build:all`）。
   - **严禁仅凭 Vite 转译断言成功**：Vite 底层 esbuild 转译仅剥离类型，会静默放行未导入/未定义的全局变量（如漏掉的 `import`），导致打包产物在用户电脑上引发 `ReferenceError` 致命白屏。
   - **交付零错误红线**：代码修改后交付前，必须实际执行完整类型检查，必须保证 **0 错误、0 警告**；若存在任何未导入变量或类型报错，绝对禁止交付、打包或宣称完成。
4. **多语言规范与交互红线**：
   - 对用户的所有回复、方案阐述与日常沟通必须一律严格使用**中文**；
   - 系统支持中英双语（`zh-CN` / `en-US`），严格遵循 `app/src/locales/` 国际化架构：
     - **零硬编码**：严禁在 TSX 组件、Hook 或 Store 中硬编码任何面向用户的文案、占位符、Tooltip 悬浮提示与 Toast 通知；
     - **纯净单语言隔离**：中文模式必须纯正，严禁混杂英文括号尾缀（如禁止 `(Checkout)`、`(Staged)`）；英文模式必须为标准 Git 英文，严禁残留中文；
     - **原生日志例外**：Git CLI 产生的底层原生终端日志（stdout/stderr）保留原生英文，不作干扰。
5. **用户数据与缓存隔离红线**：严禁在任何异常重试（ErrorBoundary）或“清理缓存”逻辑中删除用户的核心数据（包括历史工作空间 `omnigit_saved_workspaces`、工作空间项目关联 `omnigit_ws_paths_*`、最近打开项目 `omnigit_global_recent_projects` 及用户配置）；“清理缓存”操作仅允许清理易失性快照缓存（`omnigit_snap_*`）。所有本地存储写入必须具备配额防爆与磁盘备份恢复机制。
6. **编码要求**：统一 UTF-8 编码（`chcp 65001`）。
7. **代码文件体量与大文件拆分治理红线 (File Size & Modular Architecture Protocol)**：
   - **文件体量红线**：
     - **健康标准**：单文件代码行数建议控制在 **400 行以内**（高内聚、易阅读、易维护）；
     - **大文件警告线 (Warning)**：超过 **500 行** 视为偏大文件，严禁继续无节制堆砌代码，应主动抽离 Hook、子组件、类型或工具函数；
     - **巨型文件重构拆分红线 (Hard Limit)**：超过 **800 行** 判定为超标巨型文件（Monolithic File），**必须分文件拆分**！禁止向 800+ 行的大文件中继续累加逻辑。
   - **分文件与架构解耦规范**：
     - **零破坏与门面模式 (Facade / Barrel Pattern)**：拆分出的方法、子组件、类型，必须在原模块或统一门面中完整保持向后兼容导出（re-export），严禁破坏其余模块对移出方法的现有引用，杜绝引发未定义变量或运行时 404 / `ReferenceError` 报错；
     - **UI 巨石组件分治范式**：按视觉/功能区块抽离子组件（至同级 `components/`）、抽取复杂状态与副作用（至 `hooks/`）、抽离计算/树转换/格式化（至 `utils/` 或 `helpers.ts`）、类型独立存放在 `types.ts`；
     - **测试验证闭环**：拆分调整后必须执行 `npm run typecheck` 验证全局 0 错误，并由开发助手自主启动 Web 端完成全量功能与控制台 0 报错验证，严禁把半成品或未验证代码交由用户测试。
8. **跨平台路径与文件系统兼容开发规范 (Cross-Platform Path Protocol)**：
   - 详细避坑历史、核心铁律与标准范式已统一归档至独立文件：👉 [`.agent/cross-platform-path-guide.md`](./cross-platform-path-guide.md)；
   - **绝对物理路径防护**：Windows 盘符（`D:\...`）、UNC 共享（`\\...`）与 macOS/Linux POSIX 根路径（`/Users/...`, `/home/...`）一律享有物理路径第一守卫，严禁调用 Git 相对路径解码器；
   - **Git C-Quote 严格守卫**：未被英文双引号包裹的普通路径严禁解析反斜杠转义，杜绝将普通路径字符误转为 ASCII 控制符；
   - **非破坏性持久化铁律**：异步水合与恢复阶段若单项文件读取失败，坚决禁止将其从用户打开的持久化数据中删除，只有当用户显式点击关闭时才允许移除。
