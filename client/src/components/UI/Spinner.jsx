// Tailwind purge: clases dinámicas necesitan referencia literal para JIT.
// Lista exhaustiva de tamaños usados en la app.
const SIZE_CLASSES = {
  4:  'w-4 h-4',
  5:  'w-5 h-5',
  6:  'w-6 h-6',
  8:  'w-8 h-8',
  10: 'w-10 h-10',
  12: 'w-12 h-12',
  16: 'w-16 h-16',
};

/**
 * Spinner indicador de carga.
 *
 * Accesibilidad (A-05 audit Mariana 2026-05-27):
 *   role="status" + aria-label hace que screen readers anuncien
 *   la actividad de carga. Sin esto, usuarios SR no perciben
 *   estados de loading.
 *
 * @param {number} size — tamaño en Tailwind units (4-16). Default 5.
 * @param {string} label — texto para screen reader. Default "Cargando".
 */
export function Spinner({ size = 5, label = 'Cargando' }) {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES[5];
  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      className={`${sizeClass} border-2 border-[#2e3140] border-t-indigo-500 rounded-full animate-spin`}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}
