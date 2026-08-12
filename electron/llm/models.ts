import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { BrowserWindow } from 'electron';
import { DataRoot } from '../../shared/store';
import { MODEL_CATALOG, type ModelCatalogItem } from '../../shared/types';
import { ruleBasedPolish } from '../../shared/email';

export type DownloadProgress = {
  id: string;
  received: number;
  total: number;
  done: boolean;
  error?: string;
  percent: number;
  /** cancelled | paused | network | storage | unknown */
  reason?: string;
};

type ActiveDownload = {
  req?: http.ClientRequest;
  res?: http.IncomingMessage;
  out?: fs.WriteStream;
  abort: boolean;
  /** pause keeps .part; cancel deletes it */
  keepPartial: boolean;
  received: number;
  total: number;
  lastEmit: number;
};

const downloads = new Map<string, ActiveDownload>();

function broadcastProgress(progress: DownloadProgress) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('models:progress', progress);
  }
}

function emitThrottled(state: ActiveDownload, id: string, force = false) {
  const now = Date.now();
  if (!force && now - state.lastEmit < 120) return;
  state.lastEmit = now;
  const percent = state.total > 0 ? Math.min(99.5, (state.received / state.total) * 100) : 0;
  broadcastProgress({
    id,
    received: state.received,
    total: state.total,
    done: false,
    percent,
  });
}

function friendlyDownloadError(err: unknown): { message: string; reason: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Download failed');
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';

  if (code === 'ENOSPC' || /ENOSPC|no space|not enough space/i.test(raw)) {
    return {
      message: 'Not enough disk space to finish this download. Free some space, then resume.',
      reason: 'storage',
    };
  }
  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    /ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|network|socket|TLS|SSL/i.test(raw)
  ) {
    return {
      message: 'Network error while downloading. Check your connection, then resume.',
      reason: 'network',
    };
  }
  if (/HTTP 429|rate limit/i.test(raw)) {
    return { message: 'Download server is busy (rate limited). Wait a moment, then resume.', reason: 'network' };
  }
  if (/HTTP 404|HTTP 403/i.test(raw)) {
    return { message: `Could not fetch the model file (${raw}).`, reason: 'network' };
  }
  return { message: raw.slice(0, 220), reason: 'unknown' };
}

function partialPath(root: DataRoot, filename: string) {
  return path.join(root.modelsDir, `${filename}.part`);
}

function destPath(root: DataRoot, filename: string) {
  return path.join(root.modelsDir, filename);
}

function safeUnlink(file: string) {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

function freeDiskBytes(dir: string): number | null {
  try {
    // Node 18.13+ / Electron 35
    const s = (fs as typeof fs & { statfsSync?: (p: string) => { bavail: number; bsize: number } }).statfsSync?.(dir);
    if (s && s.bavail != null && s.bsize != null) return Number(s.bavail) * Number(s.bsize);
  } catch {
    /* ignore */
  }
  return null;
}

export function getActiveDownload(id: string): DownloadProgress | null {
  const d = downloads.get(id);
  if (!d) return null;
  return {
    id,
    received: d.received,
    total: d.total,
    done: false,
    percent: d.total > 0 ? Math.min(99.5, (d.received / d.total) * 100) : 0,
  };
}

export function listLocalModels(
  root: DataRoot,
): Array<
  ModelCatalogItem & {
    installed: boolean;
    path?: string;
    downloading: boolean;
    paused: boolean;
    received: number;
    total: number;
    percent: number;
  }
> {
  root.ensureDirs();
  return MODEL_CATALOG.map((m) => {
    const dest = destPath(root, m.filename);
    const tmp = partialPath(root, m.filename);
    const installed = fs.existsSync(dest);
    const active = downloads.get(m.id);
    let received = 0;
    let total = m.sizeBytes;
    let downloading = false;
    let paused = false;

    if (active && !active.abort) {
      downloading = true;
      received = active.received;
      total = active.total || m.sizeBytes;
    } else if (!installed && fs.existsSync(tmp)) {
      try {
        received = fs.statSync(tmp).size;
        total = m.sizeBytes;
        paused = received > 0;
      } catch {
        received = 0;
      }
    }

    const percent = installed
      ? 100
      : total > 0
        ? Math.min(99.5, (received / total) * 100)
        : 0;

    return {
      ...m,
      installed,
      path: installed ? dest : undefined,
      downloading,
      paused,
      received,
      total,
      percent,
    };
  });
}

export function deleteModel(root: DataRoot, id: string): boolean {
  stopDownload(id, { keepPartial: false, reason: 'cancelled', silent: true });
  const item = MODEL_CATALOG.find((m) => m.id === id);
  if (!item) return false;
  safeUnlink(destPath(root, item.filename));
  safeUnlink(partialPath(root, item.filename));
  return true;
}

export function isDownloading(id: string): boolean {
  const d = downloads.get(id);
  return Boolean(d && !d.abort);
}

/**
 * Stop an active download.
 * - pause: keep .part so Resume works
 * - cancel: delete .part
 */
export function stopDownload(
  id: string,
  opts: { keepPartial: boolean; reason?: string; silent?: boolean } = { keepPartial: false },
): { ok: boolean; wasActive: boolean } {
  const item = MODEL_CATALOG.find((m) => m.id === id);
  const d = downloads.get(id);
  if (!d) {
    if (!opts.keepPartial && item) {
      // Cancel with no active request — still clear leftover partial if requested
      // (caller may pass root via deleteModel; here we only know catalog filename)
    }
    return { ok: true, wasActive: false };
  }

  d.abort = true;
  d.keepPartial = opts.keepPartial;

  try {
    d.res?.destroy();
  } catch {
    /* ignore */
  }
  try {
    d.req?.destroy();
  } catch {
    /* ignore */
  }
  try {
    d.out?.destroy();
  } catch {
    /* ignore */
  }

  const received = d.received;
  const total = d.total;
  downloads.delete(id);

  if (!opts.keepPartial && item) {
    // Best-effort: partial path needs models dir — reconstruct from common userData layout via dest name only if we have filename
    // deleteModel handles full cleanup; for cancel from UI we need root — see cancelDownload(root, id)
  }

  if (!opts.silent) {
    const reason = opts.reason || (opts.keepPartial ? 'paused' : 'cancelled');
    broadcastProgress({
      id,
      received: opts.keepPartial ? received : 0,
      total: opts.keepPartial ? total : 0,
      done: true,
      error:
        reason === 'paused'
          ? undefined
          : reason === 'cancelled'
            ? 'Download cancelled'
            : undefined,
      percent: opts.keepPartial && total > 0 ? Math.min(99.5, (received / total) * 100) : 0,
      reason,
    });
  }

  return { ok: true, wasActive: true };
}

export function pauseDownload(root: DataRoot, id: string) {
  return stopDownload(id, { keepPartial: true, reason: 'paused' });
}

export function cancelDownload(root: DataRoot, id: string) {
  const item = MODEL_CATALOG.find((m) => m.id === id);
  const result = stopDownload(id, { keepPartial: false, reason: 'cancelled' });
  if (item) safeUnlink(partialPath(root, item.filename));
  broadcastProgress({
    id,
    received: 0,
    total: item?.sizeBytes || 0,
    done: true,
    error: 'Download cancelled',
    percent: 0,
    reason: 'cancelled',
  });
  return result;
}

/**
 * Start (or resume) a model download in the background.
 * Resolves immediately once the request is underway — progress is broadcast.
 */
export function startDownload(root: DataRoot, id: string): { ok: true } | { ok: false; error: string } {
  if (isDownloading(id)) return { ok: true };
  // Clear any aborted zombie entry
  if (downloads.has(id)) downloads.delete(id);

  const item = MODEL_CATALOG.find((m) => m.id === id);
  if (!item) return { ok: false, error: 'Unknown model' };

  root.ensureDirs();
  const dest = destPath(root, item.filename);
  const tmp = partialPath(root, item.filename);

  if (fs.existsSync(dest)) {
    broadcastProgress({ id, received: item.sizeBytes, total: item.sizeBytes, done: true, percent: 100 });
    return { ok: true };
  }

  let startAt = 0;
  if (fs.existsSync(tmp)) {
    try {
      startAt = fs.statSync(tmp).size;
    } catch {
      startAt = 0;
    }
  }

  const remaining = Math.max(0, item.sizeBytes - startAt);
  const free = freeDiskBytes(root.modelsDir);
  if (free != null && remaining > 0 && free < remaining + 50_000_000) {
    return {
      ok: false,
      error: 'Not enough disk space for this model. Free some space, then try again.',
    };
  }

  const state: ActiveDownload = {
    abort: false,
    keepPartial: true,
    received: startAt,
    total: item.sizeBytes,
    lastEmit: 0,
  };
  downloads.set(id, state);
  emitThrottled(state, id, true);

  const cleanupStreams = () => {
    try {
      state.res?.removeAllListeners();
    } catch {
      /* ignore */
    }
    try {
      state.out?.removeAllListeners();
    } catch {
      /* ignore */
    }
  };

  const finishOk = () => {
    cleanupStreams();
    try {
      if (!fs.existsSync(tmp)) {
        throw new Error('Download file missing — please try again');
      }
      const size = fs.statSync(tmp).size;
      if (state.total > 0 && size < state.total * 0.98) {
        throw new Error('Download incomplete — please resume to finish');
      }
      try {
        fs.renameSync(tmp, dest);
      } catch {
        fs.copyFileSync(tmp, dest);
        safeUnlink(tmp);
      }
      downloads.delete(id);
      broadcastProgress({
        id,
        received: state.total || size,
        total: state.total || size,
        done: true,
        percent: 100,
      });
    } catch (err) {
      downloads.delete(id);
      const { message, reason } = friendlyDownloadError(err);
      broadcastProgress({
        id,
        received: state.received,
        total: state.total,
        done: true,
        error: message,
        percent: state.total > 0 ? Math.min(99.5, (state.received / state.total) * 100) : 0,
        reason,
      });
    }
  };

  const fail = (err: unknown) => {
    cleanupStreams();
    if (state.abort) return;
    downloads.delete(id);
    const { message, reason } = friendlyDownloadError(err);
    broadcastProgress({
      id,
      received: state.received,
      total: state.total,
      done: true,
      error: message,
      percent: state.total > 0 ? Math.min(99.5, (state.received / state.total) * 100) : 0,
      reason,
    });
  };

  const get = (url: string, redirects = 0) => {
    if (state.abort) return;
    if (redirects > 8) {
      fail(new Error('Too many redirects'));
      return;
    }
    const lib = url.startsWith('https') ? https : http;
    const headers: Record<string, string> = {
      'User-Agent': 'Daybook/1.0',
      Accept: '*/*',
    };
    if (startAt > 0) headers.Range = `bytes=${startAt}-`;

    const req = lib.get(url, { headers, timeout: 60_000 }, (res) => {
      state.res = res;
      if (state.abort) {
        res.destroy();
        return;
      }

      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        get(next, redirects + 1);
        return;
      }

      if (res.statusCode !== 200 && res.statusCode !== 206) {
        fail(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }

      if (res.statusCode === 200 && startAt > 0) {
        startAt = 0;
        state.received = 0;
        safeUnlink(tmp);
      }

      const contentLength = Number(res.headers['content-length'] || 0);
      if (res.statusCode === 206 && contentLength) {
        state.total = startAt + contentLength;
      } else if (res.statusCode === 200 && contentLength) {
        state.total = contentLength;
      } else {
        state.total = Math.max(state.total, item.sizeBytes);
      }

      let settled = false;
      const out = fs.createWriteStream(tmp, {
        flags: startAt > 0 && res.statusCode === 206 ? 'a' : 'w',
      });
      state.out = out;

      const settleAbort = () => {
        if (settled) return;
        settled = true;
        cleanupStreams();
        downloads.delete(id);
        if (!state.keepPartial) safeUnlink(tmp);
        broadcastProgress({
          id,
          received: state.keepPartial ? state.received : 0,
          total: state.keepPartial ? state.total : item.sizeBytes,
          done: true,
          error: state.keepPartial ? undefined : 'Download cancelled',
          percent:
            state.keepPartial && state.total > 0
              ? Math.min(99.5, (state.received / state.total) * 100)
              : 0,
          reason: state.keepPartial ? 'paused' : 'cancelled',
        });
      };

      res.on('data', (chunk: Buffer) => {
        if (state.abort) {
          try {
            res.destroy();
          } catch {
            /* ignore */
          }
          try {
            out.destroy();
          } catch {
            /* ignore */
          }
          settleAbort();
          return;
        }
        state.received += chunk.length;
        emitThrottled(state, id);
      });

      res.on('error', (err) => {
        try {
          out.destroy();
        } catch {
          /* ignore */
        }
        if (state.abort) settleAbort();
        else fail(err);
      });

      out.on('error', (err) => {
        try {
          res.destroy();
        } catch {
          /* ignore */
        }
        if (state.abort) settleAbort();
        else fail(err);
      });

      out.on('finish', () => {
        if (settled) return;
        if (state.abort) {
          settleAbort();
          return;
        }
        settled = true;
        finishOk();
      });

      out.on('close', () => {
        if (state.abort && !settled) settleAbort();
      });

      res.pipe(out);
    });

    state.req = req;
    downloads.set(id, state);

    req.setTimeout(60_000, () => {
      req.destroy(new Error('ETIMEDOUT'));
    });

    req.on('error', (err) => {
      if (state.abort) {
        downloads.delete(id);
        if (!state.keepPartial) safeUnlink(tmp);
        broadcastProgress({
          id,
          received: state.keepPartial ? state.received : 0,
          total: state.keepPartial ? state.total : item.sizeBytes,
          done: true,
          error: state.keepPartial ? undefined : 'Download cancelled',
          percent:
            state.keepPartial && state.total > 0
              ? Math.min(99.5, (state.received / state.total) * 100)
              : 0,
          reason: state.keepPartial ? 'paused' : 'cancelled',
        });
      } else {
        fail(err);
      }
    });
  };

  get(item.url);
  return { ok: true };
}

/** @deprecated Prefer startDownload — kept for callers that await completion. */
export function downloadModel(
  root: DataRoot,
  id: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const started = startDownload(root, id);
    if (!started.ok) {
      reject(new Error(started.error));
      return;
    }
    const item = MODEL_CATALOG.find((m) => m.id === id)!;
    const dest = destPath(root, item.filename);
    if (fs.existsSync(dest) && !downloads.has(id)) {
      resolve(dest);
      return;
    }

    const tick = setInterval(() => {
      if (fs.existsSync(dest) && !isDownloading(id)) {
        clearInterval(tick);
        onProgress({ id, received: item.sizeBytes, total: item.sizeBytes, done: true, percent: 100 });
        resolve(dest);
        return;
      }
      const active = getActiveDownload(id);
      if (active) onProgress(active);
      if (!isDownloading(id) && !fs.existsSync(dest)) {
        clearInterval(tick);
        reject(new Error('Download did not complete'));
      }
    }, 250);
  });
}

/** Pick a GGUF to use for polish: settings selection, else any installed catalog model. */
export function resolvePolishModelId(root: DataRoot, preferredId: string | null | undefined): string | null {
  const tryId = (id: string | null | undefined) => {
    if (!id) return null;
    const item = MODEL_CATALOG.find((m) => m.id === id);
    if (!item) return null;
    return fs.existsSync(destPath(root, item.filename)) ? id : null;
  };
  const preferred = tryId(preferredId);
  if (preferred) return preferred;
  for (const m of MODEL_CATALOG) {
    if (fs.existsSync(destPath(root, m.filename))) return m.id;
  }
  return null;
}
export async function polishText(root: DataRoot, modelId: string | null, raw: string): Promise<string> {
  const { texts } = await polishTexts(root, modelId, [raw]);
  return texts[0];
}

export type PolishBatchResult = {
  texts: string[];
  /** Whether the local LLM actually ran (vs rule-based fallback). */
  mode: 'llm' | 'rule';
};

/**
 * Polish many strings with a single model load (EOD drafts polish every bullet).
 * Falls back to rule-based when engine/model unavailable.
 */
export async function polishTexts(
  root: DataRoot,
  modelId: string | null,
  raws: string[],
): Promise<PolishBatchResult> {
  if (!raws.length) return { texts: [], mode: 'rule' };

  const cleaned = raws.map((r) => r.trim());
  const ruleOnly = (): PolishBatchResult => ({
    texts: cleaned.map((c) => (c ? ruleBasedPolish(c) : c)),
    mode: 'rule',
  });

  if (!modelId) return ruleOnly();
  const item = MODEL_CATALOG.find((m) => m.id === modelId);
  if (!item) return ruleOnly();
  const modelPath = destPath(root, item.filename);
  if (!fs.existsSync(modelPath)) return ruleOnly();

  try {
    const { loadLlamaModule } = await import('./engine');
    const mod = await loadLlamaModule(root);
    if (!mod) return ruleOnly();

    const llama = await mod.getLlama({
      gpu: false,
      build: 'never',
      skipDownload: true,
      progressLogs: false,
    });
    const model = await (llama as { loadModel: (o: { modelPath: string }) => Promise<unknown> }).loadModel({
      modelPath,
    });
    const context = await (
      model as { createContext: () => Promise<{ getSequence: () => unknown }> }
    ).createContext();
    const session = new mod.LlamaChatSession({ contextSequence: context.getSequence() });

    const out: string[] = [];
    for (const text of cleaned) {
      if (!text) {
        out.push(text);
        continue;
      }
      try {
        const result = await session.prompt(
          [
            'Fix spelling and grammar in this work-update bullet for a professional email.',
            'Keep the same meaning. Output ONLY the corrected bullet as one line.',
            'No quotes, no bullets, no explanation.',
            '',
            `Text: ${text}`,
          ].join('\n'),
          { maxTokens: 120 },
        );
        let polished = String(result || '')
          .trim()
          .replace(/^["'`]+|["'`]+$/g, '')
          .replace(/^[-•*]\s*/, '')
          .replace(/\s+/g, ' ');
        if (/^you polish|rewrite this|one line only|fix spelling/i.test(polished)) {
          polished = '';
        }
        if (!polished || polished.length > Math.max(text.length * 1.5, text.length + 60)) {
          out.push(ruleBasedPolish(text));
        } else {
          out.push(polished);
        }
      } catch {
        out.push(ruleBasedPolish(text));
      }
    }

    try {
      const dispose = (model as { dispose?: () => Promise<void> }).dispose;
      if (typeof dispose === 'function') await dispose.call(model);
    } catch {
      /* ignore */
    }

    return { texts: out, mode: 'llm' };
  } catch {
    return ruleOnly();
  }
}
