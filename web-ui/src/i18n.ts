import { create } from 'zustand';

export type Locale = 'en' | 'zh';

const STORAGE_KEY = 'remote_claude_locale';

const translations = {
  en: {
    appName: 'Remote Claude',
    languageEnglish: 'EN',
    languageChinese: '中文',

    signInSubtitle: 'Sign in to your account',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign In',
    signingIn: 'Signing in...',

    devices: 'Devices',
    sessions: 'SESSIONS',
    new: '+ New',
    newSessionTitle: 'New session',
    closeSessionTitle: 'Close session',
    logout: 'Logout',
    deleteSessionConfirm: 'Delete this session?',

    loadingDevices: 'Loading devices...',
    noDevices: 'No devices found. Make sure the desktop client is running and connected.',

    deviceDeleteConfirm: 'Delete device "{name}"? This cannot be undone.',
    deviceDeleted: 'Device "{name}" deleted',
    deviceDeleteFailed: 'Failed to delete device',
    deviceDeleteTitle: 'Delete {name}',
    busy: 'Busy',
    idle: 'Idle',
    online: 'Online',
    offline: 'Offline',

    sessionOnline: 'Online',
    sessionOffline: 'Offline',
    plusNewSession: '+ New Session',
    sessionNewTitle: 'New Session',
    workingDirPlaceholder: 'Working directory (optional, e.g. C:\\projects)',
    start: 'Start',
    cancel: 'Cancel',
    loadingSessions: 'Loading sessions...',
    noSessionsYet: 'No sessions yet. Click "+ New Session" to start.',
    defaultDirectory: 'default directory',
    deleteSessionTitle: 'Delete session',

    back: 'Back',
    connected: 'Connected',
    error: 'Error',
    disconnected: 'Disconnected',
    terminalSessionEnded: '[Session ended]',
    terminalErrorPrefix: 'Error',
    terminalBanner: 'Remote Claude Terminal',
    terminalStarting: 'Starting interactive Claude session...',
    connecting: 'Connecting...',

    errorBoundaryTitle: 'Something went wrong',
    unexpectedError: 'An unexpected error occurred',
    reload: 'Reload',

    loginFailed: 'login failed',
    fetchDevicesFailed: 'failed to fetch devices',
    deleteDeviceFailed: 'failed to delete device',
    fetchSessionsFailed: 'failed to fetch sessions',
    createSessionFailed: 'failed to create session',
    deleteSessionFailed: 'failed to delete session',
    connectFailed: 'failed to connect',
  },
  zh: {
    appName: 'Remote Claude',
    languageEnglish: 'EN',
    languageChinese: '中文',

    signInSubtitle: '登录到你的账号',
    username: '用户名',
    password: '密码',
    signIn: '登录',
    signingIn: '登录中...',

    devices: '设备',
    sessions: '会话',
    new: '+ 新建',
    newSessionTitle: '新建会话',
    closeSessionTitle: '关闭会话',
    logout: '退出登录',
    deleteSessionConfirm: '删除这个会话？',

    loadingDevices: '设备加载中...',
    noDevices: '未发现设备。请确认桌面端已启动并连接。',

    deviceDeleteConfirm: '删除设备“{name}”？此操作不可撤销。',
    deviceDeleted: '设备“{name}”已删除',
    deviceDeleteFailed: '删除设备失败',
    deviceDeleteTitle: '删除 {name}',
    busy: '忙碌',
    idle: '空闲',
    online: '在线',
    offline: '离线',

    sessionOnline: '在线',
    sessionOffline: '离线',
    plusNewSession: '+ 新建会话',
    sessionNewTitle: '新建会话',
    workingDirPlaceholder: '工作目录（可选，例如 C:\\projects）',
    start: '开始',
    cancel: '取消',
    loadingSessions: '会话加载中...',
    noSessionsYet: '还没有会话，点击“+ 新建会话”开始。',
    defaultDirectory: '默认目录',
    deleteSessionTitle: '删除会话',

    back: '返回',
    connected: '已连接',
    error: '错误',
    disconnected: '未连接',
    terminalSessionEnded: '[会话已结束]',
    terminalErrorPrefix: '错误',
    terminalBanner: 'Remote Claude 终端',
    terminalStarting: '正在启动 Claude 交互会话...',
    connecting: '连接中...',

    errorBoundaryTitle: '页面发生错误',
    unexpectedError: '出现了未预期的错误',
    reload: '重新加载',

    loginFailed: '登录失败',
    fetchDevicesFailed: '获取设备失败',
    deleteDeviceFailed: '删除设备失败',
    fetchSessionsFailed: '获取会话失败',
    createSessionFailed: '创建会话失败',
    deleteSessionFailed: '删除会话失败',
    connectFailed: '连接失败',
  },
} as const;

export type I18nKey = keyof typeof translations.en;

function detectInitialLocale(): Locale {
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage === 'zh' || fromStorage === 'en') return fromStorage;
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: detectInitialLocale(),
  setLocale: (locale) => {
    localStorage.setItem(STORAGE_KEY, locale);
    set({ locale });
  },
}));

export function translate(key: I18nKey, locale: Locale = useI18nStore.getState().locale): string {
  return translations[locale][key] ?? translations.en[key];
}

export function formatI18n(key: I18nKey, vars: Record<string, string>, locale?: Locale): string {
  let text = translate(key, locale);
  for (const [k, v] of Object.entries(vars)) {
    text = text.split(`{${k}}`).join(v);
  }
  return text;
}

export function useI18n() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  return {
    locale,
    setLocale,
    t: (key: I18nKey) => translate(key, locale),
    tf: (key: I18nKey, vars: Record<string, string>) => formatI18n(key, vars, locale),
  };
}
