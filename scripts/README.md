# OmniGit 脚本工具箱与开发者环境配置指南 (Developer Scripts & Environment Guide)

[English](README.en.md) | **简体中文**

本目录（`scripts/`）收敛并统一管理 OmniGit 的日常运行、开发调试、服务启停与商业级安装包流水线打包脚本。所有脚本均采用相对路径（`%~dp0` / `$PSScriptRoot`）与环境自适应探测编写，克隆至任意电脑或盘符均可开箱即用。

---

## 一、 技术栈与前置环境要求 (Tech Stack & Prerequisites)

### 1. 基础依赖环境（开发者电脑需具备）
在运行脚本或打包前，请确保您的开发机已就绪以下基础环境：
- **Node.js**：`v18.0.0` 或以上（推荐 LTS `v20.x` 或 `v22.x`）；
- **包管理器**：`npm`（Node.js 自带，推荐 `>= 9.x`）或 `pnpm`；
- **Git CLI**：系统已安装 Git，且在终端中执行 `git --version` 正常响应。

### 2. 内置免配置组件（Zero-Config Pre-bundled）
- **NSIS 工业级安装包编译器**：
  - 工具路径：[`scripts/tools/nsis/`](tools/nsis/)
  - **无需额外安装**：本仓库已完整内置便携版 NSIS（包含 `makensis.exe`、Unicode 插件与 Modern UI 2 语言包），**开发者完全不需要前往 NSIS 官网单独下载安装**，跨机拉取代码即可直接压制 Windows 单文件安装包。

### 3. 可选扩展工具（按需安装）
- **7-Zip**（可选）：
  - 若您在 Windows 开发机上需要一并生成 macOS 的 `.zip` 压缩分发包，建议安装 [7-Zip](https://www.7-zip.org/) 并将其目录（如 `C:\Program Files\7-Zip`）添加至系统 `PATH` 环境变量中。

---

## 二、 首次拉取代码后的初始化 (Initialization)

首次克隆本仓库到本地后，请先进入前端及应用工程目录安装核心依赖：

```bash
# 进入应用主目录
cd app

# 安装依赖
npm install
```

---

## 三、 脚本清单与日常操作指南 (Script Catalog)

所有脚本均支持在 Windows 文件资源管理器中**双击直接运行**，也支持通过命令行调用：

| 脚本文件名 | 脚本功能与说明 | 运行场景 | 启动方式 |
| :--- | :--- | :--- | :--- |
| **`build_desktop.bat`** | **【核心交付】跨平台全自动编译与打包流水线**<br>自动校验环境、执行 TypeScript 类型校验、Vite 生产构建、Electron 主进程打包与 NSIS 工业级安装包压制。 | 正式发版 / 打包交付 | 双击直接运行，或在终端执行：<br>• `build_desktop.bat` (全部)<br>• `build_desktop.bat win` (仅Win)<br>• `build_desktop.bat mac` (仅Mac) |
| **`start_desktop.bat`** | **原生桌面客户端直启**<br>自动完成前后端构建并以原生桌面无边框窗口模式运行 OmniGit，体验最真实的独立桌面应用效果。 | 本地桌面端实测 | 双击直接运行 |
| **`start_dev.bat`**<br>`start_dev.ps1` | **Web 浏览器端快速开发热重载**<br>启动本地 Vite 开发服务器（监听 `http://localhost:5345`），并自动唤起默认系统浏览器开启热重载调试。 | 前端组件与界面开发 | 双击 `start_dev.bat`，或在 PowerShell 执行 `./start_dev.ps1` |
| **`stop_dev.bat`**<br>`stop_dev.ps1` | **开发端口释放与进程终止**<br>智能检索并强制终止当前占用 `5345` 端口的后台 Node 进程，彻底解决端口被占用的问题。 | 服务关闭 / 端口清理 | 双击 `stop_dev.bat` |
| `installer.nsi` | **NSIS 单文件安装包构建配置**<br>定义了中文安装向导、自定义目录、桌面/开始菜单快捷方式、注册表登记与静默升级规范。 | 由 `build_desktop.bat` 内部调用 | 自动化调用 |
| `generate_icon.ps1` | **专属桌面图标生成器**<br>从矢量参数生成 Windows 标配的多分辨率无损 `.ico` 与 `.png` 品牌图标。 | 品牌图标更新维护 | 由打包流水线或手动调用 |

---

## 四、 编译输出物与 GitHub Releases 分发规范

执行 `scripts/build_desktop.bat` 后，产物统一输出在 **`app/release/`** 目录中：

```
app/release/
 ├── OmniGit-Setup-0.4.0.exe        <- [对外正式发布] Windows 单文件安装包 (LZMA 高压缩，约 80MB)
 ├── OmniGit-win32-x64/             <- [本地便携调试] Windows 绿色免安装运行目录 (直接双击 OmniGit.exe 运行)
 ├── OmniGit-v0.4.0-mac-arm64.zip   <- [对外正式发布] macOS Apple Silicon (M系列芯片) 独立应用包
 └── OmniGit-v0.4.0-mac-x64.zip     <- [对外正式发布] macOS Intel x64 独立应用包
```

> [!IMPORTANT]
> **关于二进制安装包的托管原则**：
> - `app/release/` 目录已被根目录 `.gitignore` 彻底阻断，**严禁将大体积安装包提交进 Git 仓库源代码历史**；
> - 正式发布的安装包应统一上传发布至 [GitHub Releases](https://github.com/BucanYu/OmniGit/releases) 页面，供全球用户直接下载体验；
> - 客户端内置的【检查更新】功能亦直接与 GitHub Releases API 对接，实现全自动在线无缝升级。

---

## 五、 常见问题与环境自检排查 (Troubleshooting)

### Q1: 双击 `start_dev.bat` 提示端口 5345 已被占用？
**解答**：直接双击运行本目录下的 `stop_dev.bat`，脚本将自动检测并强行释放占用 `5345` 端口的残留进程，随后重新运行 `start_dev.bat` 即可。

### Q2: 提示 `Node.js is not found in PATH`？
**解答**：说明当前电脑未安装 Node.js 或未将其配置到全局系统环境变量：
1. 前往 [Node.js 官方网站](https://nodejs.org/) 下载并安装 LTS 版本；
2. 安装时请勾选 `Add to PATH` 选项；
3. 安装完毕后重新打开命令行终端验证 `node -v`。

### Q3: 其它开发机克隆后需要重新配置 NSIS 吗？
**解答**：**完全不需要**。本仓库已将 NSIS 完整编译器环境便携化内嵌在 `scripts/tools/nsis/` 中，任何 Windows 电脑在克隆项目后均可直接调用压制安装包。
