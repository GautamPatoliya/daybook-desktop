import type { AppSettings, EmailDraft, Task, TaskStatus } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusSuffix(status: TaskStatus): string {
  if (status === 'done') return ' ✅';
  if (status === 'wip') return ' ⏳';
  return '';
}

function statusSuffixHtml(status: TaskStatus): string {
  if (status === 'done') return ' &#x2705;';
  if (status === 'wip') return ' &#x23F3;';
  return '';
}

function lineText(task: Task, sub?: { text: string; enhanced?: string }): string {
  if (sub) {
    const enh = (sub.enhanced || '').trim();
    const raw = (sub.text || '').trim();
    if (enh && enh !== raw && enh.length <= Math.max(raw.length * 1.25, raw.length + 30)) return enh;
    return raw;
  }
  const enh = (task.titleEnhanced || '').trim();
  const raw = task.title.trim();
  if (enh && enh !== raw) return enh;
  return raw;
}

function tasksForProject(tasks: Task[], project: string): Task[] {
  return tasks.filter((t) => t.project === project);
}

function buildTaskBullets(tasks: Task[]): { plain: string; html: string } {
  if (!tasks.length) {
    return {
      plain: '- (No tasks logged today)',
      html: '<ul style="margin-top:4px;margin-bottom:12px;"><li>(No tasks logged today)</li></ul>',
    };
  }
  const plainParts: string[] = [];
  const htmlParts: string[] = ['<ul style="margin-top:4px;margin-bottom:12px;">'];
  for (const task of tasks) {
    const label = task.title.trim();
    if (!label) continue;
    const allDone = task.status === 'done';
    const suffix = allDone ? statusSuffix('done') : '';
    const subs = task.subItems || [];
    plainParts.push(`- ${label}${suffix}`);
    if (!subs.length) {
      htmlParts.push(`<li>${escapeHtml(label)}${statusSuffixHtml(allDone ? 'done' : task.status)}</li>`);
      continue;
    }
    htmlParts.push(`<li>${escapeHtml(label)}${statusSuffixHtml(allDone ? 'done' : task.status)}`);
    htmlParts.push('<ul style="margin-top:4px;margin-bottom:4px;">');
    for (const sub of subs) {
      const text = lineText(task, sub);
      if (!text || text.toLowerCase() === label.toLowerCase()) continue;
      plainParts.push(`    - ${text}${statusSuffix(task.status)}`);
      htmlParts.push(`<li>${escapeHtml(text)}${statusSuffixHtml(task.status)}</li>`);
    }
    htmlParts.push('</ul></li>');
  }
  htmlParts.push('</ul>');
  return { plain: plainParts.join('\n'), html: htmlParts.join('\n') };
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

export function buildEmailDraft(
  date: string,
  displayDate: string,
  tasks: Task[],
  settings: AppSettings,
): EmailDraft {
  const subject = `Daily Work Update - ${displayDate}`;
  const signOff = [...settings.signOff, settings.authorName].filter(Boolean).join('\n');
  const mode = settings.emailDefaultProject || 'master';

  let bodyCore = '';
  let htmlCore = '';

  if (mode === 'master') {
    const projects = orderedProjects(tasks, settings);
    const plainBlocks: string[] = [];
    const htmlBlocks: string[] = [];
    for (const p of projects) {
      const bullets = buildTaskBullets(tasksForProject(tasks, p));
      plainBlocks.push(`*Project:* ${p}\n\n*Tasks:*\n\n${bullets.plain}`);
      htmlBlocks.push(
        `<p style="margin:0 0 10px 0;"><b>Project:</b> ${escapeHtml(p)}</p>` +
          `<p style="margin:0 0 6px 0;"><b>Tasks:</b></p>${bullets.html}`,
      );
    }
    bodyCore = plainBlocks.join('\n\n');
    htmlCore = htmlBlocks.join('\n');
  } else {
    const project =
      [...new Set(tasks.map((t) => t.project))].length === 1
        ? tasks[0]?.project || settings.defaultProject
        : mode || settings.defaultProject;
    const bullets = buildTaskBullets(tasksForProject(tasks, project).length ? tasksForProject(tasks, project) : tasks);
    bodyCore = `*Project:* ${project}\n\n*Tasks:*\n\n${bullets.plain}`;
    htmlCore =
      `<p style="margin:0 0 10px 0;"><b>Project:</b> ${escapeHtml(project)}</p>` +
      `<p style="margin:0 0 6px 0;"><b>Tasks:</b></p>${bullets.html}`;
  }

  const body = ['Dear Sir,', '', 'Please find below my work update,', '', bodyCore, '', signOff].join('\n');
  const signOffHtml = [...settings.signOff, settings.authorName]
    .filter(Boolean)
    .map((l) => `<p style="margin:0 0 4px 0;">${escapeHtml(l)}</p>`)
    .join('\n');
  const htmlBody = `<div style="font-family:Verdana,Geneva,sans-serif;font-size:13px;color:#222;line-height:1.45;">
<p style="margin:0 0 10px 0;">Dear Sir,</p>
<p style="margin:0 0 10px 0;">Please find below my work update,</p>
${htmlCore}
${signOffHtml}
</div>`;

  const parts = [`su=${encodeURIComponent(subject)}`, `body=`];
  if (settings.emailTo) parts.unshift(`to=${encodeURIComponent(settings.emailTo)}`);
  const gmailUrl = `${settings.gmailComposeUrl}&${parts.join('&')}`;

  return { subject, body, htmlBody, gmailUrl };
}

export function ruleBasedPolish(raw: string): string {
  let t = raw.trim().replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').replace(/\s*>>\s*/g, ' - ');
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
