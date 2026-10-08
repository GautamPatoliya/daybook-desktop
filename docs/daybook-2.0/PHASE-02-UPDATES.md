# Daybook 2.0 - Phase 2: Updates (Start Check + Windows Auto-Install + Mac Assisted)

**Phase ID:** `P2`  
**Depends on:** Phase 1 complete (soft - can parallelize only if resourcing allows; prefer after P1)  
**Suggested version:** `1.2.1` / part of `2.0`

---

## 1. Purpose

Users should learn about updates **when the app starts**, install on Windows like Cursor (**restart applies update**), and on unsigned Mac get an **honest assisted path** instead of a broken silent updater.

---

## 2. In scope

1. On **every cold start**, check for updates; if newer version exists, show **modal popup**.  
2. Windows: configure/fix `electron-updater` so **Restart & install** runs `quitAndInstall()` and relaunches without full manual NSIS wizard walkthrough.  
3. macOS unsigned: detect failure / inactive trusted update; show download link + `xattr -cr` helper with one-click copy.  
4. Keep Updates tab as detail view; popup is the interrupt for availability.  

---

## 3. Out of scope

- Purchasing/configuring Apple Developer certificates (document steps only).  
- Changing GitHub repo owner.  
- Editor work.

---

## 4. Current state (facts)

| Item | Reality |
|------|---------|
| Updater | `electron-updater` in `electron/main.ts` |
| Flags | `autoDownload = !isDev`, `autoInstallOnAppQuit = !isDev` |
| Events | `update-available`, `update-downloaded`, `error`, etc. |
| IPC | `updater:check`, `updater:status`, install via `autoUpdater.quitAndInstall()` in handlers |
| UI | `renderer/app/updates/page.tsx` |
| Publish | GitHub `GautamPatoliya/daybook-desktop` |
| Windows artifact | `Daybook-Setup-${version}.exe` (NSIS) |
| Mac | dmg + zip; unsigned (`identity: null`) |

---

## 5. Start-up popup specification

### 5.1 When to check

- After app ready + main window created + **not** during first-run onboarding before settings exist (if onboarding incomplete, still may check but don’t block onboarding - show popup after onboarding completes or on next launch).  
- Prefer: if `onboardingComplete === false`, defer popup until board first load.  
- Always run check on launch when packaged (`app.isPackaged`).

### 5.2 Popup content (exact)

**Title:** `Update available`  
**Body:** `Daybook {newVersion} is ready. You have {currentVersion}.`  
Optional: first 3 bullets from CHANGELOG for that version if easily parsed.  

**Buttons:**

| Button | Action |
|--------|--------|
| **Later** | Dismiss; do not nag again until next cold start (or after 24h - implement **next cold start only** for simplicity) |
| **View notes** | Navigate to Updates tab |
| **Download / Install** | See platform flows below |

### 5.3 States

1. Checking (no modal)  
2. Up to date (no modal)  
3. Available - modal  
4. Downloading - modal progress or Updates tab progress  
5. Downloaded - modal: **Restart & install**  
6. Error - modal or toast with message  

---

## 6. Windows Cursor-like install

### 6.1 Target UX

1. Update downloads in background (already `autoDownload` in prod).  
2. User sees **Restart & install**.  
3. App quits, installer applies quietly, app relaunches at new version.  
4. User does **not** click through NSIS “Next Next Finish” for routine updates.

### 6.2 Implementation requirements

- Verify `package.json` build.nsis / publisher config supports electron-updater NSIS updates (not only “download Setup from browser”).  
- On **Restart & install**, call `autoUpdater.quitAndInstall(false, true)` (or current recommended signature): install and relaunch.  
- Ensure `autoInstallOnAppQuit` remains true as backup.  
- Document in CHANGELOG: “Updates install on restart (Windows).”

### 6.3 Acceptance tests (Windows, packaged build)

- [ ] Install vA, publish vB to Releases (or use two local builds).  
- [ ] Launch vA → popup shows vB.  
- [ ] Download completes → Restart & install → app returns as vB without manual NSIS wizard.  
- [ ] Data in `userData` preserved.

### 6.4 Failure handling

If `quitAndInstall` fails: show error + link to GitHub Releases Setup exe as fallback.

---

## 7. macOS assisted update

### 7.1 Problem statement (do not deny in UI)

App is **not** Apple-signed/notarized (`identity: null`). Auto-update via electron-updater often fails or Gatekeeper quarantines the app. Current manual workaround:

```bash
xattr -cr /Applications/Daybook.app
```

### 7.2 Required UX when Mac update isn’t trustworthy

In popup and Updates tab, if `process.platform === 'darwin'` AND (updater error OR known unsigned build flag):

**Show panel:**

1. Text: `Automatic update isn’t available for this Mac build yet (unsigned).`  
2. Button: **Download Daybook {version}.dmg** → opens  
   `https://github.com/GautamPatoliya/daybook-desktop/releases/download/v{version}/Daybook-{version}-arm64.dmg`  
   (construct from `autoUpdater` version info / latest release tag).  
3. Steps (numbered):  
   1. Open the DMG and replace Daybook in Applications.  
   2. If macOS blocks the app, open Terminal and run:  
   3. Code block with `xattr -cr /Applications/Daybook.app`  
4. Button: **Copy command** → clipboard.

### 7.3 Do not

- Show “Restart & install” as if it will work when updater is known broken on unsigned Mac.  
- Claim “up to date” when check failed.

### 7.4 Future (not Phase 2 coding)

When Apple signing exists: enable same quitAndInstall path as Windows; remove assisted panel.

---

## 8. IPC / events

Extend as needed:

```
updater:checkOnLaunch → triggers check, returns { status, version, error? }
updater:getMacAssist → { dmgUrl, xattrCommand }
```

Renderer listens for main-process push events (existing pattern) for `update-available` / `update-downloaded`.

---

## 9. Acceptance checklist

- [ ] Packaged Windows: start popup when update exists  
- [ ] Packaged Windows: Restart & install → new version without full manual wizard  
- [ ] Mac unsigned: assisted download + xattr copy works  
- [ ] Later dismisses until next cold start  
- [ ] Updates tab still works  
- [ ] Dev unpackaged: no false “you’re outdated” panic (existing inactive updater messaging OK)  
- [ ] Core regression (Global Rules) passes  

---

## 10. Explicit non-assumptions

- Do not assume Apple signing will be added mid-phase.  
- Do not remove NSIS artifact naming without verifying updater `latest.yml`.  
- Do not auto-run `xattr` from the app without user consent (copy command only).
