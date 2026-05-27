# Audit A — Addendum

**Fecha:** 2026-05-27
**Anexo de:** `audit-A.md`
**Motivo:** Responder 3 aclaraciones + cubrir 8 vacíos solicitados antes de `OK Fase A`.

---

## Parte 1 — Aclaraciones a hallazgos previos

### Aclaración 1: A-01 (labels sin asociación)

**Verificación ejecutada:**

```
grep -rEn "<input|<textarea|<select" client/src/ | wc -l   → 52
grep -rE "<input[^>]*aria-label" client/src/ | wc -l         → 0
grep -rE "aria-labelledby" client/src/ | wc -l               → 0
grep -rE "<label" client/src/ | wc -l                        → 32
```

**Patrón real detectado.** Inspección de 10 ejemplos en `WorkspaceMembers.jsx`, `WorkspaceSettings.jsx`, `CardModal.jsx`, `LoginPage.jsx`, `DigestPreferences.jsx`:

```jsx
// LoginPage.jsx:46-60 (representativo)
<label className="block text-xs font-medium ...">Email</label>
<input type="email" value={email} ... />
```

El `<label>` aparece como **hermano visual previo** al `<input>`, NO como wrapper, NO con `htmlFor`, sin que el input tenga `id`, `aria-label` ni `aria-labelledby`. Caso `DigestPreferences.jsx:82,96` SÍ usa wrapper implícito (`<label>...<input/></label>`) — válido para WCAG ahí.

**Conclusión:** la asociación es **puramente visual, no programática**, en ~50 de 52 inputs. Los 2 wrappers de DigestPreferences son la única excepción válida.

**Severidad A-01:** **CRÍTICO confirmado, bloqueante WCAG 1.3.1 Level A.** Sin cambio.

---

### Aclaración 2: A-11 (lucide-react 29 MB)

**Razón:** señal de `node_modules` size es engañosa. Tree-shake por named imports ya funciona a build-time. Bundle final ya está medido (721 kB total, incluye TODO incluido lucide).

**Acción:** **reclasificar como INFO.** Cambiar `Severidad` de **BAJO → INFO / N/A**. Mantenido como nota: añadir guardrail eslint `no-restricted-imports` para bloquear `import * from 'lucide-react'` es nice-to-have, NO hallazgo formal.

**Para medir peso real:** instalar `rollup-plugin-visualizer` y ejecutar `vite build` — pendiente, fuera de scope del audit estático.

---

### Aclaración 3: A-08 (prefers-reduced-motion)

**Razón:** WCAG 2.3.3 es **Level AAA**, no AA. AAA no es target obligatorio si el sistema apunta a AA.

**Acción:** **mantener severidad MEDIO.** Es la severidad ya asignada (no era CRÍTICO ni ALTO). El hallazgo queda como buena práctica con esfuerzo trivial. Si fuera AA, sería ALTO; siendo AAA, MEDIO es correcto.

---

## Parte 2 — 8 hallazgos nuevos

| ID | Dim | Hallazgo | Evidencia | Severidad | Esfuerzo |
|---|---|---|---|---|---|
| **A-17** | A11y | **Focus trap ausente en modales.** No hay librería (`focus-trap-react`, `react-focus-lock`) instalada ni implementación manual. 0 imports detectados. Usuario teclado puede tabular fuera del modal hacia DOM background mientras el modal está abierto. WCAG 2.4.3 (Focus Order, Level A). | `grep -rE "focus-trap\|react-focus-lock\|FocusTrap\|trapFocus" client/src/ ../package.json` → 0 hits. Modales afectados: `CardModal`, `BoardMoveModal`, `ColumnPickerModal`, `AvatarCropModal`, `WorkspaceSettings`, `AddMemberModal`. | **CRÍTICO** | Medio — añadir `react-focus-lock` (~3 KB) + envolver cada modal |
| **A-18** | A11y | **Focus NO retorna al elemento que abrió el modal.** 0 ocurrencias de `previouslyFocused`/`lastFocused`/`returnFocus` en client. Después de cerrar modal, foco va al `<body>` (Tab next va al primer elemento de la página, no al botón que abrió). WCAG 2.4.11 (Focus Not Obscured) + comportamiento esperado a11y. | `grep -rE "previouslyFocused\|lastFocused\|returnFocus" client/src/` → 0 hits | **ALTO** | Bajo — `useRef` al `document.activeElement` antes de abrir, restaurar en cleanup |
| **A-19** | A11y | **Skip-to-content link ausente.** No existe `<a href="#main">Skip to main content</a>` al inicio del DOM. Usuario teclado debe tabular por todo el header/sidebar antes de llegar al contenido. WCAG 2.4.1 (Bypass Blocks, Level A). | `grep -rE "skip.*content\|skip.*main\|#main\|sr-only" client/src/` → 0 hits relevantes | **CRÍTICO** | Trivial — añadir `<a>` con clase Tailwind `sr-only focus:not-sr-only` en `App.jsx` antes de `<Toolbar>` |
| **A-20** | A11y | **Heading hierarchy inconsistente / múltiples `<h1>` simultáneos.** 4 `<h1>` detectados en `Toolbar.jsx:133`, `WorkspaceDashboard.jsx:584`, `ResetPasswordPage.jsx:41`, `AdminPage.jsx:190`. `LoginPage.jsx` NO tiene `<h1>` (0 headings). 18 headings totales en toda la app — proporción baja para una SPA con tantas páginas. Si `Toolbar` se renderiza en mismo DOM que `WorkspaceDashboard`, dos `<h1>` activos. WCAG 1.3.1 (Info and Relationships, Level A). | `grep -rE "<h1" client/src/` → 4 ocurrencias en archivos distintos. `grep -nE "<h[1-6]" src/pages/LoginPage.jsx` → 0. Total `<h1-6>`: 18 | **ALTO** | Bajo — 1 `<h1>` por route (WorkspaceDashboard, Board, AdminPage, LoginPage), demás como `<h2>`/`<h3>` |
| **A-21** | A11y | **NotificationBell y toasts sin `aria-live`.** 0 ocurrencias de `role="alert"`, `role="status"`, `aria-live=`. Cambios en contador de notificaciones, toasts de éxito/error post-acción NO se anuncian a screen readers. WCAG 4.1.3 (Status Messages, Level AA). | `grep -rE "role=\"(alert\|status)\"\|aria-live=" client/src/` → 0 hits. `NotificationBell.jsx:31` actualiza badge sin anuncio. | **ALTO** | Bajo — `aria-live="polite"` en contenedor de badge + toast container con `role="alert"` |
| **A-22** | A11y | **Form validation NO accesible programáticamente.** 0 `aria-invalid`, 0 `aria-describedby`, 0 `aria-required`. 35 ocurrencias de `setError()` en componentes (LoginPage, AdminPage, CardModal, etc.). Mensajes de error son texto visual sin vínculo al input que falló. WCAG 3.3.1 (Error Identification, Level A) + 3.3.3 (Error Suggestion, Level AA). | `grep -rE "aria-invalid\|aria-describedby\|aria-required" client/src/` → 0 cada uno. `grep -rE "setError\(" client/src/` → 35 hits | **CRÍTICO** | Medio — añadir `id` al mensaje error + `aria-describedby={errId}` y `aria-invalid={!!err}` en cada input |
| **A-23** | UX | **Empty states parciales.** Existen 4 patrones de empty state (`WorkspaceDashboard.jsx:485,588,607-610` con "No tienes espacios de trabajo todavía"; `Board.jsx:176` con cols.length===0). Pero NO empty states detectados para: búsqueda sin resultados, board sin cards, columna vacía, notificaciones vacías, checklist vacía. | `grep -rEn "vacío\|No hay\|Sin\s" client/src/ --include="*.jsx"` → 0 matches en `Board/`, `CardModal/`, `Toolbar/`, `NotificationBell.jsx` | **MEDIO** | Bajo–Medio — añadir 4-5 empty states con CTA donde aplique |
| **A-24** | A11y | **Touch targets borderline.** `IconButton` usa `p-1` (4 px padding) sobre íconos Lucide 16 px → target total ~24×24 px. Pasa WCAG 2.5.8 (Target Size Minimum, Level AA — 2.2+) por margen 0. `NotificationBell` `p-1.5` (6 px) + Bell 24 px → 36×36 px (OK). Falla AAA (44×44). En mobile la densidad agrava: targets pegados sin separación. | `client/src/components/UI/IconButton.jsx:7` (`p-1`). `client/src/components/UI/NotificationBell.jsx:79` (`p-1.5`). Solo 8 ocurrencias de breakpoints `sm:`/`md:` en todo `client/src/` → diseño desktop-first sin escalado de target en mobile | **MEDIO** | Bajo — subir `IconButton` a `p-1.5` mínimo; añadir gap entre targets en clusters |
| **A-25** | UX | **Mobile responsiveness mínima.** Solo 8 ocurrencias totales de breakpoints Tailwind (`sm:`, `md:`, `lg:`) en todo `client/src/` (excluye `sm:max-w-`). App diseñada desktop-first. No hay viewport gate (mensaje "abre en desktop") ni breakpoint específico mobile. Probable que `<768px` degrade silenciosamente (sidebar comprimida, cards rotas). | `grep -rE "sm:\|md:\|lg:" client/src/ \| wc -l` → 8. `client/index.html:5` tiene `viewport` correcto pero ningún componente lo usa para alternar layout | **ALTO** | Alto — auditoría responsive por página + viewport gate explícito si se decide desktop-only |

---

## Parte 3 — Tabla completa Fase A (16 originales + 8 addendum + 3 ajustes severidad)

> **Reclasificaciones aplicadas:**
> - **A-11** → severidad **INFO / N/A** (no era hallazgo de performance real).
> - **A-08** confirmada **MEDIO** (WCAG AAA, no AA).
> - **A-01, A-02, A-03, A-04, A-05** confirmadas **CRÍTICO** (WCAG Level A bloqueante).

| ID | Dim | Hallazgo (1 línea) | Evidencia | Severidad | Esfuerzo |
|---|---|---|---|---|---|
| **A-01** | A11y | Labels sin asociación programática a inputs (`htmlFor`/`id`/`aria-label` ausentes en ~50/52 inputs) | 0 `htmlFor`, 0 `aria-label` en inputs, labels son hermanos visuales | **CRÍTICO** | Medio |
| **A-02** | A11y | Drag-and-drop sin `KeyboardSensor` de @dnd-kit — keyboard users no pueden mover cards/columns | 0 imports de `KeyboardSensor` | **CRÍTICO** | Bajo–Medio |
| **A-03** | A11y | Modales sin `role="dialog"` ni `aria-modal` | 0 ocurrencias en 6+ modales | **CRÍTICO** | Bajo |
| **A-04** | A11y | Iconos-botón sin `aria-label` (~7 instancias) | `grep -B1 '<X\|<Trash2\|<Pencil'` → 7 sin label | **CRÍTICO** | Bajo |
| **A-05** | A11y | Spinner sin `role="status"` ni `aria-label` | `Spinner.jsx` 8 LOC sin atributos a11y | **CRÍTICO** | Trivial |
| **A-06** | A11y | Total `aria-*` en client = 1 (síntoma agregado de cero a11y awareness) | `grep aria- client/src/` → 1 match | **ALTO** | Alto |
| **A-07** | Perf | Bundle 721.56 kB / 205.44 kB gzip / 1815 módulos / 1 chunk (sin code-splitting) | `vite build` output | **ALTO** | Medio |
| **A-08** | A11y | `prefers-reduced-motion` no respetado — WCAG 2.3.3 Level AAA | 0 `motion-reduce:` ni media query | **MEDIO** | Trivial |
| **A-09** | A11y | Modales se cierran con click en backdrop pero cierre por teclado depende de `useEscapeKey` (no auditado por modal) | 2 backdrops onClick, hook existe pero uso individual no verificado | **ALTO** | Bajo |
| **A-10** | UX | CardModal.jsx = 937 LOC — densidad cognitiva alta para usuarios + carga visual | `wc -l CardModal.jsx` → 937 | **ALTO** | Alto |
| **A-11** | Info | lucide-react 29 MB en node_modules — tree-shake OK por named imports, no es problema actual | `du -sh node_modules/lucide-react` → 29M | **INFO / N/A** | n/a |
| **A-12** | SEO | `index.html` sin meta description, OG, Twitter, canonical, theme-color | `client/index.html` 13 LOC | **MEDIO** | Trivial |
| **A-13** | SEO | `robots.txt` en prod solo boilerplate Cloudflare, sin reglas explícitas | `curl /robots.txt` | **BAJO** | Trivial |
| **A-14** | SEO | SPA auth-walled sin SSR — body vacío para crawlers (N/A práctico, sin landing pública) | `curl /` → body vacío | **N/A** | n/a |
| **A-15** | UX | Contraste bajo en texto secundario `#555b70`/`#8b92a5` sobre `#0f1117` (~3.08:1 vs AA 4.5:1) | Cálculo manual luminance, `[NO VERIFICABLE rigurosamente sin axe]` | **ALTO** | Bajo–Medio |
| **A-16** | UX | `Spinner` `w-${size}` interpolado — Tailwind JIT puede no detectar clases | `Spinner.jsx:4` | **MEDIO** | Trivial |
| **A-17** | A11y | Focus trap ausente en modales — usuario teclado escapa al DOM background | 0 librería + 0 manual implementation | **CRÍTICO** | Medio |
| **A-18** | A11y | Focus NO retorna al elemento que abrió el modal al cerrarlo | 0 `returnFocus` patterns | **ALTO** | Bajo |
| **A-19** | A11y | Skip-to-content link ausente | 0 ocurrencias | **CRÍTICO** | Trivial |
| **A-20** | A11y | Múltiples `<h1>` por DOM + LoginPage sin heading | 4 H1 en archivos distintos, LoginPage 0 H1 | **ALTO** | Bajo |
| **A-21** | A11y | NotificationBell + toasts sin `aria-live`/`role="status"` | 0 ocurrencias | **ALTO** | Bajo |
| **A-22** | A11y | Form validation sin `aria-invalid`, `aria-describedby`, `aria-required` (vs 35 setError) | 0 cada uno | **CRÍTICO** | Medio |
| **A-23** | UX | Empty states parciales — faltan en búsqueda, board vacío, columna vacía, notificaciones, checklist | 4 empty states existentes, faltantes en 5+ ubicaciones | **MEDIO** | Bajo–Medio |
| **A-24** | A11y | Touch targets borderline 24×24 px en `IconButton` (AA al límite, falla AAA 44×44) | `p-1` sobre íconos 16 px Lucide | **MEDIO** | Bajo |
| **A-25** | UX | Mobile responsiveness mínima — solo 8 breakpoints en todo client/src/ | `grep sm:/md:/lg:` → 8 hits | **ALTO** | Alto |

---

## Recuento final Fase A actualizado

| Severidad | Originales | Addendum | Total |
|---|---|---|---|
| CRÍTICO | 5 | 3 (A-17, A-19, A-22) | **8** |
| ALTO | 4 | 4 (A-18, A-20, A-21, A-25) | **8** |
| MEDIO | 4 | 2 (A-23, A-24) | **6** |
| BAJO | 3 (con A-13 confirmado) | 0 | **2** (A-13, A-16↓ — A-16 ya era MEDIO; ajusto recuento) |
| INFO / N/A | 0 | A-11, A-14 | **2** |
| **Total formal** | **16** | **8** | **24** (+ 2 INFO/N/A no priorizables) |

> Recuento corregido: 8 CRÍTICO + 8 ALTO + 6 MEDIO + 2 BAJO + 2 INFO/N/A = 26 entries totales, 24 con severidad priorizable.

---

## Tabla de severidad por dimensión

| Dimensión | CRÍTICO | ALTO | MEDIO | BAJO | INFO/N/A |
|---|---|---|---|---|---|
| A11y | 7 (A-01, A-02, A-03, A-04, A-05, A-17, A-19, A-22) → 8 | 5 (A-06, A-09, A-18, A-20, A-21) | 3 (A-08, A-24) | 0 | 0 |
| Perf | 0 | 1 (A-07) | 0 | 0 | 1 (A-11) |
| SEO | 0 | 0 | 1 (A-12) | 1 (A-13) | 1 (A-14) |
| UX | 0 | 3 (A-10, A-15, A-25) | 2 (A-16, A-23) | 0 | 0 |

> A11y count: 8 CRÍTICO + 5 ALTO + 3 MEDIO = **16 hallazgos a11y de 24 totales (67%)**. Confirma estado **ROJO** de la dimensión a11y.

---

**Awaiting `OK Fase A` definitivo para arrancar Fase B (Seguridad + DB + Arquitectura + deuda).**
