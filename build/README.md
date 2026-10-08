# Daybook Icon System

Pattern matches **PDF-ERP POS** (`pdf_erp_pos`): transparent app mark + NSIS **BMP** sidebars.

**Do not** take one PNG and AI-resize it into 20 files.  
**Do** keep two masters, then run a deterministic generator.

```text
assets/icons/source/
├── daybook-app.png              ← APP ICON MASTER (transparent hero)
├── daybook-tray.svg             ← WINDOWS TRAY MASTER (simple color)
└── daybook-tray-template.svg    ← MAC MENU BAR MASTER (black template)
```

## Generate

```bash
npm run icons:generate
```

| Output | From | Notes |
|--------|------|--------|
| `build/icon.png` | App master | **Transparent** 1024 — Start Menu / electron-builder |
| `build/icon.ico` / `icon.icns` | Transparent PNG | HERMITE multi-size; no navy plate |
| `build/installerSidebar.bmp` | App master | **164×314 24-bit BMP** (NSIS requires BMP, not PNG) |
| `build/uninstallerSidebar.bmp` | same | |
| `electron/assets/app-icon.png` | App master | Window / taskbar runtime |
| `electron/assets/tray-*.png` | Tray SVG | |
| `electron/assets/trayTemplate*` | Template SVG | macOS |
| `renderer/public/brand/logo.png` | App master | In-app |

## Rules (from PDF-ERP + Windows shell)

1. **App icon ≠ tray icon** — two designs.  
2. **No navy plate** on the Start Menu / `.exe` icon — use the transparent master.  
3. **NSIS sidebar must be `.bmp` 164×314** — PNG sidebars show blank on the installer.  
4. **Mac tray** = black template + optical padding.  
5. Judge tray art at **real menu-bar / tray size**, not zoomed to 512px.

## Edit workflow

1. Replace `assets/icons/source/daybook-app.png` (or `docs/Main Logo.png`).  
2. Tweak tray SVGs if the tiny mark needs work.  
3. `npm run icons:generate`  
4. Ship. After Windows update, unpin/repin if a pinned taskbar icon is still stale.
