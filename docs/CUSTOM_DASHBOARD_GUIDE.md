# OmniGit 工作空间自定义研发门户与系统联动交互完整开发指南
*(OmniGit Custom Workspace Portal & OmniGitBridge Interaction Guide)*

> 适用版本：OmniGit v0.6.0+  
> 目标读者：人类研发工程师 (Frontend/Fullstack Developers)、AI 编程助手 (Cursor, GitHub Copilot, Claude Code, Gemini CLI, Windsurf 等)

---

## 目录
1. [一、设计背景与总体架构](#一设计背景与总体架构)
2. [二、四大典型落地应用场景](#二四大典型落地应用场景)
   - [场景 1：本地实时开发预览端口](#场景-1本地实时开发预览端口)
   - [场景 2：自研技术规范与 API 文档站点](#场景-2自研技术规范与-api-文档站点)
   - [场景 3：本地单页应用构建产物 (静态 SPA)](#场景-3本地单页应用构建产物-静态-spa)
   - [场景 4：团队敏捷项目看板](#场景-4团队敏捷项目看板)
3. [三、团队工程配置共享规范 (.omnigit/dashboard.json)](#三团队工程配置共享规范-omnigitdashboardjson)
4. [四、核心通信协议与系统联动交互 (OmniGitBridge)](#四核心通信协议与系统联动交互-omnigitbridge)
   - [1. 会话令牌与鉴权握手](#1-会话令牌与鉴权握手)
   - [2. 消息信封规范](#2-消息信封规范)
   - [3. API 1：获取工作空间全景态势 (omnigit:get-workspace-info)](#3-api-1获取工作空间全景态势-omnigitget-workspace-info)
   - [4. API 2：跳转至 OmniGit 核心工作台 (omnigit:navigate)](#4-api-2跳转至-omnigit-核心工作台-omnigitnavigate)
   - [5. API 3：在内置 Monaco 编辑器中定位打开文件 (omnigit:open-file)](#5-api-3在内置-monaco-编辑器中定位打开文件-omnigitopen-file)
   - [6. API 4：触发全量 Git 状态刷新 (omnigit:sync-all)](#6-api-4触发全量-git-状态刷新-omnigitsync-all)
   - [7. 宿主状态主动广播 (omnigit:state-update)](#7-宿主状态主动广播-omnigitstate-update)
5. [五、开箱即用极简 SDK (omnigit-bridge-client.js)](#五开箱即用极简-sdk-omnigit-bridge-clientjs)
6. [六、单文件完整自研看板演示模板 (standalone-portal-demo.html)](#六单文件完整自研看板演示模板-standalone-portal-demohtml)
7. [七、面向 AI 编程助手的专属提示词模板 (AI Prompt)](#七面向-ai-编程助手的专属提示词模板-ai-prompt)
8. [八、安全防护红线与最佳实践 (Security Redlines)](#八安全防护红线与最佳实践-security-redlines)

---

## 一、设计背景与总体架构

OmniGit 在 v0.6.0 正式引入了**“工作空间自定义研发门户 (Workspace Custom Dashboard)”**微前端宿主能力。

在复杂多仓库协作或中大型微服务研发中，每个项目组往往都有自己的本地脚手架、接口文档中心、代码规范看板或专项流水线。OmniGit 允许每个工程工作空间将其嵌入为研发首页（快捷键 `Alt + 0`），并提供安全的双向通信桥接（`OmniGitBridge`），将原本割裂的外部网页或自研前端与 OmniGit 宿主能力（多仓库 Git 提交、Monaco 编辑器、终端、微服务编排）深度联动。

```
+-----------------------------------------------------------------------------------+
|                              OmniGit Host (Electron / Web)                        |
|                                                                                   |
|  [Alt+0] 研发首页        [Alt+1] Git提交        [Alt+2] 资源管理器     [Alt+3] 微服务   |
|  +-----------------------------------------------------------------------------+  |
|  |  Embedded Sandbox Iframe (Microfrontend Portal)                             |  |
|  |                                                                             |  |
|  |   [本地开发服务 / VitePress文档 / SPA静态产物 / Jira看板]                   |  |
|  |                                                                             |  |
|  |     ↕ postMessage (Token 鉴权 + 零信任只读 RPC)                             |  |
|  |                                                                             |  |
|  |   [OmniGitBridge]                                                           |  |
|  +-----------------------------------------------------------------------------+  |
|         ↓                            ↓                           ↓                |
|   切到指定仓库提交 (Git)         定位代码高亮 (Monaco)         读取多仓健康态势 (Store)  |
+-----------------------------------------------------------------------------------+
```

---

## 二、四大典型落地应用场景

在 OmniGit 首页大盘的**“让每个工程工作空间拥有专属自研门户”**引导卡片中，预置了四种最高频的落地场景：

### 场景 1：本地实时开发预览端口
- **典型场景**：Next.js、Vite、Vue CLI、Webpack、Nuxt 等前端服务在本地运行（如 `http://localhost:3000` 或 `http://localhost:5173`）。
- **核心价值**：开发者无需在外部浏览器与 IDE 之间反复切换，在 OmniGit 工作台内即可直观预览页面改动，HMR（热模块替换）实时生效。
- **配置方式**：
  1. 类型选择：`远程/本地 Web 链接 (URL)`；
  2. 访问地址：填入 `http://localhost:3000` 或对应端口；
  3. 勾选 `开启宿主微前端通信联动 (OmniGitBridge)`。

### 场景 2：自研技术规范与 API 文档站点
- **典型场景**：工程自建的 VitePress、Docusaurus、Swagger UI、Redoc、Storybook 组件库或开发规范站点。
- **核心价值**：边查接口契约边写代码，边查组件库 API 边做业务实现，零上下文切换损耗。
- **配置方式**：
  - 若为在线/内网服务：填入对应 HTTP/HTTPS 链接；
  - 若为本地编译构建目录：选择 `本地自研 HTML 构建产物`，路径指定为 `./docs/.vitepress/dist/index.html`。

### 场景 3：本地单页应用构建产物 (静态 SPA)
- **典型场景**：团队专属自研的工程监控大盘、代码质量扫描报告、全景部署看板（编译输出在 `./dist/index.html` 或 `./dashboard/index.html`）。
- **运行机制**：OmniGit 内置了安全回环静态挂载路由 `/api/workspace/dashboard-serve/:workspaceId/*`，不仅支持单页应用无服务托管，还会**智能动态注入 `<base>` 标签**，彻底解决静态 SPA 因相对路径（`./assets/...`）引用导致资源 404 白屏的行业通病！
- **配置方式**：
  1. 类型选择：`本地自研 HTML 构建产物`；
  2. 填入或点击“浏览文件”选中构建产物的 `index.html`。

### 场景 4：团队敏捷项目看板
- **典型场景**：Jira、TAPD、飞书项目、PingCode、GitLab Issue Board、禅道等团队任务流转系统。
- **核心价值**：直接在代码工作台内认领需求、关联 Bug 单、核对验收标准。
- **配置方式**：
  1. 填入看板 Web 链接；
  2. 范围选择：`保存为团队工程配置 (.omnigit/dashboard.json)`。

---

## 三、团队工程配置共享规范 (.omnigit/dashboard.json)

为了避免每位团队成员重复手动配置，OmniGit 支持**“团队级配置文件”**。只要在工作空间根目录下建立 `.omnigit/dashboard.json` 并提交到 Git，团队全员拉取代码后即可自动统一首页！

### 完整 Schema 结构示例

```json
{
  "$schema": "https://omnigit.dev/schemas/dashboard-v1.json",
  "version": "1.0.0",
  "enabled": true,
  "type": "url",
  "url": "http://localhost:3000",
  "filePath": "",
  "title": "前端工程专属研发门户",
  "openMode": "embedded",
  "autoReload": false,
  "reloadIntervalSeconds": 60,
  "enableBridge": true,
  "updatedAt": "2026-10-26T10:00:00.000Z",
  "author": "team-lead"
}
```

### 字段说明表

| 字段名 | 类型 | 必填 | 默认值 | 作用说明 |
| :--- | :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | 是 | `true` | 是否启用该自定义首页（设为 `false` 则回退为 OmniGit 默认态势大盘） |
| `type` | `'url' \| 'file'` | 是 | `'url'` | 门户类型：`url` 表示远程/本地网络链接；`file` 表示本地 HTML 静态构建产物 |
| `url` | `string` | 当 type=url | `""` | 目标 Web 服务地址（如 `http://localhost:3000`） |
| `filePath` | `string` | 当 type=file | `""` | 本地 HTML 文件的绝对路径或工作空间相对路径（如 `./dist/index.html`） |
| `title` | `string` | 否 | `""` | 顶部微前端操作条显示的自研门户标题，若为空则显示页面自身 title |
| `openMode` | `'embedded'` | 否 | `'embedded'` | 挂载模式，目前固定为内置沙箱（`embedded`） |
| `autoReload` | `boolean` | 否 | `false` | 是否开启定时静默刷新（适合监控大盘） |
| `reloadIntervalSeconds` | `number` | 否 | `60` | 静默刷新周期（秒），最小值限制为 5 秒 |
| `enableBridge` | `boolean` | 否 | `true` | 是否启用双向通信桥接（`OmniGitBridge`） |

---

## 四、核心通信协议与系统联动交互 (OmniGitBridge)

嵌入的自研门户若想与 OmniGit 发生“化学反应”（例如：点击按钮打开指定代码文件、点击仓库卡片进入 Git 提交面板、根据宿主黑白主题自适应），必须遵循 **OmniGitBridge 通信协议**。

### 1. 会话令牌与鉴权握手
- **Token 注入**：每次挂载 iframe 时，OmniGit 宿主都会生成一个强随机单次会话令牌（Session Token），并通过 URL Hash 传递给嵌入页面：
  ```
  http://localhost:3000/#omnigitToken=a4f78c12-3490-4e12-b210-91a6d459021b
  ```
- **Token 提取**：嵌入页面初始化时，直接从 `window.location.hash` 中提取 `omnigitToken`：
  ```js
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const omnigitToken = hashParams.get('omnigitToken');
  ```

### 2. 消息信封规范
所有嵌入页面发往 OmniGit 宿主的消息，必须使用 `window.parent.postMessage`，其结构为标准 `DashboardGuestMessage`：
```ts
interface DashboardGuestMessage {
  source: 'omnigit-guest';   // 固定签名，宿主强校验
  token: string;             // 必须携带从 Hash 提取的 omnigitToken
  type: string;              // 消息动作类型
  payload?: any;             // 业务参数
}
```

---

### 3. API 1：获取工作空间全景态势 (omnigit:get-workspace-info)
向宿主索取当前工作空间的工程、多仓库状态以及当前系统主题色。

#### 子页面发送：
```js
window.parent.postMessage({
  source: 'omnigit-guest',
  token: omnigitToken,
  type: 'omnigit:get-workspace-info'
}, '*');
```

#### 宿主返回消息 (`omnigit:state-update`)：
```json
{
  "source": "omnigit-host",
  "type": "omnigit:state-update",
  "payload": {
    "theme": "darcula",
    "workspace": {
      "id": "ws_1789365574398",
      "name": "farmland-engineer-quality-inspect",
      "repos": [
        {
          "name": "land-quality-sys-web",
          "branch": "dev",
          "uncommittedCount": 3,
          "incoming": 1,
          "outgoing": 0
        },
        {
          "name": "land-quality-sys",
          "branch": "dev",
          "uncommittedCount": 0,
          "incoming": 0,
          "outgoing": 0
        }
      ]
    }
  }
}
```

---

### 4. API 2：跳转至 OmniGit 核心工作台 (omnigit:navigate)
通知宿主切换主工作台模式，支持直接激活特定子仓库！

#### 载荷参数：
- `mode`: `'git' | 'explorer' | 'services' | 'dashboard'`
- `repoName`: *(可选)* 指定激活的工程仓库名称（如 `'land-quality-sys-web'`）
- `projectId`: *(可选)* 指定激活的工程仓库 ID

#### 示例：点击进入特定仓库的 Git 提交工作台
```js
window.parent.postMessage({
  source: 'omnigit-guest',
  token: omnigitToken,
  type: 'omnigit:navigate',
  payload: {
    mode: 'git',
    repoName: 'land-quality-sys-web'
  }
}, '*');
```

---

### 5. API 3：在内置 Monaco 编辑器中定位打开文件 (omnigit:open-file)
通知 OmniGit 在内置 Monaco 编辑器中打开当前工程的某份代码文件，并自动切换到资源管理器视图（`Alt + 2`）。

> [!SECURITY]
> **沙箱防路径穿越**：参数仅支持工作空间或当前仓库内的**相对路径**（如 `src/App.vue`、`package.json`）。任何带有 `..` 或跳出工作空间根目录的路径都将被宿主安全拦截并记录告警。

#### 示例：一键打开配置文件
```js
window.parent.postMessage({
  source: 'omnigit-guest',
  token: omnigitToken,
  type: 'omnigit:open-file',
  payload: {
    filePath: 'src/main.ts'
  }
}, '*');
```

---

### 6. API 4：触发全量 Git 状态刷新 (omnigit:sync-all)
触发宿主后台对工作空间内所有工程仓库执行 `git status` 状态轮询，刷新各仓库的未提交修改、待推与待拉取数量。

#### 示例：
```js
window.parent.postMessage({
  source: 'omnigit-guest',
  token: omnigitToken,
  type: 'omnigit:sync-all'
}, '*');
```

---

### 7. 宿主状态主动广播 (omnigit:state-update)
当用户在 OmniGit 顶栏切换了主题色（如 `darcula` -> `idea-light`），OmniGit 宿主会主动向 iframe 广播更新事件。子应用监听此事件即可实现零闪烁跟随换肤：

```js
window.addEventListener('message', (event) => {
  if (event.data?.source !== 'omnigit-host') return;
  if (event.data?.type === 'omnigit:state-update') {
    const { theme, workspace } = event.data.payload;
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme.includes('light')) {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }
  }
});
```

---

## 五、开箱即用极简 SDK (omnigit-bridge-client.js)

为了让开发者无需每次手写 `postMessage` 与 Token 校验，本指南提供一份纯原生、零依赖的极简通用客户端 SDK：

```js
/**
 * omnigit-bridge-client.js
 * OmniGit 微前端嵌入页面极简官方 SDK
 */
export class OmniGitBridgeClient {
  constructor() {
    this.token = this._extractToken();
    this.isEmbedded = window.parent !== window && Boolean(this.token);
    this.listeners = new Set();

    if (this.isEmbedded) {
      window.addEventListener('message', (e) => {
        if (e.data?.source === 'omnigit-host') {
          this.listeners.forEach((fn) => fn(e.data));
        }
      });
    }
  }

  _extractToken() {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    return params.get('omnigitToken') || '';
  }

  // 1. 发送受控消息
  send(type, payload = {}) {
    if (!this.isEmbedded) {
      console.warn('[OmniGitBridge] Page is not running inside OmniGit host.');
      return;
    }
    window.parent.postMessage({
      source: 'omnigit-guest',
      token: this.token,
      type,
      payload
    }, '*');
  }

  // 2. 快捷方法：跳转工作台
  navigateTo(mode, repoName) {
    this.send('omnigit:navigate', { mode, repoName });
  }

  // 3. 快捷方法：打开代码文件
  openFile(filePath) {
    this.send('omnigit:open-file', { filePath });
  }

  // 4. 快捷方法：触发全量状态同步
  syncAll() {
    this.send('omnigit:sync-all');
  }

  // 5. 快捷方法：索取工作空间元数据
  getWorkspaceInfo() {
    this.send('omnigit:get-workspace-info');
  }

  // 6. 监听宿主状态更新（如主题切换、工作区信息）
  onStateUpdate(callback) {
    const handler = (msg) => {
      if (msg.type === 'omnigit:state-update') {
        callback(msg.payload);
      }
    };
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }
}
```

---

## 六、单文件完整自研看板演示模板 (standalone-portal-demo.html)

这是一个**可以直接双击运行，也可直接作为 `./dist/index.html` 嵌入的自研看板原型模版**：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>团队研发专属门户</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root { --bg: #ffffff; --text: #0f172a; --card: #f8fafc; --border: #e2e8f0; }
    html.dark { --bg: #1a1b1f; --text: #f1f3f7; --card: #26282e; --border: #383b44; }
    body { background-color: var(--bg); color: var(--text); }
  </style>
</head>
<body class="p-6 font-sans select-none">
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between pb-4 border-b border-[var(--border)]">
      <div>
        <h1 class="text-xl font-bold tracking-tight">🚀 研发团队专属综合态势看板</h1>
        <p class="text-xs text-gray-500 mt-1" id="ws-desc">正在连接 OmniGit 宿主微前端桥接...</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-sync" class="px-3 py-1.5 text-xs rounded bg-sky-500 hover:bg-sky-400 text-white font-medium">
          🔄 刷新状态
        </button>
      </div>
    </div>

    <!-- Quick Shortcuts -->
    <div class="grid grid-cols-3 gap-3">
      <div onclick="openReadme()" class="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-sky-500 cursor-pointer transition">
        <div class="text-sm font-semibold">📖 项目开发规范</div>
        <p class="text-xs text-gray-400 mt-1">在内置编辑器打开 README.md</p>
      </div>
      <div onclick="openPackage()" class="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-sky-500 cursor-pointer transition">
        <div class="text-sm font-semibold">📦 依赖清单</div>
        <p class="text-xs text-gray-400 mt-1">在内置编辑器打开 package.json</p>
      </div>
      <div onclick="jumpGit()" class="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-sky-500 cursor-pointer transition">
        <div class="text-sm font-semibold">⚡ Git 快速提交</div>
        <p class="text-xs text-gray-400 mt-1">跳转至当前仓库提交工作台</p>
      </div>
    </div>

    <!-- Repos List from OmniGit Host -->
    <div>
      <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">工作空间活跃工程</h2>
      <div id="repos-container" class="grid grid-cols-2 gap-3">
        <div class="p-4 rounded-xl border border-[var(--border)] text-xs text-gray-400">正在拉取多仓库信息...</div>
      </div>
    </div>
  </div>

  <script>
    // 1. 提取 Token
    const hash = window.location.hash.replace(/^#/, '');
    const token = new URLSearchParams(hash).get('omnigitToken');

    function send(type, payload = {}) {
      if (window.parent && token) {
        window.parent.postMessage({ source: 'omnigit-guest', token, type, payload }, '*');
      }
    }

    function openReadme() { send('omnigit:open-file', { filePath: 'README.md' }); }
    function openPackage() { send('omnigit:open-file', { filePath: 'package.json' }); }
    function jumpGit(repoName) { send('omnigit:navigate', { mode: 'git', repoName }); }

    document.getElementById('btn-sync').onclick = () => {
      send('omnigit:sync-all');
      send('omnigit:get-workspace-info');
    };

    // 2. 监听宿主广播
    window.addEventListener('message', (e) => {
      if (e.data?.source !== 'omnigit-host') return;
      if (e.data?.type === 'omnigit:state-update') {
        const { theme, workspace } = e.data.payload;
        // 主题自适应
        if (theme) {
          if (theme.includes('light')) document.documentElement.classList.remove('dark');
          else document.documentElement.classList.add('dark');
        }
        // 渲染仓库列表
        if (workspace?.repos) {
          document.getElementById('ws-desc').innerText = `已连接工作空间：${workspace.name}`;
          const container = document.getElementById('repos-container');
          container.innerHTML = workspace.repos.map(r => `
            <div class="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-between">
              <div>
                <div class="text-xs font-bold">${r.name}</div>
                <div class="text-[11px] text-gray-400 mt-0.5">分支：${r.branch || 'HEAD'} · 未提：${r.uncommittedCount}</div>
              </div>
              <button onclick="jumpGit('${r.name}')" class="px-2.5 py-1 text-xs bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 rounded">
                去提交
              </button>
            </div>
          `).join('');
        }
      }
    });

    // 3. 页面就绪后立即索取一次工作区数据
    send('omnigit:get-workspace-info');
  </script>
</body>
</html>
```

---

## 七、面向 AI 编程助手的专属提示词模板 (AI Prompt)

当您或团队成员想使用 **Cursor, GitHub Copilot, Claude Code, Gemini CLI, ChatGPT** 快速为当前工程编写一个自定义研发大盘时，可直接复制以下 Prompt 模板：

```markdown
你现在是一名资深的前端微前端专家。我想为当前工程编写一个嵌入在 OmniGit (v0.6.0+) 中的专属自定义研发工作台门户 (Dashboard)。

请严格遵守以下【OmniGit 微前端受控通信规范】为我生成一个单文件 HTML 网页（或 React/Vue 独立组件）：

1. 【鉴权机制】：
   - 页面必须在启动时通过 `new URLSearchParams(window.location.hash.replace(/^#/, '')).get('omnigitToken')` 提取宿主注入的 `omnigitToken`。
   - 每次向宿主发送通信时，必须使用 `window.parent.postMessage({ source: 'omnigit-guest', token, type, payload }, '*')`。

2. 【允许使用的受控 RPC 接口】：
   - `omnigit:get-workspace-info`：向宿主索取当前工作区名、多工程仓库列表、各仓库分支与未提交变更数；
   - `omnigit:navigate`：让宿主跳转工作台，载荷格式 `{ mode: 'git' | 'explorer' | 'services', repoName?: string }`；
   - `omnigit:open-file`：在宿主内置 Monaco 编辑器中定位打开源码，载荷格式 `{ filePath: string }`（仅支持相对路径）；
   - `omnigit:sync-all`：触发宿主全量刷新 Git 状态。

3. 【监听宿主广播】：
   - 监听 `window.addEventListener('message', (e) => ...)`，当 `e.data.source === 'omnigit-host'` 且 `e.data.type === 'omnigit:state-update'` 时：
   - 根据 `e.data.payload.theme` 动态切换页面的明亮/暗黑主题样式；
   - 根据 `e.data.payload.workspace` 渲染多工程健康列表。

4. 【最高安全红线】：
   - 严禁尝试调用任何执行系统 Shell、Node.js child_process、原生终端命令的接口（OmniGit 实施零信任防护，此类接口绝对不存在且会被即刻拦截）。

请为我构建一个设计现代、高质感（支持 Tailwind CSS / 明暗主题无缝切换）的研发看板页面，包含核心快捷入口、仓库状态卡片和一键联动提交按钮。
```

---

## 八、安全防护红线与最佳实践 (Security Redlines)

针对嵌入第三方网页或外部服务可能带来的安全隐患，OmniGit 构筑了六大纵深防御护城河：

1. **绝对零代码/命令执行权**：`OmniGitBridge` 仅开放纯 UI 视图调度与安全只读文件跳转，绝对不提供任何进程执行或命令行调用通道；
2. **单次会话随机 Token**：防跨窗口 CSRF 与未授权 postMessage 嗅探；
3. **Iframe 沙箱权限最小化**：禁止 `allow-top-navigation`（防止恶意页面跳出覆盖主窗口）与 `allow-modals`（禁止伪造弹窗）；
4. **静态托管防穿越沙箱**：本地静态挂载服务对 `..`、系统敏感目录（如 `.ssh`、`.git/config`、`.env`）实施强制 `403` 拦截；
5. **公网 Origin 拦截**：对公网 IP 或外部域名嗅探本地回环静态端口一律返回 `403 Forbidden`；
6. **用户可插拔授权总开关**：嵌入公网或未知网址时，请在设置弹窗中取消勾选 `开启宿主微前端通信联动`。
