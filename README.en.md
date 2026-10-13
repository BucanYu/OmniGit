# OmniGit - High-Performance Multi-Repository Git Desktop Workbench 🚀

> **The beloved IntelliJ IDEA Git workflow & powerful 3-Way Merge conflict resolver, extracted into a lightweight, standalone, open-source desktop client.**  
> Built for multi-repo & microservices collaboration · Fine-grained selective push · Real-time external conflict auto-healing · Multi-root Workspace Explorer · Built-in Monaco Code Editor & Live Markdown Preview · VS Code-aligned Integrated Terminal · 0ms Optimistic UI · Sub-second Startup · Offline Privacy-First · Free & Open-Source

**English** | [简体中文](README.md)

[![GitHub release](https://img.shields.io/github/v/release/BucanYu/OmniGit?style=flat-square&color=0284c7)](https://github.com/BucanYu/OmniGit/releases)
[![Total Downloads](https://img.shields.io/github/downloads/BucanYu/OmniGit/total?style=flat-square&color=10b981&label=Total%20Downloads)](https://somsubhra.github.io/github-release-stats/?username=BucanYu&repository=OmniGit)
[![Latest Release Downloads](https://img.shields.io/github/downloads/BucanYu/OmniGit/latest/total?style=flat-square&color=0ea5e9&label=v0.5.0%20Downloads)](https://github.com/BucanYu/OmniGit/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue?style=flat-square)](https://github.com/BucanYu/OmniGit/releases)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/BucanYu/OmniGit?style=flat-square&color=eab308)](https://github.com/BucanYu/OmniGit/stargazers)

---

### 📦 Downloads & Releases

> 🚀 **Latest Release: v0.5.0** | 📈 **Live Stats: [![Total Downloads](https://img.shields.io/github/downloads/BucanYu/OmniGit/total?style=flat-square&color=10b981&label=Total%20Downloads)](https://somsubhra.github.io/github-release-stats/?username=BucanYu&repository=OmniGit) [![Latest Downloads](https://img.shields.io/github/downloads/BucanYu/OmniGit/latest/total?style=flat-square&color=0ea5e9&label=v0.5.0%20Downloads)](https://github.com/BucanYu/OmniGit/releases/latest)** | 🔍 **[View Live Download Analytics Dashboard ↗](https://somsubhra.github.io/github-release-stats/?username=BucanYu&repository=OmniGit)**

#### 🪟 Windows
| Package Format | Download Link (GitHub Releases) | Highlights | Zero UAC |
| :--- | :--- | :--- | :---: |
| **Setup Installer** | 👉 **[OmniGit-Setup-0.5.0.exe](https://github.com/BucanYu/OmniGit/releases/latest)** | Recommended: customizable path, auto-updates | ✅ Zero UAC |
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

> The animated demo below showcases the core end-to-end workflow of OmniGit v0.5.0: from 3-Way Merge conflict resolution and selective push, to multi-project file exploration, Monaco code editing, draggable split Markdown preview, and the integrated VS Code-aligned terminal dock.

![OmniGit v0.5.0 Live Walkthrough](docs/images/omnigit_demo.gif)

---

## 💡 Why OmniGit?

Every developer (especially those working in VS Code, Sublime, Cursor, or terminal environments) faces these familiar frustrations:

1. **Resolving Merge Conflicts is Stressful**: Manually hunting down `<<<<<<< HEAD` markers in standard editors is error-prone, carrying the constant risk of corrupting remote branches or breaking CI pipelines;
2. **Full IDEs Are Too Heavy**: IntelliJ IDEA and WebStorm offer the gold standard for visual conflict resolution, but consume 2–4 GB of RAM and take 30 seconds to boot. Opening a heavy IDE just to resolve one Git conflict heats up your laptop;
3. **Inflexible Commit & Push Controls**: In agile sprints, urgent bug fixes often interleave with unverified feature commits. Traditional clients force you to push all commits or perform tedious manual branch checkouts and cherry-picks;
4. **Desync with External Editors**: When you resolve conflicts in your favorite editor and save, most Git clients remain stuck on the conflict screen until you manually execute `git add`;
5. **Context Switching Friction**: Inspecting a couple of source files or running a quick terminal command usually forces you to open heavy external editors or separate terminal windows;
6. **Flaws of Existing Standalone Clients**:
   - **SourceTree**: Clunky, slow, prone to freezing on Windows, and mandates an Atlassian login;
   - **GitKraken**: Increasingly commercialized; paywalls private repos and merge conflict resolution behind monthly subscriptions;
   - **Fork**: Proprietary closed-source software that costs $49.99.

**OmniGit ends these compromises.** It packages JetBrains' ergonomic Git workflow and visual 3-Way Merge into a standalone desktop workbench, seamlessly integrated with a **multi-root workspace explorer, Monaco code editor, draggable Markdown live preview, and VS Code-aligned terminal dock**—all starting in **1 second, using ~60MB of RAM, and completely free and open-source.**

---

## ✨ Killer Features

### 1. 🎯 JetBrains-Grade 3-Way Merge Conflict Resolver
![OmniGit 3-Way Merge Conflict Resolver](docs/images/01_omnigit_workbench.png)

- **Intuitive 3-Column View**: Left: Local changes (Yours) · Center: Merged result · Right: Incoming changes (Theirs);
- **1-Click Bidirectional Merging**: Click arrows to cleanly accept or discard changes with live result synthesis;
- **Safety Barrier Against Raw Markers**: Blocks commits if any file still contains unmerged `<<<<<<<` markers;
- **External Resolution Auto-Healing**: When conflict markers are removed and saved in external editors (VS Code, Sublime), OmniGit automatically stages changes and clears the conflict state in real-time.

---

### 2. 📂 Multi-Root Workspace Explorer
![Workspace Explorer & Monaco Editor](docs/images/02_workspace_explorer_editor.png)

- **Cross-Repo Single Window**: Designed for microservices, front-and-backend pairs, and monorepos. Browse, expand, and drill down through multiple repository file trees concurrently in a single pane;
- **Smart File Type Recognition**: Visual code icons tailored by file extension and attributes;
- **Tab Deduplication with Single-Flight Lock**: Eliminates duplicate tab bugs by auto-focusing existing tabs when clicking already open files;
- **Reveal in OS File Explorer**: 1-click button to open the project folder in Windows File Explorer or macOS Finder.

---

### 3. 💻 Monaco Code Editor & Floating Find/Replace
![Monaco Floating Find and Replace](docs/images/05_find_replace_monaco.png)

- **Sub-50ms Offline Load**: Powered by the same Monaco Editor engine as VS Code, fully bundled locally with syntax highlighting and line numbers for all major languages;
- **Smart Comment Toggle (<kbd>Ctrl + /</kbd>)**: Toggle single-line and block comments instantly across source code, HTML, and Markdown;
- **Floating Find & Replace (<kbd>Ctrl + F</kbd>)**:
  - Sleek floating card widget styled with Darcula and VS Code aesthetics;
  - Full support for Match Case (`Aa`), Whole Word (`Ab`), and Regular Expressions (`.*`);
  - Real-time match counter (`1/N`) with smooth previous/next result navigation.

---

### 4. 📝 Draggable Split Markdown Live Preview
![Markdown Split Live Preview & Fullscreen](docs/images/03_markdown_split_preview.png)

- **GitHub-Fidelity Rendering**: High-fidelity live preview of GitHub markdown, tables, checklists, code fences, and shield badges;
- **Draggable Split Divider**: Smoothly drag the middle divider to allocate proportional width between editor and preview, with cross-session state persistence;
- **Double-Click Centering**: Double-click the middle divider anytime to instantly reset to a balanced 50:50 golden split;
- **Fullscreen Reading Mode**: 1-click toggle between Source Code, Split View, and Fullscreen Pure Reading mode.

---

### 5. 🖥️ VS Code-Aligned Integrated Terminal Dock
![Integrated Terminal Dock](docs/images/04_terminal_dock.png)

- **Multi-Tab Concurrent PTY Sessions**: Native support for PowerShell, Git Bash, and CMD sessions;
- **Double-Click Tab Renaming**: Freely rename terminal tabs (e.g., `Dev Console 01`, `Build Watcher`) to organize concurrent tasks;
- **Strictly Aligned with VS Code Ergonomics**:
  - <kbd>—</kbd> (Minus): Quickly collapse/minimize the terminal drawer;
  - <kbd>🗑️</kbd> (Trash Can): Kill the active terminal process and close its tab;
  - <kbd>^</kbd> / <kbd>v</kbd>: Maximize the terminal to full height or restore default height;
- **Upward-Opening Dropdown Menu**: Shell selection menu expands upward, completely preventing viewport clipping at the bottom of the screen.

---

### 6. 🚀 Fine-Grained Branch & Commit Push (Selective Push)
- **Zero-Checkout Branch Selection**:
  - Switch source and target branches directly in the push dialog without physically checking out branches locally;
- **Commit Multi-Selection & Independent Push**:
  - Check individual commits or batches of commits with independent checkboxes;
  - Push selected commits directly to the remote branch, or create and push a dedicated patch branch (e.g. `patch/fix-xxx`) for Code Review / PR without touching your local working tree;
- **Push Up To Here**:
  - Right-click any commit card to push history up to that specific commit, isolating unverified subsequent work;
- **Cross-Branch Commit Sync**:
  - Right-click in the Commit Log to cherry-pick and sync commits directly to another branch (e.g., `test`, `uat`), with an optional automatic remote push.

---

### 7. ⚡ 1-Click "Undo Merge" with Historical Recovery
- Ever merged a branch (e.g. `merge dev`) and immediately wished you could revert?
- OmniGit provides a persistent **Undo Merge** action with smart HEAD inspection and high-risk confirmation, restoring your working tree to its pre-merge state instantly—even after app restarts.

---

### 8. 🌐 Pure Bilingual Parity & Classic Themes
![Bilingual Mode and Theme Previews](docs/images/06_english_mode_ui.png)

- **Pure Bilingual Parity**: Natural localized strings without awkward mixing; hover tooltips reveal standard English Git terminology and IDEA shortcuts (`Ctrl+K` to commit, `Ctrl+Shift+K` to push);
- **Classic Themes**: Preloaded with Darcula, IDEA Light, and Nord Frost themes.

---

### 9. ⚡ 0ms Optimistic UI & Strict Offline Privacy
- **0ms Instant Hydration**: Combines L1 memory, L2 LocalStorage, and L3 disk snapshots for instant boot without white screens;
- **Streaming Git Clone Progress**: Displays real-time transfer percentage, network speed metrics, and live logs with unlimited timeout for large repos;
- **Zero Cloud Leakage**: Runs offline via an embedded local loopback engine. Your code and credentials never leave your machine.

---

## 📊 Mainstream Git Client Comparison

| Dimension | **OmniGit** | SourceTree | GitKraken | Fork | VS Code Built-in Git |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **License & Cost** | **100% Free & Open Source (MIT)** | Free Closed Source | Feature Gated / Paid Sub | $49.99 Commercial | Free Open Source |
| **3-Way Merge Visual Resolver** | **Native 3-Column Visual比对** | Requires External Tool | Paywalled | Native | Requires Complex Extensions |
| **External Conflict Auto-Healing** | **Native Real-Time Auto-Staging** | None, Manual `git add` | Manual Refresh | Manual Staging | Manual Staging |
| **Workspace Tree & Monaco Editor** | **Built-in (with Draggable Markdown)** | None | None | None | Native |
| **Integrated Terminal Dock** | **Built-in (VS Code Aligned)** | None (External Only) | Built-in | External Only | Native |
| **Selective Push (Fine-Grained)** | **Multi-Commit Select / Patch Branch** | Whole Branch Only | Complex | Basic | Whole Branch Only |
| **1-Click Undo Merge** | **Native with Recovery** | Complex CLI Commands | Tree Reset | Manual Rollback | None |
| **Cross-Branch Commit Sync** | **Commit Log Right-Click Cherry-pick** | Manual Checkout | Complex | Supported | Manual CLI |
| **Startup Speed & RAM** | **Instant / Very Low (~60MB)** | Heavy, Prone to Freezing | Heavy (Electron) | Native Lightweight | Tied to Full Editor |
| **Multi-Repo Workspace** | **Native Unified View** | Tab Switching | Weak | Tab Switching | Multi-Window Switching |
| **Account Mandatory** | **Zero Login (Download & Run)** | Requires Atlassian Account | Mandatory Sign-up | None | None |

---

## ⌨️ Common Productive Shortcuts

| Shortcut | Scope | Description |
| :--- | :--- | :--- |
| <kbd>Alt + 1</kbd> | Global | Switch to **Git Workbench** view |
| <kbd>Alt + 2</kbd> | Global | Switch to **Workspace Explorer & Monaco Editor** view |
| <kbd>Ctrl + K</kbd> | Git View | Focus commit message box |
| <kbd>Ctrl + Shift + K</kbd> | Git View | Open Selective Push dialog |
| <kbd>Ctrl + Enter</kbd> | Commit Panel | Commit currently selected changes |
| <kbd>Ctrl + F</kbd> | Monaco Editor | Open modern floating Find & Replace widget |
| <kbd>Ctrl + /</kbd> | Monaco Editor | Toggle line or block comments |
| <kbd>Ctrl + `</kbd> | Global | Toggle integrated terminal dock |

---

## 🛠️ Local Development

All developer utilities are unified under the [`scripts/`](scripts/) directory (see [`scripts/README.md`](scripts/README.md)):

### 1. Launch Desktop Preview
```bash
# Option 1: Double-click scripts/start_desktop.bat
# Option 2: Command line
cd app
npm run electron:preview
```

### 2. Start Web Dev Server (HMR)
```bash
# Option 1: Double-click scripts/start_dev.bat (opens http://localhost:5345)
# Option 2: Command line
cd app
npm run dev
```

### 3. Build Windows Installer
Double-click: 👉 **[`scripts/build_desktop.bat`](scripts/build_desktop.bat)**.  
The script executes TypeScript checks, Vite bundling, icon embedding, and NSIS compression to produce the standalone installer in `app/release/`.

### 4. Automated Test Suite
```bash
node test/scripts/run-all-tests.cjs
```
Runs API SLA performance benchmarks and automated headless Chrome CDP E2E verification.

---

## 📂 Project Architecture

```text
OmniGit/
├── app/                              # Core Application
│   ├── electron/                     # Electron Main Process & Auto Updater
│   │   ├── main.ts                   # Lifecycle, Local Services & Diagnostics
│   │   ├── preload.ts                # Secure IPC Preload Script
│   │   └── updater.ts                # Silent GitHub Releases Auto-Update
│   ├── src/                          # Frontend Source (React 18 + Zustand + Tailwind)
│   │   ├── components/               # Base UI Primitives (Modal, Button, Input, Dropdown)
│   │   ├── features/                 # Domain Modules
│   │   │   ├── conflict-3way/        # Visual 3-Way Merge Conflict Resolver
│   │   │   ├── diff/                 # Monaco Diff Comparison
│   │   │   ├── editor/               # Monaco Code Editor, Find/Replace, Markdown Split
│   │   │   ├── git-log/              # Commit Tree, History & Cherry-Pick Sync
│   │   │   ├── git-push/             # Selective Push & Branch Selector
│   │   │   ├── terminal/             # VS Code-Aligned Terminal Dock (PTY Manager)
│   │   │   ├── status/               # Changes Tree, Shelf
│   │   │   ├── topbar/               # Topbar Branch Selector, Undo Merge, Theme Switcher
│   │   │   └── workspace/            # Multi-Root File Explorer Tree
│   │   ├── locales/                  # Type-Safe Localization Dictionaries (zh-CN / en-US)
│   │   ├── server/                   # Local Git Execution Service
│   │   └── store/                    # Global Stores (useAppStore, 0ms Optimistic Engine)
│   ├── electron-builder.yml          # NSIS Packaging Spec
│   └── package.json                  # Dependencies & Scripts
├── docs/                             # Architecture Specs, PRDs & Assets
│   ├── images/                       # High-Definition Showcase Images & Animations
│   │   ├── omnigit_demo.gif          # v0.5.0 Full Walkthrough Animated Demo GIF
│   │   ├── 01_omnigit_workbench.png  # 3-Way Merge Conflict Resolver
│   │   ├── 02_workspace_explorer_editor.png # Explorer & Code Editor
│   │   ├── 03_markdown_split_preview.png    # Draggable Split Markdown Preview
│   │   ├── 04_terminal_dock.png      # Integrated Terminal Dock
│   │   ├── 05_find_replace_monaco.png# Floating Find/Replace Widget
│   │   └── 06_english_mode_ui.png    # Bilingual English Mode UI
│   └── OmniGit_Tutorial_Guide.docx   # Practical Guide for Non-IDEA Users
├── scripts/                          # Developer Tooling & Automation
├── test/                             # Automated E2E & SLA Test Suite
└── README.md                         # Project Overview (Simplified Chinese)
```

---

## 🤝 Contributing & Feedback

Contributions from the developer community are warmly welcomed!
- Found a bug or have a feature idea? Please file an [Issue](https://github.com/BucanYu/OmniGit/issues)
- Love the tool? Give us a ⭐️ **Star** to support continued development!

---

## 📄 License

OmniGit is licensed under the [MIT License](LICENSE). Free for personal and commercial use.
