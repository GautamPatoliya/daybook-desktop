/**
 * Local UI preview for the update modal + Updates page.
 *
 * Flip `FORCE_UPDATE_UI_PREVIEW` to `true`, reload the app, then exercise:
 * - win32: available → downloading → ready
 * - darwin: mac-assist (manual DMG) modal
 * - Updates page “Check for updates” mock download
 * - “Restart & install” (toast only — does not quit)
 *
 * Keep this `false` before shipping / committing.
 */
export const FORCE_UPDATE_UI_PREVIEW: boolean = false;

/** Switch between `'win32'` and `'darwin'` when previewing each update UI. */
export const UPDATE_PREVIEW = {
  currentVersion: '1.1.1',
  nextVersion: '1.2.0',
  platform: 'win32' as 'win32' | 'darwin',
} as const;

export function isUpdateUiPreview(): boolean {
  return FORCE_UPDATE_UI_PREVIEW === true;
}

export function getMacAssistPreview(version = UPDATE_PREVIEW.nextVersion) {
  const verNum = version.replace(/^v/i, '');
  return {
    unsigned: true,
    platform: 'darwin' as const,
    arch: 'arm64',
    xattrCommand: 'xattr -cr /Applications/Daybook.app',
    dmgUrl: `https://github.com/GautamPatoliya/daybook-desktop/releases/download/v${verNum}/Daybook-${verNum}-arm64.dmg`,
  };
}

/** Simulated download ticks for preview mode (percentages). */
export function runMockUpdateDownload(
  onProgress: (percent: number) => void,
  onDone: () => void,
): () => void {
  let cancelled = false;
  const steps = [8, 22, 41, 63, 81, 94, 100];
  let i = 0;

  const tick = () => {
    if (cancelled) return;
    const pct = steps[i] ?? 100;
    onProgress(pct);
    i += 1;
    if (pct >= 100) {
      onDone();
      return;
    }
    window.setTimeout(tick, 280);
  };

  window.setTimeout(tick, 200);
  return () => {
    cancelled = true;
  };
}
