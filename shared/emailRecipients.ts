/** Parse / serialize comma-separated email recipient lists (Settings To/Cc + mail draft). */

const HISTORY_CAP = 40;

/** Extract a bare address from tokens like `Name <a@b.com>` or quoted strings. */
export function normalizeEmailToken(raw: string): string {
  const t = raw.trim().replace(/^["']|["']$/g, '');
  const angle = t.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (angle?.[1]) return angle[1].trim();
  return t;
}

/** Lightweight check — not full RFC validation. */
export function isPlausibleEmail(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 254) return false;
  // Supports company.co.in style domains
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
}

export function parseEmailList(value: string): string[] {
  if (!value?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const email = normalizeEmailToken(raw);
    if (!email || !isPlausibleEmail(email)) return;
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(email);
  };

  // Pull Outlook-style "Name <email>" first so display names don't pollute tokens
  const angleRe = /<([^<>\s]+@[^<>\s]+)>/g;
  let rest = value;
  let m: RegExpExecArray | null;
  while ((m = angleRe.exec(value))) {
    push(m[1]);
    rest = rest.replace(m[0], ' ');
  }

  for (const part of rest.split(/[,;\n]+/)) {
    const token = part.trim();
    if (!token) continue;
    if (isPlausibleEmail(normalizeEmailToken(token))) {
      push(token);
      continue;
    }
    // Space-separated paste: "a@x.com b@y.com"
    for (const piece of token.split(/\s+/)) {
      push(piece);
    }
  }

  return out;
}

export function serializeEmailList(emails: string[]): string {
  return emails.map((e) => e.trim()).filter(Boolean).join(', ');
}

export function upsertEmailHistory(history: string[] | undefined, email: string): string[] {
  const next = normalizeEmailToken(email);
  if (!next || !isPlausibleEmail(next)) return history ? [...history] : [];
  const key = next.toLowerCase();
  const rest = (history || []).filter((e) => normalizeEmailToken(e).toLowerCase() !== key);
  return [next, ...rest].slice(0, HISTORY_CAP);
}

export function mergeSuggestionPool(
  history: string[] | undefined,
  ...lists: string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const email = normalizeEmailToken(raw);
    if (!email || !isPlausibleEmail(email)) return;
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(email);
  };
  for (const e of history || []) push(e);
  for (const list of lists) {
    for (const e of parseEmailList(list)) push(e);
  }
  return out.slice(0, HISTORY_CAP);
}

export function filterEmailSuggestions(
  pool: string[],
  query: string,
  selected: string[],
): string[] {
  const q = query.trim().toLowerCase();
  const selectedKeys = new Set(selected.map((e) => normalizeEmailToken(e).toLowerCase()));
  return pool
    .filter((e) => !selectedKeys.has(normalizeEmailToken(e).toLowerCase()))
    .filter((e) => !q || e.toLowerCase().includes(q))
    .slice(0, 8);
}

/** If history is empty, seed from existing To/Cc so autocomplete isn't blank for upgrades. */
export function normalizeRecipientHistory(
  history: unknown,
  emailTo: string,
  emailCc: string,
): string[] {
  const fromFile = Array.isArray(history)
    ? history
        .filter((e): e is string => typeof e === 'string')
        .map((e) => normalizeEmailToken(e))
        .filter((e) => isPlausibleEmail(e))
    : [];
  if (fromFile.length) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of fromFile) {
      const key = e.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
    return out.slice(0, HISTORY_CAP);
  }
  return mergeSuggestionPool([], emailTo, emailCc);
}
