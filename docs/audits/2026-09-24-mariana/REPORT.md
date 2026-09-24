# Auditoría Mariana Trench — informe consolidado

**Repo:** `aglaya-kanban-desk` (público) · **Fecha:** 2026-09-24 · **Commit auditado:** `a630a84`, el mismo que corre en producción (servidor desplegado por Railway el 19-sep; bundle del cliente idéntico al build local).
**Modo:** `report` (no se arregló nada) · **Auditoría previa:** `docs/audits/2026-05-27-mariana/` (80 entradas).

## 0. Resumen ejecutivo

- **Estado global: ROJO.** Hay dos CRITICAL operativos en producción. Una ruta pública deja darse de alta con el rol que elija quien llama (B-20, CVSS 9.8). Y los adjuntos viven en disco efímero sin copia, así que es probable que se pierdan en cada despliegue (B-34). Sin esos dos, el estado sería ámbar: de los 80 hallazgos de mayo, **43 están cerrados de verdad**.
- **Exposición legal: MEDIA-ALTA.** Claude (Anthropic) trata datos del Kanban a través del riel sin estar declarado (C-19: RGPD 13, 28, 30 y cap. V). La política pública promete botones de exportar y borrar cuenta que no existen (C-20). La supresión y la exportación están incompletas (C-21, C-22). La DPIA sigue siendo una plantilla (C-09). Atenuante: hoy hay tres cuentas y ningún cliente externo.
- **Las tres acciones de más rendimiento.** (1) Retirar `POST /api/auth/register`, borrar las dos políticas RLS permisivas y exigir CI en verde antes de desplegar: unas 2 h en total, cierra B-20, B-21 y D-19. (2) Mover los adjuntos a Supabase Storage privado: 4 h, cierra B-34, B-25 y B-26. (3) Declarar a Anthropic y ajustar la política a lo que existe: unas 4 h, cierra C-19, C-20, C-23, C-25 y C-26.
- **Si en tres meses no se hace nada:** la puerta de alta sigue abierta en producción. Los adjuntos probablemente se siguen perdiendo en cada despliegue. El plazo de GRANT explícitos de Supabase (30-oct) llega con el guardián ciego a `MAINTAIN` (B-41). Y quien use solo teclado sigue sin poder abrir una tarjeta (A-26).
- **Recursos externos:** revisión legal antes del primer cliente externo (C-19, C-09). Una prueba con `axe` y un lector de pantalla para A-26 a A-28. Para cerrar lo de aquí no hace falta pentest externo.

## 1. Recuento

| Fase | CRITICAL | HIGH | MEDIUM | LOW | INFO | No verificable | Total |
|---|---|---|---|---|---|---|---|
| A · producto | 6 | 6 | 6 | 5 | 0 | 1 | 24 |
| B · backend y datos | 2 | 3 | 8 | 10 | 1 | 3 | 27 |
| C · legal | 1 | 3 | 4 | 5 | 0 | 2 | 15 |
| D · operación | 0 | 1 | 10 | 4 | 0 | 1 | 16 |
| **Total** | **9** | **13** | **28** | **24** | **1** | **7** | **82** |

Confianza: **75 PROVEN (91,5 %)** · 7 UNVERIFIABLE · 0 descartados por falta de evidencia. Cada hallazgo probado cita `fichero:línea` o la salida exacta de una herramienta.

| Prioridad | Nº | Esfuerzo estimado |
|---|---|---|
| P0 | 11 | 32 h |
| P1 | 12 | 37,5 h |
| P2 | 28 | 70 h |
| P3 | 24 | 15,9 h |

## 2. Críticos abiertos

| ID | Hallazgo | Referencia | Esfuerzo |
|---|---|---|---|
| A-01 | 29 controles de formulario visibles sin etiqueta programática (13 sin nombre alguno) | WCAG 1.3.1 A | 3 h |
| A-03 | 6 superposiciones modales sin semántica de diálogo ni trampa de foco (absorbe A-17) | WCAG 4.1.2 A | 3 h |
| A-04 | 2 botones de solo icono sin nombre accesible | WCAG 4.1.2 A | 0,5 h |
| A-26 | Sin ratón no se puede abrir una tarjeta ni editar partes de ella | WCAG 2.1.1 A | 8 h |
| A-27 | Barra lateral: tablero no seleccionable y acciones inalcanzables sin ratón | WCAG 2.1.1 A | 4 h |
| A-28 | Estado de alternancias y desplegables no expuesto (aria-pressed / aria-expanded) | WCAG 4.1.2 A | 3 h |
| B-20 | Alta de cuentas pública: sin sesión, con el rol y la organización que manda el cliente, y correo dado por confirmado | CVSS 9,8 | 1 h |
| B-34 | Los adjuntos se guardan en disco efímero, sin volumen, y la copia diaria no los incluye | BD/Ops | 4 h |
| C-19 | Claude (Anthropic) trata contenido de tarjetas, nombres y correos a través del MCP del riel sin estar declarado como encargado | RGPD 13(1)(e), 28(1)-(3), 30(1)(d), cap. V | 3 h |

**Protocolo CRITICAL IMMEDIATE (modo `report`):** B-20 y B-34 cumplen el criterio (explotable en producción; pérdida de datos sin copia). No se mitigaron porque el modo no lo permite, y se avisó en el chat en cuanto aparecieron. Se recomienda cerrarlos ya, fuera de esta auditoría.

## 3. Delta de regresión contra 2026-05-27

| Estado de los 80 de mayo, hoy | Nº |
|---|---|
| FIXED | 43 |
| REGRESSED | 6 |
| UNCHANGED | 19 |
| DEESCALATED | 6 |
| INFORMATIVE | 4 |
| OBSOLETE | 1 |
| CROSS-REF | 1 |
| ESCALATED | 0 |

Hallazgos nuevos en esta auditoría: **52**. Los detalles por hallazgo están en la tabla «Delta» de cada `audit-X.md`.

**REGRESSED (P0 por protocolo):**

- **A-01, A-03 (con A-17), A-04 y A-22.** No se rompió código. Se cerraron como `MITIGATED` arreglos que cubrían una parte (`a9437ec`: «cierra A-01 + A-22 100%»). El proceso se trata en D-24.
- **D-17.** `INCIDENTS.md` no tiene entradas desde el 12-jul, y el código documenta tres incidentes posteriores.

**Lo que se sostuvo, y conviene decirlo:** el arreglo del XSS por subida (B-CRIT-01), la copia diaria a R2 (B-CRIT-02, 4 de 4 corridas en verde), los tokens cortos (B-02), la revalidación del rol (B-07), los límites de peticiones (B-06), el `KeyboardSensor` del tablero (A-02), la trampa de foco en los modales que se tocaron (A-17/A-18), y todo el andamiaje legal: política, registro de DPA, RAT, TOMs, base legal y procedimiento de brechas.

## 4. Matriz de prioridades

| ID | Sev | Esfuerzo (h) | Ámbito | Hallazgo | Prioridad | Sprint | Delta |
|---|---|---|---|---|---|---|---|
| A-01 | CRITICAL | 3 | accesibilidad | 29 controles de formulario visibles sin etiqueta programática (13 sin nombre alguno) | P0 | Sprint 1 | REGRESSED |
| A-03 | CRITICAL | 3 | accesibilidad | 6 superposiciones modales sin semántica de diálogo ni trampa de foco (absorbe A-17) | P0 | Sprint 1 | REGRESSED |
| A-04 | CRITICAL | 0,5 | accesibilidad | 2 botones de solo icono sin nombre accesible | P0 | Sprint 1 | REGRESSED |
| A-26 | CRITICAL | 8 | accesibilidad | Sin ratón no se puede abrir una tarjeta ni editar partes de ella | P0 | Sprint 1 | NEW |
| A-27 | CRITICAL | 4 | accesibilidad | Barra lateral: tablero no seleccionable y acciones inalcanzables sin ratón | P0 | Sprint 1 | NEW |
| A-28 | CRITICAL | 3 | accesibilidad | Estado de alternancias y desplegables no expuesto (aria-pressed / aria-expanded) | P0 | Sprint 1 | NEW |
| B-20 | CRITICAL | 1 | seguridad | Alta de cuentas pública: sin sesión, con el rol y la organización que manda el cliente, y correo dado por confirmado | P0 | Sprint 1 | NEW |
| B-34 | CRITICAL | 4 | datos | Los adjuntos se guardan en disco efímero, sin volumen, y la copia diaria no los incluye | P0 | Sprint 1 | NEW |
| C-19 | CRITICAL | 3 | legal | Claude (Anthropic) trata contenido de tarjetas, nombres y correos a través del MCP del riel sin estar declarado como encargado | P0 | Sprint 1 | NEW |
| A-22 | HIGH | 1,5 | accesibilidad | Errores de 4 formularios sin anunciar ni asociar al campo | P0 | Sprint 1 | REGRESSED |
| D-17 | LOW | 1 | documentación | INCIDENTS.md no recoge los incidentes de agosto y septiembre | P0 | Sprint 1 | REGRESSED |
| A-07 | HIGH | 3 | rendimiento | Bundle único de 724,66 kB (206,73 kB gzip), sin división de código | P1 | Sprint 2 | UNCHANGED |
| A-15 | HIGH | 3 | accesibilidad | Contraste de texto 1,61–2,80:1 (mínimo 4,5:1) en 155 usos | P1 | Sprint 2 | UNCHANGED |
| A-21 | HIGH | 2 | accesibilidad | Avisos y contador de campana no anunciados a lector de pantalla | P1 | Sprint 2 | UNCHANGED |
| A-25 | HIGH | 8 | accesibilidad | Diseño fijo: a 320 px quedan 80 px de contenido y la cabecera se recorta | P1 | Sprint 2 | UNCHANGED |
| A-29 | HIGH | 1,5 | accesibilidad | 10 controles enfocables invisibles al recibir foco | P1 | Sprint 2 | NEW |
| B-03 | HIGH | 2 | seguridad | La API sigue expuesta en el dominio por defecto de Railway; el dominio propio no existe | P1 | Sprint 2 | UNCHANGED |
| B-21 | HIGH | 0,5 | seguridad | Dos políticas RLS de INSERT con WITH CHECK (true) anulan las restrictivas en workspaces y workspace_members | P1 | Sprint 2 | NEW |
| B-27 | HIGH | 4 | seguridad | La sesión no se puede revocar: refresh de 30 días que se renueva solo; cerrar sesión solo borra la cookie | P1 | Sprint 2 | NEW |
| C-09 | HIGH | 6 | legal | La DPIA sigue siendo una plantilla sin rellenar | P1 | Sprint 2 | UNCHANGED |
| C-20 | HIGH | 3 | legal | La política promete botones de exportar y eliminar cuenta que la app no tiene | P1 | Sprint 2 | NEW |
| C-21 | HIGH | 4 | legal | Borrar la cuenta deja los espacios creados por la persona con su contenido y el avatar público; la respuesta dice lo contrario | P1 | Sprint 2 | NEW |
| D-19 | HIGH | 0,5 | despliegue | Producción no espera a CI: main exige PR pero no checks en verde, y Railway despliega sin mirarlos | P1 | Sprint 2 | NEW |
| A-08 | MEDIUM | 0,5 | accesibilidad | prefers-reduced-motion ignorado en la app | P2 | Sprint 3-4 | UNCHANGED |
| A-10 | MEDIUM | 8 | usabilidad | Densidad: CardModal.jsx 957 LOC, WorkspaceDashboard.jsx 802 LOC | P2 | Sprint 3-4 | DEESCALATED |
| A-12 | MEDIUM | 0,5 | SEO | index.html sin description, OG, theme-color ni canonical | P2 | Sprint 3-4 | UNCHANGED |
| A-24 | MEDIUM | 2 | accesibilidad | Objetivos de pulsación de 10–21 px | P2 | Sprint 3-4 | UNCHANGED |
| A-30 | MEDIUM | 4 | usabilidad | Fallos de carga y de guardado sin aviso; la vista cae a un estado vacío que miente | P2 | Sprint 3-4 | NEW |
| A-31 | MEDIUM | 1 | usabilidad | Subidas e invitación no renuevan la sesión: fallan a los 15 min, y en tarjetas sin avisar | P2 | Sprint 3-4 | NEW |
| B-08 | MEDIUM | 1 | seguridad | Dependencias del servidor con avisos HIGH (multer) y moderados, alcanzables solo con sesión | P2 | Sprint 3-4 | UNCHANGED |
| B-12 | MEDIUM | 6 | datos | RLS de tarjetas, columnas, categorías e historial filtra por organización, no por espacio | P2 | Sprint 3-4 | UNCHANGED |
| B-16 | MEDIUM | 16 | arquitectura | Rutas con lógica de negocio y acceso directo a la base, sin capa de servicio | P2 | Sprint 3-4 | UNCHANGED |
| B-23 | MEDIUM | 1 | seguridad | Categorías: la API solo exige sesión y organización, no pertenencia al espacio del tablero | P2 | Sprint 3-4 | NEW |
| B-24 | MEDIUM | 1 | seguridad | Las URL de adjuntos se guardan sin validar y el cliente las usa como enlace e imagen | P2 | Sprint 3-4 | NEW |
| B-25 | MEDIUM | 3 | seguridad | Subidas: extensión del nombre del cliente, tipos de texto sin control de contenido, servido en línea desde el origen de la app y sin sesión | P2 | Sprint 3-4 | NEW |
| B-26 | MEDIUM | 1 | seguridad | Borrar un adjunto solo exige sesión: no comprueba a quién pertenece | P2 | Sprint 3-4 | NEW |
| B-40 | MEDIUM | 1,5 | seguridad | Dos reglas de PERMISSIONS.md que el servidor no aplica (cambio de tipo por colaborador; lista de usuarios de la organización) | P2 | Sprint 3-4 | NEW |
| C-11 | MEDIUM | 1 | legal | El token de acceso lleva correo y nombre | P2 | Sprint 3-4 | UNCHANGED |
| C-16 | MEDIUM | 4 | legal | No hay programa de gobernanza de privacidad LGPD | P2 | Sprint 3-4 | UNCHANGED |
| C-22 | MEDIUM | 2 | legal | Exportación sin notificaciones (columna inexistente), sin tarjetas asignadas ni historial propio | P2 | Sprint 3-4 | NEW |
| C-23 | MEDIUM | 1 | legal | Cloudflare figura solo como DNS y R2, pero hace de proxy de todo el tráfico y recoge informes NEL | P2 | Sprint 3-4 | NEW |
| D-02 | MEDIUM | 3 | observabilidad | Registros en texto libre, sin estructura | P2 | Sprint 3-4 | DEESCALATED |
| D-04 | MEDIUM | 4 | mantenibilidad | Sin linter, formateador ni tipos | P2 | Sprint 3-4 | DEESCALATED |
| D-07 | MEDIUM | 0,5 | observabilidad | Ningún monitor de disponibilidad documentado | P2 | Sprint 3-4 | DEESCALATED |
| D-11 | MEDIUM | 0,5 | dependencias | Actualizaciones de seguridad de Dependabot desactivadas y sin dependabot.yml | P2 | Sprint 3-4 | UNCHANGED |
| D-13 | MEDIUM | 2 | documentación | ADR-001 a 010 sin ficha; ADR-005 dice que el repositorio es privado | P2 | Sprint 3-4 | UNCHANGED |
| D-16 | MEDIUM | 1 | observabilidad | /api/health responde ok sin comprobar nada | P2 | Sprint 3-4 | UNCHANGED |
| D-20 | MEDIUM | 2 | observabilidad | El cliente no registra errores en ningún sitio | P2 | Sprint 3-4 | NEW |
| D-21 | MEDIUM | 0,5 | fiabilidad | Ante una excepción no capturada el proceso no sale y Railway no lo reinicia | P2 | Sprint 3-4 | NEW |
| D-23 | MEDIUM | 1 | documentación | La UI dice que el Invitado es de solo lectura; la matriz y el servidor le dejan crear, editar y mover tarjetas | P2 | Sprint 3-4 | NEW |
| D-24 | MEDIUM | 1 | proceso | El registro de la auditoría de mayo cerró como MITIGATED arreglos parciales | P2 | Sprint 3-4 | NEW |
| A-13 | LOW | 0,25 | SEO | No hay robots.txt: /robots.txt y /sitemap.xml devuelven la SPA con 200 | P3 | Backlog | UNCHANGED |
| A-32 | LOW | 1 | usabilidad | confirm() nativo en 2 borrados, contra ADR-018 | P3 | Backlog | NEW |
| A-33 | LOW | 0,25 | accesibilidad | Salto de h1 a h3 en la vista de tablero | P3 | Backlog | NEW |
| A-34 | LOW | 0,5 | accesibilidad | El título del documento no cambia entre vistas | P3 | Backlog | NEW |
| A-35 | LOW | 0,25 | usabilidad | El pie de la barra lateral dice «AGLAYA v1.2 · Phase 1»; la versión es 1.4.0 | P3 | Backlog | NEW |
| B-28 | LOW | 0,25 | seguridad | El secreto de la puerta interna se compara con !== y no en tiempo constante | P3 | Backlog | NEW |
| B-29 | LOW | 2 | seguridad | Puerta interna: llega a espacios personales y ilike no escapa comodines (deuda declarada) | P3 | Backlog | NEW |
| B-31 | LOW | 0,25 | seguridad | Entorno local del riel MCP con dos avisos (cryptography, pip) | P3 | Backlog | NEW |
| B-33 | LOW | 0,5 | seguridad | Credenciales de servicios retirados siguen en el entorno de producción | P3 | Backlog | NEW |
| B-35 | LOW | 0,5 | datos | cards.priority sin CHECK, y crear tarjeta no valida la prioridad | P3 | Backlog | NEW |
| B-36 | LOW | 2 | datos | Borrar un espacio encadena seis borrados sin transacción ni comprobación intermedia | P3 | Backlog | NEW |
| B-37 | LOW | 3 | arquitectura | El riel MCP guarda service_role en la máquina del operador y opera como superadmin (ADR-026) | P3 | Backlog | NEW |
| B-38 | LOW | 0,5 | seguridad | CSP con unsafe-inline en script-src sin nada que lo necesite; Referrer-Policy laxa | P3 | Backlog | NEW |
| B-39 | LOW | 0,5 | seguridad | Cuatro respuestas devuelven detalles internos | P3 | Backlog | NEW |
| B-41 | LOW | 1 | datos | El guardián de GRANT no ve MAINTAIN (ya documentado) | P3 | Backlog | NEW |
| C-10 | LOW | 0,5 | legal | Sección de cookies inexacta: claves de localStorage que no se usan; calla la cookie aglaya_refresh | P3 | Backlog | DEESCALATED |
| C-25 | LOW | 0,25 | legal | GitHub figura como «trigger por reloj» y el volcado completo se hace en su runner | P3 | Backlog | NEW |
| C-26 | LOW | 0,25 | legal | «Las prioridades las asignan humanos»: agentes crean tarjetas con prioridad y responsable | P3 | Backlog | NEW |
| C-27 | LOW | 0,5 | legal | Los registros del servidor guardan correos | P3 | Backlog | NEW |
| C-28 | LOW | 0,5 | legal | Las TOMs describen como control el domain guard del registro y los adjuntos como auth-walled | P3 | Backlog | NEW |
| D-09 | LOW | 1 | despliegue | Falta el runbook de marcha atrás de un despliegue | P3 | Backlog | DEESCALATED |
| D-25 | LOW | 0,1 | documentación | package.json presenta la app como multi-tenant (contra ADR-020) | P3 | Backlog | NEW |
| D-26 | LOW | 0,1 | documentación | El README muestra licencia MIT y no hay fichero LICENSE | P3 | Backlog | NEW |
| B-32 | INFO | 0 | seguridad | Clave de Resend en el historial público, revocada el 2026-08-07 | P3 | Backlog | NEW |

## 5. No verificables

| ID | Subtipo | Pregunta | Acción externa |
|---|---|---|---|
| A-NV-01 | `NV_RUNTIME` | Core Web Vitals (LCP, INP, CLS) | PageSpeed Insights / Lighthouse sobre / sin sesión, y DevTools → Performance con sesión. |
| B-14 | `NV_CREDENTIALS` | ¿Faltan índices en cards.column_id y cards.assignee_id? | EXPLAIN ANALYZE de las consultas por column_id (server/routes/cards.js:141,547,549; columns.js:198) con tabla de tamaño real. |
| B-NV-01 | `NV_RUNTIME` | ¿Ve el limitador por IP la IP real tras Cloudflare → Netlify → Railway (trust proxy 1)? | Registrar temporalmente req.ip y X-Forwarded-For en una petición real. |
| B-NV-02 | `NV_DASHBOARD` | Plan de Supabase, PITR y copias nativas | Panel de Supabase → Database → Backups. |
| C-NV-01 | `NV_DASHBOARD` | Contrato que cubre el uso de Claude (condiciones comerciales con DPA o plan de consumo) | Consola de Anthropic / condiciones del plan; archivar el DPA en DPA-registry.md. |
| C-NV-02 | `NV_DASHBOARD` | Retención real de los registros de Railway y región real de Supabase | Panel de Railway (retención de logs) y de Supabase (región). |
| D-NV-01 | `NV_DASHBOARD` | Reglas de alerta de Sentry, destinatarios, y si Netlify espera a CI | Sentry → Alerts; Netlify → Build & deploy. |

## 6. Lagunas de herramienta

- **Ausentes:** `axe`, `radon`, `eslint`, `semgrep`, `trivy`, `lighthouse`. No se instaló ninguna. La accesibilidad y la seguridad se revisaron leyendo el código, sin barrido automático: que algo no aparezca aquí no significa que no exista.
- **Usadas:** `npm audit`, `pip-audit`, `gh api`, API de Railway (solo lectura, sin valores de variables), `curl` a las páginas públicas y `vite build` en un directorio temporal. `git status` antes y después: el build no tocó el repo.
- **Base viva:** `psql` está bloqueado por el enganche de secretos, y no se rodeó. Lo que se dice de RLS se apoya en el esquema declarado. Ningún guardián vigila las políticas vivas (B-21, recomendación).
- **Enganches:** bloquearon dos órdenes (una que nombraba ficheros de secretos y un borrado). No se rodeó ninguno.

## 7. Qué se hizo y qué no

- **Sin arreglos, sin commits, sin instalar nada.** Solo se escribió en este directorio.
- **Nada se probó contra producción.** Los hallazgos de seguridad salen de leer el código y la configuración. Las peticiones a producción fueron lecturas de páginas públicas (`/`, `/robots.txt`, `/sitemap.xml`, `/privacidad`).
- **Redacción:** el repositorio es público. Cada hallazgo de seguridad abierto dice qué falla, dónde y cómo se arregla, sin mecánica de explotación.
- **Sesiones:** la auditoría se pausó a petición del operador y se reanudó dos veces. Una de las sesiones intermedias se cortó escribiendo la Fase B. Lo que dejó a medias se verificó de nuevo leyendo el código antes de citarlo.

## 8. Ficheros

| Fichero | Contenido |
|---|---|
| `audit-0.md` | alcance, stack y herramientas |
| `audit-A.md` · `audit-B.md` · `audit-C.md` · `audit-D.md` | hallazgos por fase, con panel de evidencia y delta |
| `findings.json` | los 82 hallazgos con metadatos (esquema 3.0) |
| `roadmap.md` | plan por sprints |
| `state.json` | estado para `--resume` |
| `notas-fase-A.md`, `notas-fase-B.md` | **borradores superados** de sesiones interrumpidas (el de B está cortado a mitad de frase). Un enganche impidió borrarlos. Se pueden eliminar |

## 9. Decisión pendiente del operador

Este directorio **no está commiteado**. El repositorio es público, y B-20 y B-21 siguen abiertos en producción: publicar el informe antes de cerrarlos los anuncia. Las opciones son cerrar primero y publicar después, publicar con B-20 y B-21 resumidos, o dejarlo fuera del repositorio.
