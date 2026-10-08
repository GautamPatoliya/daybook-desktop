# Daybook icon sources (edit these only)

Same approach as PDF-ERP POS: transparent app logo + separate tray mark + BMP installer art.

| File | Role |
|------|------|
| `daybook-app.png` | **App icon master** — detailed hero with transparency (Dock, `.exe`, Start Menu, brand). |
| `daybook-tray.svg` | **Tray master (Windows)** — simplified color glyph for 16px. |
| `daybook-tray-template.svg` | **Tray master (macOS)** — black template for menu bar. |

```bash
npm run icons:generate
```

Do **not** AI-generate the pack. Do **not** hand-edit `build/` or `electron/assets/tray-*.png`.

Tray SVGs must be **ASCII-only** (Sharp’s XML parser rejects fancy dashes in comments).
