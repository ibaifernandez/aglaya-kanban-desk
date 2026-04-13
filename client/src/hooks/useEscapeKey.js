import { useEffect } from 'react';

export function useEscapeKey(onEscape, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof onEscape !== 'function') return undefined;

    function handleKeyDown(event) {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') onEscape(event);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onEscape]);
}
