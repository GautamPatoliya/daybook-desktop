/** Max bullets added in one paste — avoids accidental 500-line paste from a doc. */
export const PASTE_BULLET_LIMIT = 40;

/** Hard cap on total bullet rows in the composer/drawer. */
export const MAX_BULLET_ROWS = 80;

/**
 * Split clipboard text into bullet lines.
 * Handles Windows/Mac newlines, leading bullets (- * •), and numbered lists (1. 2)).
 */
export function parsePastedBulletLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const out: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    line = line.replace(/^[-*•·▪◦‣]\s+/, '');
    line = line.replace(/^\d+[.)]\s+/, '');
    line = line.trim();
    if (line) out.push(line);
  }

  return out;
}

/**
 * Merge multi-line paste into an existing bullet list at `index`.
 * - First pasted line fills the current row (replaces its value).
 * - Remaining lines are inserted below.
 */
export function mergePastedBullets(items: string[], index: number, pastedLines: string[]): string[] {
  if (!pastedLines.length) return items;

  const copy = [...items];
  const safeIndex = Math.max(0, Math.min(index, copy.length - 1));

  copy[safeIndex] = pastedLines[0];
  if (pastedLines.length > 1) {
    copy.splice(safeIndex + 1, 0, ...pastedLines.slice(1));
  }

  // Never leave zero rows
  if (!copy.length) copy.push('');
  return copy;
}

export type BulletPasteResult =
  | { kind: 'default' }
  | {
      kind: 'merged';
      items: string[];
      focusIndex: number;
      truncated: boolean;
      rowCapHit: boolean;
      lineCount: number;
    };

/**
 * Decide how to handle a paste into a bullet input.
 * Single-line paste → let the browser handle it (default).
 * Multi-line → split into bullets.
 */
export function handleBulletPaste(
  items: string[],
  index: number,
  clipboardText: string,
): BulletPasteResult {
  const lines = parsePastedBulletLines(clipboardText);
  if (lines.length <= 1) return { kind: 'default' };

  const truncated = lines.length > PASTE_BULLET_LIMIT;
  const capped = truncated ? lines.slice(0, PASTE_BULLET_LIMIT) : lines;
  let merged = mergePastedBullets(items.length ? items : [''], index, capped);
  let rowCapHit = false;

  if (merged.length > MAX_BULLET_ROWS) {
    merged = merged.slice(0, MAX_BULLET_ROWS);
    rowCapHit = true;
  }

  const focusIndex = Math.min(index + capped.length - 1, merged.length - 1);

  return {
    kind: 'merged',
    items: merged,
    focusIndex,
    truncated,
    rowCapHit,
    lineCount: capped.length,
  };
}
