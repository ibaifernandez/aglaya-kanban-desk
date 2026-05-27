import { useEffect, useRef } from 'react';

/**
 * useFocusTrap — accessibility hook para modales y diálogos.
 *
 * Implementa A-17 + A-18 (audit Mariana 2026-05-27, WCAG 2.4.3 Level A
 * "Focus Order"):
 *   - Atrapa el foco dentro del elemento mientras está abierto.
 *   - Restaura el foco al elemento que estaba activo antes de abrir.
 *   - Foco inicial: primer elemento focusable dentro del contenedor
 *     (o el contenedor mismo si no hay focusables).
 *
 * Uso:
 *   const ref = useFocusTrap(isOpen);
 *   return <div ref={ref} role="dialog" aria-modal="true">...</div>
 *
 * @param {boolean} active — si true, atrapa foco. false = no-op.
 * @returns {React.RefObject} ref para asignar al contenedor del modal.
 */
export function useFocusTrap(active = true) {
  const containerRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    // Guardar elemento que tenía foco antes de abrir el modal
    previouslyFocusedRef.current = document.activeElement;

    // Selector estándar de elementos focusables
    const FOCUSABLE_SELECTOR = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    function getFocusableElements() {
      return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    }

    // Foco inicial — primer elemento focusable o el contenedor
    const focusables = getFocusableElements();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      // Contenedor con tabIndex=-1 acepta focus programático
      container.tabIndex = -1;
      container.focus();
    }

    // Tab/Shift+Tab loops dentro del modal
    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;

      const current = getFocusableElements();
      if (current.length === 0) {
        e.preventDefault();
        return;
      }

      const first = current[0];
      const last = current[current.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restaurar foco al elemento previo
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        // setTimeout 0 para esperar al unmount del modal antes de focusear
        setTimeout(() => previouslyFocused.focus(), 0);
      }
    };
  }, [active]);

  return containerRef;
}
