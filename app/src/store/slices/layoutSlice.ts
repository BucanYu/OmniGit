import type { AppTheme } from '../types';
import {
  broadcastWorkspaceChanged,
  safeLocalStorageSetItem,
  initialLanguage,
  initialTheme,
} from '../storeHelpers';
import type { AppLanguage } from '../../locales';

export const createLayoutSlice = (set: any, get: any) => ({
  language: initialLanguage,

  setLanguage: (lang: AppLanguage) => {
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_language', lang);
      document.documentElement.setAttribute('lang', lang);
    }
    set({ language: lang });
  },

  theme: initialTheme,

  setTheme: (theme: AppTheme) => {
    const safeTheme: AppTheme = (theme as any) === 'light' ? 'idea-light' : theme;
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_theme', safeTheme);
      document.documentElement.setAttribute('data-theme', safeTheme);
    }
    set({ theme: safeTheme });
    broadcastWorkspaceChanged();
  },

  notification: null,

  isAddRepoModalOpen: false,

  isSettingsModalOpen: false,

  sidebarWidth:
    typeof window !== 'undefined'
      ? Math.max(160, Math.min(500, parseInt(localStorage.getItem('omnigit_sidebar_width') || '256', 10)))
      : 256,

  statusPanelWidth:
    typeof window !== 'undefined'
      ? Math.max(
          240,
          Math.min(
            Math.max(240, window.innerWidth - 256 - 320),
            parseInt(localStorage.getItem('omnigit_status_width') || '380', 10)
          )
        )
      : 380,

  commitBoxHeight:
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem('omnigit_commit_box_height') || '190', 10)
      : 190,

  logInspectorHeight:
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem('omnigit_log_inspector_height') || '260', 10)
      : 260,

  logInspectorDetailsWidth:
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem('omnigit_log_inspector_details_width') || '240', 10)
      : 240,

  setSidebarWidth: (width: number) => {
    const maxAvailable = typeof window !== 'undefined' ? Math.max(160, window.innerWidth - 450) : 500;
    const clamped = Math.max(160, Math.min(Math.min(500, maxAvailable), width));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_sidebar_width', String(clamped));
    }
    set({ sidebarWidth: clamped });
  },

  setStatusPanelWidth: (width: number) => {
    const maxAvailable =
      typeof window !== 'undefined'
        ? Math.max(240, window.innerWidth - get().sidebarWidth - 320)
        : 1100;
    const clamped = Math.max(240, Math.min(Math.min(1100, maxAvailable), width));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_status_width', String(clamped));
    }
    set({ statusPanelWidth: clamped });
  },

  setCommitBoxHeight: (height: number) => {
    const clamped = Math.max(110, Math.min(480, height));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_commit_box_height', String(clamped));
    }
    set({ commitBoxHeight: clamped });
  },

  setLogInspectorHeight: (height: number) => {
    const clamped = Math.max(120, Math.min(600, height));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_log_inspector_height', String(clamped));
    }
    set({ logInspectorHeight: clamped });
  },

  setLogInspectorDetailsWidth: (width: number) => {
    const clamped = Math.max(140, Math.min(600, width));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_log_inspector_details_width', String(clamped));
    }
    set({ logInspectorDetailsWidth: clamped });
  },

  resetPanelWidths: () => {
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_sidebar_width', '256');
      safeLocalStorageSetItem('omnigit_status_width', '380');
      safeLocalStorageSetItem('omnigit_commit_box_height', '190');
      safeLocalStorageSetItem('omnigit_log_inspector_height', '260');
      safeLocalStorageSetItem('omnigit_log_inspector_details_width', '240');
    }
    set({
      sidebarWidth: 256,
      statusPanelWidth: 380,
      commitBoxHeight: 190,
      logInspectorHeight: 260,
      logInspectorDetailsWidth: 240,
    });
  },

  setIsAddRepoModalOpen: (open) => set({ isAddRepoModalOpen: open }),

  setIsSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),

  setNotification: (notif) => set({ notification: notif }),

  clearNotification: () => set({ notification: null })
});
