# 跨平台路径与文件系统兼容开发防线指南 (Cross-Platform Path Protocol)

> **核心目标**：OmniGit 作为原生跨平台（Windows、macOS、Linux 及 Web）运行的开发者工作台，必须在底层严密抹平各操作系统之间的路径差异、字符转义差异与大小写差异，坚决杜绝因路径处理不当导致的“找不到文件”、“文件内容空白”、“工作区记录丢失”等灾难性问题。

---

## 一、 历史踩坑与根本原因深度复盘 (Postmortem & Pitfalls)

### 坑 1：Windows 反斜杠被误当成 C 语言控制字符转义（致命：非 md 文件内容空白）
- **现象**：打开位于 `farmland...`、`app...`、`tests...` 等目录下的源码文件时，Monaco 编辑器内容为一片空白，只有行号 1。
- **根因**：
  - Git CLI 在 `core.quotepath = true` 时，会对非 ASCII 字符以八进制形式输出，并用双引号包裹整个路径（如 `"\"\\346\\265...\""`）。
  - 解码工具 `decodeGitPath()` 在分支判断时出现致命漏洞：若路径没有被双引号包裹，但包含反斜杠（所有标准的 Windows 路径均包含反斜杠），代码依然进入了 C 转义解析循环。
  - 循环中把 `\f`（如 `\farmland`）解析成了 ASCII 12（换页符 `\x0c`），把 `\a`（如 `\app`）解析成了 ASCII 7（响铃符 `\x07`），把 `\t`（如 `\tests`）解析成了制表符 `\x09`。
  - 路径被篡改后，Node 端 `fs.existsSync()` 失败，抛出 500 报错，前端 Monaco 编辑器静默赋空字符串，造成空白白板。

### 坑 2：异步读取失败触发破坏性覆盖存储（致命：切换工作空间后打开的文件被静默删除）
- **现象**：用户在工作区打开了若干文件，切换到其他工作空间再切回来，之前打开的文件全部消失了。
- **根因**：
  - 在 `useEditorTabsStore.ts` 的 `restorePersistedTabs` 恢复函数中，异步请求 `/api/fs/read` 恢复各个 Tab 内容；
  - 若某个文件因网络抖动或路径错误读取失败，函数直接将其从结果中过滤剔除（`filter(t => t !== null)`）；
  - 紧接着，代码将这个**被剔除了文件的残缺列表立即写回了 localStorage**（`get().savePersistedTabs(workspaceId)`），导致用户原本保存的打开文件记录被永久、不可逆地从磁盘上抹除！

### 坑 3：操作系统绝对物理路径与 Git CLI 相对路径职责混淆
- **现象**：后端文件系统接口（`/api/fs/read`、`/api/fs/raw`）对前端传来的完整物理路径误调用了针对 Git 相对路径的 `decodeGitPath`。
- **根因**：没有理清数据边界。前端文件资源树操作的是**操作系统实际物理绝对路径**；而 Git 命令输出解析的是 **Git 仓库内部的相对路径**。两者绝对不能混同调用相同的解码函数。

### 坑 4：Windows 盘符大小写与路径斜杠方向不一致（冷启动工作区空白）
- **现象**：冷启动时本地磁盘返回 `D:\projects\...`，缓存或 URL 中为 `d:\projects\...`，比对时用 `===` 导致完全匹配不上，误判为空工作区。
- **根因**：未在入口处统一执行 `normalizePath()`（统一转换为正斜杠 `/`、去除末尾斜杠、统一小写进行比较）。

---

## 二、 跨平台路径处理核心铁律 (Non-Negotiable Rules)

### 铁律 1：绝对物理路径享有最高优先级保护 (Physical Path First Guard)
无论在任何操作系统，只要路径是操作系统绝对物理路径，**绝不进行任何 Git C 语言转义解析**：
- Windows 盘符路径：`^[a-zA-Z]:[/\\]`（如 `C:\...` 或 `d:/...`）
- Windows UNC 网络路径：`^\\\\`（如 `\\server\share\...`）
- macOS / Linux POSIX 绝对路径：`^\/`（如 `/Users/...`, `/home/...`）

> **实施规范**：在 `decodeGitPath()` 第一行必须放置三端绝对物理路径守卫。如果被意外包裹了首尾双引号，仅剥离首尾双引号，原样返回真实路径。

### 铁律 2：仅当且仅当首尾带双引号时，才解 Git C-Quoted 转义
- Git 官方规范规定：**只有当输出内容存在转义时，整条路径才会用双引号包裹**。
- 如果字符串两端没有双引号 `"`，它就**绝对没有**经过 Git 的 C-Quote 编码。
- 绝不能无条件将包含 `\` 的普通路径送入控制字符转义循环（严禁把 `\f`, `\a`, `\t`, `\r`, `\n`, `\b`, `\v` 等普通反斜杠误转为 ASCII 控制符）。

### 铁律 3：职责分离原则——物理文件 API 绝不调用 Git 相对路径解码器
- `/api/fs/read`、`/api/fs/write`、`/api/fs/raw`、`/api/fs/stat`：接收的是操作系统物理路径，直接使用 `path.resolve()` 处理，严禁调用 `decodeGitPath`。
- `git status`、`git diff`、`git log` 的解析层：接收的是 Git CLI 相对路径，才允许调用 `decodeGitPath`。

### 铁律 4：非破坏性持久化原则 (Non-Destructive Persistence)
- 任何处于水合、恢复、后台同步阶段的异步流程，**如果遇到单项读取失败或网络抖动，坚决禁止将该项从持久化数据中删除**！
- 必须完整保留该项的元数据（`filePath`, `fileName`, `repoName` 等），标记错误状态（`readError`）供用户查看与重试，**只有当用户显式点击“关闭/删除”按钮时，才允许从持久化记录中移除**！

### 铁律 5：路径比较与存储分离原则
- **内存比对 / Map 键值查找**：使用 `normalizePath(p)`（统一反斜杠转为正斜杠 `/`、去除尾端斜杠、统一转小写进行匹配比对）；
- **物理执行 / 磁盘存储 / 界面展示**：**必须完整保留原样路径（Case-Preserving）**，严禁用小写路径覆盖实际文件系统路径，以完全兼容 Linux（严格大小写敏感）与 macOS。

---

## 三、 标准代码范式与工具函数 (Standard Patterns)

### 1. `decodeGitPath` 标准实现规范 ([`app/src/utils/gitPathUtils.ts`](../app/src/utils/gitPathUtils.ts))
```ts
export function decodeGitPath(rawPath: string): string {
  if (!rawPath) return '';
  let str = rawPath.trim();

  // 1. 三端物理绝对路径最高优先级保护
  if (/^[a-zA-Z]:[/\\]/.test(str) || str.startsWith('\\\\') || str.startsWith('/')) {
    if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
      return str.slice(1, -1);
    }
    return str;
  }

  // 2. 仅当被双引号包裹时才是 Git C-Quoted 路径
  const isQuoted = str.startsWith('"') && str.endsWith('"') && str.length >= 2;
  if (isQuoted) {
    str = str.slice(1, -1);
  } else {
    // 未带引号时，仅当明确包含 UTF-8 八进制序列 (\3xx) 时才放行，普通路径（如 \01_demo）直接返回
    if (!/\\3[0-7]{2}/.test(str)) return str;
  }

  // 3. 严格解析八进制序列与 \\, \", \n, \t, \r，绝不误伤路径反斜杠
  ...
}
```

### 2. 跨平台换行符（CRLF / LF）标准读写
- 在保存文本时使用 `fileEncodingService.writeFile(path, content, encoding, targetEol)`；
- 保持原文件的换行符（macOS / Linux 默认为 `LF`，Windows 默认为 `CRLF`），严禁无差别全量替换导致 Git 产生巨量换行符 diff。

### 3. 快捷键跨操作系统适配
- 监听键盘事件时，统一使用：
  ```ts
  const isCmdOrCtrl = e.ctrlKey || e.metaKey;
  ```
- Windows / Linux 用户触发 <kbd>Ctrl</kbd>，macOS 用户原生触发 <kbd>⌘ Command</kbd>（`metaKey`），体验无缝一致。
