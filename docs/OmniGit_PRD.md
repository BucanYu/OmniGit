# OmniGit - 产品需求与架构设计文档 (PRD)

## 1. 项目背景与目标 (Background & Goals)
- **背景**: 随着AI时代复合项目的增多，开发者经常需要同时管理多个Git项目。现有的IDEA自带Git工具虽然体验优秀，但资源开销较大，且多仓库统筹管理不便。
- **目标**: 开发一款轻量级、高性能的桌面版Git客户端。首发Windows，架构原生支持跨平台。核心交互体验严格对标并深度还原IDEA的Git模块（尤其是提交面板与分支同步指示器），成为开发者的首选 Git GUI。

## 2. 核心原则与技术架构 (Core Architecture)
- **底层架构**: **纯 GUI 包装器 (Thin Wrapper)**。不魔改底层，通过极速执行和解析 Git CLI 命令实现。
- **技术栈选型**: **Electron 30 + 前端 React 18 + Tailwind CSS + Zustand + 原生 Git CLI**。
- **环境隔离要求**: 采用独立沙箱架构，零侵入、零污染宿主环境全局 PATH。
- **服务端口与脚本**: 开发服务固定绑定专属端口 **`5345`**，并在独立的 `scripts/` 目录下统一提供英文命名的启停脚本（`start_dev.bat`, `stop_dev.bat`, `start_dev.ps1`, `stop_dev.ps1`）。

## 3. UI/UX 布局设计 (UI Layout) - 深度对标 IDEA
根据用户提供的 IDEA 实际工作流界面截图，重点深度复刻以下两大核心交互区域：

### 3.1 左侧提交工作台 (IDEA 风格 Commit Tool Window)
- **顶部双 Tab**: `Commit`（主提交面板）与 `Shelf`（暂存货架/搁置更改）。
- **快捷工具栏**:
  - `Rollback (撤销/回滚修改)`
  - `Refresh (刷新状态)`
  - `Diff (查看差异对比)`
  - `Expand All / Collapse All (全部展开/折叠)`
- **树形文件分组 (分层折叠与独立全选 Checkbox)**:
  - **`Changes (X files)` 分组**: 已追踪的文件修改，包含状态标识（`M` 蓝色修改、`A` 绿色新增、`D` 红色删除）。文件名高亮，相对路径在右侧灰字展示。
  - **`Unversioned Files (Y files)` 分组**: 未追踪的新文件（带 `?` 或未版本控制标记），勾选可一键纳入提交。
- **提交控制区**:
  - `Amend last commit` 复选框（支持修改上次提交）。
  - 历史提交信息回溯按钮（时钟图标）。
  - 统计摘要栏：实时显示例如 `1 added, 7 modified`。
  - 提交信息输入框（多行、代码字体）。
  - 底部双操作按钮：`Commit`（仅本地提交）与 `Commit and Push...`（提交并立即推送到远端）。

### 3.2 顶部项目与分支流转中心 (Branch & Sync Widget)
- **分支状态胶囊按钮**: 顶部常驻显示 `[当前项目] dev v`。
- **代码未更新提示 (Sync Status Badge)**:
  - 实时检测并展示与远端的落后/超前提交数：
    - `↙ 1` (Incoming / 远端有 1 个新提交未拉取 -> 明确提示用户“有未更新的代码”)
    - `↗ 9` (Outgoing / 本地有 9 个提交尚未推送)
- **点击弹出式分支面板 (IDEA 原生级分支菜单)**:
  - 顶部快速检索框：`Search for branches and actions`。
  - 快捷操作集：
    - `Update Project... (Ctrl+T)`（一键拉取合并，带更新图标）
    - `Commit... (Ctrl+K)`
    - `Push... (Ctrl+Shift+K)`
    - `+ New Branch... (Ctrl+Alt+N)`
    - `Checkout Tag or Revision...`
  - 分支列表分层展示：
    - `Recent`（最近分支，支持收藏置顶 ☆，带远端追踪 `origin/dev >`）
    - `Local`（本地分支列表）
    - `Remote`（远端分支列表）
- **分支精炼二级动作菜单 (Flyout Action Menu - 提炼高频 4 项，告别繁冗)**:
  - 悬停或点击某一分支时，弹出最常用的核心操作：
    - **`Checkout`**（一键切换到该分支）
    - **`Merge into '<current>'`**（合并到当前分支）
    - **`Compare with '<current>'`**（与当前分支差异对比）
    - **`Delete`**（删除分支，带确认）
- **操作完成反馈气泡 (Toast Notification)**:
  - 界面右下角弹出轻量通知，如 `12 files updated in 9 commits (View Commits)` 或 `Switched to branch 'dev'`.

## 4. 核心功能与深水区方案 (Core Features & Deep Dives)
- **未更新代码检测算法 (Incoming/Outgoing)**:
  - 后台静默执行 `git fetch`，随后利用 `git rev-list --left-right --count HEAD...@{upstream}` 计算本地与远程的分支差异计数。
  - 当检测到 `incoming > 0` 时，在分支按钮及中间操作栏给予醒目的呼吸灯/角标提示。
- **安全撤销机制 (Rollback)**:
  - 支持对单个文件或勾选的多个文件执行撤销回滚（等同于 `git restore / git checkout`），执行前必须提供防误触确认弹窗。
- **自定义凭据管家 (Auth & Storage)**:
  - 拦截 Git 认证请求，弹出原生 GUI 密码框。独立加密存储。
- **顶级 Diff 视图**: 
  - 字词级精准高亮，且**可直接在右侧编辑**。

## 5. 讨论与决策记录 (Discussion Log)
- **[2026-09-08]**: 完成脚手架搭建、Rust D 盘迁移、端口 5345 配置与启停脚本归档。
- **[2026-09-09]**: 
  - 用户指导交互原则：“参考 IDEA 的好用习惯和布局，让切换零门槛，但不要死板照抄繁杂无用项”。
  - 苏格拉底式对齐决策落地：
    1. **未更新代码检测**：采用【选项 A】原生呼吸感方案。顶部分支胶囊常驻高亮 `dev ↙1`，支持快捷键 `Ctrl+T` 或点击一键更新；
    2. **文件列表展示形态**：采用【双模式兼备，默认扁平】。工具栏提供 Tree/List 切换图标，默认展示为 IDEA 截图中的“文件名突出高亮 + 相对路径灰字紧凑跟随”模式；
    3. **分支流转形态**：采用【选项 A】极简右飞二级菜单，保留核心 4 大高频动作（Checkout、Merge、Compare、Delete）。
  - **核心迭代决策**：彻底告别静态 mock 假数据，正式接入本机原生 Git CLI 引擎，直连本地真实代码目录与多仓库工程，同时深度重构 UI/UE 比例与文字排版，消除文字折行与间距失真。
  - **工作区多开与精准挑选决策**：左侧不直接灌入全部 17 个仓库，改为支持用户自主定制工作区；提供“本机扫描下拉挑选”与“父目录智能探测子仓库勾选导入”；支持客户端多开独立窗口（`?ws=...`），各窗口间项目配置与操作完全物理隔离。
