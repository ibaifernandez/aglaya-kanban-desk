# Fase B — Backend, datos y arquitectura · Auditoría Mariana 2026-09-24

**Alcance:** API Express (`server/`), esquema Supabase (`docs/schema/`), servidor MCP del riel (`kanban-mcp/`), dependencias.
**Commit:** `a630a84`. **Producción:** Railway desplegó `a630a84` el 19-sep-2026 (`gh api …/deployments`, entorno `aglaya-kanban-desk / production`), así que el servidor leído es el que corre.
**Leído entero:** `server/app.js`, `index.js`, `middleware/*`, `routes/*`, `utils/*`; `docs/schema/supabase-schema.sql` (RLS, GRANT, FK, índices); `kanban-mcp/server.py` (credenciales y HTTP).

**Criterio de redacción (repo público):** cada hallazgo de seguridad dice qué falla, dónde y cómo se arregla. No hay mecánica de explotación. Nada se probó contra producción.

## Panel de evidencia — Fase B

| Confianza | Nº | % de la fase |
|---|---|---|
| PROVEN | 24 | 88,9 % |
| UNVERIFIABLE | 3 | 11,1 % |
| **Total** | **27** | 100 % |

Fuente: code-read 18 · tool-external 6 (`npm audit`, `pip-audit`, `gh api`, API de Railway en solo lectura) · manual-verification 0.

Salud: PROVEN ≥ 60 % → sana.

## Recuento por severidad

| CRITICAL | HIGH | MEDIUM | LOW | INFO | UNVERIFIABLE |
|---|---|---|---|---|---|
| 2 | 3 | 8 | 10 | 1 | 3 |

## Hallazgos

| ID | Confianza | Dim | Hallazgo | Evidencia | OWASP / CVSS o ref | Severidad | Esfuerzo |
|---|---|---|---|---|---|---|---|
| B-20 | PROVEN | seguridad | Alta de cuentas pública: sin sesión, con el rol y la organización que manda el cliente, y correo dado por confirmado | `server/routes/auth.js:50-107`; `server/app.js:133` | A01 + A07 · 9.8 | CRITICAL | 1 h |
| B-34 | PROVEN | datos/ops | Los adjuntos se guardan en disco efímero, sin volumen, y la copia diaria no los incluye | `server/routes/uploads.js:7,41-47`; Railway `volumes: []`; `.github/workflows/db-backup.yml:58-68` | Rúbrica BD/Ops + regla 4 | CRITICAL | 4 h |
| B-21 | PROVEN | seguridad/BD | Dos políticas RLS de INSERT con `WITH CHECK (true)` anulan las restrictivas en `workspaces` y `workspace_members` | `docs/schema/supabase-schema.sql:479-480,491-492` | A01 · 8.8 | HIGH | 0,5 h |
| B-27 | PROVEN | seguridad | La sesión no se puede revocar: el refresh dura 30 días y se renueva solo, y cerrar sesión solo borra la cookie del navegador | `server/routes/auth.js:17-19,356-420`; `server/middleware/auth.js:72-81` | A07 · 7.4 | HIGH | 4 h |
| B-03 | PROVEN | seguridad | La API sigue expuesta en el dominio por defecto de Railway; el dominio propio no existe | Railway `customDomains: []`; `netlify.toml:9,16`; `server/middleware/hostMonitor.js:10-20` | Regla del checklist (dominio de plataforma expuesto) | HIGH (heredada) | 2 h |
| B-12 | PROVEN | BD | RLS de tarjetas, columnas, categorías e historial filtra por organización, no por espacio | `docs/schema/supabase-schema.sql:511-570`; `docs/INCIDENTS.md:62-66` | A01 · 8.1 bruto → MEDIUM por deuda documentada | MEDIUM | 6 h |
| B-08 | PROVEN | seguridad | Dependencias del servidor con avisos HIGH (multer) y moderados, alcanzables solo con sesión | `npm audit --omit=dev` (abajo) | A06 · 6.5 | MEDIUM | 1 h |
| B-23 | PROVEN | seguridad | Categorías: la API solo exige sesión y organización, no pertenencia al espacio del tablero | `server/app.js:175-178`; `server/routes/categories.js:15,35,59,72` | A01 · 5.4 | MEDIUM | 1 h |
| B-24 | PROVEN | seguridad | Las URL de adjuntos se guardan sin validar y el cliente las usa como enlace e imagen | `server/routes/cards.js:161,462`; `client/src/components/CardModal/CardModal.jsx:855,873-874` | A03 · 5.4 | MEDIUM | 1 h |
| B-40 | PROVEN | seguridad | Dos reglas de `PERMISSIONS.md` que el servidor no aplica | `server/routes/workspaces.js:332-338,414-446`; `docs/PERMISSIONS.md` §3 reglas 5 y 6 | A01 · 5.4 | MEDIUM | 1,5 h |
| B-25 | PROVEN | seguridad | Subidas: la extensión la pone el nombre del cliente, los tipos de texto no pasan control de contenido, y todo se sirve en línea desde el origen de la app y sin sesión | `server/routes/uploads.js:39,44-45,80-81`; `server/app.js:125`; `netlify.toml:14-18` | A04 · 4.4 | MEDIUM | 3 h |
| B-26 | PROVEN | seguridad | Borrar un adjunto solo exige sesión: no comprueba a quién pertenece | `server/routes/uploads.js:110-122`; `server/app.js:172` | A01 · 4.2 | MEDIUM | 1 h |
| B-16 | PROVEN | arquitectura | Rutas con lógica de negocio y acceso directo a la base, sin capa de servicio | `server/routes/cards.js:1`, `boards.js:1`, `columns.js:1`, `workspaces.js:3`, `categories.js:1` | Rúbrica de arquitectura | MEDIUM (heredada) | 16 h |
| B-28 | PROVEN | seguridad | El secreto de la puerta interna se compara con `!==` y no en tiempo constante | `server/routes/internalRoute.js:13` | A07 · 3.7 | LOW | 0,25 h |
| B-29 | PROVEN | seguridad | Puerta interna: llega a espacios personales por id o nombre, y `ilike` no escapa comodines (deuda que el propio código declara) | `server/routes/internalRoute.js:36-37,57-78,359-369,414-437,494-498` | A01 · 3.8 | LOW | 2 h |
| B-39 | PROVEN | seguridad | Cuatro respuestas devuelven detalles internos (mensajes de Supabase, prefijos de id de organización) | `server/routes/auth.js:73`; `server/routes/admin.js:162,239-241,260` | A05 · 2.7 | LOW | 0,5 h |
| B-38 | PROVEN | seguridad | CSP con `'unsafe-inline'` en `script-src` sin nada que lo necesite; `Referrer-Policy` laxa | `netlify.toml:38,41` | A05 · endurecimiento, sin CVSS | LOW | 0,5 h |
| B-33 | PROVEN | seguridad/ops | Credenciales de servicios retirados siguen en el entorno de producción | Railway `variableNames` (abajo); `docs/ARCHITECTURE.md:320` | A05 · higiene | LOW | 0,5 h |
| B-31 | PROVEN | seguridad | Entorno local del riel MCP con dos avisos (`cryptography`, `pip`) | `pip-audit` (abajo) | A06 · herramienta local | LOW | 0,25 h |
| B-35 | PROVEN | BD | `cards.priority` sin `CHECK`, y crear tarjeta no valida la prioridad (editar sí) | `docs/schema/supabase-schema.sql:248`; `server/routes/cards.js:156` frente a `:229-231` | Rúbrica BD (higiene) | LOW | 0,5 h |
| B-36 | PROVEN | BD | Borrar un espacio encadena seis borrados sin transacción ni comprobación de error intermedia | `server/routes/workspaces.js:360-386` | Rúbrica BD (integridad) | LOW | 2 h |
| B-37 | PROVEN | arquitectura | El riel MCP guarda la clave `service_role` en la máquina del operador para lecturas y opera como superadmin (decisión ADR-026) | `kanban-mcp/server.py:14-19,128-137`; `docs/ARCHITECTURE.md:308-313` | Mínimo privilegio | LOW | 3 h |
| B-41 | PROVEN | BD | El guardián de GRANT lee `information_schema` y no ve `MAINTAIN` (ya documentado) | `CLAUDE.md`, sección GRANTs; `scripts/grants-guard.sh` | Rúbrica BD | LOW | 1 h |
| B-32 | PROVEN | seguridad | El escaneo de secretos de GitHub encontró una clave de Resend en el historial público; está revocada desde el 7-ago-2026 | `gh api …/secret-scanning/alerts` | Informativo | INFO | — |
| B-14 | UNVERIFIABLE (`NV_CREDENTIALS`) | BD | ¿Faltan índices en `cards.column_id` y `cards.assignee_id`? | `docs/schema/supabase-schema.sql:342-355` | — | — | — |
| B-NV-01 | UNVERIFIABLE (`NV_RUNTIME`) | seguridad | ¿Ve el limitador por IP la IP real tras Cloudflare → Netlify → Railway? | `server/app.js:42,87-111` | — | — | — |
| B-NV-02 | UNVERIFIABLE (`NV_DASHBOARD`) | BD | Plan de Supabase, PITR y copias nativas | — | — | — | — |

## Detalle

### B-20 · CRITICAL · A01 + A07 · CVSS 9.8 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` · NEW

**Atacante:** ninguno necesita cuenta. **Interacción:** no. **Alcance:** sin cambio. **Impacto:** C alto / I alto / A alto.

`POST /api/auth/register` no lleva `requireAuth` y va montado en `server/app.js:133`. El manejador (`server/routes/auth.js:50-107`):

- toma `role` y `organizationId` del cuerpo de la petición (`:52`) y los guarda en `public.users` (`:81`);
- crea el usuario en Supabase Auth con `email_confirm: true` (`:66-70`), sin comprobar que quien se registra controla ese correo;
- emite tokens al momento (`:100-106`).

La única barrera es el dominio del correo (`:58-63`). La columna `public.users.role` no tiene `CHECK` (`docs/schema/supabase-schema.sql:110`). La ruta está en el repo desde marzo (`b40944b`), y **está desplegada**: Railway sirve `a630a84`.

Los documentos la presentan como control: «Domain guard» en `docs/SECURITY.md:22,101,112` y `docs/legal/TOMs.md:17`. Los tests de registro (`server/tests/auth.test.js:102-131`) cubren campos ausentes, dominio ajeno y un alta correcta. Ninguno comprueba que el rol lo decida el servidor.

**Arreglo.** Las altas ya tienen su camino: la invitación de administración (`server/routes/admin.js:98-201`), que fija rol y organización en el servidor. Retirar la ruta es lo mínimo. Si hace falta conservarla, exigir sesión de administrador e ignorar `role` y `organizationId` del cuerpo. Añadir el test que falta: un alta nunca sale con un rol que no decidió el servidor. Después, revisar en `public.users` que no haya cuentas que nadie reconozca (consulta de solo lectura; acción del Operador).

### B-34 · CRITICAL (operacional) · NEW

- `POST /api/uploads` escribe en disco local: `server/uploads/` (`server/routes/uploads.js:7`, `diskStorage` en `:41-47`).
- La API de Railway (`describe-service`, solo lectura, 24-sep-2026) da `"volumes": []` para el servicio `web`. Sin volumen, el sistema de ficheros del contenedor no sobrevive a un redespliegue, y aquí se redespliega con cada `push` a `main`: cuatro despliegues entre el 16 y el 19 de septiembre.
- La copia diaria solo vuelca la base (`pg_dump`, `.github/workflows/db-backup.yml:58-68`). Los ficheros no entran en ninguna.

Consecuencia: las tarjetas conservan la URL del adjunto, y el fichero puede no existir ya. Los documentos dicen otra cosa: `docs/RUNBOOK.md:59` («Carpeta persistente para archivos adjuntos») y `docs/legal/TOMs.md:129` («`server/uploads/` (Railway disk)»).

**Severidad.** La rúbrica de BD/Ops marca CRITICAL la pérdida de datos sin copia. La regla transversal 4 (datos de producción) sube un escalón los hallazgos de copia y restauración.

**Qué no se pudo medir:** cuántas tarjetas tienen hoy adjuntos rotos (`NV_CREDENTIALS`).

**Arreglo.** Mover los adjuntos al almacenamiento que ya usan avatares y portadas (Supabase Storage, `server/routes/media.js`), en un bucket privado con URL firmada, o montar un volumen en Railway. Incluir los ficheros en la copia en cualquiera de los dos casos.

### B-21 · HIGH · A01 · CVSS 8.8 `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H` · NEW

En Postgres, las políticas permisivas de una misma operación se combinan con OR. El esquema declarado tiene:

- `"Permitir crear workspaces a usuarios autenticados"`: `FOR INSERT TO authenticated WITH CHECK (true)` (`supabase-schema.sql:479-480`), junto a la restrictiva `"Crear workspaces en mi org"` (`:477-478`);
- `"Permitir unirse a workspaces creados"`: `FOR INSERT TO authenticated WITH CHECK (true)` (`:491-492`), junto a `"Insertar miembros si admin/owner"` (`:489-490`).

Con las dos permisivas, las restrictivas no restringen nada. `authenticated` tiene `INSERT` en todas las tablas de `public` (`:392-404`), así que el único freno al acceso directo con las claves públicas son estas políticas. `workspace_members` es justo la tabla con la que el servidor decide la pertenencia (`server/middleware/workspace.js:148-163`).

Ningún otro documento las menciona (`grep` en `docs/`, `server/`, `scripts/`). Y ningún guardián mira las políticas vivas: `docs/ARCHITECTURE.md:173-174` lo dice.

**Arreglo.** `DROP POLICY` de las dos (el servidor escribe con `service_role` y no las necesita). Verificar el estado vivo con `pg_policies` (acción del Operador). Añadir un guardián que falle si reaparece un `WITH CHECK (true)`.

### B-27 · HIGH · A07 · CVSS 7.4 `AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N` · NEW (residuo de B-02)

- El token de refresco dura 30 días (`auth.js:18-19`) y cada uso emite otro de 30 días (`:397-399`). No se guarda en ningún sitio del servidor, así que no hay lista de revocación ni detección de reutilización.
- `POST /api/auth/logout` solo borra la cookie del navegador (`:417-420`). Cambiar la contraseña tampoco invalida nada.
- `requireAuth` acepta cualquier JWT firmado con `JWT_SECRET` que traiga `id` (`server/middleware/auth.js:72-81`), sin mirar el campo `typ`. La separación entre tokens de acceso y de refresco descansa en que `JWT_REFRESH_SECRET` sea distinto (`auth.js:21-23`), y el arranque no lo exige (`server/utils/config.js:15`). En producción la variable existe (Railway, `variableNames`); que su valor difiera no se comprobó.

La cookie está bien protegida: `HttpOnly`, `Secure`, `SameSite=Lax` y ruta `/api/auth` (`auth.js:35-43`). La exposición depende de que alguien la obtenga por otra vía. Por eso la complejidad es alta (`AC:H`).

**Arreglo.** Guardar un identificador de sesión o de familia de refresco en la base, revocarlo al cerrar sesión, al cambiar la contraseña y al detectar reutilización. Rechazar `typ: 'refresh'` en `requireAuth`. Exigir `JWT_REFRESH_SECRET` en `validateCoreConfig`.

### B-03 · HIGH (heredada) · UNCHANGED

La API de Railway (24-sep) da `customDomains: []` y un solo `serviceDomains: web-production-099a0.up.railway.app`. El proxy de Netlify apunta ahí (`netlify.toml:9,16`), así que ese host es público y sirve la API sin pasar por Netlify ni por Cloudflare. `hostMonitor.js` lo explica: el dominio propio «nunca se creó» (`:10-20`), y el monitor es inerte hasta que exista. El runbook está escrito y sin ejecutar (`docs/runbooks/railway-custom-domain.md`).

### B-12 · MEDIUM · A01 · UNCHANGED

Las políticas de `columns`, `cards`, `categories` y `card_description_history` exigen solo `organization_id = get_my_org_id()` (`supabase-schema.sql:511-570`). El aislamiento entre espacios lo pone el servidor, y el repo lo declara (`docs/INCIDENTS.md:62-66`, `docs/ARCHITECTURE.md:15`). Pesa porque el código soporta el rol `cliente`, restringido a espacios `externo` (`server/middleware/workspace.js:170-173`), y por acceso directo esa restricción no existe.

**Severidad:** CVSS bruto 8.1 (`AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N`). Se rebaja a MEDIUM por la regla de reducción 3: es deuda preexistente y registrada (DOC-05). Con B-21 cerrado y sin cuentas `cliente`, el riesgo vivo es bajo. Pasa a ser real en cuanto exista una.

### B-08 · MEDIUM · A06 · UNCHANGED

`npm audit --omit=dev` (raíz, 24-sep-2026), 2 HIGH y 5 moderadas:

| Paquete | Versión | Avisos |
|---|---|---|
| `multer` | 2.2.0 | GHSA-wc9g-mqfw-jrwm, GHSA-qfvm-cv95-jqjf, GHSA-535w-7cp7-47q4 (DoS, 7.5); GHSA-qvfw-j98x-7q72 (3.7) |
| `ip-address` (vía `express-rate-limit@8.5.2`) | 10.2.0 | GHSA-mwp4-54f8-5fhr y dos más, de clasificación de direcciones |
| `file-type` | 16.5.4 | GHSA-5v7r-6r5c-r473 (5.3) |
| `express` / `body-parser` / `qs` | 4.22.2 | GHSA-4mjr-xmp4-gh2g, GHSA-x5fp-wj9c-mxmx |
| `uuid` | 9.0.1 | GHSA-w5hq-g745-h8pq (no aplica: el código usa `v4` sin búfer) |

Todas tienen arreglo publicado. `multer` y `file-type` solo se alcanzan después de `requireAuth` (`server/app.js:171`; `server/routes/media.js:29,67`), de ahí `PR:L` y 6.5. `ip-address` se usa para las claves del limitador, no para decidir a quién se conecta el servidor. Cliente: 0 avisos en producción (los 7 de `client/` son de desarrollo). El workflow `npm-audit.yml` es «informativo, no falla nada» (`:41,54`), así que está verde con estos avisos (corrida `35586743886`, 21-sep). Dependabot de seguridad: `disabled` (`gh api repos/…`).

### B-23 · MEDIUM · A01 · CVSS 5.4 `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N` · NEW

Las cuatro rutas de categorías van con `requireAuth` y nada más (`server/app.js:175-178`). Los manejadores filtran por `organization_id` (`categories.js:15,35,59,72`), no por pertenencia al espacio del `boardId`. Cualquier cuenta de la organización, incluidas las de rol `guest` o `cliente`, lee y cambia las categorías de cualquier tablero. `docs/PERMISSIONS.md` (Notas) dice que los manejadores comprueban por dentro, y eso vale para tableros, columnas y tarjetas, pero no para categorías.

**Arreglo:** resolver el espacio desde `boardId` o desde la categoría y pasar por `requireWorkspaceMember`.

### B-24 · MEDIUM · A03 · CVSS 5.4 `AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N` · NEW

`createCard` y `updateCard` guardan `attachments` tal como llega (`cards.js:161`, `:462`). El cliente usa `att.url` como `src` de imagen y `href` de descarga (`CardModal.jsx:855`, `:873-874`), y React 18 no filtra esquemas en `href`. La CSP no compensa (B-38).

**Arreglo:** en el servidor, aceptar solo URL con la forma que devuelve la subida (`/uploads/<uuid>.<ext>` o el origen de Storage) y rechazar el resto.

### B-40 · MEDIUM · A01 · CVSS 5.4 · NEW

- **Regla 5, «Colaborador Sandbox»** (solo crea espacios `personal`): la ruta de creación la aplica (`workspaces.js:239-245`), pero `PATCH /api/workspaces/:id` deja a cualquier `owner` o `admin` del espacio cambiar `type` (`:332-338`). Un colaborador convierte su espacio personal en `interno` o `externo`.
- **Regla 6** (los colaboradores no ven la lista de usuarios de la organización): `GET /:workspaceId/available-users` devuelve id, correo, nombre y rol de toda la organización a quien sea `owner` o `admin` de cualquier espacio (`:414-446`). Un colaborador lo es de su espacio personal.

**Arreglo:** aplicar la regla macro en `PATCH` cuando cambia `type`, y devolver en `available-users` solo lo necesario para invitar.

### B-25 · MEDIUM · A04 · CVSS 4.4 `AV:N/AC:H/PR:L/UI:R/S:C/C:L/I:L/A:N` · NEW (endurecimiento residual de B-CRIT-01)

El arreglo de mayo sigue en pie: lista de tipos, lista negra de extensiones y comprobación de contenido para binarios (`uploads.js:17-67,76-90`). Quedan tres holguras:

- la extensión guardada sale del nombre que manda el cliente (`:44-45`), frenada solo por una lista negra (`:39`);
- `text/plain` y `text/csv` se aceptan sin mirar el contenido (`:80-81`);
- `/uploads` se sirve con `express.static` sin sesión (`server/app.js:125`), en línea y desde el mismo origen de la app a través del proxy (`netlify.toml:14-18`).

**Arreglo:** derivar la extensión del tipo validado, servir con `Content-Disposition: attachment`, y mover los ficheros a almacenamiento con acceso autenticado (lo mismo que pide B-34).

### B-26 · MEDIUM · A01 · CVSS 4.2 `AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:L` · NEW

`DELETE /api/uploads/:filename` solo pide sesión (`server/app.js:172`). El manejador valida el nombre contra recorridos de ruta y borra (`uploads.js:110-122`), sin comprobar que el fichero pertenezca a una tarjeta de un espacio del usuario. Los nombres son UUID, de ahí `AC:H`.

### B-16 · MEDIUM (heredada) · UNCHANGED

Las rutas importan el cliente de base directamente y mezclan validación, reglas y persistencia (`cards.js:1`, `boards.js:1`, `columns.js:1`, `workspaces.js:3`, `categories.js:1`). Medido: `cards.js` tiene 784 LOC, 251 de comentario; `internalRoute.js` 666, 235 de comentario. **No hay fichero de servidor por encima de 700 LOC de código**, así que no hay hallazgo de densidad en el servidor. El coste real es otro: B-23 y B-26 existen porque cada ruta monta su propia autorización.

### B-28 · LOW · A07 · CVSS 3.7 · NEW

`internalRoute.js:13` compara `x-task-secret` con `!==`. Lo mitiga el limitador de 10 peticiones por minuto (`server/app.js:105-111`). **Arreglo:** `crypto.timingSafeEqual` sobre búferes de igual longitud.

### B-29 · LOW · A01 · CVSS 3.8 · NEW

El propio código declara la deuda: `list-workspaces` oculta los personales (`internalRoute.js:39-44`), pero `list-boards` (`:57-78`) y `create-card` por id o por nombre (`:414-437`) no los excluyen (`:36-37`). Además, `ilike` no escapa `%` ni `_` en `assignee`, `workspaceName` y `boardName` (`:359-369`, `:437`, `:498`). Solo lo usa quien tiene `TASK_SECRET`, de ahí `PR:H`. **Arreglo:** rechazar destinos `type = 'personal'` en la escritura y escapar comodines. Ya tiene tarjeta.

### B-39 · LOW · A05 · CVSS 2.7 · NEW

Cuatro respuestas devuelven detalles internos:

- `authError.message` al registrarse (`auth.js:73`);
- `inviteError.message` al invitar (`admin.js:162`);
- los prefijos de id de organización en un 403 (`admin.js:239-241`);
- el mensaje de Supabase en un 500 (`admin.js:260`).

El manejador global ya hace lo correcto en producción (`server/app.js:221-223`).

### B-38 · LOW · A05 · NEW (B-05 queda FIXED)

Las cabeceras de mayo están en producción. Pero `script-src` incluye `'unsafe-inline'` (`netlify.toml:41`), y ni el `index.html` compilado ni `client/public/privacidad.html` (0 `<script>`) tienen scripts en línea. Sobra, y anula la defensa de la CSP ante inyección. `Referrer-Policy: no-referrer-when-downgrade` (`:38`) es más laxa que `strict-origin-when-cross-origin`.

### B-33 · LOW · NEW

`describe-service` de Railway (solo nombres, sin valores) lista `RESEND_API_KEY`, `SMTP_FROM`, `DIGEST_CRON_SECRET`, `DIGEST_HOUR`, `DIGEST_MINUTE`, `DIGEST_TO`, `USER_DIGEST_HOUR` y `USER_DIGEST_MINUTE`. ADR-027 retiró el correo y lo dejó como «limpieza pendiente» (`docs/ARCHITECTURE.md:320`). Una clave viva de un proveedor que ya no se usa es superficie sin función.

**Arreglo:** revocar la clave en Resend y borrar las ocho variables.

### B-31 · LOW · NEW

`pip-audit --path kanban-mcp/.venv/lib/python3.14/site-packages` (24-sep): `cryptography 49.0.0` → PYSEC-2026-3552 (arreglado en 50.0.0), y `pip 26.1.2` → PYSEC-2026-3721 (26.2). `mcp 1.28.1` y `httpx 0.28.1`, sin avisos. Es una herramienta local de la máquina del operador.

### B-35 · LOW · NEW

`cards.priority` es `TEXT` «sin CHECK en DB» (`supabase-schema.sql:248`). `createCard` guarda `priority || 'medium'` sin validar (`cards.js:156`), mientras que `updateCard` sí valida (`:229-231`).

### B-36 · LOW · NEW

`DELETE /api/workspaces/:id` borra tarjetas, columnas, tableros, miembros y el espacio en seis llamadas sin transacción, y solo mira el error de la última (`workspaces.js:360-386`). Un fallo intermedio deja el espacio a medio borrar.

### B-37 · LOW · NEW (decisión documentada)

El riel lee con la clave `service_role` desde la máquina del operador (`kanban-mcp/server.py:14-19,128-137`) y su cuenta es superadmin (`docs/ARCHITECTURE.md:308-313`). Las destructivas piden `confirm=true` (`server.py:697-740`). La clave que salta todas las políticas vive en un fichero local. Si algún día se revisa ADR-026, leer por la API con una cuenta `admin` reduce el radio.

### B-41 · LOW · NEW (B-10 queda FIXED)

El guardián de GRANT existe y corre en CI (lo que pedía B-10), pero lee `information_schema`, y `MAINTAIN` (PostgreSQL 17) no aparece ahí. `CLAUDE.md` lo documenta con la medición del 6-ago-2026. El esquema ya lo retira por defecto (`supabase-schema.sql:445-448`). El plazo de GRANT explícitos de Supabase vence el 30-oct-2026.

### B-32 · INFO

Alerta 1 del escaneo de secretos: «Resend API Key» en `b40944b:docs/DECISIONS.md:147`, filtrada en público, resuelta como `revoked` el 7-ago-2026. Hoy el escaneo y la protección en `push` están activos. No hay nada que hacer, salvo lo de B-33.

### B-14 · UNVERIFIABLE · `NV_CREDENTIALS` · UNCHANGED

El esquema declara índices en `cards(board_id)` pero no en `cards(column_id)` ni en `cards(assignee_id)` (`supabase-schema.sql:342-355`), y el código filtra por `column_id` en caminos frecuentes (`cards.js:141,547,549`; `columns.js:198`). Sin `EXPLAIN ANALYZE` no se puede afirmar que falten. **Acción:** `EXPLAIN ANALYZE` de esas consultas con una tabla de tamaño real.

### B-NV-01 · UNVERIFIABLE · `NV_RUNTIME`

`app.set('trust proxy', 1)` (`server/app.js:42`) confía en un solo salto, y la cadena tiene tres (Cloudflare → Netlify → Railway). Si `req.ip` resulta ser la IP del proxy, los límites por IP (`:87-111`) agrupan a usuarios distintos. **Acción:** registrar temporalmente `req.ip` y `X-Forwarded-For` en una petición real.

### B-NV-02 · UNVERIFIABLE · `NV_DASHBOARD`

El plan de Supabase, si hay PITR y la retención de las copias nativas se ven en el panel. La copia propia a R2 funciona: última corrida correcta de `db-backup.yml`, `35975083149`, 24-sep-2026.

## Delta contra mayo (hallazgos B)

| ID mayo | Estado mayo | Hoy | Nota |
|---|---|---|---|
| B-CRIT-01 | MITIGATED | FIXED | lista de tipos y control de contenido en su sitio (`uploads.js:49-90`); holgura residual en B-25 |
| B-CRIT-02 | MITIGATED | FIXED | copia diaria en verde; los adjuntos quedan fuera (B-34) |
| B-02 | MITIGATED | FIXED | acceso de 15 min (`auth.js:17`); sin revocación → B-27 |
| B-03 | PARTIAL | UNCHANGED | `customDomains: []` |
| B-04 | MITIGATED | FIXED | RLS y política en `organizations` (`supabase-schema.sql:453,466-467`) |
| B-05 | MITIGATED | FIXED | cabeceras en producción; endurecimiento en B-38 |
| B-06 | MITIGATED | FIXED | límites global, de auth e interno (`server/app.js:87-111,130,133,182`) |
| B-07 | MITIGATED | FIXED | rol revalidado contra la base (`middleware/auth.js:98-111`) |
| B-08 | open | UNCHANGED | otros paquetes, misma situación |
| B-09 | MITIGATED | FIXED | `internalLimiter` |
| B-10 | open | FIXED | guardián de GRANT en CI; punto ciego en B-41 |
| B-11 | MITIGATED | FIXED | RLS en las 10 tablas (`supabase-schema.sql:453-462`) |
| B-12 | open | UNCHANGED | alcance por organización (DOC-05) |
| B-14 | open | UNCHANGED | sigue sin medir |
| B-15 | aceptado | obsoleto | el digest se retiró (ADR-027) |
| B-16 | open | UNCHANGED | — |
| B-17 | open | FIXED | `bcryptjs` ya no está en `package.json` |
| B-18 | referencia | ver A-10 | — |
| B-19 | informativo | — | — |

## Lagunas de herramienta

- **Sin `semgrep` ni `trivy`:** la revisión de seguridad es lectura manual.
- **Sin acceso a la base viva:** `psql` está bloqueado por el enganche de secretos, y no se rodeó. Las afirmaciones sobre RLS se apoyan en el esquema declarado (`docs/schema/supabase-schema.sql`), que el repo presenta como espejo de producción. Las políticas vivas no las vigila ningún guardián (B-21).
- **Historial de ficheros de secretos:** el enganche bloquea la orden que los nombra, y no se rodeó. Se cubrió con el escaneo de secretos de GitHub (B-32).
