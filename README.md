# OmniGit - 专业级跨仓库 Git 桌面工作台

> **全自闭环架构 · 0ms 乐观更新 · 原生无边框桌面体验 · 在线增量自动更新**

[English](README.en.md) | **简体中文**

[![GitHub release](https://img.shields.io/github/v/release/BucanYu/OmniGit?style=flat-square&color=0284c7)](https://github.com/BucanYu/OmniGit/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue?style=flat-square)](https://github.com/BucanYu/OmniGit/releases)

👉 **[点击前往 GitHub Releases 下载最新安装包 (Windows / macOS)](https://github.com/BucanYu/OmniGit/releases/latest)**

OmniGit 是一款专为多工程、大工作区并行协作设计的高性能 Git 桌面管理客户端。采用全内置自闭环架构，在目标 Windows 电脑上除了 Git 外**无需安装任何运行时环境**，具备毫秒级响应、沉浸式无边框顶栏、可视化的多分支合并/冲突解决与智能自动更新机制。

---

## 核心架构与设计原则

```
┌─────────────────────────────────────────────────────────────────┐
│                    OmniGit Windows 桌面端                        │
├─────────────────────────────────────────────────────────────────┤
│  无边框沉浸式顶栏 (TopBar) [原生拖拽 / 最小化 / 最大化 / 关闭]        │
├────────────────────────────────┬────────────────────────────────┤
│  React 18 前端界面 (UI Layer)   │  私有内嵌服务 (Embedded Loopback) │
│  - Zustand 0ms 乐观缓存状态     │  - 监听 127.0.0.1 (动态私有端口) │
│  - Monaco Editor 智能冲突解决   │  - 静态资源 + /api/git/* 统一交付│
│  - 多工程工作区与分支瞬时切换   │  - 安全沙箱，绝不开放外部网络端口  │
├────────────────────────────────┴────────────────────────────────┤
│  底座与环境隔离 (Runtime & Security)                              │
│  - Electron 30 内嵌独立 Node.js v20.x 沙箱运行环境              │
│  - 零环境变量修改：绝不污染或篡改目标电脑的系统全局 PATH            │
│  - 原生 Git 智能探测：扫描 PATH 及 Windows 标准安装目录            │
└─────────────────────────────────────────────────────────────────┘
```

### 1. 零环境依赖与沙箱隔离
- **零安装负担**：打包版本自带完整 Electron 30 核心与内嵌运行时，用户电脑**绝对不需要安装 Node.js、npm 或 Python**；
- **环境隔离无冲突**：客户端内部独立运行，**绝不会修改系统的全局 `PATH` 环境变量**，与目标电脑上已有的任何编程语言环境或其它 Git 工具完全物理隔离；
- **原生 Git 自动探测**：启动时智能扫描全局 `PATH` 及常见的安装路径（如 `C:\Program Files\Git`、`D:\Git` 等），无缝与系统已有 Git 绑定。

### 2. 0ms 乐观更新与全系统实时响应
- 对 Commit 提交、Update Project (Pull)、Rollback 撤销、Branch Checkout 分支切换等关键 Git 操作实施了 **0ms 同步乐观渲染**；
- 配套 15s SWR 本地持久化快照缓存机制，切换不同工程即时秒开呈现，彻底杜绝界面白屏或角标滞后问题。

---

## 快速运行与日常开发

所有便捷控制脚本均收敛存放在 [`scripts/`](scripts/) 目录下（详见 [`scripts/README.md`](scripts/README.md) 开发者环境说明）：

### 1. 桌面客户端本地直接预览
如果您想直接启动无边框的 Windows 原生桌面版应用：
- **方式一（推荐）**：双击运行 [`scripts/start_desktop.bat`](scripts/start_desktop.bat)；
- **方式二（命令行）**：
  ```bash
  cd app
  npm run electron:preview
  ```

### 2. Web 浏览器端开发调试
如果您想在浏览器中以热重载模式调试前端界面：
- **方式一（推荐）**：双击运行 [`scripts/start_dev.bat`](scripts/start_dev.bat)（将在 `http://localhost:5345` 打开）；
- **方式二（命令行）**：
  ```bash
  cd app
  npm run dev
  ```
- **停止开发服务**：双击运行 [`scripts/stop_dev.bat`](scripts/stop_dev.bat)。

---

## 一键打包 Windows 桌面客户端与安装包

### 1. 批处理脚本一键打包 (One-Click Build)
直接双击运行 `scripts` 目录下的跨平台打包脚本：
👉 **[`scripts/build_desktop.bat`](scripts/build_desktop.bat)**

脚本会自动执行：
1. 校验系统开发环境与 Node.js 运行时；
2. 执行全量 TypeScript 严格类型检查；
3. 构建 Vite 前端优化压缩资源包；
4. 编译 Electron 主进程与动态服务模块；
5. 注入高饱和度品牌双环专属图标；
6. 调用内置便携版 NSIS 编译器高压缩压制生成商业级单文件安装程序。

### 2. 双重交付物与 GitHub Releases 分发说明
打包完成后，产物均在 `app/release/` 目录下生成（该目录已被 `.gitignore` 保护，安装包统一发布到 [GitHub Releases](https://github.com/BucanYu/OmniGit/releases)）：
- **📦 单文件安装包（商业级正式交付）**：
  - 文件：`app/release/OmniGit-Setup-0.1.0.exe`（单文件约 75MB，LZMA 深度压缩）
  - 特性：
    - **规范中文安装向导**：欢迎界面、版权说明、**允许用户点击“浏览”自主更改安装盘符**（如安装在 `D:\OmniGit`）；
    - **桌面与开始菜单快捷方式**：自动创建带有专属 Logo 图标的快捷方式；
    - **系统控制面板规范卸载**：在 Windows “设置 -> 应用和功能” 中注册，自带 `Uninstall.exe` 卸载程序；
    - **单用户免提权**：默认安装至用户目录，安装与在线自动更新**彻底免除 UAC 权限确认弹窗**。
- **📁 绿色免安装目录（开发者便携自用）**：
  - 路径：`app/release/OmniGit-win32-x64/`
  - 特性：解压即用，直接双击 `OmniGit.exe` 秒开。

---

## 在线增量自动更新体系 (GitHub Releases)

桌面客户端内置了基于 GitHub Releases 的在线更新检测与增量下载系统：

```
 用户点击【系统设置 -> 版本与自动更新 -> 检查新版本】
                     │
                     ▼
  连接 GitHub Releases 检索最新 tag (如 v0.3.0)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    当前已是最新版           发现可用新版本
(展示绿色已就绪徽章)         (展示更新说明与发布日志)
                                 │
                                 ▼
                         后台静默拉取更新包
                     (展示百分比进度条与实时下载速率)
                                 │
                                 ▼
                     下载完成！高亮呈现【立即重启并更新】
                                 │
                                 ▼
                     一键重启自动替换并加载新版本
```

- **免 UAC 提权设计**：配置采用当前用户目录策略（`perMachine: false`），更新过程**无需 Windows 管理员提权**，静默顺畅；
- **双层更新保障**：优先使用 `electron-updater` 标准管道；若未安装相关依赖则自动切换至零依赖的 GitHub REST API 原生下载器，具备 100% 自愈与容错能力。

---

## 目录结构

```text
OmniGit/
├── app/                              # 应用核心主工程
│   ├── electron/                     # Electron 桌面端主进程源码
│   │   ├── main.ts                   # 主进程窗口管理、私有服务与 Git 探测
│   │   ├── preload.ts                # 安全预加载脚本 (contextBridge)
│   │   ├── updater.ts                # 在线自动更新引擎 (GitHub Releases)
│   │   └── tsconfig.json             # Electron 专属 TypeScript 配置
│   ├── src/                          # 前端 React 源码
│   │   ├── features/                 # 业务功能模块 (TopBar, Settings 等)
│   │   ├── server/                   # Git API 业务分发与服务层 (gitService)
│   │   ├── store/                    # Zustand 状态管理 (0ms 乐观更新机制)
│   │   └── types/                    # 强类型定义
│   ├── dist/                         # Vite 编译产物 (前端)
│   ├── dist-electron/                # 主进程编译产物 (CommonJS)
│   ├── release/                      # 打包生成的发布目录 (OmniGit.exe)
│   ├── electron-builder.yml          # 打包配置 (NSIS 免提权与发布规则)
│   └── package.json                  # 项目依赖与构建指令配置
├── docs/                             # 需求与技术设计文档
├── scripts/                          # 运维与一键控制脚本
│   ├── build_desktop.bat             # 一键打包 Windows 桌面端
│   ├── start_desktop.bat             # 一键启动桌面客户端
│   ├── start_dev.bat                 # 一键启动 Web 开发服务
│   ├── stop_dev.bat                  # 一键停止端口服务
│   └── README.md                     # 脚本工具箱详细说明
└── README.md                         # 项目总说明文档
```

---

## 后续持续优化与二次开发建议

1. **Rust / napi-rs 原生加速模块接入**：
   - 现阶段已采用内嵌自闭环架构，未来可将大仓库的数十万行文件 Diff 计算、超大提交历史树解析通过 `napi-rs` 编译为原生 C/Rust 动态库直接供主进程调用，进一步榨干 CPU 极限性能；
2. **自定义缓存路径持续演进**：
   - 已在【系统设置】中实现将快照数据避开 C 盘存放在指定盘符（如 `D:\OmniGitCache`），未来可为不同大型工程单独定制专用轻量缓存策略；
3. **GitHub 私有仓库更新鉴权**：
   - 当前公开仓库无需 Token；如后续将 OmniGit 迁移至企业级私有仓库，可在【系统设置】中增加 GitHub Token 配置项以拉取私有 Releases 资源。
