# OmniGit App Core (核心应用工程)

OmniGit 前端与桌面端核心应用工程。基于 React 18 + TypeScript + Vite 6 + Electron 30 + Tailwind CSS + Zustand 架构打造，严格遵循单文件 `<= 800` 行模块化高内聚协议与桌面/Web 双端无缝同构设计。

---

## 🏗️ 目录结构组织

```text
app/
├── electron/                         # Electron 桌面端主进程与自更新
│   ├── main.ts                       # 窗口生命周期、本地私有调度服务与网络环境
│   ├── preload.ts                    # 安全预加载脚本 (IPC 通道桥接)
│   ├── serviceProcessManager.ts      # 桌面端微服务进程控制、异步端口检测与进程树清理
│   └── updater.ts                    # 基于 GitHub Releases 的静默检查与更新
├── src/                              # 前端源码
│   ├── components/                   # 通用基础 UI 组件 (Modal, Button, ResizeDivider, Toast)
│   ├── constants/                    # 全局版本与常量定义 (version.ts)
│   ├── features/                     # 业务特性模块 (严格遵循 <= 800 行模块化协议)
│   │   ├── activity-bar/             # 左侧核心活动栏 (Dashboard / Git / Explorer / Services / DataTools)
│   │   ├── code-editor/              # Monaco 源码编辑器、行级 Blame、大文件卡片与 Markdown 渲染
│   │   ├── data-tools/               # 10 合 1 离线数据格式化、结构树透视与多窗口分屏对比工作台
│   │   ├── diff-editor/              # Monaco 差异比对面板与子组件
│   │   ├── git-conflict/             # 3-Way Merge 可视化三方冲突合并器与子组件
│   │   ├── git-log/                  # 提交日志、SVG 彩色分支拓扑图 (CommitGraphLane) 与跨分支同步
│   │   ├── git-push/                 # 分支选择、提交多选与精细化推送弹窗
│   │   ├── git-status/               # 工作区改动 (Changes)、Git Stash 暂存架 (StatusStashDrawer)、提交框
│   │   ├── global-search/            # 跨工程全局代码搜索弹窗
│   │   ├── navigation/               # 顶栏分支菜单 (BranchMenu / Flyout)、撤销合并、身份切换
│   │   ├── services/                 # 多微服务启动编排、端口冲突一键释放、实时 ANSI 日志流与持久化
│   │   ├── settings/                 # 系统全局设置、Git 账户管理、主题预设与关于/更新页
│   │   ├── terminal/                 # VS Code 风格集成终端 Dock (PTY 多会话管理)
│   │   ├── workspace/                # 多仓库侧边栏 (支持批量 Pull/Fetch/Checkout) 与欢迎屏管理
│   │   ├── workspace-dashboard/      # 工作空间自定义研发门户 (OmniGitBridge) 与默认工程态势大盘
│   │   └── workspace-explorer/       # 多工程全文件资源树、Git 忽略文件显隐切换与目录钻取
│   ├── locales/                      # 纯正双语国际化字典 (zh-CN / en-US)
│   ├── server/                       # 本地私有调度引擎与 API 服务
│   │   ├── git/                      # Git 7 大领域子模块 (Exec/Status/Log/Branch/Merge/Clone/BatchStashBlame)
│   │   ├── gitService.ts             # Git 聚合门面 (Facade)
│   │   ├── fileSystemService.ts      # 文件树遍历与非破坏性 .gitignore 标记解析
│   │   ├── codeSearchService.ts      # 跨仓库高性能并发代码搜索引擎
│   │   ├── ignorePatterns.ts         # 全语种通用构建产物/虚拟环境/二进制忽略字典
│   │   ├── dashboardServeHandler.ts  # 自研门户静态构建产物安全托管与 <base> 动态注入
│   │   ├── builtinDocsHandler.ts     # 内置开发指南跨环境路径解析服务
│   │   └── nodeServiceProcessManager.ts # Web 端微服务进程管理、异步端口检测与 SSE 日志流
│   ├── store/                        # Zustand 全局状态管理 (9 大领域 Slices、storeHelpers、三级快照缓存)
│   ├── App.tsx                       # 应用根组件与全局快捷键分发 (Alt+0 ~ Alt+4)
│   └── main.tsx                      # Web 入口与离线 Monaco 静态资源配置
├── electron-builder.yml              # NSIS 单文件打包配置
└── package.json                      # 依赖与脚本
```

---

## 🛠️ 核心开发命令

```bash
# 启动 Web 调试端 (HMR 热重载，默认绑定 http://localhost:5345)
npm run dev

# 启动 Electron 桌面端预览调试
npm run electron:preview

# 严格 TypeScript 类型与 React Hooks 规则校验 (前端 + Electron 主进程双工程 0 报错验证)
npm run typecheck

# 编译前端与 Electron 主进程生产构建产物
npm run build:all

# 运行全量 7 阶段 API SLA 与无头浏览器 CDP 自动化端到端测试套件 (在项目根目录执行)
node ../test/scripts/run-all-tests.cjs
```

---

## 📐 架构与编码规范

1. **大文件模块化协议**：
   - 单文件行数推荐 $\le 400$ 行，严禁无限制堆砌代码；
   - 超过 800 行必须触发拆分重构，抽离专用组件、自定义 Hook 与领域子模块；
   - 原始入口文件必须采用 Facade / Barrel 模式重新导出被抽离的符号，确保对外部模块 100% 兼容；
   - 启用 `verbatimModuleSyntax: true`，跨文件导入纯类型必须显式使用 `import type`。
2. **纯正多语言隔离原则**：
   - 中文模式（`zh-CN`）彻底清除中英文混杂，呈现纯正自然表达；
   - 英文模式（`en-US`）严禁残留中文字符；
   - 快捷键与英文对照按需收敛于悬停气泡（`title` Tooltip）。
3. **零卡顿异步执行与防卡死基线**：
   - 后端所有 Git CLI 调用统一经由 `runGit()` 并发信号量通道（本地最大并发 6、远程最大并发 3）并注入 `GIT_OPTIONAL_LOCKS=0`；
   - 工作区文件监听（`fs.watch`）联动 `.gitignore` 与 `ignorePatterns.ts` 全语种构建产物字典，带 `2500ms` 冷却防抖；
   - 微服务日志流采用 `StreamLogBuffer`（`32ms` 节流合并）与 `350` 行滑动窗口渲染，端口探测与杀进程全面采用异步 `execFileAsync`。
