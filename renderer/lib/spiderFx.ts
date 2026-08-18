const EVENT = 'sv-fx';
const THWIP_MS = 520;
const LAND_MS = 780;

export type SpiderFxKind = 'thwip' | 'land';

export type SpiderFxDetail = {
  kind: SpiderFxKind;
  from?: { x: number; y: number };
  toSelector: string;
};

let busyUntil = 0;

function allowed() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.getAttribute('data-theme') !== 'spider-verse') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

function pointFromEl(el: HTMLElement | null | undefined) {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Fire a one-shot board burst. Land can interrupt thwip; thwip is skipped while busy. */
export function emitSpiderFx(
  kind: SpiderFxKind,
  opts: { fromEl?: HTMLElement | null; toSelector: string },
) {
  if (!allowed()) return;
  const now = performance.now();
  if (kind === 'thwip' && now < busyUntil) return;
  busyUntil = now + (kind === 'land' ? LAND_MS : THWIP_MS);

  window.dispatchEvent(
    new CustomEvent<SpiderFxDetail>(EVENT, {
      detail: {
        kind,
        from: pointFromEl(opts.fromEl),
        toSelector: opts.toSelector,
      },
    }),
  );
}

export function onSpiderFx(handler: (detail: SpiderFxDetail) => void) {
  const fn = (e: Event) => handler((e as CustomEvent<SpiderFxDetail>).detail);
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

export const SPIDER_FX_MS = { thwip: THWIP_MS, land: LAND_MS } as const;
