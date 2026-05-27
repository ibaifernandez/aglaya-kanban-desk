# Audit A — Producto cara al usuario

**Fecha:** 2026-05-27
**Repo SHA:** `23cdd06`
**Dimensiones cubiertas:** Accesibilidad (WCAG 2.1 AA), Usabilidad, Performance, SEO técnico.

---

## Resumen de Fase A

| Severidad | Count |
|---|---|
| CRÍTICO | 5 |
| ALTO | 4 |
| MEDIO | 4 |
| BAJO | 3 |
| **Total** | **16** |

---

## Hallazgos

| ID | Dim | Hallazgo | Evidencia | Severidad | Impacto usuario | Esfuerzo fix |
|---|---|---|---|---|---|---|
| **A-01** | A11y | Labels NO asociados a inputs (`htmlFor`/`id` ausentes en toda la app). 0 `htmlFor=`, 0 `<input id=` en `client/src/`. WCAG 1.3.1 (Info and Relationships, Level A). | `grep htmlFor client/src/` → 0 hits. Ejemplos: `LoginPage.jsx:46-60`, `WorkspaceMembers.jsx:189-198`, `WorkspaceSettings.jsx:91-172`, `CardModal.jsx:538` | **CRÍTICO** | Screen reader no anuncia label al enfocar input. Click en label no enfoca input. Usuarios con lectores no pueden completar login ni editar cards | Medio — agregar `id` único + `htmlFor` en ~32 inputs |
| **A-02** | A11y | Drag-and-drop sin soporte keyboard. `@dnd-kit/core` instalado SIN `KeyboardSensor`. 0 ocurrencias de `KeyboardSensor`. WCAG 2.1.1 (Keyboard, Level A). | `grep KeyboardSensor client/src/` → 0 hits. `client/package.json:12` (`@dnd-kit/core ^6.1.0` provee `KeyboardSensor` que no se importa). | **CRÍTICO** | Usuario que no puede usar mouse/touch (motora, ceguera total) NO puede mover cards entre columnas ni reordenar tableros. Funcionalidad principal inaccesible | Bajo–Medio — añadir sensor + `sortableKeyboardCoordinates` |
| **A-03** | A11y | Modales SIN `role="dialog"` ni `aria-modal="true"`. 0 ocurrencias. WCAG 4.1.2 (Name, Role, Value, Level A). | `grep 'role="dialog"' client/src/` → 0 hits. Modales: `CardModal.jsx`, `BoardMoveModal.jsx`, `ColumnPickerModal.jsx`, `AvatarCropModal.jsx`, `WorkspaceMembers.jsx` (AddMemberModal), `WorkspaceSettings.jsx` | **CRÍTICO** | Screen readers no identifican el modal como diálogo, no atrapan foco lógicamente, anuncian la página completa en lugar del modal | Bajo — añadir `role="dialog"`, `aria-modal`, `aria-labelledby` + focus trap |
| **A-04** | A11y | Iconos-botón sin `aria-label`. Botones con solo `<X />` / `<Trash2 />` / `<Pencil />` y sin texto visible ni label. ~7 instancias detectadas. WCAG 4.1.2 (Level A). | `grep -B1 '<X\b\|<Trash2\|<Pencil\|<Plus' client/src/` → 7 botones sin `aria-label`. Ej: cerrar modales, eliminar items, editar inline | **CRÍTICO** | Botón se anuncia como "botón" sin acción descriptiva. Usuarios de screen reader no pueden cerrar modales ni eliminar | Bajo — añadir `aria-label` a cada |
| **A-05** | A11y | `Spinner` (componente loading global) SIN `role="status"` ni `aria-label`. WCAG 4.1.3 (Status Messages, Level AA). | `client/src/components/UI/Spinner.jsx:1-7` (8 LOC, solo `<div>` spinning, sin atributos a11y) | **CRÍTICO** | Estados de carga invisibles para screen readers. Usuario no sabe si la app está procesando | Trivial — añadir `role="status" aria-label="Cargando"` |
| **A-06** | A11y | Total de atributos `aria-*` en client = **1** (`aria-pressed={enabled}` en `DigestPreferences.jsx:87`). Resto del UI carece de cualquier marcación ARIA. | `grep -rE "aria-" client/src/` → 1 match | **ALTO** | Síntoma agregado: app sin awareness de a11y. Botones toggle, expandibles, listas marcadas no exponen estado | Alto — auditoría completa componente por componente |
| **A-07** | Perf | Bundle único 721.56 kB JS (205.44 kB gzip) sin code-splitting. Vite emite warning >500 kB. | `npx vite build` → `dist/assets/index-N0DQ1B1P.js: 721.56 kB │ gzip: 205.44 kB`. 1815 módulos en 1 chunk. | **ALTO** | LCP/INP en 3G/4G degradados. Login screen requiere descargar app completa antes de mostrarse | Medio — `React.lazy` por ruta (`LoginPage`, `WorkspaceDashboard`, `Board`, `AdminPage`); `manualChunks` para vendor split |
| **A-08** | A11y | `prefers-reduced-motion` NO respetado. 0 ocurrencias de `motion-reduce:` o media query equivalente. 4 clases `animate-*` activas (spinner, transitions). WCAG 2.3.3 (Animation from Interactions, Level AAA) — no AA, pero relevante para usuarios con sensibilidad vestibular. | `grep -rE "prefers-reduced-motion\|motion-reduce:" client/src/` → 0 hits | **MEDIO** | Usuarios con migraña/vértigo expuestos a animaciones sin opt-out | Trivial — `motion-reduce:animate-none` en clases relevantes |
| **A-09** | A11y | Modales cerrables con click en backdrop pero accesibilidad de cierre por teclado depende de `useEscapeKey` (no verificado en todos los modales). | `grep -rE "<div[^>]*onClick={onClose}" client/src/` → 2 backdrops (`WorkspaceSettings.jsx:72`, `WorkspaceMembers.jsx:385`). `useEscapeKey()` existe (hook degree 18, ver grafo god-nodes) pero no auditado por modal. | **ALTO** | Si algún modal NO usa `useEscapeKey`, usuarios teclado quedan atrapados (no pueden cerrar) | Bajo — verificar uso en cada modal + asegurar focus return al elemento que abrió |
| **A-10** | UX | `CardModal.jsx` = 937 LOC en un solo componente. Carga cognitiva alta para usuarios + alta complejidad ciclomática implícita. | `wc -l client/src/components/CardModal/CardModal.jsx` → 937. Modal único contiene: título, descripción, prioridad, fecha, checklist, asignaciones, archivos adjuntos, comentarios, mover, eliminar | **ALTO** | Modal denso satura visualmente (UI density). Difícil escanear. Alta tasa de error al editar (varios estados a la vez) | Alto — split por tabs/sections o sidebar pattern |
| **A-11** | Perf | `lucide-react` ocupa 29M en `node_modules` (mayor dep del cliente). Aunque tree-shaking por named imports funciona a build-time, expone riesgo si algún componente importa `*` o agrupa muchos íconos. | `du -sh client/node_modules/lucide-react` → 29M. Imports auditados son named (ej. `import { Plus, X } from 'lucide-react'`) — tree-shake OK actualmente | **BAJO** | Riesgo latente, no impacto actual | Trivial — guardrail eslint `no-restricted-imports` para bloquear `lucide-react/*` wildcard |
| **A-12** | SEO | `index.html` carece de meta description, OG (Open Graph), Twitter card, canonical, theme-color, apple-touch-icon. Solo `lang="es"`, `viewport`, `favicon`, `title`. | `client/index.html:1-13` (13 LOC totales) | **MEDIO** | Link previews en Slack/WhatsApp/Twitter aparecen sin imagen/descripción de marca. Compartir kanban.aglaya.biz da fallback genérico | Trivial — añadir meta tags |
| **A-13** | SEO | `robots.txt` en producción contiene solo boilerplate de Cloudflare Content Signals, sin reglas explícitas. No hay `User-agent: *` / `Disallow` ni `Sitemap:` directive. | `curl https://kanban.aglaya.biz/robots.txt` → solo bloque Cloudflare | **BAJO** | App es auth-walled, contenido no indexable de todos modos. Pero falta señal explícita (Disallow: /) para evitar crawl bot waste | Trivial — añadir `User-agent: * / Disallow: /` o permitir explicitamente |
| **A-14** | SEO | App auth-walled SPA pero `kanban.aglaya.biz/` responde 200 con body vacío (`<div id="root"></div>` cargado por JS). Crawlers que no ejecutan JS ven página vacía. | `curl https://kanban.aglaya.biz/` → body sin contenido server-rendered | **N/A en práctica** | No impacta UX. Solo registrado: si en el futuro hay landing pública, SSR/SSG necesario | n/a |
| **A-15** | UX | Color contrast bajo previsible. Texto secundario en `#555b70` y `#8b92a5` sobre `#0f1117`/`#1a1d26` (dark theme). `#555b70` sobre `#0f1117` da contraste ~3.1:1 (WCAG AA exige 4.5:1 para texto <18pt). `[NO VERIFICABLE rigurosamente — requiere DevTools/axe contra el deploy o cálculo manual de cada par]` | Tailwind classes detectadas: `text-[#555b70]`, `text-[#8b92a5]`. Cálculo rápido: `#555b70` luminance ≈ 0.146 vs `#0f1117` ≈ 0.0066 → ratio ~3.08 | **ALTO** | Usuarios con baja visión / luz ambiente alta no leen labels, fechas, contadores secundarios | Bajo–Medio — ajustar tokens del design system |
| **A-16** | UX | `Spinner` size prop pasa a `w-${size}` (interpolación de Tailwind clases). Si Tailwind purge no detecta `w-5`/`h-5` literales en uso, classes pueden quedar fuera del bundle. Pendiente verificación. | `client/src/components/UI/Spinner.jsx:4` (`w-${size} h-${size}`) — Tailwind JIT requiere clases completas | **MEDIO** | En prod, spinner puede no renderizar tamaño correcto (clase no incluida en CSS) | Trivial — usar mapa `{5: 'w-5 h-5', 8: 'w-8 h-8'}` |

---

## Notas de método

- **Bundle build:** `vite build` ejecutado localmente, no requiere deploy.
- **SEO crawl:** `curl` directo a https://kanban.aglaya.biz, robots.txt, sitemap.xml.
- **A11y:** análisis estático por grep + lectura de componentes representativos (`LoginPage.jsx`, `Spinner.jsx`, `WorkspaceSettings.jsx`). NO se ejecutó axe-core ni Lighthouse contra el deploy (requeriría sesión auth válida para auditar páginas internas).
- **Core Web Vitals reales:** `[NO VERIFICABLE — requiere Lighthouse/PageSpeed contra kanban.aglaya.biz con sesión válida o WebPageTest desde región objetivo]`.
- **Color contrast riguroso:** `[NO VERIFICABLE rigurosamente sin axe-core o Stark]`. Cálculo manual para los 2 pares más visibles indica riesgo alto.

---

## Conclusión Fase A

**Estado a11y: rojo.** 5 hallazgos CRÍTICOS violan WCAG 2.1 Level A. Cualquier usuario con dependencia de teclado o screen reader queda excluido de funcionalidad principal (drag-drop, modales, formularios). No conformidad explícita con WCAG AA — bloqueante si AGLAYA factura a clientes con políticas a11y (UE pública, contratos europeos exigen EN 301 549).

**Estado performance: amarillo.** Bundle único 721 kB es funcional pero degrada experiencia en redes lentas / primera visita. Code-splitting es ROI alto con esfuerzo medio.

**Estado SEO: verde** (relativo). App auth-walled, no hay contenido indexable. Solo recomendaciones nice-to-have (OG tags, robots explícito).

**Estado UX: amarillo.** Loading/error patterns existen y son consistentes. CardModal (937 LOC) y contraste de texto secundario son los dos pain points reales.

---

**Awaiting `OK Fase A` para arrancar Fase B (Seguridad + DB + Arquitectura).**
