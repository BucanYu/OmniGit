# OmniGit - High-Performance Multi-Repo Git Workbench & Local Microservices Platform 🚀

> **Centered around the beloved IntelliJ IDEA Git workflow & 3-Way Merge conflict resolver, seamlessly integrating multi-root workspace exploration, Monaco code editing, live draggable Markdown preview, VS Code-aligned terminal dock, and unified microservice launch script orchestration for modern developers.**  
> 
> Built for multi-repo & microservices collaboration · Fine-grained selective push · Real-time external conflict auto-healing · 1-Click microservices start/stop & real-time ANSI console · Smart tab disambiguation · 0ms Optimistic UI · Sub-second startup · Offline privacy-first · 100% Free & Open-Source

**English** | [简体中文](README.md)

[![GitHub release](https://img.shields.io/github/v/release/BucanYu/OmniGit?style=flat-square&color=0284c7)](https://github.com/BucanYu/OmniGit/releases)
[![Total Downloads](https://img.shields.io/github/downloads/BucanYu/OmniGit/total?style=flat-square&color=10b981&label=Total%20Downloads)](https://somsubhra.github.io/github-release-stats/?username=BucanYu&repository=OmniGit)
[![Latest Release Downloads](https://img.shields.io/github/downloads/BucanYu/OmniGit/latest/total?style=flat-square&color=0ea5e9&label=v0.5.0%20Downloads)](https://github.com/BucanYu/OmniGit/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Web-blue?style=flat-square)](https://github.com/BucanYu/OmniGit/releases)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/BucanYu/OmniGit?style=flat-square&color=eab308)](https://github.com/BucanYu/OmniGit/stargazers)

---

### 📦 Downloads & Releases

> 🚀 **Latest Release: v0.5.0** | 📈 **Live Stats: [![Total Downloads](https://img.shields.io/github/downloads/BucanYu/OmniGit/total?style=flat-square&color=10b981&label=Total%20Downloads)](https://somsubhra.github.io/github-release-stats/?username=BucanYu&repository=OmniGit) [![Latest Downloads](https://img.shields.io/github/downloads/BucanYu/OmniGit/latest/total?style=flat-square&color=0ea5e9&label=v0.5.0%20Downloads)](https://github.com/BucanYu/OmniGit/releases/latest)** | 🔍 **[View Live Download Analytics Dashboard ↗](https://somsubhra.github.io/github-release-stats/?username=BucanYu&repository=OmniGit)**

#### 🪟 Windows
| Package Format | Download Link (GitHub Releases) | Highlights | Zero UAC |
| :--- | :--- | :--- | :---: |
| **Setup Installer** | 👉 **[OmniGit-Setup-0.5.0.exe](https://github.com/BucanYu/OmniGit/releases/latest)** | Recommended: high compression (76MB), customizable path, auto-updates | ✅ Zero UAC |
| **Portable (ZIP)** | 👉 **[OmniGit-win32-x64.zip](https://github.com/BucanYu/OmniGit/releases/latest)** | Extract & run `OmniGit.exe` directly, suitable for restricted work PCs | ✅ Portable |

#### 🍎 macOS
| Architecture | Download Link (GitHub Releases) | Highlights |
| :--- | :--- | :--- |
| **Apple Silicon (arm64)** | 👉 **[OmniGit-v0.5.0-mac-arm64.zip](https://github.com/BucanYu/OmniGit/releases/latest)** | Native build for Apple Silicon M1 / M2 / M3 / M4 Macs |
| **Intel (x64)** | 👉 **[OmniGit-v0.5.0-mac-x64.zip](https://github.com/BucanYu/OmniGit/releases/latest)** | Compatible with Intel-based Macs |

> 💡 **Release History & Analytics**:  
> - Looking for previous versions (v0.4.0, v0.3.0, etc.) and changelogs? Visit 👉 **[GitHub Releases Archive](https://github.com/BucanYu/OmniGit/releases)**  
> - Want to monitor real-time daily download trends and breakdown charts? Visit 👉 **[GitHub Release Stats Dashboard](https://somsubhra.github.io/github-release-stats/?username=BucanYu&repository=OmniGit)**

---

## 🎬 Live Walkthrough Animation

> The animated demo below showcases the complete workflow of OmniGit: from **Git Core Workbench and 3-Way Merge conflict resolution**, **Zero-Checkout selective push**, to **multi-root project exploration, Monaco code editing**, **draggable split Markdown live preview**, **VS Code-aligned terminal dock**, and the **Services & Launch Scripts Manager with real-time ANSI logs**.

![OmniGit Live Walkthrough](docs/images/omnigit_demo.gif)

---

## 💡 Why OmniGit?

With modern software architecture evolving into microservices and monorepos, developers (especially those working in VS Code, Cursor, Sublime, or terminal environments) face these recurring pain points:

1. **Resolving Merge Conflicts is Stressful**: Manually hunting down `<<<<<<< HEAD` markers in standard editors is error-prone, carrying the constant risk of corrupting remote branches or breaking CI pipelines;
2. **Full IDEs Are Too Heavy**: IntelliJ IDEA and WebStorm offer the gold standard for visual conflict resolution, but consume 2–4 GB of RAM and take 30 seconds to boot. Opening a heavy IDE just to resolve one Git conflict heats up your machine;
3. **Inflexible Commit & Push Controls**: In agile sprints, urgent bug fixes often interleave with unverified feature commits. Traditional clients force you to push all commits or perform tedious manual branch checkouts and cherry-picks;
4. **Desync with External Editors**: When you resolve conflicts in your favorite editor and save, most Git clients remain stuck on the conflict screen until you manually execute `git add`;
5. **Painful Multi-Service Launching**: Monorepo or microservice setups require launching multiple backends, frontends, and auxiliary workers, leaving developers with 6–8 terminal windows scattered across the screen and lingering orphan processes;
6. **Context Switching Friction**: Inspecting a couple of source files, launching a dev server, or running a quick Git command usually forces you to open heavy external editors or separate terminal windows;
7. **Flaws of Existing Standalone Clients**:
   - **SourceTree**: Clunky, slow, prone to freezing on Windows, and mandates an Atlassian login;
   - **GitKraken**: Commercialized; paywalls private repos and merge conflict resolution behind monthly subscriptions;
   - **Fork**: Proprietary closed-source software that costs $49.99.

**OmniGit ends these compromises.** It packages JetBrains' ergonomic Git workflow and visual 3-Way Merge as its centerpiece, while deeply integrating **multi-root workspace exploration, Monaco code editing, draggable Markdown live preview, a VS Code-aligned terminal dock, and a unified microservice launch orchestrator**—all starting in **1 second, using ~60MB of RAM, seamlessly functional on both Desktop and Web, and 100% free and open-source.**

---

## ✨ Killer Features

### 1. 🎯 JetBrains-Grade 3-Way Merge Conflict Resolver (Core Git Engine)
![OmniGit 3-Way Merge Conflict Resolver](docs/images/01_omnigit_workbench.png)

- **Intuitive 3-Column View**: Left: Local changes (Yours) · Center: Merged result · Right: Incoming changes (Theirs);
- **1-Click Bidirectional Merging**: Click arrows to cleanly accept or discard changes with live result synthesis;
- **Safety Barrier Against Raw Markers**: Blocks commits if any file still contains unmerged `<<<<<<<` markers;
- **External Resolution Auto-Healing**: When conflict markers are removed and saved in external editors (VS Code, Sublime), OmniGit automatically stages changes and clears the conflict state in real-time;
- **Full Chinese & Unicode Path Encoding**: Fully handles non-ASCII characters via `-c core.quotepath=false` and automatic octal de-escaping.

---

### 2. 🚀 Zero-Checkout Selective Push & Patch Branches
![Selective Push Modal](docs/images/08_selective_push_modal.png)

- **Zero-Checkout Branch Selection**:
  - Switch source and remote target branches directly inside the push modal without physically checking out local workspaces;
- **Commit Multi-Select Checkboxes**:
  - Independent checkboxes for outgoing commits; push selected commits directly to the remote branch or create a dedicated patch branch (e.g., `patch/fix-xxx`) for PR / Code Review without polluting your current working tree;
- **Push Up To Here**:
  - Right-click any commit card to push history up to that point, isolating subsequent unverified commits;
- **Cross-Branch Cherry-pick & Sync**:
  - In Commit Log, right-click any commit to cleanly cherry-pick and sync to other branches (such as `test` or `uat`) with optional automatic remote pushing.

---

### 3. 🛠️ Services & Launch Scripts Manager (Unified Microservice Orchestrator)
![Services Orchestrator & Real-Time Console](docs/images/07_services_orchestrator.png)

- **Script-Centric Workflow**:
  - Automatically discovers scripts across all workspace projects (`package.json` scripts, `.bat`, `.sh`, etc.);
  - Create and edit custom launch scripts, stop scripts, and environment variables;
- **Monorepo Directory Auto-Resolution**:
  - Intelligently deduces working directories for nested packages in Monorepo setups;
- **Drag-to-Reorder with Persistence**:
  - Reorder service script cards freely with intuitive drag-and-drop; order is persisted across restarts;
- **Real-Time ANSI Color Streaming Console**:
  - High-performance Server-Sent Events (SSE) streaming console with native ANSI color rendering and OSC title sanitization;
  - **Smart Auto-Scroll**: Sticks to bottom by default; locks viewport when scrolling up for inspection, with a 1-click floating button to jump back down;
  - **Chunk Line Buffering**: Prevents stream fragmentation and cleanly decodes mixed Windows GBK and Linux UTF-8 logs;
- **1-Click Start/Stop All & Orphan Process Guard**:
  - Top action bar to start or stop all microservices with live running count badge;
  - Non-blocking asynchronous lifecycle execution prevents UI stutter; sub-processes are automatically cleaned up to prevent lingering port collisions.

---

### 4. 📂 Multi-Root Workspace Explorer
![Workspace Explorer & Monaco Editor](docs/images/02_workspace_explorer_editor.png)

- **Cross-Repo Single Window**: Designed for microservices, front-and-backend pairs, and monorepos. Browse, expand, and drill down through multiple repository file trees concurrently in a single pane;
- **Smart File Type Recognition**: Visual code icons tailored by file extension and attributes;
- **Tab Deduplication with Single-Flight Lock**: Eliminates duplicate tab bugs by auto-focusing existing tabs when clicking already open files;
- **Reveal in OS File Explorer**: 1-click button to open the project folder in Windows File Explorer or macOS Finder.

---

### 5. 💻 Monaco Code Editor & Smart Tabs
![Monaco Floating Find and Replace](docs/images/05_find_replace_monaco.png)

- **Sub-50ms Offline Load**: Powered by the same Monaco Editor engine as VS Code, fully bundled locally with syntax highlighting and line numbers for all major languages;
- **Smart Tab Disambiguation**: When identical file names are open across different projects (e.g. multiple `package.json` files), the tab strip automatically appends parent directory labels;
- **Horizontal Wheel Scroll & Tab Overflow Drawer**: Smooth mouse wheel scrolling along tab strips with an overflow dropdown menu for instant navigation;
- **Smart Comment Toggle (<kbd>Ctrl + /</kbd>)**: Toggle single-line and block comments instantly across source code, HTML, and Markdown;
- **Floating Find & Replace (<kbd>Ctrl + F</kbd>)**:
  - Sleek floating card widget styled with Darcula and VS Code aesthetics;
  - Full support for Match Case (`Aa`), Whole Word (`Ab`), and Regular Expressions (`.*`);
  - Real-time match counter (`1/N`) with smooth previous/next result navigation.

---

### 6. 📝 Draggable Split Markdown Live Preview
![Markdown Split Live Preview & Fullscreen](docs/images/03_markdown_split_preview.png)

- **GitHub-Fidelity Rendering**: Supports Markdown headings, tables, syntax-highlighted code blocks, task lists, and GitHub badges;
- **Local Relative Image Resolution**: Built-in `/api/fs/raw` asset pipeline displays local relative images (e.g., `./docs/images/xxx.png`) with 100% fidelity;
- **Free Split Border Dragging**: Smoothly drag the middle separator to adjust editor vs. preview width with persistent ratio memory;
- **Double-Click Center Reset**: Double-click the separator at any time to instantly snap back to the 50:50 ratio;
- **1-Click Fullscreen Reading**: Quickly toggle between Source, Split, and Fullscreen reading modes.

---

### 7. 🖥️ VS Code-Aligned Integrated Terminal Dock
![Integrated Terminal Dock](docs/images/04_terminal_dock.png)

- **Multi-Tab Concurrent PTY Sessions**: Run PowerShell, Git Bash, CMD, and WSL concurrently;
- **Double-Click Tab Renaming**: Rename terminal sessions on the fly (e.g., `Backend Dev`, `Vite Watcher`);
- **Aligned with VS Code Controls**:
  - <kbd>—</kbd> (Minus): Minimize/collapse drawer;
  - <kbd>🗑️</kbd> (Trash): Terminate process and close tab;
  - <kbd>^</kbd> / <kbd>v</kbd>: Maximize and restore dock height;
- **Smart Upward Popup Menu**: Add Terminal menu automatically pops upwards to prevent taskbar cutoff.

---

### 8. ⚡ 1-Click "Undo Merge" Safe Rollback
- Made an accidental `git merge dev` and want to back out cleanly?
- OmniGit provides a dedicated **Undo Merge** button in the branch menu, sniffing recent merge commits and safely restoring your working tree with a high-risk confirmation guard.

---

### 9. 🌐 Desktop & Web Parity, Bilingual Localization & Offline Privacy
![Seamless Bilingual Localization](docs/images/06_english_mode_ui.png)

- **Full Desktop + Web Parity**: Run as a standalone Electron desktop client or access via any browser on your local network with identical features and real-time streaming;
- **Strict Bilingual Support**: English and Chinese locales are maintained with zero translation mixing;
- **Classic Themes**: Built-in Darcula, IDEA Light, and Nord Frost themes;
- **0ms Instant Hydration**: L1 memory, L2 LocalStorage, and L3 disk snapshots eliminate loading flashes and blank screens;
- **100% Offline Sandbox**: **Never uploads your code or credentials**.

---

## 📊 Comparison with Popular Tools

| Dimension | **OmniGit** | SourceTree | GitKraken | Fork | Native VS Code |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Scope** | **Git Core + Multi-Repo Microservice Workbench** | Traditional Git client | Traditional Git client | Traditional Git client | General text editor |
| **License** | **100% Free & Open-Source (MIT)** | Proprietary freeware | Freemium / Paid subscription | $49.99 Commercial | Free & open-source |
| **3-Way Merge Conflict Resolver** | **Native 3-column visual merge** | Requires external tool | Paywalled | Native | Complex extensions needed |
| **External Conflict Auto-Healing** | **Auto-detects and stages on external save** | Manual staging required | Manual refresh required | Manual staging required | Manual staging required |
| **Multi-Service Launch & ANSI Logs** | **Native built-in (scripts, auto-scroll, stop guards)** | None | None | None | Needs tasks/plugins |
| **Selective Push & Patch Branches** | **Native support (multi-select, patch branches)** | Whole branch only | Complex | Basic | Whole branch only |
| **Multi-Root Explorer & Monaco Editor**| **Native built-in (disambiguation, split preview)** | None | None | None | Native built-in |
| **Integrated Terminal Dock** | **Native built-in (VS Code ergonomics)** | External terminal only | Built-in | External terminal only | Native built-in |
| **1-Click Undo Merge** | **Native (with history sniffing)** | CLI commands required | Complex tree undo | Manual rollback | None |
| **Cross-Branch Commit Sync** | **Right-click Cherry-pick & push** | Manual branch checkouts | Clunky | Supported | Manual CLI required |
| **Startup & Footprint** | **Instant / ~76MB Installer** | Heavy, freezes on Windows | Heavy (> 200MB) | Native lightweight | Runs full editor runtime |
| **Account Mandatory** | **Zero login required** | Mandates Atlassian login | Mandates account signup | No login | No login |

---

## ⌨️ Efficient Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| <kbd>Alt + 1</kbd> | Global | Switch to **Git Core Workbench** view |
| <kbd>Alt + 2</kbd> | Global | Switch to **Workspace Explorer & Editor** view |
| <kbd>Ctrl + K</kbd> | Git View | Focus commit message box |
| <kbd>Ctrl + Shift + K</kbd> | Git View | Open Selective Push modal |
| <kbd>Ctrl + Enter</kbd> | Commit Box | Commit selected changes |
| <kbd>Ctrl + F</kbd> | Monaco Editor | Toggle modern floating find & replace widget |
| <kbd>Ctrl + /</kbd> | Monaco Editor | Toggle line or block comments |
| <kbd>Ctrl + Shift + F</kbd> | Global | Open global search across all workspace files |
| <kbd>Ctrl + `</kbd> | Global | Toggle bottom integrated terminal dock |

---

## 🛠️ Developer Guide (Local Development)

All utility scripts are organized in the [`scripts/`](scripts/) directory (see [`scripts/README.en.md`](scripts/README.en.md)):

### 1. Launch Desktop Preview
```bash
# Option 1: Double-click scripts/start_desktop.bat
# Option 2: Command line
cd app
npm run electron:preview
```

### 2. Launch Web Development Server (HMR)
```bash
# Option 1: Double-click scripts/start_dev.bat (opens http://localhost:5345)
# Option 2: Command line
cd app
npm run dev
```

### 3. Build Windows Installer Package
Double-click: 👉 **[`scripts/build_desktop.bat`](scripts/build_desktop.bat)**.  
The build pipeline validates TypeScript types, compiles assets, injects icons, and produces a highly compressed NSIS single-file installer in `app/release/` (~76MB).

### 4. Automated Regression Test Suite
```bash
# Run API and E2E regression tests
npm run test:e2e
# Run microservices lifecycle end-to-end tests
node app/scripts/test-e2e-services.cjs
```

---

## 📂 Project Architecture Overview

```text
OmniGit/
├── app/                              # Core application
│   ├── electron/                     # Electron main process & auto-updater
│   │   ├── main.ts                   # Window lifecycle, private local server & detection
│   │   ├── preload.ts                # Secure preload script
│   │   └── updater.ts                # Silent updater via GitHub Releases
│   ├── src/                          # Frontend source (React 18 + Zustand + Tailwind)
│   │   ├── components/               # Base UI components (Modal, Button, Input, Dropdown)
│   │   ├── features/                 # Modular feature domains
│   │   │   ├── activity-bar/         # Left Activity Bar (Git, Explorer, Services)
│   │   │   ├── conflict-3way/        # Visual 3-Way Merge conflict resolver
│   │   │   ├── diff-editor/          # Monaco diff viewer
│   │   │   ├── editor/               # Monaco code editor, find/replace & Markdown preview
│   │   │   ├── git-log/              # Commit log, branch graph & cross-branch sync
│   │   │   ├── git-push/             # Branch selector, commit checkboxes & selective push
│   │   │   ├── git-status/           # Changes, Shelf & commit box
│   │   │   ├── services/             # Services & Launch Scripts Manager (ANSI streaming)
│   │   │   ├── terminal/             # VS Code-styled terminal dock (PTY sessions)
│   │   │   ├── topbar/               # Top branch menu, undo merge, user profile
│   │   │   └── workspace/            # Multi-repo explorer & workspace tree
│   │   ├── locales/                  # Strictly isolated i18n dictionaries (zh-CN / en-US)
│   │   ├── server/                   # Local execution engine & API (Git/FS/Services)
│   │   └── store/                    # State management (useAppStore, 0ms optimistic UI)
│   ├── electron-builder.yml          # NSIS installer configuration
│   └── package.json                  # Dependencies & scripts
├── docs/                             # Architecture, PRD, tutorials & media assets
│   ├── images/                       # High-res feature showcases & demo animations
│   │   ├── omnigit_demo.gif          # Full workflow animation
│   │   ├── omnigit_demo.webm         # Full workflow video
│   │   ├── 01_omnigit_workbench.png  # 3-Way Merge conflict resolver & Git workbench
│   │   ├── 02_workspace_explorer_editor.png # Workspace explorer & code editor
│   │   ├── 03_markdown_split_preview.png    # Draggable split Markdown preview
│   │   ├── 04_terminal_dock.png      # Integrated terminal dock
│   │   ├── 05_find_replace_monaco.png# Monaco floating find & replace
│   │   ├── 06_english_mode_ui.png    # English mode UI
│   │   ├── 07_services_orchestrator.png     # Services orchestrator & real-time logs
│   │   └── 08_selective_push_modal.png      # Zero-checkout selective push modal
│   └── OmniGit_PRD.md                # Product requirements & architecture documentation
├── scripts/                          # Developer automation scripts
├── test/                             # Automated E2E and benchmark test suite
└── README.md                         # Main documentation (Simplified Chinese)
```

---

## 🤝 Contributing & Feedback

Contributions, feature suggestions, and bug reports are warmly welcome!
- Found a bug or have an idea? Open an [Issue](https://github.com/BucanYu/OmniGit/issues)
- Enjoying OmniGit? Give us a ⭐️ **Star** on GitHub to support the project!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
