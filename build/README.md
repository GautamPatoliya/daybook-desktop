# App icons for electron-builder

## Masters (edit these only)

| Source | Path / method | Used for |
|--------|----------------|----------|
| Hero | `docs/Main Logo.png` | App icon, window icon, NSIS sidebar, large `.ico`/`.icns`, in-app brand |
| Tray glyph | Drawn in `scripts/generate-icons.mjs` (crisp SVG at exact px) | `tray-16` / `tray-32` + ICO 16–32 |

Do **not** downscale the illustrated logo into the tray. Do **not** hand-edit derived files.

## Generate all derived assets

```bash
npm run icons:generate
```

`dist` / `dist:win` / `dist:mac` / `publish:github` run this automatically before packaging.

| Output | Size / notes |
|--------|----------------|
| `build/icon.png` | 1024×1024 **transparent** Main Logo |
| `build/icon-win.png` | 1024×1024 **opaque** navy plate (Windows / Dock master) |
| `build/icon.ico` | Windows `.exe` / taskbar / Start Menu (from opaque master) |
| `build/icon.icns` | macOS bundle icon (from opaque master) |
| `build/nsis-sidebar.png` | 164×314 installer banner (opaque navy — NSIS requirement) |
| `electron/assets/app-icon.png` | 256×256 window / Dock / taskbar |
| `electron/assets/tray-16.png` | Windows tray — solid notebook glyph @ 16px |
| `electron/assets/tray-32.png` | macOS / HiDPI tray — same glyph @ 32px |
| `renderer/public/brand/logo.png` | In-app brand (topbar, onboarding, loaders) |
| `renderer/public/brand/logo-64.png` | Optional 64px copy of the same mark |

## Packaging wiring

| Config | Path |
|--------|------|
| `build.icon` | `build/icon.png` |
| `build.win.icon` | `build/icon.ico` |
| `build.mac.icon` | `build/icon.icns` |
| NSIS sidebars | `build/nsis-sidebar.png` |
| Electron runtime | `electron/assets/*` (copied into `dist-electron` on `build:electron`) |
| Renderer UI | `renderer/public/brand/*` → static export `out/brand/` |

After replacing a master, run `npm run icons:generate` (or any `dist*` script).
