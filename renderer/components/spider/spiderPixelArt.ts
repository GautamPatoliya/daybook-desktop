/** Original 16-bit style pixel sprites — inspired web-hero motif, not Marvel assets. */

export type PixelCell = { x: number; y: number; fill: string; w?: number; h?: number };

export const C = {
  red: '#df2a2f',
  redHi: '#ff5054',
  redDk: '#8a1010',
  blue: '#1a7fc4',
  blueHi: '#4aa8e8',
  blueDk: '#0d5088',
  white: '#f0f0ff',
  cream: '#f0dfa8',
  black: '#000000',
  web: 'rgba(200,220,255,0.55)',
  webDim: 'rgba(140,170,210,0.35)',
  panel: '#0a1628',
} as const;

function px(x: number, y: number, fill: string, w = 1, h = 1): PixelCell {
  return { x, y, fill, w, h };
}

function parseGrid(
  grid: string[],
  map: Record<string, string>,
  ox = 0,
  oy = 0,
): PixelCell[] {
  const out: PixelCell[] = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = map[ch];
      if (fill) out.push(px(ox + x, oy + y, fill));
    });
  });
  return out;
}

/** Vertical web strand */
export function webStrand(x: number, y0: number, y1: number, thick = 1): PixelCell[] {
  const out: PixelCell[] = [];
  for (let y = y0; y <= y1; y++) {
    out.push(px(x, y, C.web, thick, 1));
    if (thick === 1 && y % 4 === 0) out.push(px(x - 1, y, C.webDim));
    if (thick === 1 && y % 5 === 2) out.push(px(x + 1, y, C.webDim));
  }
  return out;
}

/** Radial web fan from anchor point */
export function webFan(ox: number, oy: number, radius: number): PixelCell[] {
  const out: PixelCell[] = [];
  for (let r = 4; r <= radius; r += 4) {
    for (let i = -r; i <= r; i += 2) {
      out.push(px(ox + i, oy + r, C.webDim, 2, 1));
      out.push(px(ox + i, oy - r, C.webDim, 2, 1));
      out.push(px(ox - r, oy + i, C.webDim, 1, 2));
      out.push(px(ox + r, oy + i, C.webDim, 1, 2));
    }
  }
  const spokes: Array<[number, number]> = [[1, 0], [0, 1], [1, 1], [-1, 1], [1, -1]];
  spokes.forEach(([dx, dy]) => {
    for (let d = 2; d <= radius; d += 2) {
      out.push(px(ox + dx * d, oy + dy * d, C.web, 1, 1));
    }
  });
  return out;
}

/** Spider creature (16×16 grid placed at ox,oy) */
export type SpiderKind = 'red' | 'blue' | 'ink' | 'gold' | 'hero';

const SPIDER_MAP: Record<string, string> = {
  r: C.red,
  h: C.redHi,
  d: C.redDk,
  b: C.blue,
  c: C.blueHi,
  n: C.blueDk,
  k: C.black,
  w: C.white,
  g: C.cream,
  o: C.web,
  '.': '',
};

const SPIDER_GRIDS: Record<SpiderKind, string[]> = {
  red: [
    '................',
    '...o........o...',
    '..o...rrrr...o..',
    '.o..rrrrrrrr..o.',
    'o..rrhrhrhrr..o.',
    '...rrwwrrwwrr...',
    '..drrrrrrrrrrd..',
    '.d.rrrrrrrrrr.d.',
    '.d..rrrrrrrr..d.',
    '..d...rrrr...d..',
    '.d.....rr.....d.',
    'd...r......r...d',
    '.d.r........r.d.',
    '..r..........r..',
    '.r............r.',
    '................',
  ],
  blue: [
    '................',
    '....o......o....',
    '..o..bbbbbb..o..',
    '.o.bbbbbbbbbb.o.',
    'o..bbccbbccbb.o.',
    '...bbwwbbwwbb...',
    '..nbbbbbbbbbbn..',
    '.n.bbbbbbbbbb.n.',
    '.n..bbbbbbbb..n.',
    '..n...bbbb...n..',
    '.n.....bb.....n.',
    'n...b......b...n',
    '.n.b........b.n.',
    '..b..........b..',
    '.b............b.',
    '................',
  ],
  ink: [
    '................',
    '..o..........o..',
    '.o....kkkk....o.',
    'o...kkkkkkkk...o',
    '...kkkwkkwkkk...',
    '..kkkkkkkkkkkk..',
    '.o.kkkkkkkkkk.o.',
    'o...kkkkkkkk...o',
    '.....kkkkkk.....',
    '....k......k....',
    '...k........k...',
    '..k...k..k...k..',
    '.k...k....k...k.',
    'k...k......k...k',
    '................',
    '................',
  ],
  gold: [
    '................',
    '.o............o.',
    'o....gggggg....o',
    '....gghgghgg....',
    '...ggwwggwwgg...',
    '..dggggggggggd..',
    '.d..gggggggg..d.',
    'd....gggggg....d',
    '......gggg......',
    'd....g....g....d',
    '.d..g......g..d.',
    '..dg........gd..',
    '.d.g........g.d.',
    'd.g..........g.d',
    '.g............g.',
    '................',
  ],
  hero: [
    '................',
    '...o........o...',
    '..o...rrrr...o..',
    '.o..rrrrrrrr..o.',
    'o..rrwwrrwwrr.o.',
    '...rrrrrrrrrr...',
    '..nbbbbbbbbbbn...',
    '.n.bbbrrrrrrbb.n',
    '.n...bbbbbb...n.',
    '..n...bbbb...n..',
    '.b.....bb.....b.',
    'b...r......r...b',
    '.b.r........r.b.',
    '..r..........r..',
    '.r............r.',
    '................',
  ],
};

export function spiderSprite(ox = 0, oy = 0, kind: SpiderKind = 'red'): PixelCell[] {
  return parseGrid(SPIDER_GRIDS[kind], SPIDER_MAP, ox, oy);
}

/** 16×16 shooter pose — add-task thwip burst */
export function thwipSprite(): PixelCell[] {
  return parseGrid(
    [
      '................',
      '......rrrr......',
      '.....rhwwr......',
      '.....rrrrr......',
      '....bbrrrrbb....',
      '...bb.rrrr......',
      '......rr.www....',
      '.........o.o.o..',
      '..........o..o..',
      '...........o....',
      '.....bb.........',
      '....bb..........',
      '...bb...........',
      '................',
      '................',
      '................',
    ],
    SPIDER_MAP,
  );
}

const MASK_MAP: Record<string, string> = {
  k: C.black,
  r: C.red,
  h: C.redHi,
  d: C.redDk,
  w: C.white,
  b: C.blue,
  '.': '',
};

/** Compact mask for HUD chips (16×16). */
export function heroMaskSprite(ox = 0, oy = 0): PixelCell[] {
  return parseGrid(
    [
      '....kkkkkkkk....',
      '..kkrrrrrrrrkk..',
      '.krrwwkrrkwwrrk.',
      '.krwwwwkkwwwwwk.',
      '.krwwwwkkwwwwwk.',
      '.krrwwwkkwwwrrk.',
      '.krrrrrrrrrrrrk.',
      '.krrrddddddrrrk.',
      '.krrrrddddrrrrk.',
      '..krrrrkkrrrrk..',
      '...krrrrrrrrk...',
      '....kkrrrrkk....',
      '.....kkkkkk.....',
      '....bbbbbbbb....',
      '...bbbbbbbbbb...',
      '................',
    ],
    MASK_MAP,
    ox,
    oy,
  );
}

/** Loading-screen portrait — 32×32, hard outline, lenses, web lines. */
export function heroMask32(ox = 0, oy = 0, blink = false): PixelCell[] {
  const cells = parseGrid(
    [
      '................................',
      '............kkkkkkkk............',
      '..........kkrrrrrrrrkk..........',
      '........kkrrhhhhhhhhrrkk........',
      '.......krrhhhhhhhhhhhhrrk.......',
      '......krrhrrrrrrrrrrrrhrrk......',
      '.....krrrrrrrrrrrrrrrrrrrrk.....',
      '....krrrwwwkkrrrrrrkkwwwrrrk....',
      '...krrwwwwwkkrrrrrrkkwwwwwrrk...',
      '..kkrwwwwwwkrrrrrrrrkwwwwwwrkk..',
      '..krwwwwwwwkrrrrrrrrkwwwwwwwrk..',
      '..krwwkwwwwkrrkkkkrrkwwwwkwwrk..',
      '..krwwwwwwwwkkkkkkkkwwwwwwwwrk..',
      '..krwwwwwwwkrrrrrrrrkwwwwwwwrk..',
      '..krrwwwwwkrrddddddrrkwwwwwrrk..',
      '...krrwwwkrrrddddddrrrkwwwrrk...',
      '...krrrrrkrrrddddddrrrkrrrrrk...',
      '....krrrrkrrrrddddrrrrkrrrrk....',
      '....krrdrrkrrrddddrrrkrrdrrk....',
      '.....krrdrrkrrkkkkrrkrrdrrk.....',
      '.....krrrdrkrrrrrrrrkrdrrrk.....',
      '......krrrrkrrrrrrrrkrrrrk......',
      '.......krrrrkrrrrrrkrrrrk.......',
      '........krrrrkkkkkkrrrrk........',
      '.........krrrrrrrrrrrrk.........',
      '..........kkrrrrrrrrkk..........',
      '............kkkkkkkk............',
      '.............kkkkkk.............',
      '............krrrrrrk............',
      '..........kkbbbbbbbbkk..........',
      '........kkbbbbbbbbbbbbkk........',
      '.......kbbbbkkkkkkkkbbbbk.......',
    ],
    MASK_MAP,
    ox,
    oy,
  );
  if (!blink) return cells;
  return cells.map((c) => {
    if (c.fill !== C.white) return c;
    if (c.y === oy + 11) return c;
    return { ...c, fill: C.black };
  });
}

/** Swinging hero — body on diagonal web (fits 48×48) */
export function sceneSwing(): PixelCell[] {
  const out: PixelCell[] = [];
  // diagonal web
  for (let i = 0; i < 28; i++) {
    out.push(px(8 + i, 4 + Math.floor(i * 0.55), C.web, 1, 1));
    if (i % 3 === 0) out.push(px(8 + i, 5 + Math.floor(i * 0.55), C.webDim));
  }
  // body — red/blue suit simplified
  const body: Array<[number, number, string]> = [
    [28, 18, C.red], [29, 18, C.red], [30, 18, C.red],
    [27, 19, C.redHi], [28, 19, C.white], [29, 19, C.white], [30, 19, C.redHi], [31, 19, C.red],
    [26, 20, C.blue], [27, 20, C.red], [28, 20, C.red], [29, 20, C.red], [30, 20, C.red], [31, 20, C.blue],
    [25, 21, C.blueHi], [26, 21, C.blue], [27, 21, C.redDk], [28, 21, C.red], [29, 21, C.red], [30, 21, C.blue], [31, 21, C.blueHi],
    [24, 22, C.blue], [25, 22, C.blue], [26, 22, C.blue], [27, 22, C.red], [28, 22, C.red], [29, 22, C.blue], [30, 22, C.blue], [31, 22, C.blue], [32, 22, C.blue],
    [23, 23, C.blue], [24, 23, C.blue], [32, 23, C.blue], [33, 23, C.blue],
    [22, 24, C.redHi], [23, 24, C.red], [33, 24, C.red], [34, 24, C.redHi],
    [21, 25, C.red], [22, 25, C.red], [34, 25, C.red], [35, 25, C.red],
    [20, 26, C.redDk], [21, 26, C.red], [35, 26, C.red], [36, 26, C.redDk],
    [19, 27, C.blueDk], [20, 27, C.blue], [36, 27, C.blue], [37, 27, C.blueDk],
    [18, 28, C.blue], [19, 28, C.blue], [37, 28, C.blue], [38, 28, C.blue],
  ];
  body.forEach(([x, y, fill]) => out.push(px(x, y, fill, 1, 1)));
  return out;
}

/** Crouch landing pose — done column */
export function sceneLand(): PixelCell[] {
  const out: PixelCell[] = [];
  // rooftop ledge
  for (let x = 8; x < 40; x++) out.push(px(x, 38, x % 2 ? C.blueDk : C.blue, 1, 1));
  for (let x = 6; x < 42; x++) out.push(px(x, 39, C.black, 1, 1));

  const pxBody: Array<[number, number, string, number?, number?]> = [
    [20, 28, C.red, 2, 2], [22, 28, C.redHi, 2, 1], [24, 28, C.redHi, 2, 1], [26, 28, C.red, 2, 2],
    [19, 30, C.red], [20, 30, C.white], [21, 30, C.white], [22, 30, C.red], [24, 30, C.red], [25, 30, C.white], [26, 30, C.white], [27, 30, C.red],
    [18, 31, C.red], [19, 31, C.red], [20, 31, C.redDk], [21, 31, C.redDk], [22, 31, C.redDk], [23, 31, C.redDk], [24, 31, C.redDk], [25, 31, C.redDk], [26, 31, C.redDk], [27, 31, C.red], [28, 31, C.red],
    [17, 32, C.blue], [18, 32, C.red], [19, 32, C.red], [20, 32, C.red], [21, 32, C.red], [22, 32, C.red], [23, 32, C.red], [24, 32, C.red], [25, 32, C.red], [26, 32, C.red], [27, 32, C.red], [28, 32, C.red], [29, 32, C.blue],
    [16, 33, C.blueHi], [17, 33, C.blue], [18, 33, C.blue], [19, 33, C.blueDk], [20, 33, C.red], [21, 33, C.red], [22, 33, C.red], [23, 33, C.red], [24, 33, C.red], [25, 33, C.red], [26, 33, C.blueDk], [27, 33, C.blue], [28, 33, C.blue], [29, 33, C.blueHi],
    [15, 34, C.blue], [16, 34, C.blue], [17, 34, C.blue], [18, 34, C.blue], [19, 34, C.blue], [20, 34, C.redDk], [21, 34, C.redDk], [22, 34, C.redDk], [23, 34, C.redDk], [24, 34, C.redDk], [25, 34, C.blue], [26, 34, C.blue], [27, 34, C.blue], [28, 34, C.blue], [29, 34, C.blue], [30, 34, C.blue],
    [14, 35, C.blueDk], [15, 35, C.blue], [16, 35, C.blue], [17, 35, C.blue], [18, 35, C.blue], [19, 35, C.blue], [20, 35, C.blue], [21, 35, C.blue], [22, 35, C.blue], [23, 35, C.blue], [24, 35, C.blue], [25, 35, C.blue], [26, 35, C.blue], [27, 35, C.blue], [28, 35, C.blue], [29, 35, C.blue], [30, 35, C.blue], [31, 35, C.blueDk],
    [13, 36, C.red], [14, 36, C.red], [15, 36, C.redHi], [29, 36, C.redHi], [30, 36, C.red], [31, 36, C.red], [32, 36, C.red],
    [12, 37, C.redDk], [13, 37, C.red], [14, 37, C.red], [30, 37, C.red], [31, 37, C.red], [32, 37, C.red], [33, 37, C.redDk],
  ];
  pxBody.forEach(([x, y, fill, w, h]) => out.push(px(x, y, fill, w ?? 1, h ?? 1)));

  // small web under ledge
  out.push(...webFan(24, 42, 10));
  return out;
}

/** Backlog — spider descending a web */
export function sceneHang(): PixelCell[] {
  const out: PixelCell[] = [];
  out.push(...webStrand(24, 2, 30, 2));
  out.push(...webFan(24, 2, 8));
  out.push(...spiderSprite(16, 32));
  // tiny web anchor
  out.push(px(22, 0, C.web, 5, 2));
  return out;
}

export const EMPTY_SCENES = {
  none: sceneHang,
  wip: sceneSwing,
  done: sceneLand,
} as const;
