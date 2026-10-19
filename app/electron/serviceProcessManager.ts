import * as path from 'path';
import { app, ipcMain } from 'electron';
import {
  nodeServiceProcessManager,
  ServiceRunConfig,
  ActiveProcessRecord,
} from '../src/server/nodeServiceProcessManager';

export type { ServiceRunConfig, ActiveProcessRecord };

try {
  nodeServiceProcessManager.setCustomLockFilePath(
    path.join(app.getPath('userData'), 'active_service_pids.json')
  );
} catch {}

export const serviceProcessManager = nodeServiceProcessManager;

export function setupServiceIpcHandlers() {
  ipcMain.handle('services:start', (event, config: ServiceRunConfig) => {
    const sender = event.sender;
    return nodeServiceProcessManager.start(
      config,
      (serviceId, data, stream) => {
        if (!sender.isDestroyed()) {
          sender.send('services:log', { serviceId, data, stream });
        }
      },
      (serviceId, exitCode, signal) => {
        if (!sender.isDestroyed()) {
          sender.send('services:exit', { serviceId, exitCode, signal });
        }
      }
    );
  });

  ipcMain.handle('services:stop', (_event, serviceId: string) => {
    return { success: nodeServiceProcessManager.stop(serviceId) };
  });

  ipcMain.handle('services:stop-all', (_event, projectId?: string) => {
    const stoppedCount = nodeServiceProcessManager.stopAll(projectId);
    return { success: true, count: stoppedCount };
  });

  ipcMain.handle('services:get-running', (_event, projectId?: string) => {
    return nodeServiceProcessManager.getRunningServices(projectId);
  });

  ipcMain.handle('services:check-orphans', () => {
    return nodeServiceProcessManager.checkAndCleanOrphanProcesses();
  });

  ipcMain.handle('services:scan-scripts', (_event, projectPath: string) => {
    return nodeServiceProcessManager.scanProjectScripts(projectPath);
  });
}
