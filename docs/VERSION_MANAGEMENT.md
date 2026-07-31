# Version Management & Release Guide

This document describes how to manage Daybook's versions using Git, package new desktop builds, and release auto-updates to employees.

---

## 🛠️ Prerequisites
Before publishing updates, ensure the GitHub repository has been configured correctly in the build configuration:

1. **Open `package.json`** and navigate to the `build.publish` section (around line 70):
   ```json
   "publish": [
     {
       "provider": "github",
       "owner": "YOUR_GITHUB_USER_OR_ORG",
       "repo": "YOUR_REPO_NAME"
     }
   ]
   ```
2. Make sure this matches your actual GitHub repository URL.

---

## 🚀 How to Publish a New Update

Follow these 5 steps to release a new update to employees:

### 1. Update Version Numbers
Before triggering a build, you must increment the version number in `package.json` under the `"version"` field (following [Semantic Versioning](https://semver.org/)):
* **Patch release (bug fixes):** `1.0.0` ➔ `1.0.1`
* **Minor release (new features):** `1.0.0` ➔ `1.1.0`
* **Major release (breaking changes):** `1.0.0` ➔ `2.0.0`

Example edit in `package.json`:
```json
{
  "name": "daybook",
  "version": "1.0.1",
  "description": "Daybook — offline daily work tracker for office teams"
  ...
}
```

### 2. Update the Changelog (Optional but Recommended)
Open [CHANGELOG.md](file:///Users/gautam/Downloads/dailybook-desktop/CHANGELOG.md) and document your changes so they render in the app's **Updates** panel:
```markdown
## 1.0.1 — Today's Date
- Fixed newline bugs inside task detail descriptions.
- Removed deprecated due date selectors.
- Beautified the Analytics and Updates dashboards.
```

### 3. Commit Your Changes
Stage and commit your edits to Git:
```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to v1.0.1 and update changelog"
```

### 4. Create and Push a Version Tag
The GitHub Actions release pipeline triggers automatically whenever a tag starting with `v` (e.g. `v1.0.1`) is pushed. Create a new tag matching the version you set in `package.json`:
```bash
git tag v1.0.1
git push origin main --tags
```

### 5. Automated Build & Release
* Pushing the tag starts the `.github/workflows/release.yml` GitHub Action.
* The pipeline runs concurrently on **Windows** (`windows-latest`) and **macOS** (`macos-latest`).
* It builds, compiles, and publishes installer artifacts (e.g., `.exe` and `.dmg`/`.zip`) directly to a new release page under your repository.
* The draft release is automatically published as a release candidate or full release.

---

## 🔄 How the Auto-Updater Works

* **Trigger**: The application checks for updates automatically on start, and every **4 hours** while running in the background.
* **Download**: If a newer version tag is found on the GitHub Release page, the application automatically downloads the installer in the background (using `electron-updater`).
* **Installation**: Once downloaded, a banner appears in the **Updates** tab of the app prompting the user to click **Restart & install**.
* If the user ignores it, the update will be applied automatically next time they quit and relaunch the app.

---

## 🧪 How to Test Auto-Update (0.9.0 → 1.0.0)

`npm run dev` used to report **UP TO DATE** incorrectly because `electron-updater` is inactive in unpackaged apps, and the UI treated a `null` check result as “latest.” That is fixed: dev can *detect* updates via `dev-app-update.yml`, but **download/install only works from a packaged Setup/.dmg**.

### Correct end-to-end test

1. Keep GitHub Release **v1.0.0** published (with `latest.yml` / `latest-mac.yml`).
2. Set `"version": "0.9.0"` in `package.json`.
3. Build installers locally (do **not** publish):
   - Windows: `npm run dist:win` → install `release/Daybook-Setup-0.9.0.exe`
   - macOS: `npm run dist:mac` → install the `.dmg` (copy app to `/Applications`)
4. Quit any `npm run dev` instance. Open the **installed** Daybook only.
5. Open **Updates → Check for updates**. You should see download progress for **1.0.0**, then **Restart & install**.

### Quick detection-only check (dev)

With `package.json` at `0.9.0` and `dev-app-update.yml` present:

```bash
npm run dev
```

**Updates → Check for updates** should report that **1.0.0** is available. Dev will not download/install it.

### Notes

* Release feed is public and correct (`latest.yml` → `Daybook-Setup-1.0.0.exe`).
* Current macOS CI artifacts are **arm64 only**. Intel Macs need an `x64` (or universal) zip in the release or the download step will fail after detection.
* Unsigned macOS builds may fail at *install* time until Apple signing/notarization secrets are configured.

---

## 🏗️ Code Signing (For Production Rollout)
Unsigned apps trigger SmartScreen warnings on Windows and Gatekeeper blocks on macOS. For a production rollout, set these secret keys in your GitHub Repository settings (`Settings ➔ Secrets and variables ➔ Actions`):

### Windows Signing
* **`CSC_LINK`**: A Base64-encoded string of your Windows Code Signing certificate (`.pfx`).
* **`CSC_KEY_PASSWORD`**: The password to decrypt the certificate.

### macOS Signing & Notarization
* **`APPLE_ID`**: Your Apple developer email.
* **`APPLE_APP_SPECIFIC_PASSWORD`**: An app-specific password generated via Apple ID portal.
* **`APPLE_TEAM_ID`**: Your Apple developer team ID.
