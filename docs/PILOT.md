# Office pilot rollout — Work Task Tracker

Guide for distributing the unsigned (then signed) desktop app to the CEO’s office team.

## What employees get

- One Windows installer: `Work Task Tracker-Setup-1.0.0.exe` (NSIS)
- Or one macOS disk image: `Work Task Tracker-*.dmg` (+ `.zip` for auto-update)
- No OpenClaw, no terminal, no system Ollama
- Data stays on each PC under the OS app data folder

## Pilot steps (unsigned)

1. Build on a Windows machine: `npm run dist:win` → artifact in `release/`
2. Copy the Setup `.exe` to a shared drive or email it to pilot users
3. Employees run the installer (choose install path, desktop shortcut)
4. On first launch, complete onboarding (name, email To, working hours)
5. Autostart is on by default so hourly / EOD reminders work after login
6. Optional: Models tab → download a small GGUF for AI email polish

**Expect SmartScreen / Gatekeeper warnings** on unsigned builds. Tell staff to choose “More info → Run anyway” (Windows) or right-click → Open (macOS).

## Pilot checklist

- [ ] Installer runs without admin elevation issues (per-user NSIS)
- [ ] Board loads; add / drag / edit / delete tasks
- [ ] Open tasks carry forward on the next working day
- [ ] Email draft copies Verdana HTML and opens Gmail
- [ ] Settings: hours, working days, To list, autostart
- [ ] Tray icon + reminder popup (or use tray “Hourly reminder now”)
- [ ] Analytics shows local numbers; CSV copy works
- [ ] Uninstall removes app; `%APPDATA%\work-task-tracker` data remains

## Signing for production

Set secrets before CI publish:

| Platform | Env vars |
|----------|----------|
| Windows | `CSC_LINK` (pfx base64 or file), `CSC_KEY_PASSWORD` |
| macOS | Apple Developer ID + notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) |

Then push a version tag `v1.0.1` — GitHub Actions builds both OS targets and uploads to Releases. Employees update from **Updates** in the app (or get the next installer).

## GitHub Releases setup

1. Create a private or public repo for the app
2. Set `package.json` → `build.publish.owner` / `repo`
3. Ensure the Actions workflow has `contents: write`
4. Tag `v*` to publish

## Support notes for IT

- Offline day-to-day; network only for model download and update checks
- Wipe history: Settings → Data → Wipe task history
- Open data folder from Settings for backup / migration
- macOS uninstall: move app to Trash; optionally wipe data from Settings first
