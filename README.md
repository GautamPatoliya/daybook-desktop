# Work Task Tracker — Office Desktop App

Offline Electron + Next.js app for employee task tracking, daily email drafts, local LLM polish, reminders, analytics, and GitHub Releases auto-update.

## Requirements

- Node.js 20+
- Windows 10/11 or macOS 12+
- (Optional) code signing certificates for trusted installers

## Develop

```bash
cd work-tracker-desktop
npm install
npm run dev
```

Dev mode loads the Next.js app from `http://127.0.0.1:41763` inside Electron (unique port so it does not clash with typical Next/Vite apps on 3000/5173). Packaged builds use the same port band (`41763`–`41767`).

## Build installers

```bash
# Windows NSIS .exe
npm run dist:win

# macOS .dmg + .zip (run on a Mac)
npm run dist:mac
```

Artifacts land in `release/`.

## Publish updates (GitHub Releases)

1. Edit `package.json` → `build.publish` owner/repo.
2. Tag a release: `git tag v1.0.1 && git push origin v1.0.1`
3. GitHub Actions builds and uploads to Releases.
4. Employees' apps check for updates on launch / every 4 hours.

## First-run employee experience

1. Install `.exe` / `.dmg`
2. Onboarding: name, email To, working days/hours
3. App auto-starts on login (toggle in Settings)
4. Optional: download a local GGUF model for AI email polish

## Data location

- Windows: `%APPDATA%\work-task-tracker\`
- macOS: `~/Library/Application Support/work-task-tracker/`

Uninstall keeps user data by default (NSIS `deleteAppDataOnUninstall: false`). Wipe from Settings later if needed.

## Code signing (pilot → production)

- **Windows:** Authenticode cert via `CSC_LINK` / `CSC_KEY_PASSWORD`
- **macOS:** Apple Developer ID + notarization env vars

Unsigned builds work for internal pilots but show SmartScreen / Gatekeeper warnings.

See [docs/PILOT.md](docs/PILOT.md) for CEO-office rollout checklist.

## Architecture

- `electron/` — main process, IPC, scheduler, updater, LLM download
- `renderer/` — Next.js static export UI
- `shared/` — types, store, email builder, analytics
