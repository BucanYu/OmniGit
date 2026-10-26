import type { WorkspaceDashboardConfig } from '../../store/types';

export type { WorkspaceDashboardConfig };

/**
 * .omnigit/dashboard.json 团队协同配置文件规范定义
 */
export interface TeamDashboardJsonConfig extends WorkspaceDashboardConfig {
  $schema?: string;
  version?: string;
  updatedAt?: string;
  author?: string;
}

/**
 * 嵌入页面 (Guest) 发送给 OmniGit 宿主 (Host) 的受控受限消息
 * 【最高安全准则】：严禁任何执行系统命令或终端代码的载荷
 */
export type DashboardGuestMessageType =
  | 'omnigit:navigate'
  | 'omnigit:open-file'
  | 'omnigit:sync-all'
  | 'omnigit:get-workspace-info';

export interface DashboardGuestMessage<T = any> {
  source: 'omnigit-guest';
  token: string; // 单次会话鉴权令牌，强校验匹配
  type: DashboardGuestMessageType;
  payload?: T;
}

export interface DashboardNavigatePayload {
  mode: 'git' | 'explorer' | 'services' | 'dashboard';
  projectId?: string;
  repoName?: string;
}

export interface DashboardOpenFilePayload {
  filePath: string;
  line?: number;
}

/**
 * OmniGit 宿主 (Host) 向嵌入页面 (Guest) 广播的环境脱敏元数据
 */
export interface DashboardHostStateUpdatePayload {
  theme: string;
  workspace: {
    id: string;
    name: string;
    repos: Array<{
      name: string;
      branch?: string;
      uncommittedCount?: number;
      incoming?: number;
      outgoing?: number;
    }>;
  };
}

export interface DashboardHostMessage<T = any> {
  source: 'omnigit-host';
  type: 'omnigit:state-update';
  payload: T;
}
