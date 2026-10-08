import type {
  AnalyticsRange,
  AnalyticsSummary,
  AppSettings,
  DayPayload,
  EmailDraft,
  ModelCatalogItem,
  ProjectMeta,
  SubItem,
  Task,
  TaskPriority,
  TaskStatus,
} from '../../shared/types';

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  if (typeof window === 'undefined' || !window.wtt) {
    throw new Error('Open Daybook from the desktop app to continue.');
  }
  return window.wtt.invoke<T>(channel, payload);
}

export const api = {
  getVersion: () => invoke<string>('app:getVersion'),
  openExternal: (url: string) => invoke<{ ok: boolean }>('shell:openExternal', url),
  getSettings: () => invoke<AppSettings>('settings:get'),
  saveSettings: (partial: Partial<AppSettings>) => invoke<AppSettings>('settings:save', partial),
  addProject: (name: string) =>
    invoke<{ projects: ProjectMeta[]; added: string }>('projects:add', name),
  upsertProject: (payload: { name: string; color?: string; notes?: string; renameFrom?: string }) =>
    invoke<{ projects: ProjectMeta[] }>('projects:upsert', payload),
  archiveProject: (name: string, archived: boolean) =>
    invoke<{ projects: ProjectMeta[] }>('projects:archive', { name, archived }),
  deleteProject: (name: string) =>
    invoke<{ projects: ProjectMeta[] }>('projects:delete', name),
  getDay: (date: string) => invoke<DayPayload>('day:get', date),
  initDay: (date: string) => invoke<DayPayload>('day:init', date),
  createTask: (
    date: string,
    body: {
      title: string;
      project?: string;
      category?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string;
      subItems?: string[] | SubItem[];
      detailsHtml?: string;
    },
  ) => invoke<{ task: Task } & DayPayload>('task:create', { date, ...body }),
  updateTask: (
    date: string,
    id: string,
    patch: Partial<{
      title: string;
      project: string;
      category: string;
      status: TaskStatus;
      priority: TaskPriority;
      dueDate: string | null;
      subItems: SubItem[];
      detailsHtml: string;
    }>,
  ) => invoke<{ task: Task } & DayPayload>('task:update', { date, id, patch }),
  deleteTask: (date: string, id: string) => invoke<DayPayload>('task:delete', { date, id }),
  remindersSetPaused: (paused: boolean) =>
    invoke<{ ok: boolean; paused: boolean }>('reminders:setPaused', paused),
  remindersGetPaused: () => invoke<{ paused: boolean }>('reminders:getPaused'),
  emailDraft: (date: string, enhance = false) =>
    invoke<EmailDraft>('email:draft', { date, enhance }),
  emailCopy: (draft: EmailDraft) =>
    invoke<{ ok: boolean; subject: string }>('email:copy', draft),
  emailOpen: (draft: EmailDraft) =>
    invoke<{ ok: boolean; pasted?: boolean; pasteHint?: string }>('email:open', draft),
  markEmailSent: (date: string) => invoke<AppSettings>('email:markSent', date),
  categoriesAdd: (name: string) =>
    invoke<{ categories: string[]; defaultCategory: string }>('categories:add', name),
  categoriesRename: (from: string, to: string) =>
    invoke<{ categories: string[]; defaultCategory: string }>('categories:rename', { from, to }),
  categoriesReorder: (order: string[]) =>
    invoke<{ categories: string[]; defaultCategory: string }>('categories:reorder', order),
  categoriesDelete: (name: string) =>
    invoke<{ categories: string[]; defaultCategory: string }>('categories:delete', name),
  setDefaultCategory: (name: string) =>
    invoke<{ categories: string[]; defaultCategory: string }>('settings:setDefaultCategory', name),
  downloadModel: (id: string) => invoke<{ started: boolean }>('models:download', id),
  cancelDownload: (id: string) => invoke<{ ok: boolean }>('models:cancel', id),
  pauseDownload: (id: string) => invoke<{ ok: boolean }>('models:pause', id),
  deleteModel: (id: string) => invoke<boolean>('models:delete', id),
  listModels: () =>
    invoke<
      Array<
        ModelCatalogItem & {
          installed: boolean;
          path?: string;
          downloading: boolean;
          paused?: boolean;
          received: number;
          total: number;
          percent: number;
        }
      >
    >('models:list'),
  consumeReminder: () => invoke<{ mode: string | null }>('reminder:consume'),
  engineStatus: () =>
    invoke<{
      installed: boolean;
      version: string | null;
      platformPackage: string | null;
      installing: boolean;
      path: string;
      supported?: boolean;
    }>('engine:status'),
  installEngine: () => invoke<{ ok: boolean; error?: string }>('engine:install'),
  cancelEngineInstall: () => invoke<{ ok: boolean }>('engine:cancel'),
  uninstallEngine: () => invoke<{ ok: boolean }>('engine:uninstall'),
  analytics: (range?: AnalyticsRange) => invoke<AnalyticsSummary>('analytics:get', range),
  analyticsCsv: (range?: AnalyticsRange) => invoke<string>('analytics:csv', range),
  changelog: () => invoke<string>('changelog:get'),
  updaterStatus: () =>
    invoke<{
      ready: boolean;
      error: string | null;
      packaged?: boolean;
      version?: string;
      updaterActive?: boolean;
    }>('updater:status'),
  checkUpdates: () =>
    invoke<{
      ok: boolean;
      updateInfo?: { version?: string } | null;
      isUpdateAvailable?: boolean;
      error?: string;
      ready?: boolean;
      message?: string;
      packaged?: boolean;
      version?: string;
    }>('updater:check'),
  installUpdate: () => invoke<{ ok: boolean; error?: string }>('updater:install'),
  checkUpdatesOnLaunch: () =>
    invoke<{
      ok: boolean;
      deferred?: boolean;
      packaged?: boolean;
      platform?: string;
      version?: string;
      ready?: boolean;
      isUpdateAvailable?: boolean;
      updateInfo?: { version?: string } | null;
      error?: string | null;
    }>('updater:checkOnLaunch'),
  getMacAssist: (version?: string) =>
    invoke<{
      unsigned: boolean;
      platform: string;
      xattrCommand: string;
      dmgUrl: string;
      releasesUrl: string;
      setupUrl: string;
    }>('updater:getMacAssist', version),
  listDates: () => invoke<string[]>('dates:list'),
  wipeData: () => invoke<{ ok: boolean }>('data:wipe'),
  openDataFolder: () => invoke<string>('data:openFolder'),
};
