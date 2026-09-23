# Daybook — Product Vision (Owner Direction)

This document captures the product direction preferred for Daybook after v1.1.1.

> Daybook should become a **smart personal work companion** that understands the day, reduces formatting work, and helps Indian office employees never lose their daily update — not a prettier Kanban board.

**Current version baseline:** 1.1.1  
**Primary outcome remains:** a trustworthy end-of-day work summary (email).  
**New ambition:** intelligence around activity, focus, carry-forward, day explanation, smoother updates, and frictionless Gmail handoff.

---

## 1. Product thesis

Daybook already does the hard infrastructure:

- Local day board  
- Carry-forward  
- Reminders / tray  
- EOD draft + Gmail handoff  
- Optional on-device AI polish  

What it does **not** do well yet:

1. Comfortable writing (line-by-line bullets force manual formatting)  
2. Understanding *what the day meant* (AI only rewrites sentences)  
3. Helping when the employee is busy and skips everything  
4. Preventing carry-forward graveyards  
5. Using the desktop/tray advantage fully  
6. Reliable email handoff (users still manually copy/paste structured HTML)  
7. Updates that feel like Cursor (download + silent swap on restart), especially on Mac without Apple signing  

The next major releases should attack those gaps.

---

## 2. Feature directions (approved)

### 2.1 Bigger New Task dialog — **editor only** (no bullets UI)

**Problem:** Dialog is too small; line-by-line bullets force people to format for mail while working.

**Direction (updated):**

- Enlarge the New Task / Edit Task dialog for comfortable writing.  
- **Only a rich editor** — do **not** keep a separate bullets list UI alongside the editor.  
- One writing surface; Daybook later aligns/structures content for email.  
- **No status emojis in email body** (no ✅ / ⏳ on every line).  
- Status signal stays on the **task title level** only.

**Outcome:** User writes freely → Daybook structures for mail.

---

### 2.2 Smart Activity Companion — screen overlay character

**Problem:** Busy employees dismiss reminders all day, then forget everything at EOD.

**Direction:** Watch activity patterns and intervene with useful prompts — not nag spam.

**Character (updated):**

- Open-license **2D/3D animated character** from GitHub / Rive / Lottie (not custom Spidey art for this system).  
- Rendered as an **on-screen overlay** (floating layer above app UI), working on **Windows and macOS**.  
- Architecture must support a future **Settings → Character** section without rewrite:
  - Character registry (id, name, asset pack, license)  
  - Enabled / disabled  
  - Selected character  
  - Frequency / quiet hours (later)  
  - Overlay position / size defaults  
- Keep companion logic (`signals → action`) separate from presentation (`CharacterOverlay` + asset pack).

**Indian office intervention catalog (examples):**

| Signal | Companion says / does |
|--------|------------------------|
| 3+ reminder dismissals, no new log in 2+ hours | “Busy morning? One line is enough — what are you on right now?” → Quick Update |
| Near lunch, WIP open, zero notes today | “Before lunch — 20 seconds to park what you’re doing?” |
| Post-lunch dead zone (14:00–16:00) | “Afternoon often gets interrupt-heavy. Log the interruption or the main thread?” |
| EOD in 45 min, thin board | “EOD soon and today’s board is thin. Meetings, support, or deep work?” |
| Same task carried 3+ days | Surfaces Carry Intelligence |
| Friday afternoon | “Weekly wrap? Draft Friday summary + Monday carry decisions.” |
| Yesterday’s update never marked sent | “Yesterday’s update wasn’t marked sent. Rebuild from yesterday?” |

**Principle:** Intervene when silence risks the EOD outcome; stay quiet when the user is logging.

---

### 2.3 Daily Brief (morning screen)

- What carried overnight  
- What needs a decision (stale / blocked / aging)  
- Suggested plan for today  
- One-tap into Focus Mode  

---

### 2.4 Work Patterns analytics

Avoid gamification streaks. Prefer useful patterns:

- Most productive window  
- Highest interruption window  
- Most carried-forward category  
- Average completion time  
- Most fragmented project  
- Short insight lines (“longest uninterrupted sessions usually before lunch”)

---

### 2.5 AI Work Summary (not wording polish)

AI should **understand** the day and produce structured summary sections (Major work / Investigation / Remaining), then generate the final email from that understanding — not merely rewrite sentences.

Status in mail: **title-level only**, no emoji clutter in body.

---

### 2.6 Focus Mode

Collapse UI to one task + quick updates + Done / Blocked / Switch Task. Hide chrome and noise. Tray can enter/exit Focus.

---

### 2.7 Carry Forward Intelligence

Morning triage: continue automatically / needs decision / probably stale.  
Actions on aging tasks: Continue · Defer · Drop · Convert to project task.  
Goal: no graveyard of eternal carry-forwards.

---

### 2.8 Tray as control surface

```
● Working on: …
+ Quick Update / + New Task
▶ Focus Mode / ⏸ Pause Reminders
Today's Progress
Open Daybook / Generate EOD
```

---

### 2.9 Explain My Day

Personal work intelligence narrative from the same “day understanding” engine used for EOD summary.

---

### 2.10 Time format — always Indian 12-hour

**Everywhere** in the app (board timestamps, Focus timeline, analytics windows, reminders copy, Daily Brief, Explain My Day, settings labels):

- Use **12-hour clock with AM/PM** as used in India (e.g. `9:15 AM`, `2:30 PM`).  
- Do not show 24-hour (`14:30`) in user-facing UI.  
- Internal storage can stay ISO / 24h; **display layer** always formats 12h Indian style.

---

### 2.11 Content / layout resilience (long links & rich content)

**Problem:** Long content (e.g. Google Drive URLs) breaks layout — email preview and other surfaces fail to wrap / overflow.

**Direction:**

- All content surfaces (task cards, editor preview, email preview panel, Explain My Day, analytics tables) must **wrap or truncate safely**.  
- Long URLs: break with `overflow-wrap: anywhere` / mid-word break; optional “open link” affordance.  
- Email HTML must survive long links without blowing horizontal layout.  
- Test cases: GDrive links, long ticket URLs, pasted multi-paragraph notes.

---

### 2.12 EOD email handoff — fix “Open Gmail” properly

**Problem today:**

- Gmail compose URL cannot carry full structured/styled HTML.  
- App copies HTML to clipboard then opens Gmail — user still has to paste manually.  
- Copy control is buried; friction is high.

**Direction:**

1. **Move Copy to the email panel header** (always visible, primary actions at top).  
2. **Open Gmail must deliver structured, styled content into the compose body** with minimal/no manual paste.  
3. Technical approach (research & implement the best that works on Windows + Mac with Gmail web):
   - Prefer: open Gmail compose → **auto-inject / auto-paste** HTML into the message body (Electron BrowserWindow / helper flow, or OS-level paste simulation after compose focuses — with clear UX if blocked).  
   - Fallback: one-click “Copy & open Gmail” that pastes automatically when possible; if OS blocks automation, show a single clear “Press Ctrl+V / Cmd+V once” toast (not the current buried multi-step).  
4. Keep structured Verdana HTML as the source of truth for what managers receive.  
5. Align with AI Work Summary output once that ships.

**Success:** User clicks Open Gmail → sees the full styled update already in the compose window (or one unavoidable OS paste), not a blank body.

---

### 2.13 Updates — check on every start + Cursor-like install

#### A) Check on app start

- On **every app launch** (cold start), check GitHub Releases for a newer version.  
- If available: show a **prominent popup** (not only buried in Updates tab): what’s new + Download / Install / Later.  
- Keep periodic checks while running; start check is mandatory.

#### B) Windows — auto-install like Cursor (not manual Setup again)

**Problem today:** Updater downloads the new `.exe`; user must run installer steps again.

**Target (Cursor-like):**

1. Download update in background.  
2. Prompt: **Restart & install**.  
3. On restart, updater **applies update and relaunches** Daybook — no walking through NSIS wizard again.

**Implementation note:** Use `electron-updater` properly with NSIS + `quitAndInstall()` / `autoInstallOnAppQuit` so the differential/full update applies silently on quit-restart. Verify packaging (`artifactName`, publish config) so Windows gets an updater-compatible package, not “download Setup and DIY.”

#### C) macOS — unsigned / no Apple Developer account

**Problem today:**

- App is not Apple-signed / notarized.  
- Auto-update often fails or Gatekeeper blocks the replaced app.  
- Manual workaround: share GitHub `.dmg` link + users run  
  `xattr -cr /Applications/Daybook.app`

**Direction:**

1. **Short term (product UX):**  
   - Detect Mac update failure / unsigned environment.  
   - In-app message with **direct download link** + copyable `xattr -cr /Applications/Daybook.app` (one-click copy).  
   - Don’t leave Mac users on a broken silent updater with no explanation.

2. **Medium term (real fix):**  
   - Apple Developer ID + notarization so `electron-updater` zip/dmg updates work like signed apps.  
   - Until then, document Mac as “assisted update” in Updates UI.

3. Do not pretend Mac auto-update works if signing is absent — **honest UX > fake button**.

---

## 3. Suggested release sequencing

| Release | Theme | Ships |
|---------|--------|--------|
| **1.2** | Write + Email + Time + Layout | Editor-only large composer; 12h Indian time everywhere; long-link/layout fixes; email header Copy + Open Gmail auto-paste flow |
| **1.2b** | Updates | Start-up update popup; Windows Cursor-like install-on-restart; Mac assisted update UX (link + xattr helper) until signing |
| **1.3** | Focus + Tray | Focus Mode; richer tray menu; Pause Reminders |
| **1.4** | Morning intelligence | Daily Brief; Carry Forward Intelligence |
| **1.5** | Understanding | AI Work Summary; Explain My Day; Work Patterns analytics |
| **1.6** | Companion | Overlay character (Win+Mac), settings-ready registry, activity interventions |

Order can shift; **email handoff + updates** are high friction today and should not wait behind companion work.

**Dependency note:** Explain My Day and AI Work Summary share one “day understanding” engine.

---

## 4. Design constraints (non-negotiable)

1. Stay **local-first**.  
2. Email remains the **primary professional output**.  
3. Companion overlay must work on **Windows and macOS**.  
4. Character system must be **settings-pluggable** later without rewrite.  
5. **Editor only** — no dual bullets+editor UI.  
6. **12-hour Indian time** in all user-facing UI.  
7. No streak/flame gamification.  
8. Don’t grow into Jira.  
9. Long content / URLs must not break layout.  
10. Mac update honesty until Apple signing exists.

---

## 5. Open decisions

1. Editor library (TipTap / similar) and storage shape (HTML vs JSON doc).  
2. Character shortlist + license.  
3. Gmail auto-paste: BrowserWindow compose vs clipboard+simulated paste vs Google Workspace API (likely out of scope for privacy).  
4. Windows updater package path (NSIS web installer vs full; verify `quitAndInstall` UX).  
5. Timeline for Apple Developer account / notarization.  
6. AI Work Summary: local model required vs hybrid when model missing.

---

## 6. Success criteria

- Writing happens in one large editor; mail formatting is Daybook’s job.  
- Open Gmail lands the **styled structured body** with near-zero manual paste.  
- Long Drive links don’t break preview or cards.  
- Times always read as Indian 12h.  
- On start, users see update popup when a new version exists.  
- Windows users restart once and get the new version (no full manual Setup dance).  
- Mac users either auto-update (once signed) or get a clear assisted path (link + xattr).  
- Busy employees update from tray/Focus; Explain My Day is used before send.  
- Carry list shrinks via decisions.

---

## 7. Out of scope (for now)

- Multi-user cloud collaboration  
- Theme packs as the main roadmap  
- Gamified streaks  
- Pretending Mac auto-update works without signing  

---

*Owner product direction — updated with editor-only, overlay companion architecture, 12h time, layout resilience, Gmail handoff, and Cursor-like / Mac-honest updates.*
