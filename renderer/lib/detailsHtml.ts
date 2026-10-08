import type { SubItem } from '../../shared/types';
import { mergeSubItemEnhancements, parseDetailsHtmlToSubItems } from '../../shared/detailsParse';

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'STRIKE',
  'UL', 'OL', 'LI', 'A', 'H1', 'H2', 'H3',
  'BLOCKQUOTE', 'PRE', 'CODE', 'HR',
  'SUB', 'SUP', 'MARK', 'SPAN', 'DIV',
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Sanitize TipTap HTML to an allowlisted subset before save. */
export function sanitizeDetailsHtml(html: string): string {
  if (typeof document === 'undefined') return html || '';
  const raw = (html || '').trim();
  if (!raw) return '';

  const template = document.createElement('template');
  template.innerHTML = raw;

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return Array.from(el.childNodes).map(walk).join('');
    }
    if (tag === 'BR') return '<br>';
    if (tag === 'HR') return '<hr>';
    if (tag === 'A') {
      const href = (el.getAttribute('href') || '').trim();
      if (!/^https?:\/\//i.test(href)) {
        return Array.from(el.childNodes).map(walk).join('');
      }
      const safe = href.replace(/"/g, '&quot;');
      return `<a href="${safe}">${Array.from(el.childNodes).map(walk).join('')}</a>`;
    }
    if (tag === 'SPAN' || tag === 'MARK') {
      const style = el.getAttribute('style') || '';
      const color = style.match(/color:\s*([^;]+)/i)?.[1]?.trim();
      const bg = style.match(/background(?:-color)?:\s*([^;]+)/i)?.[1]?.trim();
      const safeColor = color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : '';
      const safeBg = bg && /^#[0-9a-f]{3,8}$/i.test(bg) ? bg : '';
      const parts: string[] = [];
      if (safeColor) parts.push(`color:${safeColor}`);
      if (safeBg) parts.push(`background-color:${safeBg}`);
      const inner = Array.from(el.childNodes).map(walk).join('');
      if (!parts.length) return inner;
      return `<span style="${parts.join(';')}">${inner}</span>`;
    }
    const align = el.style?.textAlign || el.getAttribute('style')?.match(/text-align:\s*(\w+)/)?.[1];
    // Preserve a space between block siblings so text doesn't glue (Test + Test → TestTest)
    const kids = Array.from(el.childNodes);
    const pieces: string[] = [];
    for (let i = 0; i < kids.length; i++) {
      const part = walk(kids[i]);
      if (!part) continue;
      if (
        pieces.length &&
        /(?:<\/p>|<\/div>|<\/h[1-6]|<\/li>|<\/ul>|<\/ol>)$/i.test(pieces[pieces.length - 1]) &&
        /^(?:<p|<div|<h[1-6]|<li|<ul|<ol)/i.test(part)
      ) {
        pieces.push('');
      }
      pieces.push(part);
    }
    const inner = pieces.join('');
    const lower = tag.toLowerCase();
    if (align && ['left', 'center', 'right', 'justify'].includes(align)) {
      return `<${lower} style="text-align:${align}">${inner}</${lower}>`;
    }
    return `<${lower}>${inner}</${lower}>`;
  };

  const out = Array.from(template.content.childNodes).map(walk).join('').trim();
  if (!out || out === '<p></p>' || out === '<p><br></p>') return '';
  return out;
}

/** Derive email/card subItems from sanitized details HTML, preserving nest depth. */
export function deriveSubItemsFromHtml(html: string, previous: SubItem[] = []): SubItem[] {
  const cleaned = typeof document !== 'undefined' ? sanitizeDetailsHtml(html) : html;
  if (!cleaned?.trim()) return [];
  return mergeSubItemEnhancements(parseDetailsHtmlToSubItems(cleaned), previous);
}

/** Load editor HTML from detailsHtml or legacy subItems. */
export function loadDetailsHtml(task: { detailsHtml?: string; subItems?: SubItem[] }): string {
  const html = (task.detailsHtml || '').trim();
  if (html) return html;
  const items = task.subItems || [];
  if (!items.length) return '';
  return buildNestedUlHtml(items);
}

function buildNestedUlHtml(items: SubItem[]): string {
  if (!items.length) return '';
  type Node = { text: string; children: Node[] };
  const root: Node[] = [];
  const path: Node[] = [];

  for (const item of items) {
    const depth = Math.max(0, item.depth ?? 0);
    const node: Node = { text: item.text, children: [] };
    path.length = depth;
    if (depth === 0) {
      root.push(node);
      path[0] = node;
    } else {
      const parent = path[depth - 1];
      if (!parent) {
        root.push(node);
        path[0] = node;
      } else {
        parent.children.push(node);
        path[depth] = node;
      }
    }
  }

  const render = (nodes: Node[]): string => {
    if (!nodes.length) return '';
    return `<ul>${nodes
      .map((n) => `<li><p>${escapeHtml(n.text)}</p>${n.children.length ? render(n.children) : ''}</li>`)
      .join('')}</ul>`;
  };
  return render(root);
}

export function isEmptyDetailsHtml(html: string): boolean {
  return !sanitizeDetailsHtml(html);
}
