export type TaskStatus = 'none' | 'wip' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface SubItem {
  text: string;
  enhanced?: string;
}

export interface Task {
  id: string;
  project: string;
  category: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  subItems: SubItem[];
  titleEnhanced?: string;
  createdAt: string;
  updatedAt: string;
  carriedFrom?: string;
}

export interface TaskStore {
  version: 2;
  tasks: Task[];
  carriedAt?: string;
}

export interface ProjectMeta {
  name: string;
  color: string;
  archived: boolean;
  notes?: string;
}

export interface AppSettings {
  appName: string;
  authorName: string;
  signOff: string[];
  projects: ProjectMeta[];
  defaultProject: string;
  emailDefaultProject: 'master' | string;
  categories: string[];
  timezone: string;
  workingDays: number[];
  popupHours: { hourlyStart: number; hourlyEnd: number };
  eodHour: number;
  eodMinute: number;
  reminderIntervalMinutes: number;
  emailTo: string;
  gmailComposeUrl: string;
  aiEnhanceEnabled: boolean;
  selectedModelId: string | null;
  /** When false (default), backlog (`none`) tasks are omitted from EOD email drafts. */
  includeBacklogInEmail: boolean;
  autostart: boolean;
  onboardingComplete: boolean;
  theme: string;
}

export interface DayPayload {
  date: string;
  displayDate: string;
  today: string;
  tasks: Task[];
  stats: { total: number; done: number; wip: number; none: number };
  carriedAt: string | null;
  config: {
    appName: string;
    authorName: string;
    projects: string[];
    projectMeta: ProjectMeta[];
    defaultProject: string;
    categories: string[];
    timezone: string;
    emailTo: string;
  };
  carry?: { carried: number; from: string | null; restored?: number };
}

export interface EmailDraft {
  subject: string;
  body: string;
  htmlBody: string;
  gmailUrl: string;
  /** Present when draft was built via Polish — llm | rule | none */
  enhanceMode?: 'none' | 'rule' | 'llm';
}

export interface ModelCatalogItem {
  id: string;
  name: string;
  filename: string;
  url: string;
  sizeBytes: number;
  ramHintGb: number;
  description: string;
  recommended?: boolean;
}

export interface AnalyticsSummary {
  daysWithData: number;
  totalTasks: number;
  done: number;
  wip: number;
  none: number;
  completionRate: number;
  carryOverCount: number;
  streakDays: number;
  averageWipAgeDays: number;
  byProject: Record<string, number>;
  byCategory: Record<string, number>;
  byWeekday: Record<string, number>;
  activityByHour: Record<string, number>;
  recentDays: Array<{
    date: string;
    total: number;
    done: number;
    wip: number;
    none: number;
  }>;
}

export const PROJECT_COLORS = [
  '#3b82f6',
  '#14b8a6',
  '#a78bfa',
  '#f59e0b',
  '#f472b6',
  '#22c55e',
  '#38bdf8',
  '#fb7185',
];

export function activeProjectNames(projects: ProjectMeta[]): string[] {
  return projects.filter((p) => !p.archived).map((p) => p.name);
}

export function normalizeProjects(raw: unknown): ProjectMeta[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ name: 'General', color: PROJECT_COLORS[0], archived: false }];
  }
  return raw.map((item, i) => {
    if (typeof item === 'string') {
      return { name: item, color: PROJECT_COLORS[i % PROJECT_COLORS.length], archived: false };
    }
    const p = item as Partial<ProjectMeta>;
    return {
      name: (p.name || 'Untitled').trim() || 'Untitled',
      color: p.color || PROJECT_COLORS[i % PROJECT_COLORS.length],
      archived: Boolean(p.archived),
      notes: p.notes || '',
    };
  });
}

export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'Daybook',
  authorName: '',
  signOff: ['Thank you.', 'Best regards,'],
  projects: [{ name: 'General', color: PROJECT_COLORS[0], archived: false }],
  defaultProject: 'General',
  emailDefaultProject: 'master',
  categories: [
    'Deployment',
    'Bug Fix / Issue',
    'Feature / Development',
    'Code Review',
    'Testing & Validation',
    'Support / Help',
    'Other',
  ],
  timezone: 'Asia/Kolkata',
  workingDays: [1, 2, 3, 4, 5],
  popupHours: { hourlyStart: 8, hourlyEnd: 18 },
  eodHour: 18,
  eodMinute: 45,
  reminderIntervalMinutes: 60,
  emailTo: '',
  gmailComposeUrl: 'https://mail.google.com/mail/?view=cm&fs=1',
  aiEnhanceEnabled: false,
  selectedModelId: null,
  includeBacklogInEmail: false,
  autostart: true,
  onboardingComplete: false,
  theme: 'default',
};

export const MODEL_CATALOG: ModelCatalogItem[] = [
  {
    id: 'qwen25-1_5b-instruct-q4',
    name: 'Fast & light',
    filename: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1_000_000_000,
    ramHintGb: 3,
    description: 'Best starting point — quick on most office PCs.',
    recommended: true,
  },
  {
    id: 'llama32-1b-instruct-q4',
    name: 'Extra small',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sizeBytes: 800_000_000,
    ramHintGb: 3,
    description: 'Smallest download — light polish for everyday notes.',
  },
  {
    id: 'qwen25-3b-instruct-q4',
    name: 'Clearer writing',
    filename: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    sizeBytes: 2_000_000_000,
    ramHintGb: 5,
    description: 'Smoother wording when your PC has a bit more memory.',
  },
  {
    id: 'phi3-mini-q4',
    name: 'Professional tone',
    filename: 'Phi-3-mini-4k-instruct-q4.gguf',
    url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    sizeBytes: 2_300_000_000,
    ramHintGb: 6,
    description: 'Strong for formal email polish — needs more memory.',
  },
  {
    id: 'gemma2-2b-it-q4',
    name: 'Balanced',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    sizeBytes: 1_600_000_000,
    ramHintGb: 4,
    description: 'A middle ground between speed and writing quality.',
  },
];
