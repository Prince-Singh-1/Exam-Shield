import { useEffect } from 'react';

type Report = (type: string, detail?: string) => void;

/**
 * Anti-cheat lockdown for the online exam runner.
 * Disables copy/cut/paste, right-click, text selection, printing, DevTools
 * shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U), forces fullscreen, and reports
 * tab-switch / window-blur / fullscreen-exit violations.
 */
export function useExamLockdown(active: boolean, report: Report) {
  useEffect(() => {
    if (!active) return;

    const block = (e: Event) => {
      e.preventDefault();
      report('COPY_PASTE', e.type);
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      const devtools =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(k)) ||
        (e.ctrlKey && k === 'U');
      const clipboard = (e.ctrlKey || e.metaKey) && ['C', 'V', 'X', 'P', 'A', 'S'].includes(k);
      if (devtools) {
        e.preventDefault();
        report('DEVTOOLS', e.key);
      } else if (clipboard) {
        e.preventDefault();
        report('COPY_PASTE', e.key);
      }
    };
    const onVisibility = () => {
      if (document.hidden) report('TAB_SWITCH', 'Tab hidden');
    };
    const onBlur = () => report('WINDOW_BLUR', 'Window lost focus');
    const onFsChange = () => {
      if (!document.fullscreenElement) report('FULLSCREEN_EXIT', 'Left fullscreen');
    };

    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('paste', block);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('beforeprint', () => report('DEVTOOLS', 'Print attempt'));

    document.documentElement.requestFullscreen?.().catch(() => undefined);

    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [active, report]);
}
