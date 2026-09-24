# Fase A — Superficie de producto · Auditoría Mariana 2026-09-24

**Alcance:** accesibilidad (WCAG 2.1 AA), usabilidad, rendimiento y SEO del cliente React.
**Commit:** `a630a84`. **Leído:** `client/src` entero (41 ficheros, 6.870 LOC), `client/index.html`, `client/vite.config.js`, `client/tailwind.config.js`. **Producción:** el bundle servido (`index-DsBmdg9A.js`) tiene el mismo hash que el build local de `a630a84`, así que lo leído es lo que corre.

## Panel de evidencia — Fase A

| Confianza | Nº | % de la fase |
|---|---|---|
| PROVEN | 23 | 95,8 % |
| UNVERIFIABLE | 1 | 4,2 % |
| **Total** | **24** | 100 % |

Fuente: code-read 21 · tool-external 1 (`vite build`) · manual-verification 1 (`curl` a producción).

Salud: PROVEN ≥ 60 % → sana.

## Convenciones de esta fase

- **Accesibilidad:** rúbrica WCAG. Nivel A = CRITICAL, AA = HIGH, AAA = MEDIUM. El listón declarado es **WCAG 2.1**: 2.5.8 (tamaño de objetivo, AA) solo existe en 2.2, así que ese hallazgo se gradúa por 2.5.5 (AAA) y se cita 2.2 en nota.
- **Usabilidad, rendimiento y SEO no tienen criterio WCAG en la rúbrica.** Un hallazgo heredado conserva la severidad de mayo salvo que haya evidencia nueva. Uno nuevo se gradúa por impacto, con la razón escrita: MEDIUM = la pantalla engaña o falla sin avisar, sin pérdida de datos; LOW = fricción.
- **Numeración:** los hallazgos heredados **conservan su ID de mayo**, y los nuevos siguen la serie a partir de A-26. Así el mismo ID designa el mismo defecto en las dos auditorías.
- **`REGRESSED`** se aplica por definición del protocolo: estaba `MITIGATED` y sigue abierto. En los cuatro casos de esta fase **no se rompió código**. Los restos datan de marzo (`git blame`: `b40944b`, `68bf2ebe`, `6db825d6`). Lo que falló fue el cierre: se declaró completo un arreglo parcial, y el commit `a9437ec` dice «cierra A-01 + A-22 100%».

## Recuento por severidad

| CRITICAL | HIGH | MEDIUM | LOW | UNVERIFIABLE |
|---|---|---|---|---|
| 6 | 6 | 6 | 5 | 1 |

## Hallazgos

| ID | Confianza | Dim | Hallazgo | Evidencia | Severidad | Esfuerzo |
|---|---|---|---|---|---|---|
| A-26 | PROVEN | a11y | Sin ratón no se puede abrir una tarjeta ni editar partes de ella | `Card.jsx:37-50`; dnd-kit `core.esm.js:1098-1101,1357-1367`; `CardModal.jsx:311-313,316,577-608,829-837`; `ContextMenu.jsx:58-67` | CRITICAL | 8 h |
| A-27 | PROVEN | a11y | Barra lateral: tablero no seleccionable y acciones inalcanzables sin ratón | `Sidebar.jsx:35-38,97-118`; `App.jsx:201-216` | CRITICAL | 4 h |
| A-01 | PROVEN | a11y | 29 controles de formulario visibles sin etiqueta programática (13 sin nombre alguno) | inventario abajo | CRITICAL | 3 h |
| A-03 | PROVEN | a11y | 6 superposiciones modales sin semántica de diálogo ni trampa de foco (incluye A-17) | `Board.jsx:349-385`; `Sidebar.jsx:318-347`; `AvatarCropModal.jsx:52-53`; `WorkspaceDashboard.jsx:326-327,467-468`; `CardModal.jsx:935-954` | CRITICAL | 3 h |
| A-04 | PROVEN | a11y | 2 botones de solo icono sin nombre accesible | `CardModal.jsx:121-128`, `:915-917` | CRITICAL | 0,5 h |
| A-28 | PROVEN | a11y | Estado de alternancias y desplegables no expuesto (`aria-pressed`/`aria-expanded`) | `LoginPage.jsx:94` (único); ver detalle | CRITICAL | 3 h |
| A-15 | PROVEN | a11y | Contraste de texto 1,61–2,80:1 (mínimo 4,5:1) en 155 usos | `tailwind.config.js:21-22`; cálculo abajo | HIGH | 3 h |
| A-29 | PROVEN | a11y | 10 controles enfocables invisibles al recibir foco | `CardModal.jsx:166-170,262,271,856,877,882`; `CategorySettings.jsx:84`; `WorkspaceDashboard.jsx:248` | HIGH | 1,5 h |
| A-21 | PROVEN | a11y | Avisos y contador de campana no anunciados a lector de pantalla | `Board.jsx:388-395`; `WorkspaceMembers.jsx:413-417`; `AdminPage.jsx:328-335`; `Sidebar.jsx:294-300`; `NotificationBell.jsx:86-90` | HIGH | 2 h |
| A-22 | PROVEN | a11y | Errores de 4 formularios sin anunciar ni asociar al campo | `WorkspaceDashboard.jsx:432,473`; `WorkspaceMembers.jsx:221`; `ResetPasswordPage.jsx:111-115` | HIGH | 1,5 h |
| A-25 | PROVEN | a11y | Diseño fijo: a 320 px quedan 80 px de contenido y la cabecera se recorta | `Sidebar.jsx:220`; `Toolbar.jsx:93,127`; `App.jsx:335` | HIGH | 8 h (o 0,5 h si se declara «solo escritorio») |
| A-07 | PROVEN | perf | Bundle único de 724,66 kB (206,73 kB gzip), sin división de código | `vite build` (salida abajo) | HIGH (heredada) | 3 h |
| A-24 | PROVEN | a11y | Objetivos de pulsación de 10–21 px | `CardModal.jsx:259-275,901-903`; `IconButton.jsx:7`; `Sidebar.jsx:97-117`; `Column.jsx:101-108` | MEDIUM | 2 h |
| A-08 | PROVEN | a11y | `prefers-reduced-motion` ignorado en la app | 0 coincidencias en `client/src`; `index.css:36-44` | MEDIUM | 0,5 h |
| A-30 | PROVEN | ux | Fallos de carga y de guardado sin aviso; la vista cae a un estado vacío que miente | ver detalle | MEDIUM | 4 h |
| A-31 | PROVEN | ux | Subidas e invitación no renuevan la sesión: fallan a los 15 min, y en tarjetas sin avisar | `client/src/api/client.js:52-72,135-144,167-211`; `server/routes/auth.js:17`; `server/middleware/auth.js:73-77`; `CardModal.jsx:429-431` | MEDIUM | 1 h |
| A-10 | PROVEN | ux | Densidad: `CardModal.jsx` 957 LOC, `WorkspaceDashboard.jsx` 802 LOC | `wc -l` | MEDIUM | 8 h |
| A-12 | PROVEN | seo | `index.html` sin description, OG, theme-color ni canonical | `client/index.html:1-13` | MEDIUM (heredada) | 0,5 h |
| A-13 | PROVEN | seo | No hay `robots.txt`: `/robots.txt` y `/sitemap.xml` devuelven la SPA con 200 | `curl` a producción, 24-sep-2026 | LOW | 0,25 h |
| A-32 | PROVEN | ux | `confirm()` nativo en 2 borrados, contra ADR-018 | `WorkspaceMembers.jsx:285`; `AdminPage.jsx:177` | LOW | 1 h |
| A-33 | PROVEN | a11y | Salto de h1 a h3 en la vista de tablero | `Toolbar.jsx:112`; `Column.jsx:77` | LOW | 0,25 h |
| A-34 | PROVEN | a11y | El título del documento no cambia entre vistas | `client/index.html:7`; 0 usos de `document.title` | LOW | 0,5 h |
| A-35 | PROVEN | ux | El pie de la barra lateral dice «AGLAYA v1.2 · Phase 1»; la versión es 1.4.0 | `Sidebar.jsx:305`; `package.json` | LOW | 0,25 h |
| A-NV-01 | UNVERIFIABLE (`NV_RUNTIME`) | perf | Core Web Vitals (LCP, INP, CLS) | — | — | — |

## Detalle

### A-26 · CRITICAL · WCAG 2.1.1 Teclado (A) · NEW

**Afecta a:** usuarios de solo teclado sin lector de pantalla. Un lector en modo exploración simula clic y sí abre.

- **Abrir tarjeta.** La tarjeta es un `div` con `onClick` y los atributos de arrastre de dnd-kit (`Card.jsx:37-50`, pasados en `SortableCard.jsx:26`), que le dan `role="button"` y `tabIndex=0` (`core.esm.js:3405-3408`). El sensor de teclado arranca con **Espacio o Enter** y hace `preventDefault` (`core.esm.js:1098-1101`, `:1357-1367`). Resultado: la tarjeta recibe foco, pero Enter la **arrastra** en vez de abrirla. La única vía es el menú contextual (Shift+F10 en Windows; en macOS sin lector no hay tecla equivalente). Dentro de ese menú, «Mover a columna» y «Mover a tablero» solo se abren con `onMouseEnter` (`ContextMenu.jsx:58-67`).
- **Editar la descripción de una tarjeta existente.** Al editar se muestra la vista previa por defecto (`CardModal.jsx:316`), que es un `div` con `onClick` sin `tabIndex` (`:577-608`). El `textarea` solo aparece tras ese clic.
- **Adjuntar archivo.** `input type="file" className="hidden"` (`display:none`) dentro de un `label` (`CardModal.jsx:829-837`). Ni el input ni la etiqueta entran en el orden de tabulación.
- **Reordenar la lista de comprobación.** Solo `PointerSensor` (`CardModal.jsx:311-313`).

**Nota:** el arreglo de A-02 (`KeyboardSensor` en el tablero) es correcto y se mantiene, pero es lo que hoy captura Enter. Separar el asa de arrastre de la acción de abrir resuelve las dos cosas.

### A-27 · CRITICAL · WCAG 2.1.1 (A) · NEW

La fila de cada tablero es un `div` con `onClick` sin `tabIndex` (`Sidebar.jsx:35-38`). Mover, renombrar y eliminar viven en `hidden group-hover:flex` (`:97-118`): con `display:none` no existen para el teclado. Sin ratón solo queda el atajo ⌘1–9 (`App.jsx:201-216`), que llega a los nueve primeros tableros. El asa de arrastre sí es enfocable, pero Enter la arrastra.

### A-01 · CRITICAL · WCAG 1.3.1, 3.3.2, 4.1.2 (A) · REGRESSED (cierre parcial)

Hay 51 controles, 5 de ellos `input type=file` ocultos que se disparan desde otro elemento; quedan 46 visibles. **17** tienen nombre programático. De los otros 29:

- **Sin nombre alguno (13):** `CardModal.jsx:131` (casilla del ítem), `:139`; `Column.jsx:49`; `Sidebar.jsx:56`; `CategorySettings.jsx:64`; `Toolbar.jsx:194,206,219,233` (los cuatro filtros); `AvatarCropModal.jsx:76` (zoom); `WorkspaceMembers.jsx:208,363` (rol); `AdminPage.jsx:279` (rol).
- **Solo `placeholder` (15):** `Board.jsx:283`; `CardModal.jsx:192,631,692,908`; `Column.jsx:133`; `Sidebar.jsx:261`; `CategorySettings.jsx:167`; `Toolbar.jsx:118,174`; `WorkspaceMembers.jsx:89`; `ResetPasswordPage.jsx:66,92`; `WorkspaceDashboard.jsx:354,367`.
- **Solo `title` (1):** `Column.jsx:87`.
- **Etiquetas visibles sin `htmlFor`:** `WorkspaceDashboard.jsx:335,353,366,379,403`; `ResetPasswordPage.jsx:62,88`; `WorkspaceMembers.jsx:197,206`; `CardModal.jsx:826,896`.

El arreglo de mayo (`a9437ec`) cubrió los «inputs críticos» (login, recuperación, ajustes de espacio, invitación y los campos principales de la tarjeta), y todos siguen bien. El resto no se tocó, pero el hallazgo se cerró entero.

### A-03 · CRITICAL · WCAG 4.1.2 y 2.4.3 (A) · REGRESSED (cierre parcial; absorbe A-17)

Hay 14 `fixed inset-0` en el cliente y 8 `role="dialog"`. Seis superposiciones modales no tienen `role="dialog"`, `aria-modal` ni `useFocusTrap`:

- confirmación de borrar tarjeta o columna (`Board.jsx:349-385`);
- confirmación de borrar tablero (`Sidebar.jsx:318-347`);
- recorte de avatar (`AvatarCropModal.jsx:52-53`), que además **no cierra con Escape**: `UserMenu.jsx:20-23` ignora Escape mientras hay recorte, y la barra superior no lo gestiona;
- formulario de nuevo espacio y de edición de espacio (`WorkspaceDashboard.jsx:326-327`);
- confirmación de borrar espacio (`WorkspaceDashboard.jsx:467-468`);
- visor de imagen (`CardModal.jsx:935-954`).

`AvatarCropModal` figuraba en la lista de A-03 y A-17, y `76dac8d` no lo tocó (`git show --stat 76dac8d`). Los otros cinco no estaban inventariados en mayo.

### A-04 · CRITICAL · WCAG 4.1.2 (A) · REGRESSED (cierre parcial)

El asa de arrastre de cada ítem de la lista de comprobación (`CardModal.jsx:121-128`) y el botón «añadir etiqueta» (`:915-917`) contienen solo un icono, sin `aria-label` ni `title`. Ambos son de marzo.

### A-28 · CRITICAL · WCAG 4.1.2 (A) · NEW (A-06 pasa a FIXED)

En todo el cliente hay 68 atributos `aria-*`, pero **un solo `aria-pressed`** (`LoginPage.jsx:94`) y **ningún `aria-expanded`**. El estado solo se ve por color en:

- el filtro «Vencidas» (`Toolbar.jsx:246-256`);
- los botones de tipo de espacio (`WorkspaceDashboard.jsx:404-419`, `WorkspaceSettings.jsx:188-203`);
- los emojis (`WorkspaceDashboard.jsx:337-347`, `WorkspaceSettings.jsx:101-116`);
- el selector de color (`CategorySettings.jsx:9-27`).

La campana (`NotificationBell.jsx:76-91`), el menú de perfil (`UserMenu.jsx:134-149`) y el desplegable de asignados (`CardModal.jsx:163-185`) no dicen si están abiertos.

### A-15 · HIGH · WCAG 1.4.3 (AA) · UNCHANGED

Contraste calculado con la fórmula WCAG de luminancia relativa:

| Color de texto | Usos | Sobre `#0f1117` | `#16181f` | `#1e2028` | `#252830` |
|---|---|---|---|---|---|
| `#555b70` (`text.muted`) | 134 en 22 ficheros | 2,80 | 2,63 | 2,41 | **2,19** |
| `#3a3f50` | 11 | 1,80 | — | — | — |
| `#3d4155` | 10 (+ 14 como placeholder) | 1,87 | 1,76 | 1,61 | — |

Ejemplos: la vista previa de la descripción en la tarjeta (`Card.jsx:73`, 2,19:1) y el pie del login (`LoginPage.jsx:146`, 1,80:1). El «~3,08:1» de mayo estaba mal calculado; la cifra real es peor.

### A-29 · HIGH · WCAG 2.4.7 Foco visible (AA) · NEW

Diez controles enfocables usan `opacity-0 group-hover:opacity-100` sin revelarse al recibir foco. El foco de teclado cae en un botón invisible:

- `CardModal.jsx:166-170` (asignados), `:262` (editar ítem), `:271` (quitar ítem), `:856` (ampliar y quitar imagen), `:877` (descargar), `:882` (quitar adjunto);
- `CategorySettings.jsx:84` (borrar categoría);
- `WorkspaceDashboard.jsx:248` (editar, portada y borrar espacio).

El patrón correcto ya está en el repo (`WorkspaceDashboard.jsx:517`, `focus:opacity-100`).

### A-21 · HIGH · WCAG 4.1.3 (AA) · UNCHANGED

Ninguno de estos avisos tiene `role="status"` ni `aria-live`: tarjeta movida (`Board.jsx:388-395`), rol actualizado o miembro eliminado (`WorkspaceMembers.jsx:413-417`), aviso de administración (`AdminPage.jsx:328-335`), error de la barra lateral (`Sidebar.jsx:294-300`) y contador de la campana (`NotificationBell.jsx:86-90`).

### A-22 · HIGH · WCAG 4.1.3 (AA) · REGRESSED (cierre parcial; baja de CRITICO)

Cuatro formularios muestran el error en texto, así que 3.3.1 se cumple visualmente, pero no lo anuncian ni lo asocian al campo (`role="alert"`, `aria-invalid`, `aria-describedby`): nuevo o editar espacio (`WorkspaceDashboard.jsx:432`), borrar espacio (`:473`), añadir miembro (`WorkspaceMembers.jsx:221`) y nueva contraseña (`ResetPasswordPage.jsx:111-115`). `a9437ec` arregló cuatro formularios y el commit dice «A-22 100%».

### A-25 · HIGH · WCAG 1.4.10 Reflow (AA) · UNCHANGED

- La barra lateral mide 240 px fijos (`w-60`, `Sidebar.jsx:220`) y ningún punto de ruptura la pliega.
- La cabecera no envuelve (`Toolbar.jsx:93`, sin `flex-wrap`) y solo el buscador ya pide 176 px (`w-44`, `:127`).
- El contenedor recorta (`overflow-hidden`, `App.jsx:335`).

A 320 px quedan 80 px para el contenido, y los controles de la cabecera quedan fuera del alcance del puntero. Hay 11 prefijos responsive en todo el cliente, y ningún documento (`PRD.md`, `README.md`, `ARCHITECTURE.md`) declara que la herramienta sea solo de escritorio. Declararlo es la salida barata. Con eso, esto baja a decisión documentada.

### A-07 · HIGH (heredada) · rendimiento · UNCHANGED

Salida de `npx vite build` (vite 5.4.21), compilado al directorio temporal de la sesión, sin tocar el repo:

```
index-DsBmdg9A.js   724.66 kB │ gzip: 206.73 kB
index-ccf6Vy8B.css   42.87 kB │ gzip:   8.22 kB
✓ 1815 modules transformed.
(!) Some chunks are larger than 500 kB after minification.
```

No hay ningún `lazy(` ni `import(` en `client/src`, y `vite.config.js` no define `manualChunks`. El login descarga la aplicación entera. En mayo: 721,56 / 205,44 kB.

### A-24 · MEDIUM · WCAG 2.5.5 (AAA) (en 2.2: 2.5.8 AA) · UNCHANGED, ahora medido

- quitar etiqueta: icono de 10 px sin relleno (`CardModal.jsx:901-903`);
- editar o quitar ítem de la lista: `p-0.5` + icono de 11–12 px = 15–16 px (`:259-275`);
- `IconButton`: `p-1` + icono de 12–13 px = 20–21 px (`IconButton.jsx:7`), con 2 px de separación en la barra lateral (`Sidebar.jsx:97-117`) y en columnas (`Column.jsx:101-108`).

Con esa separación, la excepción de espaciado de 2.5.8 tampoco se cumple.

### A-08 · MEDIUM · WCAG 2.3.3 (AAA) · UNCHANGED

Hay 0 `prefers-reduced-motion` o `motion-reduce` en `client/src`; solo existe en la página legal (`client/public/privacidad.html:103`). Hay 158 clases `animate-` o `transition-`, entre ellas la animación de aviso (`index.css:36-44`).

### A-30 · MEDIUM · usabilidad · NEW

- **La carga falla y la vista dice que no hay nada.** Los tres hooks de datos guardan el error (`useWorkspaces.js:14`, `useBoards.js:15`, `useBoardData.js:21`), pero ninguna vista lo lee (`WorkspaceDashboard.jsx:566`, `App.jsx:72`, `App.jsx:141-145`). Si falla la carga de espacios, la pantalla dice «No tienes espacios de trabajo todavía.» (`WorkspaceDashboard.jsx:700-703`). Lo mismo con los miembros (`WorkspaceMembers.jsx:259-264` y `:339`). Quien lo crea puede ponerse a recrear lo que ya existe.
- **Guardar falla sin decir nada.** Guardar una tarjeta hace `await` sin `try` (`Board.jsx:99-122`): si falla, el modal no se cierra y no dice por qué. Confirmar un borrado no captura el rechazo (`Board.jsx:373-377`). Una subida fallida solo llega a `console.error` (`CardModal.jsx:429-431`), igual que el avatar desde la barra (`Toolbar.jsx:73-75`) y la portada (`WorkspaceDashboard.jsx:180-181`). Quitar un adjunto traga el error (`CardModal.jsx:439`).
- **El diálogo promete lo que el servidor rechaza** (visto en Fase B). Al borrar una columna, la confirmación dice «y todas sus tarjetas» (`Board.jsx:363`). El servidor se niega con `409` si la columna tiene tarjetas (`server/routes/columns.js:202-209`), y ese rechazo cae en el borrado sin `catch` de arriba: el diálogo se cierra y la columna sigue ahí, sin explicación.

### A-31 · MEDIUM · usabilidad · NEW

El resto de la API reintenta tras un 401 renovando el token (`client/src/api/client.js:52-72`). `uploadFile`, `uploadAvatar`, `uploadWorkspaceCover` e `inviteUser` llaman a `fetch` directamente (`:135-144`, `:167-195`, `:201-211`), sin ese reintento. El token de acceso dura 15 min (`server/routes/auth.js:17`), y uno caducado recibe 401 (`server/middleware/auth.js:73-77`). Tras 15 min sin actividad, **la primera subida falla**, y en la tarjeta ese fallo no se muestra (A-30).

### A-10 · MEDIUM · densidad cognitiva · DEESCALATED (ALTO → MEDIUM)

`CardModal.jsx` tiene 957 LOC (937 en mayo) y `WorkspaceDashboard.jsx` 802 LOC, ahora por encima de 700. La rúbrica de arquitectura fija los componentes de más de 700 LOC en MEDIUM.

### A-12 · MEDIUM (heredada) · SEO · UNCHANGED

`client/index.html` tiene 13 líneas: `title`, `viewport` y favicon, sin `description`, `og:*`, `theme-color` ni `canonical`. Producción sirve lo mismo.

### A-13 · LOW · SEO · UNCHANGED

`curl` del 24-sep-2026: `/robots.txt` y `/sitemap.xml` responden `200 text/html` con el `index.html` de la SPA. La regla comodín de `netlify.toml` devuelve 200 para cualquier ruta, así que las rutas inexistentes no dan 404. El bloque de Cloudflare que vio mayo ya no está. Para una herramienta tras login lo coherente es un `robots.txt` explícito.

### A-32 · LOW · usabilidad · NEW

`confirm()` nativo al quitar un miembro (`WorkspaceMembers.jsx:285`) y al borrar un usuario (`AdminPage.jsx:177`). El resto de borrados usa confirmación propia (ADR-018).

### A-33 · LOW · WCAG 1.3.1 (buena práctica) · NEW

La vista de tablero pasa del `h1` del título (`Toolbar.jsx:112`) al `h3` de cada columna (`Column.jsx:77`) sin `h2`. A-20 queda cerrado: cada vista tiene un solo `h1`.

### A-34 · LOW · WCAG 2.4.2 (buena práctica en SPA) · NEW

`document.title` no se usa en ningún sitio. Espacios, tablero y administración comparten el título «AGLAYA Kanban Desk» (`client/index.html:7`).

### A-35 · LOW · usabilidad · NEW

El pie de la barra lateral dice «AGLAYA v1.2 · Phase 1» (`Sidebar.jsx:305`), y `package.json` está en `1.4.0`.

### A-NV-01 · UNVERIFIABLE · `NV_RUNTIME`

LCP, INP y CLS necesitan medirse en un navegador contra el despliegue con sesión iniciada. El login es la única vista pública. **Acción:** PageSpeed Insights o Lighthouse sobre `/` sin sesión, y DevTools → Performance con sesión.

## Delta contra mayo (hallazgos A)

| ID mayo | Estado mayo | Hoy | Nota |
|---|---|---|---|
| A-01 | MITIGATED | **REGRESSED** | 29 controles sin etiqueta; `a9437ec` cubrió parte y se cerró entero |
| A-02 | MITIGATED | FIXED | `KeyboardSensor` en `App.jsx:136-139` y `WorkspaceDashboard.jsx:594-599` |
| A-03 | MITIGATED | **REGRESSED** | 6 superposiciones sin diálogo; `AvatarCropModal` estaba listado |
| A-04 | MITIGATED | **REGRESSED** | 2 botones de icono sin nombre, ambos de marzo |
| A-05 | MITIGATED | FIXED | `Spinner.jsx:27-34` |
| A-06 | open | FIXED | 68 `aria-*` (antes 1); el hueco concreto que queda es A-28 |
| A-07 | open | UNCHANGED | 724,66 kB |
| A-08 | open | UNCHANGED | — |
| A-09 | open | FIXED | Escape verificado modal por modal; la excepción (`AvatarCropModal`) va en A-03 |
| A-10 | open (ALTO) | DEESCALATED | MEDIUM por rúbrica; ahora con dos ficheros |
| A-11 | informativo | — | — |
| A-12 | open | UNCHANGED | — |
| A-13 | open | UNCHANGED | sigue sin reglas; el bloque de Cloudflare desapareció |
| A-14 | informativo | — | — |
| A-15 | open | UNCHANGED | cifras corregidas a la baja |
| A-16 | MITIGATED | FIXED | `Spinner.jsx:3-11` |
| A-17 | MITIGATED | **REGRESSED** → fundido en A-03 | mismos elementos |
| A-18 | MITIGATED | FIXED | `useFocusTrap.js:82-90` |
| A-19 | MITIGATED | FIXED | `App.jsx:339-344` |
| A-20 | PARTIAL | FIXED | un `h1` por vista |
| A-21 | open | UNCHANGED | — |
| A-22 | MITIGATED | **REGRESSED** | 4 formularios; severidad HIGH (4.1.3), no CRITICO |
| A-23 | open | FIXED | vacíos en búsqueda, notificaciones, tablero, categorías |
| A-24 | open | UNCHANGED | ahora medido |
| A-25 | open | UNCHANGED | ahora citado como 1.4.10 |

## Lagunas de herramienta

No hay `axe-core` ni `lighthouse` instalados. Esta fase se hizo leyendo el código, sin barrido automático: un escaneo con axe sobre la app en marcha puede encontrar defectos de ARIA en tiempo de ejecución que la lectura no ve. Que no aparezcan aquí no significa que no existan.
