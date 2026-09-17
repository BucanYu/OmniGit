# OmniGit Scripts & Developer Environment Guide

**English** | [简体中文](README.md)

This directory (`scripts/`) organizes and centralizes all automation scripts for OmniGit's daily execution, development debugging, service management, and commercial-grade installer packaging pipelines. All scripts are authored using relative paths (`%~dp0` / `$PSScriptRoot`) with dynamic environment probing, working out of the box when cloned to any machine or directory.

---

## 1. Tech Stack & Prerequisites

### 1. Basic Environment (Required on Developer's Machine)
Before running scripts or packaging builds, ensure your machine has the following tools installed:
- **Node.js**: `v18.0.0` or higher (Recommended LTS `v20.x` or `v22.x`);
- **Package Manager**: `npm` (bundled with Node.js, recommended `>= 9.x`) or `pnpm`;
- **Git CLI**: Git installed on your system and accessible via terminal (`git --version`).

### 2. Zero-Config Pre-bundled Tools
- **NSIS Industrial-Grade Installer Compiler**:
  - Tool path: [`scripts/tools/nsis/`](tools/nsis/)
  - **No installation needed**: This repository includes a complete portable NSIS distribution (including `makensis.exe`, Unicode plugins, and Modern UI 2 language packs). Developers do **not** need to install NSIS separately. Packaging a single-file Windows installer works immediately upon cloning.

### 3. Optional Tools
- **7-Zip** (Optional):
  - If you need to build macOS `.zip` distribution bundles from a Windows development machine, install [7-Zip](https://www.7-zip.org/) and ensure its path (e.g. `C:\Program Files\7-Zip`) is added to your system `PATH`.

---

## 2. Initialization

After cloning the repository for the first time, navigate to the `app/` directory and install project dependencies:

```bash
# Navigate to the app directory
cd app

# Install dependencies
npm install
```

---

## 3. Script Catalog & Usage

All `.bat` scripts can be executed by **double-clicking in Windows Explorer** or run from a terminal:

| Script Name | Purpose & Description | Typical Use Case | How to Run |
| :--- | :--- | :--- | :--- |
| **`build_desktop.bat`** | **[Core Pipeline] Cross-platform automated build & packaging**<br>Validates environment, runs TypeScript type checks, builds Vite production bundle, packages Electron app, and compiles NSIS Windows installer. | Official release / Packaging | Double-click, or run in terminal:<br>• `build_desktop.bat` (All)<br>• `build_desktop.bat win` (Windows only)<br>• `build_desktop.bat mac` (macOS only) |
| **`start_desktop.bat`** | **Native Desktop Client Direct Launch**<br>Automatically compiles frontend/backend and launches OmniGit in a native borderless desktop window to preview real standalone desktop behavior. | Local desktop testing | Double-click to run |
| **`start_dev.bat`**<br>`start_dev.ps1` | **Web Browser Fast Dev Server (HMR)**<br>Starts local Vite dev server (listening on `http://localhost:5345`) and automatically opens the default system browser with hot-reload debugging. | UI & component development | Double-click `start_dev.bat`, or run `./start_dev.ps1` in PowerShell |
| **`stop_dev.bat`**<br>`stop_dev.ps1` | **Port Cleanup & Process Termination**<br>Intelligently finds and terminates background Node processes occupying port `5345`, resolving port conflict issues. | Server shutdown / Port cleanup | Double-click `stop_dev.bat` |
| `installer.nsi` | **NSIS Single-File Installer Script**<br>Defines wizard UI, custom installation path, desktop/start menu shortcuts, uninstaller registry entries, and silent updates. | Invoked by `build_desktop.bat` | Automated |
| `generate_icon.ps1` | **Desktop Icon Generator**<br>Generates standard multi-resolution lossless `.ico` and `.png` brand icons from vector specs. | Branding updates | Pipeline / Manual |

---

## 4. Build Artifacts & GitHub Releases Distribution

When you run `scripts/build_desktop.bat`, the output files are generated in **`app/release/`**:

```
app/release/
 ├── OmniGit-Setup-0.3.0.exe        <- [Official Release] Windows single-file installer (LZMA compressed, ~80MB)
 ├── OmniGit-win32-x64/             <- [Portable Preview] Windows portable folder (run OmniGit.exe directly)
 ├── OmniGit-v0.3.0-mac-arm64.zip   <- [Official Release] macOS Apple Silicon (M-series) app bundle
 └── OmniGit-v0.3.0-mac-x64.zip     <- [Official Release] macOS Intel x64 app bundle
```

> [!IMPORTANT]
> **Binary Distribution Guidelines**:
> - The `app/release/` directory is strictly ignored by root `.gitignore`. **Do NOT commit heavy installation binaries into Git source history.**
> - Release binaries should be published to [GitHub Releases](https://github.com/BucanYu/OmniGit/releases) for users to download.
> - OmniGit's built-in "Check for Updates" feature integrates with the GitHub Releases API for automated updates.

---

## 5. Troubleshooting & FAQ

### Q1: Double-clicking `start_dev.bat` reports port 5345 is already in use?
**Solution**: Double-click `scripts/stop_dev.bat`. The script will detect and terminate lingering processes on port `5345`. Then re-run `start_dev.bat`.

### Q2: Error `Node.js is not found in PATH`?
**Solution**: Node.js is not installed or not in your system PATH:
1. Visit [Node.js Official Website](https://nodejs.org/) and download the LTS release.
2. During installation, make sure the "Add to PATH" option is enabled.
3. Open a new terminal and verify with `node -v`.

### Q3: Do other developers need to install NSIS after cloning?
**Solution**: **No.** NSIS compiler tools are pre-bundled portably under `scripts/tools/nsis/`. Any Windows machine can build the installer immediately after cloning.
