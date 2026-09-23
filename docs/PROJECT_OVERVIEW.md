# Daybook — Project Overview

**Product name:** Daybook  
**Version:** 1.1.1  
**Type:** Offline desktop app (Windows + macOS)  
**Audience:** Office employees who log daily work and send end-of-day updates to a manager  
**Repo:** [GautamPatoliya/daybook-desktop](https://github.com/GautamPatoliya/daybook-desktop)  
**License:** UNLICENSED (private / internal)

---

## 1. What is Daybook?

Daybook is a **local-first daily work tracker** for office teams. Employees keep a day-by-day board of tasks, get reminded to log work during the shift, and at end of day generate a polished **daily work update email** (plain text + Verdana HTML) that opens in Gmail or copies to the clipboard.

It is **not** a cloud project-management tool (no Jira-style assignees, sprints, or shared boards). Data stays on each person’s PC. Network is only needed for:

- Optional Local AI model / engine downloads  
- Checking and installing app updates from GitHub Releases  

### Core promise

> Log work during the day → unfinished work carries forward → produce a manager-ready EOD email without rewriting the day.

---

## 2. Purpose & problem it solves

| Pain in a typical office | How Daybook helps |
|--------------------------|-------------------|
| People forget what they did by 6pm | Hourly nudges + day board as a running log |
| Copy-pasting yesterday’s WIP into today | Automatic **carry-forward** of open tasks |
| Messy notes become unprofessional emails | Structured tasks → email draft; optional on-device AI polish |
| Managers want a consistent daily update | Same subject/body shape every day (by project, bullets, sign-off) |
| Tools that need accounts / internet | Fully offline day-to-day use |

**Primary output:** the daily email (`Daily Work Update - {date}`).  
**Primary workspace:** the Kanban board (Backlog / In progress / Done).

---

## 3. Who it’s for

- Individual contributors in an office (e.g. CEO-office / delivery teams)  
- People who already send daily status emails to a manager  
- Windows and Apple Silicon Mac users  
- IT that wants a simple installer, no terminal, no shared server  

**Not aimed at:** multi-user collaboration, client portals, or replacing full PM suites.

---

## 4. Main features (current)

### Board
- Day-scoped Kanban: **Backlog** (`none`), **In progress** (`wip`), **Done**  
- Drag-and-drop cards; project, category, priority  
- Task titles + bullet detail lines (multi-line paste splits into bullets)  
- Date picker to review past / future days  
- Project filter  

### Carry-forward
- On a new working day, open tasks from the previous business day are copied forward  
- Source tasks are marked so they are not re-carried after completion (lineage via `sourceTaskId` / `carriedAwayAt`)  

### Daily email
- Builds subject, plain body, and HTML (Verdana) from today’s tasks  
- Groups by project (or a single default project mode)  
- Backlog excluded from email by default (toggle in Settings)  
- Copy HTML / open Gmail compose with To + subject  
- Optional **Local AI** or rule-based wording polish for titles/details  

### Reminders & tray
- Autostart on login (default on)  
- System tray; app can stay running in background  
- **Hourly** (or interval) nudge during configured work hours → jump to New Task  
- **EOD** reminder at configured time → email draft flow  
- Respects configured working days and timezone  

### Projects & settings
- Named projects with colors; archive / rename  
- Categories (Deployment, Bug Fix, Feature, etc.)  
- Profile: name, sign-off lines, email To list  
- Schedule: working days, hourly window, EOD time, reminder interval  
- Theme: **Default** or **Spider-Verse**  
- Data: open data folder, wipe task history  

### Analytics
- Local stats over recent days: completion, carry volume, by project/category/weekday, activity by hour, streak  
- CSV export / copy  

### Local AI (optional)
- Install AI engine + download a small GGUF model (Qwen, Llama, Phi, Gemma variants)  
- Runs on-device for email polish — no API keys  
- Off by default; not required for core use  

### Themes
- **Default** — clean office UI  
- **Spider-Verse** — pixel HUD, hanging spiders, cobwebs, thwip / hero-landing beats, Spidey loader  

### Updates
- `electron-updater` against GitHub Releases  
- In-app Updates tab with changelog cards  
- Check on launch and about every 4 hours  

---

## 5. How employees use it (day in the life)

1. **Install** `Daybook-Setup-x.y.z.exe` (Windows) or `.dmg` (Mac).  
2. **First launch — onboarding:** name, email To (manager), working days, work hours / EOD time.  
3. **During the day:** add tasks, drag to WIP/Done, add bullets as work happens.  
4. **Hourly reminder:** tray/notification → log what you’re doing.  
5. **Next morning:** unfinished work appears again via carry-forward.  
6. **EOD:** Email Draft → review → Copy HTML or Open in Gmail → send to manager.  
7. **Optional:** enable Local AI polish; switch Spider-Verse theme in Settings → Profile.  
8. **Updates:** Updates tab → Check for updates → Restart & install when prompted.  

---

## 6. Screens & navigation

| Area | Route / entry | Role |
|------|----------------|------|
| Board | `/` | Daily Kanban + composer + email panel |
| Projects | `/projects` | Project list / table |
| Analytics | `/analytics` | Local stats |
| Local AI / Models | `/models` | Engine + GGUF download |
| Settings | `/settings` | Profile, Schedule, Projects, Behavior, Data |
| Updates | `/updates` | Changelog + updater |
| Onboarding | `/onboarding` | First-run setup |

---

## 7. Architecture

```
daybook-desktop/
├── electron/          # Main process: window, tray, IPC, reminders, updater, LLM
├── renderer/          # Next.js UI (static export into Electron)
├── shared/            # Types, day store, email builder, analytics (Node-safe)
├── build/             # Icons, NSIS assets
├── docs/              # Pilot, versioning, email templates, this overview
├── CHANGELOG.md       # Shown in-app Updates
└── package.json       # App version + electron-builder config
```

| Layer | Responsibility |
|-------|----------------|
| **Electron main** | App lifecycle, single instance, tray, autostart, IPC handlers, scheduler, auto-updater, optional LLM engine |
| **Preload** | Safe bridge to renderer |
| **Renderer (Next)** | UI pages and components; talks to main via IPC API |
| **Shared** | `types`, `store` (JSON files per day), `email`, `analytics` |

**Stack:** Electron 35, Next.js 15 (static), React 19, TypeScript, `@dnd-kit`, `electron-updater`, optional `node-llama-cpp` (loaded when AI is installed).

**Dev:** renderer on `http://127.0.0.1:41763` inside Electron.  
**Packaged:** serves static `renderer/out` on the same port band (`41763`–`41767`).

---

## 8. Data model & storage

**Location (userData):**

| OS | Path |
|----|------|
| Windows | `%APPDATA%\work-task-tracker\` |
| macOS | `~/Library/Application Support/work-task-tracker/` |

*(Folder name is historical; product UI name is Daybook.)*

**Layout:**

```
userData/
├── settings.json          # Profile, schedule, projects, theme, AI flags
├── data/
│   └── YYYY-MM-DD/
│       └── tasks.json     # That day’s tasks
└── models/                # Optional GGUF + engine bits
```

**Task (simplified):** id, project, category, title, status, priority, subItems[], timestamps, carry-forward fields (`carriedFrom`, `sourceTaskId`, `carriedAwayAt`), optional `titleEnhanced` / sub-item `enhanced` from polish.

**Settings highlights:** author name, sign-off, projects meta, categories, timezone (`Asia/Kolkata` default), working days, hourly window, EOD hour/minute, reminder interval, email To, Gmail compose URL, AI enable + model id, include backlog in email, autostart, theme, onboarding flag.

Uninstall does **not** delete app data by default (`deleteAppDataOnUninstall: false`). Wipe via Settings → Data if needed.

---

## 9. Development

### Requirements
- Node.js 20+  
- Windows 10/11 or macOS 12+ for running/building that platform’s installer  

### Commands

```bash
npm install
npm run dev              # Next + Electron together

npm run build            # Renderer + Electron compile
npm run dist:win         # Windows NSIS installer → release/
npm run dist:mac         # macOS dmg + zip → release/
npm run publish:github   # Build and publish (when configured)
```

### Version & release
1. Bump `package.json` / lockfile version  
2. Update `CHANGELOG.md`  
3. Commit, tag `vX.Y.Z`, push with tags  
4. GitHub Actions builds Windows + macOS and attaches artifacts to the Release  
5. Installed apps pick up the update via **Updates**  

See [VERSION_MANAGEMENT.md](./VERSION_MANAGEMENT.md) and [PILOT.md](./PILOT.md).

**App ID:** `com.bcreative.worktasktracker`  
**Artifacts:** `Daybook-Setup-{version}.exe`, `Daybook-{version}-arm64.dmg` (+ zip for Mac updates)

---

## 10. Distribution & IT notes

- **Pilot:** share unsigned installer; expect SmartScreen / Gatekeeper prompts (“More info → Run anyway” / right-click Open).  
- **Production:** code signing — Windows (`CSC_LINK`, `CSC_KEY_PASSWORD`); macOS Apple ID + notarization secrets.  
- Offline for daily work; open outbound only for Hugging Face (models) and GitHub (updates) when used.  
- Backup / migrate: Settings → open data folder, or copy the `userData` directory.  
- Support docs for internal announcement emails live under `docs/email-templates/`.

---

## 11. Design principles (product)

1. **Email is the product outcome** — the board exists to feed a trustworthy daily update.  
2. **Local-first** — no account, no server dependency for core workflows.  
3. **Low friction capture** — reminders and quick add beat perfect project management.  
4. **Carry-forward over re-entry** — don’t make people retype unfinished work.  
5. **Optional AI** — never block EOD on model downloads.  
6. **Stay out of Jira’s lane** — no multi-user boards, sprints, or cloud sync in the current product definition.

---

## 12. Related docs

| Doc | Contents |
|-----|----------|
| [README.md](../README.md) | Quick start, build, architecture sketch |
| [CHANGELOG.md](../CHANGELOG.md) | Release notes (also shown in-app) |
| [PILOT.md](./PILOT.md) | Office rollout checklist |
| [VERSION_MANAGEMENT.md](./VERSION_MANAGEMENT.md) | Versioning, tagging, auto-update |
| [email-templates/](./email-templates/) | v1.1.1 announcement HTML + Gmail send helpers |
| [PRODUCT_VISION.md](./PRODUCT_VISION.md) | Next product direction (composer, Focus, AI summary, companion, etc.) |

---

## 13. Quick facts

| Item | Value |
|------|--------|
| Current version | 1.1.1 |
| Platforms | Windows x64, macOS arm64 |
| UI themes | Default, Spider-Verse |
| Default timezone | Asia/Kolkata |
| Default work window | 08:00–18:00, EOD ~18:45 |
| Default reminder interval | 60 minutes |
| Autostart | On after onboarding |
| Data survives uninstall | Yes (by default) |

---

*Last updated to reflect Daybook v1.1.1 (Spider-Verse theme release).*
