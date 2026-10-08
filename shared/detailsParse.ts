import type { SubItem } from './types';

/**
 * Parse TipTap/details HTML into depth-aware subItems.
 * Works in both renderer and Electron main (no DOM required).
 *
 * - Nested <ul>/<ol> inside <li> → depth 0, 1, 2, …
 * - Loose paragraphs outside lists (e.g. "Test" then a bullet list) → depth 0, in order
 */
export function parseDetailsHtmlToSubItems(html: string): SubItem[] {
  const out: SubItem[] = [];
  const input = (html || '').trim();
  if (!input) return out;

  // Keep list structure; turn block/inline chrome into spaces so text doesn't glue together.
  const normalized = input
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p(?:\s[^>]*)?>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div(?:\s[^>]*)?>/gi, '')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<h[1-6](?:\s[^>]*)?>/gi, '')
    .replace(/<\/?(strong|em|b|i|u|s|strike|span|a|blockquote|code|pre|sub|sup|mark)(?:\s[^>]*)?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  const re = /<\/?(ul|ol|li)(?:\s[^>]*)?>|([^<]+)/gi;
  const listStack: true[] = [];
  let liDepth: number | null = null;
  let liText = '';
  let looseText = '';

  const flushLi = () => {
    if (liDepth === null) return;
    const text = liText.replace(/\s+/g, ' ').trim();
    if (text) out.push({ text, depth: liDepth });
    liText = '';
    liDepth = null;
  };

  /** Flush current LI text before opening a nested list (keeps parent separate from children). */
  const flushLiTextKeepDepth = () => {
    if (liDepth === null) return;
    const text = liText.replace(/\s+/g, ' ').trim();
    if (text) out.push({ text, depth: liDepth });
    liText = '';
    liDepth = null;
  };

  /** Paragraphs / lines typed outside any list (common TipTap pattern). */
  const flushLoose = () => {
    const chunks = looseText.split(/\n+/);
    looseText = '';
    for (const chunk of chunks) {
      const text = chunk.replace(/\s+/g, ' ').trim();
      if (text) out.push({ text, depth: 0 });
    }
  };

  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    if (m[2] != null) {
      if (liDepth !== null) {
        liText += m[2];
      } else if (listStack.length === 0) {
        looseText += m[2];
      }
      continue;
    }

    const raw = m[0];
    const name = (m[1] || '').toLowerCase();
    const closing = raw.startsWith('</');

    if (name === 'ul' || name === 'ol') {
      if (closing) {
        flushLi();
        listStack.pop();
      } else {
        flushLoose();
        flushLiTextKeepDepth();
        listStack.push(true);
      }
      continue;
    }

    if (name === 'li') {
      if (closing) {
        flushLi();
      } else {
        flushLi();
        liDepth = Math.max(0, listStack.length - 1);
        liText = '';
      }
    }
  }
  flushLi();
  flushLoose();

  // No list markup and no loose blocks - last-resort plain scrape
  if (!out.length) {
    const plain = normalized
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (plain) out.push({ text: plain, depth: 0 });
  }

  return out;
}

/** Merge newly parsed items with previous enhanced wording when text matches. */
export function mergeSubItemEnhancements(next: SubItem[], previous: SubItem[] = []): SubItem[] {
  return next.map((item) => {
    const prev = previous.find((p) => p.text === item.text);
    if (prev?.enhanced) return { ...item, enhanced: prev.enhanced };
    return item;
  });
}
