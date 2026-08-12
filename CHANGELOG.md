# Changelog

All notable changes to Daybook will be documented in this file.

## 1.1.0 — 2026-08-11

### What's new
* **Smaller, faster install** — Daybook takes less space and runs better on everyday office laptops.
* **Local AI is optional** — Install the AI engine and a model only when you want on-device wording polish for email drafts.
* **Clearer Settings** — Side tabs (Profile, Schedule, Projects, Behavior, Data) so you can find options quickly.
* **Better Updates screen** — Each version has its own release card; easier to see what changed.
* **Smarter task bullets** — Paste several lines at once and Daybook splits them into separate bullet points automatically.
* **Cleaner daily email** — Backlog tasks are left out of end-of-day drafts by default. Turn on **Include Backlog in EOD email** in Settings if you want them.

### Improvements
* **Polish wording** — Email drafts show polished titles and details more reliably, with clearer feedback when Local AI is used.
* **Faster, offline-ready UI** — Icons and fonts load instantly without waiting on the internet.
* **Reminders** — Wait a few seconds after startup before nudging you, so login stays smooth on slow PCs.
* **Windows notifications** — Reminders now show the Daybook name and icon instead of a generic Electron label.

## 1.0.2 — 2026-08-04

### Fixes
* **Small screens / onboarding:** Onboarding and app shell now scroll so Next / Submit stay reachable on short laptop displays; sticky action buttons; lower minimum window size.
* **Windows double app:** Enforce a single running instance so opening Daybook no longer spawns two windows and two tray entries.
* **Windows autostart:** Stop registering both AutoLaunch and Electron login items (that combo launched Daybook twice at sign-in).
* **Tray icon:** Show a real Daybook tray icon on Windows instead of a blank/missing icon.

## 1.0.1 — 2026-08-03

### Fixes
* **EOD reminder:** End-of-day now builds and shows the email draft immediately (no more blank side panel until reopen).
* **Hourly reminder:** Hourly nudge opens the **New task** dialog so you can log work right away.
* **Local AI downloads:** Cancel and pause work reliably; clearer handling for network errors, disk space issues, and interrupted downloads with Resume / Discard.
* **Reminders:** Hourly/EOD bring you back to the Board if you were on another tab, and survive window reopen more reliably.
* **Updates check:** Correct “update available” detection (`isUpdateAvailable`) instead of falsely reporting up to date in some cases.

### Improvements
* Mac packaging hooks for signing/notarization readiness (Developer ID + notarize when secrets are configured).
* Local AI download UX: Pause, Cancel, Resume, and Discard for partial downloads.

## 1.0.0 — 2026-07-31

Welcome to **Daybook v1.0.0**! This is the initial stable release of Daybook, a local-first daily work tracker and automated email companion tailored for office teams.

### Key Features

* **Offline Task Board**: Manage your daily tasks using a clean drag-and-drop Kanban board layout. Sort tasks across `Backlog`, `In progress`, and `Done` columns seamlessly.
* **Auto-Carry-Over**: Stop copying outstanding work log items. Daybook automatically carries forward unfinished tasks (status WIP or Backlog) from your previous active work date on launch.
* **Automated Daily Email Drafts**: Instantly compile your daily achievements into styled Markdown, plain text, and Verdana-formatted HTML updates. Hand off directly to Gmail with a deep link or copy to your clipboard with a click.
* **Local On-Device AI Wording Polish**: Polish and clean up your task title details using on-device quantized LLMs (including Qwen 2.5, Llama 3.2, Phi 3, and Gemma 2). Runs completely offline without api keys.
* **Sleek Analytics Dashboard**: Track project distributions, task categories, completion streak stats, average day durations, and hourly log activity tables.
* **Time and Schedule Scheduler**: Set custom working days and shift hours. Receive customizable hourly nudges to log details and daily end-of-day prompts to send reports.
* **Auto-Launch & OS Tray Integration**: Enable autostart in Settings to run Daybook in the background. Manage tasks quickly via right-clicks on the desktop tray.
* **GitHub Release Auto-Updates**: Stay updated automatically. Daybook pulls, downloads, and prompts to install new versions directly from GitHub Releases.
