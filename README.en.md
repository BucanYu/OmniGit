# OmniGit - Professional Multi-Repository Git Desktop Workbench

> **Self-Contained Architecture · 0ms Optimistic UI · Native Frameless Desktop Experience · Seamless Auto-Updates**

**English** | [简体中文](README.md)

[![GitHub release](https://img.shields.io/github/v/release/BucanYu/OmniGit?style=flat-square&color=0284c7)](https://github.com/BucanYu/OmniGit/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue?style=flat-square)](https://github.com/BucanYu/OmniGit/releases)

👉 **[Download Latest Release from GitHub Releases (Windows / macOS)](https://github.com/BucanYu/OmniGit/releases/latest)**

OmniGit is a high-performance Git desktop management client designed for concurrent collaboration across multiple projects and large workspaces. Powered by a self-contained closed-loop architecture, it requires **zero external runtime installations** (except Git CLI) on target Windows/macOS computers. It provides millisecond response times, an immersive frameless topbar, visual multi-branch merge/conflict resolution, and intelligent incremental auto-updates.

---

## Architecture & Core Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                    OmniGit Native Desktop Client                │
├─────────────────────────────────────────────────────────────────┤
│  Frameless Immersive TopBar [Native Drag / Minimize / Max / Close] │
├────────────────────────────────┬────────────────────────────────┤
│  React 18 Frontend UI Layer    │  Embedded Loopback Service      │
│  - Zustand 0ms Optimistic Cache│  - Listens on 127.0.0.1 (Dynamic)│
│  - Monaco Editor 3-Way Merge   │  - Unified Static + /api/git/* │
│  - Instant Multi-Repo Switch   │  - Strict Sandbox, No External │
├────────────────────────────────┴────────────────────────────────┤
│  Runtime & Security Isolation                                   │
│  - Electron 30 with Isolated Node.js v20.x Sandbox              │
│  - Zero Environment Pollution: Never touches system global PATH │
│  - Native Git Auto-Detection: Scans PATH & Standard Locations   │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Zero External Dependencies & Sandbox Isolation
- **Zero Runtime Burden**: Packaged releases include a full Electron 30 core and embedded runtime. Target user machines **never need Node.js, npm, or Python installed**;
- **Strict Environment Isolation**: Runs entirely in an isolated sandbox, **never altering system global `PATH` variables**, fully decoupled from existing dev environments;
- **Native Git Auto-Detection**: Automatically detects native Git CLI from system `PATH` and common installation directories (e.g. `C:\Program Files\Git`, etc.).

### 2. 0ms Optimistic UI & Real-Time Responsiveness
- Employs **0ms synchronous optimistic rendering** for critical Git operations: Commit, Pull/Update, Rollback, Branch Checkout, and Branch Switching;
- Backed by an intelligent SWR persistent local snapshot cache, switching between large repositories takes 0ms without blank screens or delayed badges.

---

## Quick Start & Daily Development

All control scripts are consolidated in the [`scripts/`](scripts/) directory (see [`scripts/README.en.md`](scripts/README.en.md) for environment details):

### 1. Launch Native Desktop Window Locally
To start the native frameless Windows desktop client:
- **Option 1 (Recommended)**: Double-click [`scripts/start_desktop.bat`](scripts/start_desktop.bat);
- **Option 2 (CLI)**:
  ```bash
  cd app
  npm run electron:preview
  ```

### 2. Web Browser Development Mode (Hot Reload)
To debug the frontend in browser with Vite HMR:
- **Option 1 (Recommended)**: Double-click [`scripts/start_dev.bat`](scripts/start_dev.bat) (opens at `http://localhost:5345`);
- **Option 2 (CLI)**:
  ```bash
  cd app
  npm run dev
  ```
- **Stop Background Dev Server**: Double-click [`scripts/stop_dev.bat`](scripts/stop_dev.bat).

---

## One-Click Packaging for Desktop Releases

### 1. One-Click Packaging Script
Double-click the cross-platform packager in `scripts/`:
👉 **[`scripts/build_desktop.bat`](scripts/build_desktop.bat)**

The script automatically executes:
1. Environment and Node.js runtime readiness verification;
2. Strict TypeScript type check across frontend and backend;
3. Production asset compilation and minification via Vite;
4. Electron main process and dynamic loopback services compilation;
5. Brand multi-resolution vibrant dual-loop icon injection;
6. High-ratio LZMA Solid compression via pre-bundled portable NSIS compiler into a commercial-grade single-file setup installer.

### 2. Deliverables & Distribution via GitHub Releases
Packaging outputs are placed in `app/release/` (protected by `.gitignore`; installers are published to [GitHub Releases](https://github.com/BucanYu/OmniGit/releases)):
- **📦 Single-file Setup Installer (Official Distribution)**:
  - File: `app/release/OmniGit-Setup-0.3.0.exe` (~80MB compressed)
  - Features:
    - **Bilingual Guided Setup**: Welcome page, License, Custom destination directory selection;
    - **Desktop & Start Menu Shortcuts**: Creates branded shortcuts with custom icons;
    - **Clean Control Panel Uninstaller**: Registers in Windows "Installed Apps" with `Uninstall.exe`;
    - **Zero UAC Elevation**: Installs to user directory by default, completely eliminating UAC prompts for both installation and silent auto-updates.
- **📁 Portable Directory (Developer Testing)**:
  - Path: `app/release/OmniGit-win32-x64/`
  - Features: Zero installation required, run `OmniGit.exe` instantly.

---

## Online Incremental Auto-Updates (GitHub Releases)

The desktop client includes built-in online update detection and download integration with GitHub Releases:

```
  User clicks [Settings -> Version & Updates -> Check for Updates]
                             │
                             ▼
     Connects to GitHub Releases to query latest release tag (e.g. v0.3.0)
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
      Already on Latest Version      New Version Available
    (Shows green up-to-date badge)   (Displays release notes & changelog)
                                                 │
                                                 ▼
                                     Silent Background Download
                                 (Shows progress bar & transfer rate)
                                                 │
                                                 ▼
                                      Download Complete! Highlighting
                                     [Restart & Apply Update]
                                                 │
                                                 ▼
                                     One-click restart to launch new version
```

- **No UAC Elevation Needed**: Uses per-user directory strategy (`perMachine: false`), allowing updates without administrator privilege prompts;
- **Dual Update Engine**: Standard `electron-updater` pipeline with automatic fallback to zero-dependency GitHub REST API native downloader.

---

## Repository Structure

```text
OmniGit/
├── .github/                          # GitHub Actions workflows (CI / Release)
│   └── workflows/release.yml         # Automated release pipeline on tag push
├── app/                              # Core application source
│   ├── electron/                     # Electron desktop main process (TypeScript)
│   │   ├── main.ts                   # Window management, loopback service & Git probe
│   │   ├── preload.ts                # Secure preload script (contextBridge)
│   │   ├── updater.ts                # Auto-update engine (GitHub Releases)
│   │   └── tsconfig.json             # Electron TypeScript configuration
│   ├── src/                          # React 18 Frontend UI
│   │   ├── features/                 # Modular features (TopBar, Git Log, Settings, etc.)
│   │   ├── server/                   # Git API service layer (gitService.ts)
│   │   ├── store/                    # Zustand store (0ms optimistic updates)
│   │   └── types/                    # TypeScript type definitions
│   ├── build/                        # Brand icons (icon.ico, icon.png, icon.icns)
│   ├── dist/                         # Vite build output (Git ignored)
│   ├── dist-electron/                # Compiled Electron main process (Git ignored)
│   ├── release/                      # Packaged installers (Git ignored, sent to Releases)
│   ├── electron-builder.yml          # Packaging metadata & NSIS rules
│   └── package.json                  # Dependencies & scripts
├── docs/                             # Architecture & product specifications
├── scripts/                          # Unified operational & packaging scripts
│   ├── build_desktop.bat             # Cross-platform desktop packager
│   ├── start_desktop.bat             # Native desktop client launcher
│   ├── start_dev.bat                 # Web dev server launcher (Port 5345)
│   ├── stop_dev.bat                  # Background port release utility
│   ├── publish_release.bat           # Helper script to publish to GitHub Releases
│   ├── tools/nsis/                   # Pre-bundled portable NSIS compiler (6.9MB)
│   ├── README.md                     # Script guide (Chinese)
│   └── README.en.md                  # Script guide (English)
├── .gitignore                        # Standard root ignore rules
├── README.md                         # Main repository guide (Chinese)
└── README.en.md                      # Main repository guide (English)
```

---

## License

OmniGit is licensed under the [MIT License](LICENSE).
