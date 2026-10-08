# Daybook 2.0 - Global Rules (all phases)

These rules apply to **every** phase. Violating them counts as a bug even if the phase feature “works.”

---

## 1. Repository & stack (do not reinvent)

| Area | Location / fact |
|------|-----------------|
| Electron main | `electron/main.ts`, `electron/ipc/handlers.ts`, `electron/scheduler/`, `electron/preload.ts` |
| Renderer | `renderer/app/**`, `renderer/components/**` |
| Shared domain | `shared/types.ts`, `shared/store.ts`, `shared/email.ts`, `shared/analytics.ts` |
| User data root | `app.getPath('userData')` → historically folder name `work-task-tracker` |
| Day files | `{userData}/data/YYYY-MM-DD/tasks.json` |
| Settings | `{userData}/settings.json` |
| Themes | `settings.theme`: `'default'` \| `'spider-verse'` (and CSS: `globals.css`, `spider-verse.css`) |

---

## 2. Time display (mandatory)

**User-facing:** always Indian **12-hour** with AM/PM.

| Correct | Incorrect |
|---------|-----------|
| `9:15 AM` | `09:15` (24h without AM/PM) |
| `2:30 PM` | `14:30` |
| `12:05 PM` | `12:05` ambiguous |

**Implementation:**

- Create / use a single helper, e.g. `renderer/lib/formatTime.ts` → `formatIndianTime12(date | hhmm | Date): string`.  
- Settings schedule pickers may keep internal 0–23 values but **labels** must show 12h.  
- Storage: keep ISO / `HH:mm` 24h in JSON if already used - **do not** rewrite historical files to 12h strings.

**Locale:** Prefer `en-IN` with `hour12: true` for display.

---

## 3. Themes (mandatory)

Every new UI in any phase:

- Must render correctly in **Default** and **Spider-Verse**.  
- Prefer shared class names + theme CSS overrides; avoid one-theme-only hacks.  
- Do not remove Spider-Verse assets to “clean up.”

---

## 4. Data safety (mandatory)

- Never wipe `data/` or `settings.json` as part of a feature.  
- Migrations must be **idempotent** and run on read or on first open after upgrade.  
- If parse fails on a day file, preserve the corrupt file (rename to `.bak`) rather than overwrite silently with `[]` without user notice when changing behavior - Phase docs specify exact behavior when they touch store reads.

---

## 5. Email status rules (mandatory from Phase 1)

- **Do not** append ✅ / ⏳ emoji to every bullet in email HTML/plain.  
- Status may appear only at **task title** level (text suffix or structured heading), not emoji spam.  
- Remove existing emoji suffixes from `shared/email.ts` `statusSuffix` / `statusSuffixHtml` as part of Phase 1.

---

## 6. IPC conventions

- Keep `ipcMain.handle('namespace:action', …)` style already used.  
- Expose new APIs through `renderer/lib/api.ts` + preload whitelist.  
- Never call Node `fs` from renderer.

---

## 7. QA gates before merging a phase

### Core regression (always)

1. Onboarding still completes → board loads.  
2. Create task → appears in correct column.  
3. Drag WIP → Done works.  
4. Carry-forward still copies open tasks on new business day.  
5. Email draft generates without crash.  
6. Settings save/reload.  
7. Autostart toggle does not double-launch (Windows).  
8. Single instance lock still works.

### Platform

- Windows: primary CI/dev verification for every phase.  
- macOS: required for Phase 2 (updates) and any clipboard/Gmail automation notes in Phase 1.

---

## 8. Documentation updates per phase

When finishing a phase:

1. User-facing bullets in root `CHANGELOG.md`.  
2. If settings fields added: update `docs/PROJECT_OVERVIEW.md` data section briefly.  
3. Do not delete older phase docs.

---

## 9. Resolved product decisions (do not re-litigate in code)

| Topic | Decision |
|-------|----------|
| Task writing UI | **Editor only** - remove bullets list UI |
| Category delete when in use | **Reassign** all tasks using that category to `Other` (create `Other` if missing), then delete category; confirm dialog explains this |
| Category default | Add `settings.defaultCategory: string` - must be one of `settings.categories` |
| Streaks / badges | **Forbidden** in 2.0 |
| Mac unsigned auto-update | **Assisted UX**, not fake success |

Open decisions still listed inside individual phases when technical choice remains (e.g. TipTap vs alternative - Phase 1 picks TipTap).
