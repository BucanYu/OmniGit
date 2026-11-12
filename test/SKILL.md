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
│   │   ├── run-all-tests.cjs                       # 统一 7 阶段测试调度总入口
│   │   ├── api-e2e-test.cjs                        # 阶段 1：后端 API、性能 SLA 与安全沙箱测试
│   │   ├── cdp-browser-test.cjs                    # 阶段 2：基于 Chrome CDP 的核心工作台交互与截图测试
│   │   ├── test-services-project-switcher-e2e.cjs  # 阶段 3：微服务模块内工程切换与 Git 状态联动测试
│   │   ├── test-builtin-doc-open-e2e.cjs           # 阶段 4：内置开发指南在编辑器中一键打开渲染测试
│   │   ├── test-data-tools-e2e.cjs                 # 阶段 5：Data Tools 格式化、结构树、表格与 TS 生成测试
│   │   ├── test-services-lifecycle-e2e.cjs         # 阶段 6：微服务生命周期、pause 防阻塞与一次性任务完成测试
│   │   ├── test-data-tools-multi-window-e2e.cjs    # 阶段 7：Data Tools 多窗口标签页、格式下拉与双栏对比测试
│   │   ├── test-data-tools-all-formats-e2e.cjs     # 专项：Data Tools 全格式美化与幂等性断言测试
│   │   └── test-workspace-explorer-e2e.cjs         # 专项：源码资源管理器全文件展示、.gitignore 显隐切换与二进制卡片测试
│   └── reports/                # 自动化产物（01 ~ 25 全场景高清验证截图与 JSON 报告）
```

---

## 3. 测试覆盖范围与性能基准 (SLA)

| 检查项 | 目标规范 / SLA | 验证方式 |
| :--- | :--- | :--- |
| **Monaco 静态资源离线化** | `/vs/loader.js` 本地响应 < 50ms，彻底杜绝外网 CDN 超时导致的 `Loading...` 停滞 | `api-e2e-test.cjs` 校验本地静态资源大小与延迟 |
| **Monaco 主样式表加载** | `/vs/editor/editor.main.css` 响应 < 30ms，本地完整响应 | `api-e2e-test.cjs` HTTP 检查 |
| **工作区备份与静态门户托管** | `/api/git/workspaces/backup` 返回持久化数组，`/api/workspace/dashboard-serve` 动态注入 `<base>` 且拦截越界访问 | `api-e2e-test.cjs` 结构与安全校验 |
| **文件树全量遍历与 `.gitignore` 标记** | `/api/fs/tree` 目录列表响应 < 50ms，解绑 Git 硬过滤返回全量文件（含 `dist`、`.env*`），准确标注 `isIgnored: boolean` | `api-e2e-test.cjs` & `test-workspace-explorer-e2e.cjs` |
| **文件极速读取与二进制识别** | `/api/fs/read` 源码文件读取响应 < 30ms，保留原始编码与换行符 (CRLF/LF)，准确标记 `isBinary` 与 `isTooLarge` | `api-e2e-test.cjs` & `test-workspace-explorer-e2e.cjs` |
| **安全沙箱越界防护** | 尝试路径穿越（如 `../../Windows`）必须返回错误或拦截，拒绝非法读取 | `api-e2e-test.cjs` 安全探测 |
| **浏览器界面水合与 5 大模式切换** | 正常加载页面，无控制台严重报错，支持 `Alt + 0` ~ `Alt + 4` 快捷切换所有主工作台视图 | `cdp-browser-test.cjs` Chrome CDP 交互验证 |
| **微服务生命周期与项目快切** | 模块内切换项目联动 Git 状态，一次性脚本自动完成标记为 `completed`，含 `pause` 脚本不挂起 | `test-services-project-switcher-e2e.cjs` & `test-services-lifecycle-e2e.cjs` |
| **Data Tools 多格式与多窗口对比** | 覆盖全部离线格式美化/压缩幂等性、多窗口新建下拉定位、分屏并排对比与持久化恢复 | `test-data-tools-e2e.cjs` & `test-data-tools-multi-window-e2e.cjs` |

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

### 5.2 目录全量浏览、`.gitignore` 显隐切换与单子目录链式展开防退化
- **根因回顾**：
  1. `fileSystemService.ts` 在每次展开目录时，为获取文件大小对目录下每个非目录项同步执行 `fs.statSync`，造成大量无意义磁盘 I/O；
  2. 早期版本将 `dist`、`build`、`.env*` 等目录或 `.gitignore` 匹配项在后端硬性过滤，导致源码查看模块无法浏览工作区全量文件；
  3. Java 等多级包路径（如 `src/main/java/com/adas/...`）如果每级都需要手动点击，操作繁琐且体验滞后。
- **解决方案**：
  1. `readDirectory` 仅通过 `fs.readdirSync(..., { withFileTypes: true })` 获取文件列表，移除每文件同步 `statSync`；
  2. 解绑 Git 硬过滤（仅跳过 `.git` / `.svn` / `.hg`），将 `.gitignore` 规则基于 `mtime` 内存缓存转化为非破坏性的 `isIgnored: boolean` 标记，支持前端默认全量展示与一键切换隐藏被忽略文件；
  3. 前端 `useWorkspaceExplorerStore.ts` 支持单子目录自动链式展开（最多 8 层），并对二进制/超大文件通过 `BinaryOrLargeFileNotice.tsx` 呈现安全元数据卡片。

---

## 6. 测试产物查看指南

测试运行完毕后，可在 `test/reports/` 下查看生成的自动化报告截图（涵盖 `01` ~ `25` 全模块场景）：
- **Git 提交工作台视图**：[01_git_workbench.png](file:///d:/projects/OmniGit/test/reports/01_git_workbench.png)
- **源码资源管理器与 Monaco 编辑器视图**：[02_explorer_editor.png](file:///d:/projects/OmniGit/test/reports/02_explorer_editor.png)
- **工作空间自定义研发门户与态势大盘**：[09_workspace_dashboard.png](file:///d:/projects/OmniGit/test/reports/09_workspace_dashboard.png)
- **微服务一次性任务脚本完成状态**：[21_services_task_completed.png](file:///d:/projects/OmniGit/test/reports/21_services_task_completed.png)
- **Data Tools 多窗口标签与双栏并排对比**：[22_data_tools_multi_window.png](file:///d:/projects/OmniGit/test/reports/22_data_tools_multi_window.png)
- **资源管理器全文件展示与 `.gitignore` 显隐切换**：[24_workspace_explorer_all_files.png](file:///d:/projects/OmniGit/test/reports/24_workspace_explorer_all_files.png) / [25_workspace_explorer_hide_ignored.png](file:///d:/projects/OmniGit/test/reports/25_workspace_explorer_hide_ignored.png)
