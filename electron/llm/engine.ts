/**
 * Optional Local AI runtime (node-llama-cpp + platform package + JS deps).
 * Not shipped in the base installer — downloaded into userData on demand.
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { BrowserWindow } from 'electron';
import * as tar from 'tar';
import type { DataRoot } from '../../shared/store';

/** Pinned JS API — platform binary version resolved from optionalDependencies. */
export const LLM_ENGINE_VERSION = '3.19.1';

export type EngineProgress = {
  phase: 'download' | 'extract' | 'done' | 'error';
  packageName?: string;
  received?: number;
  total?: number;
  percent: number;
  error?: string;
  message?: string;
};

export type EngineStatus = {
  installed: boolean;
  version: string | null;
  platformPackage: string | null;
  installing: boolean;
  path: string;
  supported: boolean;
};

type ActiveEngineInstall = {
  abort: boolean;
  req?: http.ClientRequest;
};

let activeInstall: ActiveEngineInstall | null = null;

type LlamaModule = {
  getLlama: (options?: Record<string, unknown>) => Promise<unknown>;
  LlamaChatSession: new (opts: { contextSequence: unknown }) => {
    prompt: (text: string, opts?: { maxTokens?: number }) => Promise<unknown>;
  };
};

let cachedModule: LlamaModule | null = null;
let cachedLoadError: string | null = null;

function broadcast(progress: EngineProgress) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('engine:progress', progress);
  }
}

/** CPU-first platform packages (no CUDA/Vulkan in the optional engine). */
export function platformBinaryPackage(): string | null {
  if (process.platform === 'win32' && process.arch === 'x64') return '@node-llama-cpp/win-x64';
  if (process.platform === 'win32' && process.arch === 'arm64') return '@node-llama-cpp/win-arm64';
  if (process.platform === 'darwin' && process.arch === 'arm64') return '@node-llama-cpp/mac-arm64-metal';
  if (process.platform === 'darwin' && process.arch === 'x64') return '@node-llama-cpp/mac-x64';
  if (process.platform === 'linux' && process.arch === 'x64') return '@node-llama-cpp/linux-x64';
  if (process.platform === 'linux' && process.arch === 'arm64') return '@node-llama-cpp/linux-arm64';
  return null;
}

export function engineRoot(root: DataRoot): string {
  return path.join(root.root, 'llm-engine');
}

function markerPath(root: DataRoot): string {
  return path.join(engineRoot(root), 'engine.json');
}

function hasRunnableEngine(dir: string, platformPkg: string): boolean {
  const llamaEntry = path.join(dir, 'node_modules', 'node-llama-cpp', 'package.json');
  const nativeEntry = path.join(dir, 'node_modules', ...platformPkg.split('/'), 'package.json');
  // Runtime JS deps — missing these caused "Cannot find package lifecycle-utils"
  const lifecycle = path.join(dir, 'node_modules', 'lifecycle-utils', 'package.json');
  return fs.existsSync(llamaEntry) && fs.existsSync(nativeEntry) && fs.existsSync(lifecycle);
}

export function getEngineStatus(root: DataRoot): EngineStatus {
  root.ensureDirs();
  const dir = engineRoot(root);
  const platformPkg = platformBinaryPackage();
  const marker = markerPath(root);
  const installed =
    Boolean(platformPkg) && fs.existsSync(marker) && hasRunnableEngine(dir, platformPkg!);

  let version: string | null = null;
  if (installed) {
    try {
      version = (JSON.parse(fs.readFileSync(marker, 'utf8')) as { version?: string }).version || null;
    } catch {
      version = null;
    }
  }

  return {
    installed,
    version,
    platformPackage: platformPkg,
    installing: Boolean(activeInstall && !activeInstall.abort),
    path: dir,
    supported: Boolean(platformPkg),
  };
}

let adoptAttempted = false;

/**
 * If packages exist but marker was cleared after a failed verify (old require/file:// bug),
 * re-verify with ESM import and adopt the install. Runs at most once per process.
 */
export async function adoptExistingEngine(root: DataRoot): Promise<EngineStatus> {
  const status = getEngineStatus(root);
  if (status.installed) return status;
  if (adoptAttempted) return status;
  adoptAttempted = true;
  const platformPkg = status.platformPackage;
  if (!platformPkg || !hasRunnableEngine(status.path, platformPkg)) return status;

  try {
    clearLlamaModuleCache();
    fs.writeFileSync(
      markerPath(root),
      `${JSON.stringify(
        {
          version: LLM_ENGINE_VERSION,
          platformPackage: platformPkg,
          installedAt: new Date().toISOString(),
          adopted: true,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    const mod = await loadLlamaModule(root);
    if (!mod) throw new Error('adopt failed');
    return getEngineStatus(root);
  } catch {
    try {
      fs.rmSync(markerPath(root), { force: true });
    } catch {
      /* ignore */
    }
    clearLlamaModuleCache();
    return getEngineStatus(root);
  }
}

function httpGetResponse(url: string, redirects = 0): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    if (redirects > 8) {
      reject(new Error('Too many redirects'));
      return;
    }
    if (activeInstall?.abort) {
      reject(new Error('cancelled'));
      return;
    }
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      { headers: { 'User-Agent': 'Daybook/1.1', Accept: '*/*' }, timeout: 120_000 },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          httpGetResponse(new URL(res.headers.location, url).toString(), redirects + 1).then(resolve, reject);
          return;
        }
        resolve(res);
      },
    );
    if (activeInstall) activeInstall.req = req;
    req.on('error', reject);
    req.setTimeout(120_000, () => req.destroy(new Error('ETIMEDOUT')));
  });
}

async function httpGetJson<T>(url: string): Promise<T> {
  const res = await httpGetResponse(url);
  if (res.statusCode !== 200) {
    res.resume();
    throw new Error(`HTTP ${res.statusCode} for ${url}`);
  }
  const chunks: Buffer[] = [];
  for await (const c of res) {
    if (activeInstall?.abort) {
      res.destroy();
      throw new Error('cancelled');
    }
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

async function downloadToFile(
  url: string,
  dest: string,
  onProgress?: (received: number, total: number) => void,
): Promise<void> {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const res = await httpGetResponse(url);
  if (res.statusCode !== 200) {
    res.resume();
    throw new Error(`HTTP ${res.statusCode} for ${url}`);
  }
  const total = Number(res.headers['content-length'] || 0);
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(dest);
    let received = 0;
    res.on('data', (c: Buffer) => {
      if (activeInstall?.abort) {
        res.destroy();
        out.destroy();
        try {
          fs.rmSync(dest, { force: true });
        } catch {
          /* ignore */
        }
        reject(new Error('cancelled'));
        return;
      }
      received += c.length;
      onProgress?.(received, total);
    });
    res.pipe(out);
    out.on('finish', () => resolve());
    out.on('error', reject);
    res.on('error', reject);
  });
}

/** Pin caret/tilde ranges to the minimum stated version (good enough for engine install). */
function pinVersion(range: string): string {
  const m = range.trim().match(/(\d+\.\d+\.\d+(?:-[\w.-]+)?)/);
  if (m) return m[1];
  return range.trim().replace(/^[\^~>=<\s]+/, '');
}

async function resolvePackageTarball(
  packageName: string,
  version: string,
): Promise<{ tarball: string; version: string }> {
  const encoded = packageName.replace('/', '%2F');
  try {
    const meta = await httpGetJson<{ dist?: { tarball?: string }; version?: string }>(
      `https://registry.npmjs.org/${encoded}/${version}`,
    );
    const tarball = meta.dist?.tarball;
    if (!tarball) throw new Error(`No tarball for ${packageName}@${version}`);
    return { tarball, version: meta.version || version };
  } catch {
    // Caret pin may not exist as an exact publish — use latest
    const packument = await httpGetJson<{
      'dist-tags'?: { latest?: string };
      versions?: Record<string, { dist?: { tarball?: string } }>;
    }>(`https://registry.npmjs.org/${encoded}`);
    const latest = packument['dist-tags']?.latest;
    if (!latest || !packument.versions?.[latest]?.dist?.tarball) {
      throw new Error(`Could not resolve ${packageName}@${version}`);
    }
    return { tarball: packument.versions[latest].dist!.tarball!, version: latest };
  }
}

async function resolveNativeVersion(platformPkg: string, llamaVersion: string): Promise<string> {
  const meta = await httpGetJson<{
    optionalDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
  }>(`https://registry.npmjs.org/node-llama-cpp/${llamaVersion}`);
  const fromOptional = meta.optionalDependencies?.[platformPkg];
  const fromDeps = meta.dependencies?.[platformPkg];
  const ver = fromOptional || fromDeps;
  if (ver) return pinVersion(ver);
  return llamaVersion;
}

async function extractNpmPackage(tgzPath: string, destNodeModules: string, packageName: string) {
  fs.mkdirSync(destNodeModules, { recursive: true });
  const extractRoot = path.join(destNodeModules, '._extract_tmp');
  fs.rmSync(extractRoot, { recursive: true, force: true });
  fs.mkdirSync(extractRoot, { recursive: true });

  await tar.x({ file: tgzPath, cwd: extractRoot });
  const extracted = path.join(extractRoot, 'package');
  if (!fs.existsSync(extracted)) {
    throw new Error(`Unexpected tarball layout for ${packageName}`);
  }
  const target = path.join(destNodeModules, ...packageName.split('/'));
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(extracted, target);
  fs.rmSync(extractRoot, { recursive: true, force: true });
  fs.rmSync(tgzPath, { force: true });
}

type PackumentDeps = {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

/**
 * Flat-install production dependency tree into node_modules (no npm CLI required).
 * Skips optionalDependencies except packages explicitly requested as roots.
 */
async function installDependencyTree(
  roots: Array<{ name: string; version: string }>,
  destNodeModules: string,
  tarballDir: string,
  onProgress: (pct: number, message: string, packageName?: string) => void,
) {
  const queue: Array<{ name: string; version: string }> = [...roots];
  const installed = new Set<string>();
  let done = 0;
  // Estimate ~40 packages for progress (grows as we discover deps)
  let estimated = 40;

  while (queue.length) {
    if (activeInstall?.abort) throw new Error('cancelled');
    const pkg = queue.shift()!;
    if (installed.has(pkg.name)) continue;
    installed.add(pkg.name);
    estimated = Math.max(estimated, installed.size + queue.length);

    onProgress(
      Math.min(88, Math.round((done / estimated) * 88)),
      `Installing ${pkg.name}@${pkg.version}…`,
      pkg.name,
    );

    const { tarball, version } = await resolvePackageTarball(pkg.name, pkg.version);
    const tgzPath = path.join(tarballDir, `${pkg.name.replace(/[@/]/g, '_')}.tgz`);
    await downloadToFile(tarball, tgzPath, (received, total) => {
      if (total <= 0) return;
      const base = (done / estimated) * 88;
      const slice = (received / total) * (88 / estimated);
      onProgress(Math.min(88, Math.round(base + slice)), `Downloading ${pkg.name}…`, pkg.name);
    });
    await extractNpmPackage(tgzPath, destNodeModules, pkg.name);
    done += 1;

    const pkgJsonPath = path.join(destNodeModules, ...pkg.name.split('/'), 'package.json');
    const meta = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as PackumentDeps;
    for (const [dep, range] of Object.entries(meta.dependencies || {})) {
      if (installed.has(dep)) continue;
      if (queue.some((q) => q.name === dep)) continue;
      queue.push({ name: dep, version: pinVersion(range) });
    }
  }

  onProgress(90, 'Dependencies installed');
}

function runNpmInstall(cwd: string, packages: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    // Windows: spawning npm.cmd without shell throws spawn EINVAL (breaks install entirely).
    const npmCmd = 'npm';
    let child;
    try {
      child = spawn(
        npmCmd,
        [
          'install',
          ...packages,
          '--omit=dev',
          '--omit=optional',
          '--no-fund',
          '--no-audit',
          '--no-package-lock',
          '--ignore-scripts',
        ],
        {
          cwd,
          env: { ...process.env, npm_config_progress: 'false' },
          windowsHide: true,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
    } catch (e) {
      console.warn('[daybook] npm spawn failed:', e);
      resolve(false);
      return;
    }

    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', (err) => {
      console.warn('[daybook] npm engine install error:', err.message);
      resolve(false);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(true);
      else {
        console.warn('[daybook] npm engine install failed:', stderr.slice(0, 500));
        resolve(false);
      }
    });
  });
}

export function cancelEngineInstall() {
  if (!activeInstall) return { ok: true };
  activeInstall.abort = true;
  try {
    activeInstall.req?.destroy();
  } catch {
    /* ignore */
  }
  return { ok: true };
}

export async function installEngine(root: DataRoot): Promise<{ ok: true } | { ok: false; error: string }> {
  if (activeInstall && !activeInstall.abort) {
    return { ok: false, error: 'AI engine install is already running.' };
  }
  const platformPkg = platformBinaryPackage();
  if (!platformPkg) {
    return { ok: false, error: `Local AI is not supported on ${process.platform}/${process.arch}.` };
  }

  activeInstall = { abort: false };
  clearLlamaModuleCache();
  const dir = engineRoot(root);
  const nodeModules = path.join(dir, 'node_modules');
  const tarballDir = path.join(dir, '.tarballs');

  try {
    root.ensureDirs();
    // Clean partial/broken installs (e.g. missing lifecycle-utils)
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(nodeModules, { recursive: true });
    fs.mkdirSync(tarballDir, { recursive: true });

    const nativeVersion = await resolveNativeVersion(platformPkg, LLM_ENGINE_VERSION);

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      `${JSON.stringify(
        {
          name: 'daybook-llm-engine',
          private: true,
          version: LLM_ENGINE_VERSION,
          dependencies: {
            'node-llama-cpp': LLM_ENGINE_VERSION,
            [platformPkg]: nativeVersion,
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    broadcast({
      phase: 'download',
      percent: 2,
      message: 'Installing AI engine and dependencies…',
      packageName: 'node-llama-cpp',
    });

    // npm (when available) is fastest; registry walker works without Node on office PCs.
    // Never let npm spawn failures abort the whole install (was: spawn EINVAL on Windows).
    let usedNpm = false;
    const npmProgress = setInterval(() => {
      broadcast({
        phase: 'download',
        percent: 15,
        message: 'Installing AI engine via npm…',
        packageName: 'node-llama-cpp',
      });
    }, 2000);
    let npmOk = false;
    try {
      npmOk = await runNpmInstall(dir, [
        `node-llama-cpp@${LLM_ENGINE_VERSION}`,
        `${platformPkg}@${nativeVersion}`,
      ]);
    } finally {
      clearInterval(npmProgress);
    }

    if (npmOk && hasRunnableEngine(dir, platformPkg)) {
      usedNpm = true;
      broadcast({ phase: 'extract', percent: 90, message: 'Verifying engine…' });
    } else {
      broadcast({
        phase: 'download',
        percent: 5,
        message: 'Downloading AI engine packages…',
      });
      // Fresh tree via registry (includes lifecycle-utils and transitive deps)
      fs.rmSync(nodeModules, { recursive: true, force: true });
      fs.mkdirSync(nodeModules, { recursive: true });
      await installDependencyTree(
        [
          { name: 'node-llama-cpp', version: LLM_ENGINE_VERSION },
          { name: platformPkg, version: nativeVersion },
        ],
        nodeModules,
        tarballDir,
        (pct, message, packageName) => {
          broadcast({
            phase: pct >= 90 ? 'extract' : 'download',
            percent: pct,
            message,
            packageName,
          });
        },
      );
    }

    try {
      fs.rmSync(tarballDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }

    if (!hasRunnableEngine(dir, platformPkg)) {
      throw new Error(
        'AI engine install incomplete (missing runtime packages). Check your network and try again.',
      );
    }

    // Verify native + JS load before marking installed
    try {
      clearLlamaModuleCache();
      fs.writeFileSync(
        markerPath(root),
        `${JSON.stringify(
          {
            version: LLM_ENGINE_VERSION,
            platformPackage: platformPkg,
            nativeVersion,
            via: usedNpm ? 'npm' : 'registry',
            installedAt: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      const mod = await loadLlamaModule(root);
      if (!mod) throw new Error('Engine files installed but could not be loaded.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        fs.rmSync(markerPath(root), { force: true });
      } catch {
        /* ignore */
      }
      clearLlamaModuleCache();
      broadcast({ phase: 'error', percent: 0, error: msg });
      activeInstall = null;
      return { ok: false, error: msg };
    }

    broadcast({ phase: 'done', percent: 100, message: 'AI engine ready' });
    activeInstall = null;
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    activeInstall = null;
    if (message === 'cancelled') {
      broadcast({ phase: 'error', percent: 0, error: 'AI engine install cancelled' });
      return { ok: false, error: 'Install cancelled' };
    }
    broadcast({ phase: 'error', percent: 0, error: message });
    return { ok: false, error: message };
  }
}

export function uninstallEngine(root: DataRoot): boolean {
  cancelEngineInstall();
  clearLlamaModuleCache();
  const dir = engineRoot(root);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Load node-llama-cpp from userData.
 * Package is ESM (top-level await). TypeScript CommonJS emit rewrites `import()` to
 * `require()`, which cannot load file:// ESM — use a real dynamic import instead.
 */
export async function loadLlamaModule(root: DataRoot): Promise<LlamaModule | null> {
  const status = getEngineStatus(root);
  if (!status.installed) return null;
  if (cachedModule) return cachedModule;
  if (cachedLoadError) throw new Error(cachedLoadError);

  const entry = path.join(status.path, 'node_modules', 'node-llama-cpp', 'dist', 'index.js');
  if (!fs.existsSync(entry)) return null;

  try {
    const specifier = pathToFileURL(entry).href;
    // Prevent TS from downleveling to require() — must be native ESM import
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<LlamaModule>;
    const mod = await dynamicImport(specifier);
    cachedModule = mod;
    return mod;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/NODE_MODULE_VERSION|was compiled against a different Node|dlopen/i.test(msg)) {
      cachedLoadError =
        'AI engine binaries do not match this Daybook build. Remove the engine in Local AI and install again, or update Daybook.';
    } else if (/Cannot find package|Cannot find module/i.test(msg)) {
      cachedLoadError = `AI engine is missing a dependency (${msg}). Remove the engine and install again.`;
    } else {
      cachedLoadError = `Could not load AI engine: ${msg}`;
    }
    throw new Error(cachedLoadError);
  }
}

export function clearLlamaModuleCache() {
  cachedModule = null;
  cachedLoadError = null;
}
