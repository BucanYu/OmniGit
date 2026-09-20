# OmniGit - High-Performance Multi-Repository Git Desktop Workbench 🚀

> **The beloved IntelliJ IDEA Git workflow & powerful 3-Way Merge conflict resolver, extracted into a lightweight, standalone, open-source desktop client.**  
> Built for multi-repo & microservices collaboration · 0ms Optimistic UI · Sub-second Startup · Offline Privacy-First · Free & Open-Source

**English** | [简体中文](README.md)

[![GitHub release](https://img.shields.io/github/v/release/BucanYu/OmniGit?style=flat-square&color=0284c7)](https://github.com/BucanYu/OmniGit/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue?style=flat-square)](https://github.com/BucanYu/OmniGit/releases)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/BucanYu/OmniGit?style=flat-square&color=eab308)](https://github.com/BucanYu/OmniGit/stargazers)

---

### 📦 Download Latest Release

| Platform | Package Format | Download Link (GitHub Releases) | Highlights |
| :--- | :--- | :--- | :--- |
| **Windows x64** | **Setup Installer** | 👉 **[OmniGit-Setup-0.3.0.exe](https://github.com/BucanYu/OmniGit/releases/latest)** | Recommended: customizable path, auto-updates, **Zero UAC Elevation** |
| **Windows x64** | **Portable (ZIP)** | 👉 **[OmniGit-win32-x64.zip](https://github.com/BucanYu/OmniGit/releases/latest)** | No installation needed, extract and launch `OmniGit.exe` instantly |
| **macOS (Apple Silicon)** | **Portable App (ZIP)** | 👉 **[OmniGit-v0.3.0-mac-arm64.zip](https://github.com/BucanYu/OmniGit/releases/latest)** | Optimized for Apple Silicon M1 / M2 / M3 / M4 Macs |
| **macOS (Intel x64)** | **Portable App (ZIP)** | 👉 **[OmniGit-v0.3.0-mac-x64.zip](https://github.com/BucanYu/OmniGit/releases/latest)** | Compatible with Intel-based Macs |

---

## 📸 Interface Preview

![OmniGit Workbench Preview](docs/images/omnigit_workbench_preview.png)

---

## 💡 Why OmniGit?

Every developer (especially those working in VS Code, Sublime, or the terminal) faces these familiar frustrations:

1. **Resolving Merge Conflicts is Stressful**: Manually hunting down `<<<<<<< HEAD` markers in normal text editors is error-prone and risks corrupting remote code.
2. **Full IDEs Are Too Heavy**: IntelliJ IDEA and WebStorm have the gold standard for Git conflict resolution, but they consume 2–4 GB of RAM and take 30 seconds to boot. Opening an entire IDE just to resolve one Git conflict heats up your laptop.
3. **Flaws of Existing Standalone Clients**:
   - **SourceTree**: Clunky, slow, prone to freezing on Windows, and forces an Atlassian account login.
   - **GitKraken**: Increasingly commercialized; charges monthly subscriptions for private repos and merge conflict resolution.
   - **Fork**: Smooth, but proprietary and costs $49.99.

**OmniGit ends these compromises.** It packages JetBrains' ergonomic Git workflow and visual 3-Way Merge into a standalone client that **starts in 1 second, uses only ~60MB of memory, and is completely free and open-source.**

---

## ✨ 5 Killer Features

### 1. 🎯 JetBrains-Grade 3-Way Merge Conflict Resolver
- **Intuitive 3-Column View**: Left: Local changes (Yours) · Center: Result preview · Right: Incoming changes (Theirs).
- **1-Click Accept**: Click bidirectional arrows to accept or discard chunks cleanly with live syntax highlighting.
- **Safety Barrier**: Prevents committing if any file still contains raw `<<<<<<<` conflict markers.

### 2. ⚡ 1-Click "Undo Merge" with Historical Recovery
- Ever merged a branch (e.g. `merge dev`) and immediately wished you hadn't?
- OmniGit provides a dedicated **Undo Merge** button that inspects Git HEAD history and state, restoring your working tree to its pre-merge state instantly—even after app restarts.

### 3. 🖥️ IntelliJ IDEA Ergonomics & Keybindings
- **Classic Commit Panel**: Changes tree, side-by-side Monaco diff viewer, Amend commit checkbox, and Rollback action.
- **Familiar Themes & Shortcuts**: Pre-loaded with Darcula, IDEA Light, and Nord Frost themes; supports `Ctrl+K` to commit and `Ctrl+Shift+K` to push.

### 4. 📂 Multi-Repository Workspace Management
- Built for microservices, monorepos, and multi-package teams.
- Manage all your related repositories in one window with real-time incoming/outgoing counters (`↗` / `↘`) and instant switching.

### 5. 🚀 0ms Optimistic UI & Strict Offline Privacy
- **Instant Responsiveness**: Optimistic updates and SWR snapshot cache ensure operations feel instant without UI freeze.
- **Zero Cloud Leakage**: All Git commands execute locally via an embedded loopback engine. Your code and credentials never leave your machine.

---

## 📊 Comparison with Mainstream Git Clients

| Feature | **OmniGit** | SourceTree | GitKraken | Fork | VS Code Built-in |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Open Source & Price** | **100% Free & MIT** | Free (Closed Source) | Freemium ($$ Subscription) | $49.99 Paid | Free & Open Source |
| **3-Way Merge Resolver** | **Native 3-Panel Visual** | Needs external tool | Paywalled feature | Supported | Requires heavy extensions |
| **1-Click Undo Merge** | **Native with Auto-recovery** | Complex CLI commands | Complex reflog rollback | Manual revert | None |
| **IntelliJ Ergonomics** | **Deep 1:1 Parity** | Outdated layout | Custom UI | Mac style | Basic tree view |
| **Startup & Memory** | **Sub-second (~60MB)** | Heavy, frequent lags | Heavy (Electron) | Fast native | Tied to whole editor |
| **Multi-Repo Workspace** | **Native Aggregate View** | Multi-tab | Weak | Multi-tab | Needs multiple windows |
| **Account Lock-in** | **Zero Login Needed** | Mandatory Atlassian | Mandatory registration | None | None |

---

## 🛠️ Local Development Guide

All automation and runner scripts are located in the [`scripts/`](scripts/) directory:

### 1. Launch Desktop Preview
```bash
# Option 1: Double click scripts/start_desktop.bat
# Option 2: Via terminal
cd app
npm run electron:preview
```

### 2. Web Development Mode (HMR)
```bash
# Option 1: Double click scripts/start_dev.bat (opens http://localhost:5345)
# Option 2: Via terminal
cd app
npm run dev
```

### 3. Build Windows Installer Package
Double-click: 👉 **[`scripts/build_desktop.bat`](scripts/build_desktop.bat)**.  
The script compiles TypeScript, bundles Vite assets, and uses portable NSIS to generate the single-file installer in `app/release/`.

---

## 🤝 Contributing & Feedback

Contributions, bug reports, and ideas are warmly welcomed!
- Found a bug or have a suggestion? Open an [Issue](https://github.com/BucanYu/OmniGit/issues)
- If you find OmniGit useful, please give us a ⭐️ **Star** to support the project!

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).
