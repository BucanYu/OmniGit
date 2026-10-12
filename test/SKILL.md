---
name: omnigit-automated-test
description: Automated end-to-end test suite and browser CDP verification protocol for OmniGit. Provides reusable scripts and workflows for API latency benchmarks, Monaco editor offline asset integrity, and UI browser automation without consuming extra subagent tokens.
---

# OmniGit 自动化测试与浏览器验证工具包 (Skill)

## 1. 简介与设计背景

为了杜绝人工逐点反馈与零散修改、提升系统稳定性，本项目在 `test/` 目录下建立了全套可复用的**轻量级自动化端到端测试套件**。

### 核心优势
1. **零第三方重型依赖**：利用 Node.js v22 原生内置的 `fetch` 与 `WebSocket` API，直接通过 Chrome DevTools Protocol (CDP) 驱动本地 Google Chrome 进行无头自动化测试，无需额外安装或下载庞大的 Playwright/Puppeteer 浏览器二进制。
2. **零 Token 浪费**：后续对话或开发过程中，可以直接通过运行本地测试脚本 `node test/scripts/run-all-tests.cjs` 即可瞬间完成所有 API 性能压测与浏览器界面渲染验证，无需反复调用 `/browser` 子代理消耗大量 Token。
3. **确定性高分辨率截图与性能度量**：自动化脚本不仅校验 DOM 节点与控制台日志，还会在每次测试时将真实渲染视图保存至 `test/reports/`，包含 Git 工作台模式和源码编辑器模式的全真截图。

---

## 2. 目录结构与模块说明

```
OmniGit/
├── app/                        # 应用源代码目录
├── test/                       # 自动化测试专属目录（与 app 同级）
│   ├── SKILL.md                # 本自动化测试规范与复用操作指南
│   ├── run-test.bat            # Windows 一键执行入口脚本
│   ├── scripts/
│   │   ├── run-all-tests.cjs   # 统一测试调度入口
│   │   ├── api-e2e-test.cjs    # 后端 API、性能 SLA 与安全沙箱测试
│   │   └── cdp-browser-test.cjs# 基于 Chrome CDP 的浏览器 E2E 交互与截图测试
│   └── reports/                # 自动化产物（截图与日志）
│       ├── 01_git_workbench.png   # Git 提交工作台截图
│       └── 02_explorer_editor.png # 源码资源管理器与 Monaco 编辑器截图
```

---

## 3. 测试覆盖范围与性能基准 (SLA)

| 检查项 | 目标规范 / SLA | 验证方式 |
| :--- | :--- | :--- |
| **Monaco 静态资源离线化** | `/vs/loader.js` 本地响应 < 50ms，彻底杜绝外网 CDN 超时导致的 `Loading...` 停滞 | `api-e2e-test.cjs` 校验本地静态资源大小与延迟 |
| **Monaco 主样式表加载** | `/vs/editor/editor.main.css` 响应 < 30ms，本地完整响应 | `api-e2e-test.cjs` HTTP 检查 |
| **工作区备份接口** | `/api/git/workspaces/backup` 返回真实持久化数组 | `api-e2e-test.cjs` 结构校验 |
| **文件树遍历延迟** | `/api/fs/tree` 目录列表响应 < 50ms（移除同步 `fs.statSync`，带 `.gitignore` 内存缓存） | `api-e2e-test.cjs` 压测检查 |
| **文件极速读取** | `/api/fs/read` 源码文件读取响应 < 30ms，保留原始编码与换行符 (CRLF/LF) | `api-e2e-test.cjs` 内容与标头检查 |
| **安全沙箱越界防护** | 尝试路径穿越（如 `../../Windows`）必须返回错误或拦截，拒绝非法读取 | `api-e2e-test.cjs` 安全探测 |
| **浏览器界面水合与模式切换** | 正常加载页面，无控制台严重报错，支持 `Alt + 1` (Git) 与 `Alt + 2` (Explorer) 快捷切换 | `cdp-browser-test.cjs` Chrome CDP 交互验证 |
| **目录级联展开与源码渲染** | 点击项目根目录展开文件树，点击源文件能够正确挂载 Monaco Editor，代码行数 > 0 且无白屏 | `cdp-browser-test.cjs` 真实 DOM 探查并留存截图 |

---

## 4. 快速运行指南

### 方式 1：一键批处理命令（推荐）
在项目根目录或命令行中直接运行：
```bash
.\test\run-test.bat
```

### 方式 2：Node.js 统一运行
```bash
node test/scripts/run-all-tests.cjs
```

### 方式 3：分模块独立运行
- **仅运行后端 API 与性能基准测试**：
  ```bash
  node test/scripts/api-e2e-test.cjs
  ```
- **仅运行浏览器无头端到端测试与截图**：
  ```bash
  node test/scripts/cdp-browser-test.cjs
  ```

---

## 5. 核心问题定位与防退化机制

### 5.1 Monaco 编辑器 "Loading..." 假死防退化
- **根因回顾**：`@monaco-editor/react` 默认请求公共外网 CDN `https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs`，在离线或国内网络环境下该请求极易发生超时，导致页面一直卡在默认的 `Loading...` 占位符上。
- **解决方案**：
  1. 通过 `app/scripts/setup-monaco.cjs` 将 `node_modules` 中已安装的 Monaco 静态资源自动拷贝至 `app/public/vs`；
  2. 在 `app/src/main.tsx` 中配置 `loader.config({ paths: { vs: '/vs' } })`；
  3. `package.json` 中的 `predev` 与 `prebuild` 钩子强制自动执行拷贝；
  4. 自动化测试脚本 `cdp-browser-test.cjs` 会实时轮询 `.monaco-editor` 节点与 `.view-line`，一旦检测到渲染停滞或 `Loading...` 超过阈值立即报警。

### 5.2 目录浏览与单子目录连续点击优化防退化
- **根因回顾**：
  1. `fileSystemService.ts` 在每次展开目录时，为获取文件大小对目录下每个非目录项同步执行 `fs.statSync`，造成大量无意义磁盘 I/O。
  2. Java 等多级包路径（如 `src/main/java/com/adas/...`）如果每级都需要手动点击，操作繁琐且体验滞后。
- **解决方案**：
  1. `readDirectory` 仅通过 `fs.readdirSync(..., { withFileTypes: true })` 获取文件列表，移除每文件同步 `statSync`；
  2. `.gitignore` 规则增加基于 `mtime` 的内存缓存，避免重复读盘解析；
  3. 前端 `useWorkspaceExplorerStore.ts` 支持单子目录自动链式展开（最多 8 层），实现类似 VS Code 的紧凑文件夹体验。

---

## 6. 测试产物查看指南

测试运行完毕后，可在以下路径查看生成的自动化报告截图：
- **Git 提交工作台视图**：[01_git_workbench.png](file:///d:/projects/OmniGit/test/reports/01_git_workbench.png)
- **源码资源管理器与 Monaco 编辑器视图**：[02_explorer_editor.png](file:///d:/projects/OmniGit/test/reports/02_explorer_editor.png)
