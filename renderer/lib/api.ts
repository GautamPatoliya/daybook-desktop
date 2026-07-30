import type {
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
      subItems?: string[];
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
    }>,
  ) => invoke<{ task: Task } & DayPayload>('task:update', { date, id, patch }),
  deleteTask: (date: string, id: string) => invoke<DayPayload>('task:delete', { date, id }),
  emailDraft: (date: string, enhance = false) =>
    invoke<EmailDraft>('email:draft', { date, enhance }),
  emailCopy: (draft: EmailDraft) =>
    invoke<{ ok: boolean; subject: string }>('email:copy', draft),
  emailOpen: (draft: EmailDraft) => invoke<{ ok: boolean }>('email:open', draft),
  downloadModel: (id: string) => invoke<{ started: boolean }>('models:download', id),
  cancelDownload: (id: string) => invoke<{ ok: boolean }>('models:cancel', id),
  deleteModel: (id: string) => invoke<boolean>('models:delete', id),
  listModels: () =>
    invoke<
      Array<
        ModelCatalogItem & {
          installed: boolean;
          path?: string;
          downloading: boolean;
          received: number;
          total: number;
          percent: number;
        }
      >
    >('models:list'),
  analytics: () => invoke<AnalyticsSummary>('analytics:get'),
  analyticsCsv: () => invoke<string>('analytics:csv'),
  changelog: () => invoke<string>('changelog:get'),
  updaterStatus: () =>
    invoke<{ ready: boolean; error: string | null }>('updater:status'),
  checkUpdates: () =>
    invoke<{
      ok: boolean;
      updateInfo?: unknown;
      error?: string;
      ready?: boolean;
      message?: string;
    }>('updater:check'),
  installUpdate: () => invoke<{ ok: boolean; error?: string }>('updater:install'),
  listDates: () => invoke<string[]>('dates:list'),
  wipeData: () => invoke<{ ok: boolean }>('data:wipe'),
  openDataFolder: () => invoke<string>('data:openFolder'),
};
