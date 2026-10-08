/**
 * Daybook Icon System — deterministic packaging (PDF-ERP POS pattern).
 *
 * Masters (edit these):
 *   assets/icons/source/daybook-app.png           → app / .exe / brand (transparent)
 *   assets/icons/source/daybook-tray.svg          → Windows tray
 *   assets/icons/source/daybook-tray-template.svg → macOS menu-bar template
 *
 * Fallback app master: docs/Main Logo.png
 *
 * npm run icons:generate
 *
 * NSIS expects 164×314 24-bit BMP sidebars (PNG is ignored / blank).
 * Windows Start menu uses the transparent ICO — no navy plate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import png2icons from 'png2icons';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SOURCE = path.join(ROOT, 'assets', 'icons', 'source');
const MASTER_APP_PRIMARY = path.join(SOURCE, 'daybook-app.png');
const MASTER_APP_FALLBACK = path.join(ROOT, 'docs', 'Main Logo.png');
const MASTER_TRAY = path.join(SOURCE, 'daybook-tray.svg');
const MASTER_TRAY_TEMPLATE = path.join(SOURCE, 'daybook-tray-template.svg');

const BUILD = path.join(ROOT, 'build');
const ASSETS = path.join(ROOT, 'electron', 'assets');
const PUBLIC_BRAND = path.join(ROOT, 'renderer', 'public', 'brand');

const SIZE_APP = 1024;
const SIZE_WINDOW = 256;
const NSIS_W = 164;
const NSIS_H = 314;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resolveAppMaster() {
  if (fs.existsSync(MASTER_APP_PRIMARY)) return MASTER_APP_PRIMARY;
  if (fs.existsSync(MASTER_APP_FALLBACK)) return MASTER_APP_FALLBACK;
  return null;
}

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
    const isCanvas = min >= threshold && max - min < 18;
    if (isCanvas) {
      data[i + 3] = 0;
    } else if (min >= 220 && max - min < 28) {
      const t = (min - 220) / (255 - 220);
      data[i + 3] = Math.round(a * (1 - t * 0.85));
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();
}

/** Transparent app icon — fills most of the canvas (PDF-ERP style, no navy plate). */
async function composeAppIcon(appMaster, size) {
  const cutout = await knockOutWhite(appMaster);
  const padded = Math.round(size * 0.96);
  const logo = await cutout
    .resize(padded, padded, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();

  const offset = Math.round((size - padded) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function composeNsisSidebarPng(appMaster) {
  const bgSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${NSIS_W}" height="${NSIS_H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#14305c"/>
          <stop offset="55%" stop-color="#0a1a3a"/>
          <stop offset="100%" stop-color="#061028"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="28%" r="52%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${NSIS_W}" height="${NSIS_H}" fill="url(#bg)"/>
      <rect width="${NSIS_W}" height="${NSIS_H}" fill="url(#glow)"/>
    </svg>`,
  );
  const bg = await sharp(bgSvg).png().toBuffer();
  const cutout = await knockOutWhite(appMaster);
  const logoSize = 128;
  const logo = await cutout
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();
  const left = Math.round((NSIS_W - logoSize) / 2);
  const top = 40;

  return sharp(bg)
    .composite([{ input: logo, left, top }])
    .flatten({ background: '#061028' })
    .removeAlpha()
    .png()
    .toBuffer();
}

/**
 * Classic Windows BMP (BI_RGB 24-bit), bottom-up — required by NSIS MUI sidebars.
 * Matches PDF-ERP: build/installerSidebar.bmp @ 164×314.
 */
function writeBmp24(filePath, width, height, rgbTopDown) {
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const pixelBytes = rowSize * height;
  const fileSize = 54 + pixelBytes;
  const out = Buffer.alloc(fileSize);
  out.write('BM', 0);
  out.writeUInt32LE(fileSize, 2);
  out.writeUInt32LE(0, 6);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(0, 30);
  out.writeUInt32LE(pixelBytes, 34);
  out.writeInt32LE(2835, 38);
  out.writeInt32LE(2835, 42);
  out.writeUInt32LE(0, 46);
  out.writeUInt32LE(0, 50);

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const si = (srcY * width + x) * 3;
      const di = 54 + y * rowSize + x * 3;
      out[di] = rgbTopDown[si + 2];
      out[di + 1] = rgbTopDown[si + 1];
      out[di + 2] = rgbTopDown[si];
    }
  }
  fs.writeFileSync(filePath, out);
}

async function pngToBmp24(pngBuffer, filePath) {
  // Force 3-channel RGB (sharp may keep an opaque alpha plane after removeAlpha).
  const { data, info } = await sharp(pngBuffer)
    .flatten({ background: '#061028' })
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  let rgb = data;
  if (info.channels === 4) {
    rgb = Buffer.alloc(info.width * info.height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i + 2];
    }
  } else if (info.channels !== 3) {
    throw new Error(`BMP encode expected RGB, got ${info.channels} channels`);
  }
  writeBmp24(filePath, info.width, info.height, rgb);
}

/** Render tray SVG into a padded canvas (optical size, not edge-to-edge). */
async function composeTrayFromSvg(svgPath, size, { pad = 0.94 } = {}) {
  const inner = Math.max(10, Math.round(size * pad));
  const glyph = await sharp(svgPath)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toBuffer();
  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: glyph, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function writeIco(transparentPngBuffer) {
  // HERMITE keeps edges sharper than BILINEAR for multi-size ICO frames.
  const ico = png2icons.createICO(transparentPngBuffer, png2icons.HERMITE, 0, false);
  if (!ico?.length) {
    throw new Error('png2icons.createICO returned empty — Windows exe icon would stay stale');
  }
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), ico);
}

async function writeIcns(png1024) {
  const icns = png2icons.createICNS(png1024, png2icons.HERMITE, 0);
  if (!icns) {
    console.warn('warn: icon.icns empty; electron-builder can still use icon.png');
    return;
  }
  fs.writeFileSync(path.join(BUILD, 'icon.icns'), icns);
}

async function writeQaPreviews(png1024, tray16, tray32, template22) {
  const qa = path.join(BUILD, '.qa');
  fs.rmSync(qa, { recursive: true, force: true });
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
  await sharp(tray16).resize(128, 128, { kernel: sharp.kernel.nearest }).png().toFile(path.join(qa, 'tray-16@preview.png'));
  await sharp(tray32).resize(128, 128, { kernel: sharp.kernel.nearest }).png().toFile(path.join(qa, 'tray-32@preview.png'));
  if (template22) {
    await sharp(template22)
      .resize(128, 128, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qa, 'tray-template@preview.png'));
  }
}

async function main() {
  const appMaster = resolveAppMaster();
  if (!appMaster) {
    console.error(`Missing app master. Add:\n  ${MASTER_APP_PRIMARY}\nor\n  ${MASTER_APP_FALLBACK}`);
    process.exit(1);
  }
  if (!fs.existsSync(MASTER_TRAY)) {
    console.error(`Missing tray master: ${MASTER_TRAY}`);
    process.exit(1);
  }
  if (!fs.existsSync(MASTER_TRAY_TEMPLATE)) {
    console.error(`Missing tray template master: ${MASTER_TRAY_TEMPLATE}`);
    process.exit(1);
  }

  if (appMaster === MASTER_APP_FALLBACK) {
    ensureDir(SOURCE);
    fs.copyFileSync(MASTER_APP_FALLBACK, MASTER_APP_PRIMARY);
    console.log('Synced docs/Main Logo.png → assets/icons/source/daybook-app.png');
  }

  ensureDir(BUILD);
  ensureDir(ASSETS);
  ensureDir(PUBLIC_BRAND);

  console.log(`App master: ${path.relative(ROOT, appMaster)}`);
  console.log('Composing transparent 1024 (no navy plate)…');
  const icon1024 = await composeAppIcon(appMaster, SIZE_APP);
  fs.writeFileSync(path.join(BUILD, 'icon.png'), icon1024);

  console.log('Writing app-icon.png (256 transparent)…');
  await sharp(icon1024)
    .resize(SIZE_WINDOW, SIZE_WINDOW, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(ASSETS, 'app-icon.png'));

  console.log('Writing in-app brand…');
  const brandCutout = await knockOutWhite(appMaster);
  const brandBuf = await brandCutout
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await sharp(brandBuf)
    .resize(256, 256, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC_BRAND, 'logo.png'));
  await sharp(brandBuf)
    .resize(64, 64, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC_BRAND, 'logo-64.png'));

  console.log('Writing NSIS sidebar BMP 164×314 (PDF-ERP pattern)…');
  const sidebarPng = await composeNsisSidebarPng(appMaster);
  fs.writeFileSync(path.join(BUILD, 'nsis-sidebar.png'), sidebarPng);
  await pngToBmp24(sidebarPng, path.join(BUILD, 'installerSidebar.bmp'));
  await pngToBmp24(sidebarPng, path.join(BUILD, 'uninstallerSidebar.bmp'));

  console.log('Writing Windows tray-16 / tray-32…');
  const tray16 = await composeTrayFromSvg(MASTER_TRAY, 16, { pad: 1 });
  const tray32 = await composeTrayFromSvg(MASTER_TRAY, 32, { pad: 1 });
  fs.writeFileSync(path.join(ASSETS, 'tray-16.png'), tray16);
  fs.writeFileSync(path.join(ASSETS, 'tray-32.png'), tray32);

  console.log('Writing macOS tray templates…');
  const template22 = await composeTrayFromSvg(MASTER_TRAY_TEMPLATE, 22, { pad: 0.55 });
  const template44 = await composeTrayFromSvg(MASTER_TRAY_TEMPLATE, 44, { pad: 0.55 });
  fs.writeFileSync(path.join(ASSETS, 'trayTemplate.png'), template22);
  fs.writeFileSync(path.join(ASSETS, 'trayTemplate@2x.png'), template44);

  console.log('Writing icon.ico / icon.icns from transparent master…');
  await writeIco(icon1024);
  await writeIcns(icon1024);

  // Drop legacy opaque plate if present
  for (const name of ['icon-win.png', 'spider-icon.png', 'spider-icon.jpg']) {
    const p = path.join(name.startsWith('icon') ? BUILD : ASSETS, name);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`Removed ${path.relative(ROOT, p)}`);
    }
  }

  console.log('Writing QA previews…');
  await writeQaPreviews(icon1024, tray16, tray32, template22);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
