import type { AppSettings, EmailDraft, Task } from './types';
import { parseDetailsHtmlToSubItems } from './detailsParse';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Status emoji on the task title line (not on detail bullets). */
function titleStatusEmoji(task: Task): string {
  if (task.status === 'done') return ' ✅';
  if (task.status === 'wip') return ' ⏳';
  return '';
}

const WRAP_STYLE = 'word-break:break-word;overflow-wrap:anywhere;';

function wrapLongTextHtml(text: string): string {
  return `<span style="${WRAP_STYLE}">${escapeHtml(text)}</span>`;
}

function lineText(task: Task, sub?: { text: string; enhanced?: string }): string {
  const accept = (enh: string, raw: string) => {
    if (!enh || enh === raw) return false;
    return enh.length <= Math.max(raw.length * 1.5, raw.length + 60);
  };

  if (sub) {
    const enh = (sub.enhanced || '').trim();
    const raw = (sub.text || '').trim();
    if (accept(enh, raw)) return enh;
    return raw;
  }
  const enh = (task.titleEnhanced || '').trim();
  const raw = task.title.trim();
  if (accept(enh, raw)) return enh;
  return raw;
}

function tasksForProject(tasks: Task[], project: string): Task[] {
  return tasks.filter((t) => t.project === project);
}

function indentPlain(depth: number): string {
  return '    '.repeat(Math.max(0, depth));
}

/** Prefer detailsHtml (nested lists) over flat/legacy subItems. */
function detailSubsForTask(task: Task) {
  const html = (task.detailsHtml || '').trim();
  if (html) {
    const parsed = parseDetailsHtmlToSubItems(html);
    if (parsed.length) return parsed;
  }
  return task.subItems || [];
}

function buildTaskBullets(tasks: Task[]): { plain: string; html: string } {
  if (!tasks.length) {
    return {
      plain: '- (No tasks logged today)',
      html: `<ul style="margin-top:4px;margin-bottom:12px;${WRAP_STYLE}"><li>(No tasks logged today)</li></ul>`,
    };
  }

  type NestNode = { text: string; children: NestNode[] };
  const plainParts: string[] = [];

  const renderHtml = (nodes: NestNode[]): string => {
    if (!nodes.length) return '';
    return `<ul style="margin-top:4px;margin-bottom:4px;${WRAP_STYLE}">${nodes
      .map(
        (n) =>
          `<li style="${WRAP_STYLE}">${wrapLongTextHtml(n.text)}${n.children.length ? renderHtml(n.children) : ''}</li>`,
      )
      .join('')}</ul>`;
  };

  const rootTasks: NestNode[] = [];

  for (const task of tasks) {
    const label = lineText(task);
    if (!label) continue;
    const rawTitle = task.title.trim();
    const titleWithStatus = `${label}${titleStatusEmoji(task)}`;
    plainParts.push(`- ${titleWithStatus}`);

    const taskNode: NestNode = { text: titleWithStatus, children: [] };
    rootTasks.push(taskNode);

    const subs = detailSubsForTask(task);
    const path: NestNode[] = [taskNode];

    for (const sub of subs) {
      const text = lineText(task, sub);
      if (!text || text.toLowerCase() === rawTitle.toLowerCase() || text.toLowerCase() === label.toLowerCase()) {
        continue;
      }
      const depth = Math.max(0, sub.depth ?? 0);
      // detail depth 0 sits under the task title (email indent level 1)
      const nestDepth = depth + 1;
      plainParts.push(`${indentPlain(nestDepth)}- ${text}`);

      const node: NestNode = { text, children: [] };
      while (path.length > nestDepth) path.pop();
      while (path.length < nestDepth) {
        // Gap in depths - attach under deepest known parent
        path.push(path[path.length - 1] || taskNode);
      }
      const parent = path[nestDepth - 1] || path[path.length - 1] || taskNode;
      parent.children.push(node);
      path.length = nestDepth;
      path[nestDepth] = node;
    }
  }

  return {
    plain: plainParts.join('\n'),
    html: renderHtml(rootTasks) || `<ul style="margin-top:4px;margin-bottom:12px;${WRAP_STYLE}"><li>(No tasks)</li></ul>`,
  };
}

function orderedProjects(tasks: Task[], settings: AppSettings): string[] {
  const present = [...new Set(tasks.map((t) => t.project).filter(Boolean))];
  const ordered: string[] = [];
  for (const p of settings.projects) {
    if (!p.archived && present.includes(p.name)) ordered.push(p.name);
  }
  for (const p of present) {
    if (!ordered.includes(p)) ordered.push(p);
  }
  return ordered;
}

function buildClassicCore(tasks: Task[], settings: AppSettings): { bodyCore: string; htmlCore: string } {
  const mode = settings.emailDefaultProject || 'master';
  const emailTasks =
    settings.includeBacklogInEmail === true ? tasks : tasks.filter((t) => t.status !== 'none');

  if (mode === 'master') {
    const projects = orderedProjects(emailTasks, settings);
    const plainBlocks: string[] = [];
    const htmlBlocks: string[] = [];
    for (const p of projects) {
      const projectTasks = tasksForProject(emailTasks, p);
      if (!projectTasks.length) continue;
      const bullets = buildTaskBullets(projectTasks);
      plainBlocks.push(`*Project:* ${p}\n\n*Tasks:*\n\n${bullets.plain}`);
      htmlBlocks.push(
        `<p style="margin:0 0 10px 0;${WRAP_STYLE}"><b>Project:</b> ${escapeHtml(p)}</p>` +
          `<p style="margin:0 0 6px 0;"><b>Tasks:</b></p>${bullets.html}`,
      );
    }
    if (!plainBlocks.length) {
      return {
        bodyCore: '*Tasks:*\n\n- (No in-progress or completed tasks today)',
        htmlCore:
          `<p style="margin:0 0 6px 0;"><b>Tasks:</b></p><ul style="margin-top:4px;margin-bottom:12px;${WRAP_STYLE}"><li>(No in-progress or completed tasks today)</li></ul>`,
      };
    }
    return { bodyCore: plainBlocks.join('\n\n'), htmlCore: htmlBlocks.join('\n') };
  }

  const project =
    [...new Set(emailTasks.map((t) => t.project))].length === 1
      ? emailTasks[0]?.project || settings.defaultProject
      : mode || settings.defaultProject;
  const scoped = tasksForProject(emailTasks, project);
  const bullets = buildTaskBullets(scoped.length ? scoped : emailTasks);
  return {
    bodyCore: `*Project:* ${project}\n\n*Tasks:*\n\n${bullets.plain}`,
    htmlCore:
      `<p style="margin:0 0 10px 0;${WRAP_STYLE}"><b>Project:</b> ${escapeHtml(project)}</p>` +
      `<p style="margin:0 0 6px 0;"><b>Tasks:</b></p>${bullets.html}`,
  };
}

export function buildEmailDraft(
  date: string,
  displayDate: string,
  tasks: Task[],
  settings: AppSettings,
): EmailDraft {
  const subject = `Daily Work Update - ${displayDate}`;
  const signOff = [...settings.signOff, settings.authorName].filter(Boolean).join('\n');
  const { bodyCore, htmlCore } = buildClassicCore(tasks, settings);

  const body = ['Dear Sir,', '', 'Please find below my work update,', '', bodyCore, '', signOff].join('\n');
  const signOffHtml = [...settings.signOff, settings.authorName]
    .filter(Boolean)
    .map((l) => `<p style="margin:0 0 4px 0;">${escapeHtml(l)}</p>`)
    .join('\n');
  const htmlBody = `<div style="font-family:Verdana,Geneva,sans-serif;font-size:13px;color:#222;line-height:1.45;${WRAP_STYLE}">
<p style="margin:0 0 10px 0;">Dear Sir,</p>
<p style="margin:0 0 10px 0;">Please find below my work update,</p>
${htmlCore}
${signOffHtml}
</div>`;

  const gmailUrl = buildGmailComposeUrl(settings.gmailComposeUrl, {
    to: settings.emailTo,
    cc: settings.emailCc,
    subject,
  });

  return { subject, body, htmlBody, gmailUrl };
}

/** Build a Gmail compose URL with recipients/subject (body is pasted separately). */
export function buildGmailComposeUrl(
  baseUrl: string,
  opts: { to?: string; cc?: string; subject?: string },
): string {
  const raw = (baseUrl || 'https://mail.google.com/mail/?view=cm&fs=1').trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    url = new URL('https://mail.google.com/mail/?view=cm&fs=1');
  }
  if (opts.to?.trim()) url.searchParams.set('to', opts.to.trim());
  else url.searchParams.delete('to');
  if (opts.cc?.trim()) url.searchParams.set('cc', opts.cc.trim());
  else url.searchParams.delete('cc');
  if (opts.subject?.trim()) url.searchParams.set('su', opts.subject.trim());
  else url.searchParams.delete('su');
  // Body is pasted via clipboard - keep param empty so Gmail opens cleanly.
  url.searchParams.set('body', '');
  return url.toString();
}

/** Sample tasks for Settings live email-format preview (not persisted). */
export function buildEmailFormatPreview(settings: AppSettings): EmailDraft {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const date = `${y}-${m}-${d}`;
  const displayDate = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const project =
    settings.projects.find((p) => !p.archived)?.name || settings.defaultProject || 'General';
  const category = settings.defaultCategory || settings.categories[0] || 'Other';
  const sample: Task[] = [
    {
      id: 'preview-1',
      project,
      category,
      title: 'Sample completed task',
      status: 'done',
      priority: 'medium',
      subItems: [{ text: 'Detail the team can skim in the report' }],
      detailsHtml: '<ul><li>Detail the team can skim in the report</li></ul>',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'preview-2',
      project,
      category,
      title: 'Sample in-progress task',
      status: 'wip',
      priority: 'high',
      subItems: [{ text: 'Still working - shows with an in-progress mark' }],
      detailsHtml: '<ul><li>Still working - shows with an in-progress mark</li></ul>',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];
  return buildEmailDraft(date, displayDate, sample, settings);
}

export function ruleBasedPolish(raw: string): string {
  let t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return t;

  // Normalize casual separators used in Indian office notes
  t = t.replace(/\s*>>\s*/g, ' - ').replace(/\s*->\s*/g, ' - ').replace(/\s*:\s*$/, '');

  // Common spelling / wording fixes (case-insensitive whole words)
  const fixes: Array<[RegExp, string]> = [
    [/\bteh\b/gi, 'the'],
    [/\brecieve\b/gi, 'receive'],
    [/\brecieved\b/gi, 'received'],
    [/\boccurence\b/gi, 'occurrence'],
    [/\bseperate\b/gi, 'separate'],
    [/\bdefinately\b/gi, 'definitely'],
    [/\btommorow\b/gi, 'tomorrow'],
    [/\btommorrow\b/gi, 'tomorrow'],
    [/\buntill\b/gi, 'until'],
    [/\bwrok\b/gi, 'work'],
    [/\budpate\b/gi, 'update'],
    [/\bupadte\b/gi, 'update'],
    [/\bcompletition\b/gi, 'completion'],
    [/\bimplemetation\b/gi, 'implementation'],
    [/\bimplementaion\b/gi, 'implementation'],
    [/\brequirment\b/gi, 'requirement'],
    [/\brequirments\b/gi, 'requirements'],
    [/\bdiscusion\b/gi, 'discussion'],
    [/\bmetting\b/gi, 'meeting'],
    [/\bfolow\b/gi, 'follow'],
    [/\bfolow[- ]?up\b/gi, 'follow-up'],
    [/\bfixd\b/gi, 'fixed'],
    [/\bcheked\b/gi, 'checked'],
    [/\btestng\b/gi, 'testing'],
    [/\bdb\b/gi, 'DB'],
    [/\bapi\b/gi, 'API'],
    [/\bui\b/gi, 'UI'],
  ];
  for (const [re, replacement] of fixes) {
    t = t.replace(re, replacement);
  }

  // Sentence-style capitalisation
  t = t.charAt(0).toUpperCase() + t.slice(1);
  // Capitalise after . ! ?
  t = t.replace(/([.!?]\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

  return t;
}

/**
 * Convert Daybook email plain body (*bold*, nested - lists) into themed HTML for the drawer preview.
 * Does not use the Gmail HTML (which forces #222) so colors stay on-theme.
 */
export function renderEmailMarkdownPreview(body: string): string {
  const escape = escapeHtml;
  const lines = (body || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let listStack: number[] = [];

  const closeListsTo = (depth: number) => {
    while (listStack.length > depth) {
      blocks.push('</ul>');
      listStack.pop();
    }
  };

  const inline = (text: string) =>
    escape(text).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');

  for (const raw of lines) {
    const bullet = raw.match(/^( *)-\s+(.*)$/);
    if (bullet) {
      const spaces = bullet[1].length;
      const depth = Math.floor(spaces / 4) + 1;
      while (listStack.length < depth) {
        blocks.push('<ul>');
        listStack.push(listStack.length + 1);
      }
      closeListsTo(depth);
      blocks.push(`<li>${inline(bullet[2])}</li>`);
      continue;
    }
    closeListsTo(0);
    const trimmed = raw.trim();
    if (!trimmed) {
      blocks.push('<div class="mail-md-gap"></div>');
      continue;
    }
    blocks.push(`<p>${inline(trimmed)}</p>`);
  }
  closeListsTo(0);
  return blocks.join('');
}
