export const AI_PROMPT_TEMPLATE = `你现在是一名资深前端微前端专家。我想为当前工程编写一个嵌入在 OmniGit (v0.6.0+) 中的专属自定义研发工作台门户 (Dashboard)。

请严格遵守以下【OmniGit 微前端受控通信规范】为我生成一个单文件 HTML 网页（或 React/Vue 独立组件）：

1. 【鉴权机制】：
   - 页面必须在启动时通过 new URLSearchParams(window.location.hash.replace(/^#/, '')).get('omnigitToken') 提取宿主注入的 omnigitToken。
   - 每次向宿主发送通信时，必须使用 window.parent.postMessage({ source: 'omnigit-guest', token, type, payload }, '*')。

2. 【允许使用的受控 RPC 接口】：
   - omnigit:get-workspace-info：向宿主索取当前工作区名、多工程仓库列表、各仓库分支与未提交变更数；
   - omnigit:navigate：让宿主跳转工作台，载荷格式 { mode: 'git' | 'explorer' | 'services', repoName?: string }；
   - omnigit:open-file：在宿主内置 Monaco 编辑器中定位打开源码，载荷格式 { filePath: string }（仅支持相对路径）；
   - omnigit:sync-all：触发宿主全量刷新 Git 状态。

3. 【监听宿主广播】：
   - 监听 window.addEventListener('message', (e) => ...)，当 e.data.source === 'omnigit-host' 且 e.data.type === 'omnigit:state-update' 时：
   - 根据 e.data.payload.theme 动态切换页面的明亮/暗黑主题样式；
   - 根据 e.data.payload.workspace 渲染多工程健康列表。

4. 【最高安全红线】：
   - 严禁尝试调用任何执行系统 Shell、Node.js child_process、原生终端命令的接口（OmniGit 实施零信任防护，此类接口绝对不存在且会被即刻拦截）。

请为我构建一个设计现代、高质感（支持 Tailwind CSS / 明暗主题无缝切换）的研发看板页面，包含核心快捷入口、仓库状态卡片和一键联动提交按钮。`;

export const SDK_CODE_SNIPPET = `// 提取会话 Token
const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('omnigitToken');

// 向 OmniGit 宿主发送受控动作
function sendToOmniGit(type, payload = {}) {
  if (window.parent && token) {
    window.parent.postMessage({ source: 'omnigit-guest', token, type, payload }, '*');
  }
}

// 常用交互快捷函数
export const omnigit = {
  // 1. 跳转到指定仓库的 Git 提交面板
  jumpToGit: (repoName) => sendToOmniGit('omnigit:navigate', { mode: 'git', repoName }),
  // 2. 在内置 Monaco 编辑器中定位打开相对路径代码文件
  openFile: (filePath) => sendToOmniGit('omnigit:open-file', { filePath }),
  // 3. 索取工作空间多仓库健康状态与主题
  getWorkspaceInfo: () => sendToOmniGit('omnigit:get-workspace-info'),
  // 4. 触发全量 Git 状态刷新
  syncAll: () => sendToOmniGit('omnigit:sync-all'),
};

// 监听宿主广播（如明暗主题切换）
window.addEventListener('message', (e) => {
  if (e.data?.source !== 'omnigit-host') return;
  if (e.data?.type === 'omnigit:state-update') {
    const { theme, workspace } = e.data.payload;
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  }
});`;
