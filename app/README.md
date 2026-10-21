# OmniGit App Core (核心应用工程)

OmniGit 前端与桌面端核心应用工程。基于 React 18 + TypeScript + Vite + Electron + Tailwind CSS + Zustand 架构打造，严格遵循模块化高内聚与双端无缝同构设计。

---

## 🏗️ 目录结构组织

```text
app/
├── electron/                         # Electron 桌面端主进程与自更新
│   ├── main.ts                       # 窗口生命周期、本地私有调度服务与网络环境
│   ├── preload.ts                    # 安全预加载脚本 (IPC 桥接)
│   └── updater.ts                    # 基于 GitHub Releases 的静默检查与更新
├── src/                              # 前端源码
│   ├── components/                   # 通用基础 UI 组件 (Modal, Button, Input, Dropdown)
│   ├── features/                     # 业务特性模块
│   │   ├── activity-bar/             # 左侧核心活动栏 (Git工作台 / 资源管理 / 微服务编排)
│   │   ├── conflict-3way/            # 3-Way Merge 可视化三方冲突合并器
│   │   ├── diff-editor/              # Monaco 差异比对面板
│   │   ├── editor/                   # Monaco 源码编辑器、查找替换与 Markdown 渲染
│   │   ├── git-log/                  # 提交日志、分支历史树与跨分支同步弹窗
│   │   ├── git-push/                 # 分支选择、提交多选与精细化推送弹窗
│   │   ├── git-status/               # 工作区改动 (Changes)、搁置架 (Shelf)、提交面板
│   │   ├── services/                 # 多微服务启动与脚本统一编排中心 (实时ANSI日志流)
│   │   ├── terminal/                 # VS Code 风格集成终端 Dock (PTY 多会话管理)
│   │   ├── topbar/                   # 顶栏分支菜单、撤销合并、身份切换与全局操作
│   │   └── workspace/                # 多工程文件资源树与工作区管理
│   ├── locales/                      # 纯正双语国际化字典 (zh-CN / en-US)
│   ├── server/                       # 本地私有调度引擎与 API 服务 (Git/文件系统/服务进程)
│   ├── store/                        # Zustand 全局状态切片与 0ms 水合缓存
│   ├── App.tsx                       # 应用根组件与全局快捷键分发
│   └── main.tsx                      # Web 入口
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

# TypeScript 类型检查 (57+ 业务组件 0 报错验证)
npm run typecheck

# 编译前端生产静态资源
npm run build

# 自动化端到端测试套件
npm run test:e2e
```

---

## 📐 架构与编码规范

1. **大文件模块化协议**：
   - 单文件行数推荐 $\le 400$ 行，严禁无限制堆砌代码；
   - 超过 800 行必须触发拆分重构，抽离专用组件、自定义 Hook 与工具函数；
   - 原始入口文件必须采用 Facade / Barrel 模式重新导出被抽离的符号，确保对外部模块 100% 兼容。
2. **纯正多语言隔离原则**：
   - 中文模式（`zh-CN`）彻底清除中英文混杂，呈现纯正自然表达；
   - 英文模式（`en-US`）严禁残留中文字符；
   - 快捷键与英文对照按需收敛于悬停气泡（`title` Tooltip）。
3. **零卡顿异步执行**：
   - 针对 Git 命令与微服务进程启停等耗时 I/O，严格采用非阻塞异步管线，杜绝 UI 线程假死。
