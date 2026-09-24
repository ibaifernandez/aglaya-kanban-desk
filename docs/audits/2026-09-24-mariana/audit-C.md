# Fase C — Cumplimiento legal · Auditoría Mariana 2026-09-24

**Marco:** el que declara la propia política (`docs/legal/privacy-policy-kanban.md`): RGPD, Ley 21.719 (Chile) y LGPD (Brasil).
**Leído:** `docs/legal/*` (política, encargados, registro de DPA, RAT, TOMs, base legal, retención, brechas, DPIA), la política publicada en `/privacidad`, y el código que la sostiene o la contradice (`server/routes/auth.js`, `media.js`, `client/src`, `kanban-mcp/server.py`).
**Contexto de riesgo:** hoy hay tres cuentas por decisión (`CLAUDE.md`), pero el código soporta clientes externos (rol `cliente`, espacios `externo`), y la política se escribe para ellos.

## Panel de evidencia — Fase C

| Confianza | Nº | % de la fase |
|---|---|---|
| PROVEN | 13 | 86,7 % |
| UNVERIFIABLE | 2 | 13,3 % |
| **Total** | **15** | 100 % |

Fuente: code-read 12 (documentos y código del repo, incluidas ausencias probadas con `grep`) · manual-verification 1 (`curl -I` a producción, 24-sep-2026 21:10Z) · tool-external 0.

Salud: PROVEN ≥ 60 % → sana.

## Recuento por severidad

| CRITICAL | HIGH | MEDIUM | LOW | UNVERIFIABLE |
|---|---|---|---|---|
| 1 | 3 | 4 | 5 | 2 |

## Hallazgos

| ID | Confianza | Dim | Hallazgo | Evidencia | Norma / art. | Severidad | Esfuerzo |
|---|---|---|---|---|---|---|---|
| C-19 | PROVEN | encargados | Claude (Anthropic) trata contenido de tarjetas, nombres y correos a través del MCP del riel, y no figura como encargado en ningún registro | `kanban-mcp/server.py:222-262,618-640,687-693`; `docs/ARCHITECTURE.md:308-313`; `privacy-policy-kanban.md:92-103` | RGPD 13(1)(e), 28, 30(1)(d), cap. V; LGPD 9 y 33; Ley 21.719 (información y transferencia) | CRITICAL | 3 h |
| C-20 | PROVEN | derechos | La política promete botones de «exportar» y «eliminar cuenta» en el perfil; la app no los tiene | `privacy-policy-kanban.md:160-161`; `client/src/components/User/UserMenu.jsx:100-114`; 0 usos de `/auth/me` en `client/src` | RGPD 12(1)-(2), 13, 5(1)(a) | HIGH | 3 h |
| C-21 | PROVEN | supresión | Borrar la cuenta deja los espacios que creó la persona (incluido el personal) con todo su contenido, y el avatar público; y la respuesta dice que se borraron | `server/routes/auth.js:305-350` (`:344`); `docs/schema/supabase-schema.sql:130,184-185`; `server/routes/media.js:33,44-46`; `retention-policy.md:65` | RGPD 17(1), 5(1)(e), 12(3); LGPD 18(VI) | HIGH | 4 h |
| C-09 | PROVEN | DPIA | La DPIA sigue siendo una plantilla sin rellenar, aunque ella misma dice que el tratamiento probablemente la requiere | `docs/legal/DPIA-template.md:5,7,19` | RGPD 35 | HIGH (heredada) | 6 h |
| C-22 | PROVEN | acceso/portabilidad | La exportación sale sin notificaciones (lee una columna que no existe) y sin tarjetas asignadas ni historial escrito por la persona; la política dice «todos tus datos» | `server/routes/auth.js:208-218,278`; `docs/schema/supabase-schema.sql:308,331-338`; `privacy-policy-kanban.md:160` | RGPD 15, 20 | MEDIUM | 2 h |
| C-23 | PROVEN | encargados | Cloudflare figura solo como DNS y copias en R2, pero hace de proxy de todo el tráfico y recoge informes de red del navegador | `curl -I` (abajo); `privacy-policy-kanban.md:101,123`; `subprocessors.md:19` | RGPD 13(1)(e)-(f), 28, 44 | MEDIUM | 1 h |
| C-11 | PROVEN | minimización | El token de acceso lleva correo y nombre | `server/routes/auth.js:101,139-145,388-394` | RGPD 5(1)(c), 25 | MEDIUM (heredada) | 1 h |
| C-16 | PROVEN | gobernanza | No hay programa de gobernanza de privacidad para LGPD | 0 coincidencias de «gobernanza» o «Art. 50» en `docs/legal/` | LGPD 50 | MEDIUM (heredada) | 4 h |
| C-10 | PROVEN | cookies | La sección de cookies describe claves de `localStorage` que ya no se usan y calla la cookie de sesión `aglaya_refresh` | `privacy-policy-kanban.md:188-193`; `client/src/utils/session.js:1-4,41,87`; `server/routes/auth.js:19,35-43` | RGPD 13; ePrivacy 5(3) (exención, no la información) | LOW | 0,5 h |
| C-25 | PROVEN | encargados | GitHub figura como «trigger por reloj», pero el volcado completo de la base se hace dentro de su runner | `.github/workflows/db-backup.yml:58-68`; `subprocessors.md:25`; `privacy-policy-kanban.md:102` | RGPD 13(1)(e), 30 | LOW | 0,25 h |
| C-26 | PROVEN | transparencia | La política dice que las prioridades «las asignan humanos»; agentes crean tarjetas con prioridad y responsable | `privacy-policy-kanban.md:88`; `docs/legal/base-legal.md:116`; `server/routes/internalRoute.js:202-214`; `kanban-mcp/server.py:352-384` | RGPD 13 (exactitud); 22 no aplica | LOW | 0,25 h |
| C-27 | PROVEN | minimización | Los registros del servidor guardan correos (auto-borrado, cambios de rol, invitaciones) | `server/routes/auth.js:321,337`; `server/routes/admin.js:185-189,238` | RGPD 5(1)(c), 5(1)(e) | LOW | 0,5 h |
| C-28 | PROVEN | TOMs | Las TOMs describen como control el «domain guard» del registro (B-20) y los adjuntos como «auth-walled» (B-25, B-34) | `docs/legal/TOMs.md:17,129`; `docs/SECURITY.md:22,101,112` | RGPD 32 (documentación) | LOW | 0,5 h |
| C-NV-01 | UNVERIFIABLE (`NV_DASHBOARD`) | encargados | ¿Qué contrato cubre el uso de Claude (condiciones comerciales con DPA o plan de consumo)? | — | RGPD 28 | — | — |
| C-NV-02 | UNVERIFIABLE (`NV_DASHBOARD`) | retención | Retención real de los registros de Railway (la política dice «7-30 días según plan») y región real de Supabase | `privacy-policy-kanban.md:142` | RGPD 5(1)(e) | — | — |

## Detalle

### C-19 · CRITICAL · RGPD 13(1)(e), 28(1)-(3), 30(1)(d), cap. V · NEW

**Titulares afectados:** todas las personas con cuenta y cualquiera nombrado en una tarjeta. **Exposición:** RGPD 83(4) (hasta 10 M€ o el 2 %) por el Art. 28 y el 30; 83(5) (hasta 20 M€ o el 4 %) por la información (13) y la transferencia (44).

El riel MCP (ADR-026, `docs/ARCHITECTURE.md:308-313`) está pensado para que lo usen sesiones de Claude: `CLAUDE.md` lo registra para «cualquier sesión de Claude de esta máquina». Sus herramientas devuelven a esas sesiones:

- el contenido de las tarjetas (`list_cards`, `kanban-mcp/server.py:222-262`);
- las versiones anteriores y quién las escribió (`card_history`, `:618-640`);
- **nombre y correo** de cada miembro (`list_members`, `:687-693`).

Todo eso viaja a Anthropic para que el modelo lo procese.

Anthropic no aparece en la tabla de encargados de la política (`privacy-policy-kanban.md:92-103`), ni en `subprocessors.md`, ni en `DPA-registry.md`, ni en `RAT.md` (`grep` de «anthropic», «claude», «IA», «agente»: 0 coincidencias en `docs/legal/`).

**Arreglo:** declarar el encargado con su función, región y mecanismo de transferencia; registrar el contrato aplicable (C-NV-01); añadir la actividad al RAT. Minimizar lo que el riel devuelve: `list_members` no necesita el correo para operar.

### C-20 · HIGH · RGPD 12(1)-(2), 13 · NEW

La política pública, §7.1, dice de la portabilidad «UI disponible en tu perfil» y lo mismo de la supresión (`privacy-policy-kanban.md:160-161`). El menú de perfil tiene dos botones, «Cambiar foto de perfil» y «Cerrar sesión» (`UserMenu.jsx:100-114`), y ningún fichero de `client/src` llama a `/api/auth/me/export` ni a `DELETE /api/auth/me`. Hoy esos derechos solo se ejercen llamando a la API a mano o por correo (§7.2).

**Arreglo:** añadir los dos botones, o corregir la política a lo que existe.

### C-21 · HIGH · RGPD 17(1), 5(1)(e) · NEW

`DELETE /api/auth/me` borra el usuario de Supabase Auth, y en cascada su fila y sus membresías (`auth.js:323-332`). Pero:

- **Los espacios que creó la persona se quedan.** `workspaces.created_by` es `ON DELETE SET NULL` (`supabase-schema.sql:130`) y las membresías caen en cascada (`:184-185`), así que un espacio personal queda sin miembros y con todas sus tarjetas. El registro crea uno para cada alta (`auth.js:89-98`). La respuesta dice lo contrario: «Los workspaces que pertenecían solo a ti han sido eliminados en cascada» (`:344`).
- **El avatar sigue publicado.** Se guarda en `avatars/<userId>` del bucket `media` con URL pública (`media.js:33`, `:44-46`), y ningún código lo borra. La retención promete «Tras supresión cuenta: 30 días» (`retention-policy.md:65`).
- **Los correos quedan en los registros.** El propio borrado escribe el correo dos veces (`auth.js:321`, `:337`); ver C-27.

La política ya dice que las tarjetas de espacios compartidos sobreviven (`privacy-policy-kanban.md:138`). Eso es defendible. Un espacio personal sin nadie dentro no lo es.

### C-09 · HIGH (heredada) · RGPD 35 · UNCHANGED

`DPIA-template.md` sigue en «🟡 Plantilla inicial — completar por DPO/responsable cuando aplique» (`:5`), con huecos sin rellenar («[N usuarios actuales / proyección]», `:19`). Su propia introducción dice que los espacios de clientes externos con texto libre en tarjetas «califica[n] probablemente» (`:7`). La última edición (`8bdb608`) corrigió una frase sobre RLS, sin completar la evaluación.

### C-22 · MEDIUM · RGPD 15, 20 · NEW

- **Notificaciones.** La consulta pide `read_at` (`auth.js:217`), y la tabla tiene `read`, no `read_at` (`supabase-schema.sql:331-338`; `schema-drift.yml` en verde el 24-sep confirma el esquema declarado). PostgREST devuelve error, el código no lo mira y exporta `notifications: []` (`auth.js:278`).
- **Faltan datos que son de la persona:** solo exporta las tarjetas donde es `owner_id` (`:208-212`), no aquellas donde es responsable (`assignee_id`). Tampoco las versiones que escribió (`card_description_history.changed_by`, `supabase-schema.sql:308`).

La política promete «todos tus datos» (`privacy-policy-kanban.md:160`).

### C-23 · MEDIUM · RGPD 13(1)(e)-(f), 28, 44 · NEW

`curl -I https://kanban.aglaya.biz/` (24-sep-2026 21:10Z) responde `server: cloudflare`, `cf-ray: …-GRU` y cabeceras `report-to`/`nel` hacia `a.nel.cloudflare.com`. Cloudflare termina TLS y ve cada petición, incluido el login, y recoge informes de errores de red del navegador. La política lo describe como «DNS de `aglaya.biz` + bucket R2» (`:101`), y sobre transferencias dice «sin transferencia fuera de UE para este flujo específico» (`:123`), refiriéndose solo a R2. El proxy es global.

Efecto colateral en la propia página legal: la ofuscación de correos de Cloudflare reescribe los contactos de `/privacidad`, y sin JavaScript se ven como «[email protected]». Es la única diferencia entre producción y `client/public/privacidad.html` (comparación hecha en esta auditoría).

### C-11 · MEDIUM (heredada) · RGPD 5(1)(c) · UNCHANGED

Las claims del token de acceso incluyen `email` y `name` en el registro, el login y la renovación (`auth.js:101`, `:139-145`, `:388-394`). El servidor ya no las usa para decidir: relee el usuario en la base (`server/middleware/auth.js:98-111`). Sobran.

### C-16 · MEDIUM (heredada) · LGPD 50 · UNCHANGED

No hay programa de gobernanza de privacidad para LGPD: 0 coincidencias de «gobernanza» o «Art. 50» en `docs/legal/`.

### C-10 · LOW · DEESCALATED (ALTO → LOW)

No hace falta banner: no hay analítica ni rastreadores (`grep` en `client/`, Fase A), y la política ya tiene la sección. Pero es inexacta. Declara `localStorage` con `aglaya_token` y `aglaya_session` (`privacy-policy-kanban.md:188-193`). El cliente usa `sessionStorage` con `aglaya_session` (token y usuario) y `aglaya_ui_state` (`session.js:1-4`, `:41`, `:87`), y existe una cookie `aglaya_refresh` `HttpOnly` de 30 días (`auth.js:19`, `:35-43`) que la sección no nombra.

### C-25 · LOW · NEW

`db-backup.yml` ejecuta `pg_dump` de la base entera dentro del runner de GitHub Actions (`:58-68`) antes de subirlo a R2. `subprocessors.md:25` y la política (`:102`) describen a GitHub como «Trigger por reloj del backup diario». El DPA de Microsoft está archivado y cubre el tratamiento; lo que falla es la descripción.

### C-26 · LOW · NEW

«Las prioridades de cards las asignan humanos» (`privacy-policy-kanban.md:88`; `base-legal.md:116`). La puerta interna y el MCP crean tarjetas con prioridad y responsable elegidos por el llamante, que puede ser un agente (`internalRoute.js:202-214`; `kanban-mcp/server.py:352-384`). El Art. 22 sigue sin aplicar, porque repartir tareas internas no produce efectos jurídicos. Lo inexacto es la frase.

### C-27 · LOW · NEW

Hay correos en `console.warn`/`console.error`: al borrarse la cuenta (`auth.js:321`, `:337`), en el intento de editar a otra organización (`admin.js:238`) y en un fallo de invitación (`admin.js:185-189`). Se quedan en los registros de Railway lo que dure su retención (C-NV-02). El identificador bastaría.

### C-28 · LOW · NEW

`TOMs.md:17` lista el «domain guard» del registro como medida, y `SECURITY.md:22,101,112` lo presenta como control. Es justo lo que B-20 muestra que no protege. `TOMs.md:129` describe los adjuntos como «Supabase Storage (auth-walled) o `server/uploads/` (Railway disk)». Los adjuntos van a disco efímero (B-34) y se sirven sin sesión (B-25).

## Delta contra mayo (hallazgos C)

| ID mayo | Estado mayo | Hoy | Nota |
|---|---|---|---|
| C-01 | MITIGATED | FIXED | `/privacidad` y `/privacy` → 200 |
| C-02 | MITIGATED | FIXED | Supabase declarado |
| C-03 | MITIGATED | FIXED | `docs/legal/` y registro de DPA completos para los encargados listados |
| C-04 | MITIGATED | FIXED | `DELETE /api/auth/me` existe; alcance incompleto en C-21 y sin interfaz en C-20 |
| C-05 | MITIGATED | FIXED | `GET /api/auth/me/export` existe; contenido incompleto en C-22 |
| C-06 | MITIGATED | FIXED | `base-legal.md` |
| C-07 | MITIGATED | FIXED | `TOMs.md`; exactitud en C-28 |
| C-08 | MITIGATED | FIXED | `breach-notification-procedure.md` |
| C-09 | PARTIAL | UNCHANGED | sigue siendo plantilla |
| C-10 | open (ALTO) | DEESCALATED → LOW | no hace falta banner; la sección es inexacta |
| C-11 | open | UNCHANGED | — |
| C-12 | open | FIXED | `retention-policy.md` con plazos por categoría |
| C-13 | MITIGATED | FIXED | encargados enumerados; faltan Anthropic (C-19) y la función real de Cloudflare (C-23) |
| C-14 | open | FIXED | sección de transferencias; mismo hueco |
| C-15 | MITIGATED | FIXED | contacto de privacidad |
| C-16 | open | UNCHANGED | — |
| C-17 | MITIGATED | FIXED | `RAT.md`; le falta la actividad de C-19 |
| C-18 | informativo | — | — |

## Nota de alcance

Esto es una revisión técnica de coherencia entre documentos y código, no asesoría legal. La política de mayo registró que se declinó la revisión legal externa (`privacy-policy-kanban.md`, pie). Si entra el primer cliente con rol `cliente`, C-09 y C-19 son los que conviene cerrar antes.
