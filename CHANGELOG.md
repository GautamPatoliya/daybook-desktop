# Changelog

All notable changes to Daybook will be documented in this file.

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
