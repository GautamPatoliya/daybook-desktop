/**
 * Derive packaging + in-app icons from:
 *   docs/Main Logo.png  → app icon, window, NSIS, brand mark, large ICO/ICNS
 * Tray + tiny ICO (16–32) → purpose-built crisp SVG (not from masters —
 * soft downscales look like a blurred white square in the Windows tray).
 *
 * Re-run: npm run icons:generate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import png2icons from 'png2icons';

const NAVY_HEX = '#0a1a3a';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MASTER_HERO = path.join(ROOT, 'docs', 'Main Logo.png');

const BUILD = path.join(ROOT, 'build');
const ASSETS = path.join(ROOT, 'electron', 'assets');
/** In-app brand mark (Next static export serves `renderer/public`). */
const PUBLIC_BRAND = path.join(ROOT, 'renderer', 'public', 'brand');

const SIZE_APP = 1024;
const SIZE_WINDOW = 256;
const NSIS_W = 164;
const NSIS_H = 314;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Soft white / near-white canvas → transparent.
 * Also fades very light fringe so the notebook edge stays clean on any OS chrome.
 */
async function knockOutWhite(inputPath, threshold = 242) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) {
      data[i + 3] = 0;
      continue;
    }
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    // Near-white and low chroma (canvas), not pale blue glow on the art
    const isCanvas = min >= threshold && max - min < 18;
    if (isCanvas) {
      data[i + 3] = 0;
    } else if (min >= 220 && max - min < 28) {
      // Soft fringe: fade instead of hard cut
      const t = (min - 220) / (255 - 220);
      data[i + 3] = Math.round(a * (1 - t * 0.85));
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();
}

/**
 * Transparent square with the hero logo centered (no plate).
 * Slight padding so Dock / Start Menu masks do not clip sparkles.
 */
async function composeAppIcon(size, { opaque = false } = {}) {
  const cutout = await knockOutWhite(MASTER_HERO);
  const padded = Math.round(size * (opaque ? 0.82 : 0.9));
  const logo = await cutout
    .resize(padded, padded, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();

  const offset = Math.round((size - padded) / 2);

  // Windows .exe / taskbar / Start Menu need an opaque icon — transparent
  // ICOs often fail to embed, so the old Daybook.exe icon sticks around.
  if (opaque) {
    // Full-bleed navy (no rounded transparent corners) so Windows rcedit
    // embeds a real opaque .ico into Daybook.exe for the taskbar.
    const plate = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#122a52"/>
            <stop offset="100%" stop-color="${NAVY_HEX}"/>
          </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" fill="url(#g)"/>
      </svg>`,
    );
    const platePng = await sharp(plate).png().toBuffer();
    return sharp(platePng)
      .composite([{ input: logo, left: offset, top: offset }])
      .removeAlpha()
      .png()
      .toBuffer();
  }

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toBuffer();
}

/** NSIS requires an opaque banner — navy wash + transparent-cutout logo. */
async function composeNsisSidebar() {
  const bgSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${NSIS_W}" height="${NSIS_H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#14305c"/>
          <stop offset="55%" stop-color="#0a1a3a"/>
          <stop offset="100%" stop-color="#061028"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="32%" r="55%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${NSIS_W}" height="${NSIS_H}" fill="url(#bg)"/>
      <rect width="${NSIS_W}" height="${NSIS_H}" fill="url(#glow)"/>
    </svg>`,
  );
  const bg = await sharp(bgSvg).png().toBuffer();

  const cutout = await knockOutWhite(MASTER_HERO);
  const logoSize = 132;
  const logo = await cutout
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();

  const left = Math.round((NSIS_W - logoSize) / 2);
  const top = 48;

  return sharp(bg)
    .composite([{ input: logo, left, top }])
    .png()
    .toBuffer();
}

/**
 * Purpose-built tray / tiny-OS glyph — NOT from user masters.
 * Integer-pixel SVG at the exact size (16 / 24 / 32). Soft downscales of
 * illustrations always look like a blurred white square on Windows trays.
 */
function trayGlyphSvg(size) {
  const s = size / 16;
  const px = (n) => Math.round(n * s);
  const page = '#FFFFFF';
  const accent = '#3B82F6';
  const dark = '#1E3A8A';

  // Hollow checkbox as four edge blocks (no stroked rects — those blur at 16px)
  const hollow = (x, y, w, h) => {
    const t = Math.max(1, px(1));
    return [
      `<rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${dark}"/>`,
      `<rect x="${x}" y="${y + h - t}" width="${w}" height="${t}" fill="${dark}"/>`,
      `<rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${dark}"/>`,
      `<rect x="${x + w - t}" y="${y}" width="${t}" height="${h}" fill="${dark}"/>`,
    ].join('');
  };

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
      <rect x="${px(2)}" y="${px(2)}" width="${px(9)}" height="${px(12)}" fill="${page}"/>
      <rect x="${px(11)}" y="${px(2)}" width="${px(3)}" height="${px(12)}" fill="${accent}"/>
      <rect x="${px(3)}" y="${px(4)}" width="${px(2)}" height="${px(2)}" fill="${dark}"/>
      <rect x="${px(4)}" y="${px(4)}" width="${px(1)}" height="${px(1)}" fill="${accent}"/>
      <rect x="${px(6)}" y="${px(4)}" width="${px(4)}" height="${px(1)}" fill="${dark}"/>
      <rect x="${px(3)}" y="${px(7)}" width="${px(2)}" height="${px(2)}" fill="${dark}"/>
      <rect x="${px(4)}" y="${px(7)}" width="${px(1)}" height="${px(1)}" fill="${accent}"/>
      <rect x="${px(6)}" y="${px(7)}" width="${px(4)}" height="${px(1)}" fill="${dark}"/>
      ${hollow(px(3), px(10), px(2), px(2))}
      <rect x="${px(6)}" y="${px(10)}" width="${px(4)}" height="${px(1)}" fill="${dark}"/>
      <rect x="${px(4)}" y="${px(13)}" width="${px(2)}" height="${px(1)}" fill="${accent}"/>
    </svg>`,
  );
}

async function composeTray(size) {
  return sharp(trayGlyphSvg(size)).png().toBuffer();
}

/**
 * Windows .exe icon — build from an opaque 256/512 master via png2icons (BMP
 * layers). Do not put the tray SVG into the ICO; taskbar uses this file.
 */
async function writeIco(opaquePngBuffer) {
  // false = BMP entries inside ICO (best compatibility with electron-builder / rcedit)
  const ico = png2icons.createICO(opaquePngBuffer, png2icons.BILINEAR, 0, false);
  if (!ico || !ico.length) {
    throw new Error('png2icons.createICO returned empty — Windows exe icon would stay stale');
  }
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), ico);
}

async function writeIcns(png1024) {
  const icns = png2icons.createICNS(png1024, png2icons.BILINEAR, 0);
  if (!icns) {
    console.warn(
      'warn: could not build icon.icns (png2icons returned empty); electron-builder can still use icon.png',
    );
    return;
  }
  fs.writeFileSync(path.join(BUILD, 'icon.icns'), icns);
}

/** Write nearest-neighbor previews under build/.qa/ for visual review. */
async function writeQaPreviews(png1024, tray16, tray32) {
  const qa = path.join(BUILD, '.qa');
  ensureDir(qa);
  for (const s of [16, 32, 48, 128, 256]) {
    await sharp(png1024)
      .resize(s, s, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toFile(path.join(qa, `app-${s}.png`));
    await sharp(path.join(qa, `app-${s}.png`))
      .resize(128, 128, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qa, `app-${s}@preview.png`));
  }
  await sharp(tray16)
    .resize(128, 128, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(path.join(qa, 'tray-16@preview.png'));
  await sharp(tray32)
    .resize(128, 128, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(path.join(qa, 'tray-32@preview.png'));
}

async function main() {
  if (!fs.existsSync(MASTER_HERO)) {
    console.error(`Missing master: ${MASTER_HERO}`);
    process.exit(1);
  }

  ensureDir(BUILD);
  ensureDir(ASSETS);

  console.log('Composing transparent 1024 app icon…');
  const icon1024 = await composeAppIcon(SIZE_APP, { opaque: false });
  fs.writeFileSync(path.join(BUILD, 'icon.png'), icon1024);

  console.log('Composing opaque Windows / Dock master…');
  const iconOpaque1024 = await composeAppIcon(SIZE_APP, { opaque: true });
  fs.writeFileSync(path.join(BUILD, 'icon-win.png'), iconOpaque1024);

  console.log('Writing window app-icon.png (256, opaque for taskbar)…');
  await sharp(iconOpaque1024)
    .resize(SIZE_WINDOW, SIZE_WINDOW, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(ASSETS, 'app-icon.png'));

  console.log('Writing in-app brand mark (renderer/public/brand)…');
  ensureDir(PUBLIC_BRAND);
  // 256 for crisp Retina topbar / loader (displayed ~36–88 CSS px)
  await sharp(icon1024)
    .resize(256, 256, { kernel: sharp.kernel.lanczos3 })
    .modulate({ brightness: 1.08, saturation: 1.2 })
    .png()
    .toFile(path.join(PUBLIC_BRAND, 'logo.png'));
  await sharp(icon1024)
    .resize(64, 64, { kernel: sharp.kernel.lanczos3 })
    .modulate({ brightness: 1.08, saturation: 1.2 })
    .png()
    .toFile(path.join(PUBLIC_BRAND, 'logo-64.png'));

  console.log('Writing NSIS sidebar 164×314…');
  const sidebar = await composeNsisSidebar();
  fs.writeFileSync(path.join(BUILD, 'nsis-sidebar.png'), sidebar);

  console.log('Writing tray-16 / tray-32…');
  const tray16 = await composeTray(16);
  const tray32 = await composeTray(32);
  fs.writeFileSync(path.join(ASSETS, 'tray-16.png'), tray16);
  fs.writeFileSync(path.join(ASSETS, 'tray-32.png'), tray32);

  console.log('Writing icon.ico (opaque, for Daybook.exe)…');
  await writeIco(iconOpaque1024);

  console.log('Writing icon.icns…');
  await writeIcns(iconOpaque1024);

  console.log('Writing QA previews…');
  await writeQaPreviews(icon1024, tray16, tray32);

  // Drop legacy spider OS icons if present
  for (const name of ['spider-icon.png', 'spider-icon.jpg']) {
    const p = path.join(ASSETS, name);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`Removed ${path.relative(ROOT, p)}`);
    }
  }

  console.log('Done.');
  console.log(`  ${path.relative(ROOT, path.join(BUILD, 'icon.png'))}`);
  console.log(`  ${path.relative(ROOT, path.join(BUILD, 'icon-win.png'))}`);
  console.log(`  ${path.relative(ROOT, path.join(BUILD, 'icon.ico'))}`);
  console.log(`  ${path.relative(ROOT, path.join(BUILD, 'icon.icns'))}`);
  console.log(`  ${path.relative(ROOT, path.join(BUILD, 'nsis-sidebar.png'))}`);
  console.log(`  ${path.relative(ROOT, path.join(ASSETS, 'app-icon.png'))}`);
  console.log(`  ${path.relative(ROOT, path.join(ASSETS, 'tray-16.png'))}`);
  console.log(`  ${path.relative(ROOT, path.join(ASSETS, 'tray-32.png'))}`);
  console.log(`  ${path.relative(ROOT, path.join(PUBLIC_BRAND, 'logo.png'))}`);
  console.log(`  ${path.relative(ROOT, path.join(PUBLIC_BRAND, 'logo-64.png'))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
