/** Apply Daybook theme. Spider-Verse enter animation only when switching into it. */
export function applyTheme(theme: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prev = root.getAttribute('data-theme') || 'default';
  root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('daybook-theme', theme);
  } catch {
    /* ignore */
  }

  if (theme === 'spider-verse' && prev !== 'spider-verse') {
    root.classList.remove('sv-entering');
    void root.offsetWidth;
    root.classList.add('sv-entering');
    window.setTimeout(() => root.classList.remove('sv-entering'), 1600);
  } else {
    root.classList.remove('sv-entering');
  }

  if (typeof window !== 'undefined' && (window as any).wtt) {
    (window as any).wtt.invoke('app:setThemeIcon', theme).catch(() => {});
  }
}
