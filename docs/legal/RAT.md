# Registro de Actividades de Tratamiento (RAT)

**Marco legal:** RGPD Art. 30 (Registro de actividades de tratamiento) + LGPD Art. 37 (Registro das atividades de tratamento) + Ley 21.719 Chile (registro interno)
**Última actualización:** 2026-08-25 *(v1.1 — el correo cesa; ver Actividades 3 y 5)*
**Responsable del tratamiento:** Antonio Ibai Fernández Gutiérrez (AGLAYA) — Rua Palestina s/n, Belo Horizonte, MG, Brasil, CEP 30850-000 — info@aglaya.biz

> **Nota legal:** RGPD Art. 30 obliga al responsable a llevar un registro escrito de actividades de tratamiento. Este documento es la **fuente de verdad operativa** del proyecto AGLAYA Kanban Desk. Debe revisarse trimestralmente o tras cualquier cambio de schema/integración.

---

## Actividad 1 — Gestión de cuentas de colaboradores

| Campo | Valor |
|---|---|
| **Finalidad** | Permitir acceso autenticado al kanban a colaboradores AGLAYA |
| **Base legal** | Ejecución del contrato laboral / acuerdo de colaboración (RGPD Art. 6(1)(b)) |
| **Categorías de titulares** | Empleados AGLAYA, freelancers contratados, clientes externos invitados a workspaces |
| **Categorías de datos** | Email, nombre completo, role (superadmin/admin/colaborador/cliente/guest), organization_id, avatar_url |
| **Categorías de destinatarios** | Internos: equipo AGLAYA con role admin. Externos: Supabase (Auth + DB), Railway (server hosting) |
| **Transferencias internacionales** | Brasil (Supabase sa-east-1), US (Railway, Cloudflare, GitHub Actions). Ver `subprocessors.md` |
| **Plazo de conservación** | Mientras relación contractual activa. Tras baja del colaborador: 30 días para hard-delete (ver `retention-policy.md`) |
| **Medidas de seguridad** | Ver `TOMs.md` — bcrypt en Supabase Auth, JWT firmado HS256, RLS habilitada en DB, HTTPS obligatorio |

---

## Actividad 2 — Gestión de tareas y trabajo del equipo (cards)

| Campo | Valor |
|---|---|
| **Finalidad** | Organización de trabajo interno + colaboración con clientes en workspaces "externos" |
| **Base legal** | Ejecución contractual + interés legítimo (RGPD Art. 6(1)(b) + 6(1)(f)) |
| **Categorías de titulares** | Colaboradores AGLAYA, clientes finales (en workspaces tipo "externo") |
| **Categorías de datos** | Títulos y descripciones de cards (contenido libre — **posible PII en función del uso**), comentarios, checklist items, asignaciones (user_id), adjuntos (filenames + storage URLs), fechas, prioridades, etiquetas |
| **Categorías de destinatarios** | Miembros del workspace (verificado por `requireWorkspaceMember` middleware) |
| **Transferencias internacionales** | Brasil (Supabase) + US/Global (Railway/Netlify/Cloudflare R2 para backups) |
| **Plazo de conservación** | Cards activas: mientras workspace activo. Cards archivadas: **pendiente decisión operador** (sugerido 24 meses post-archive). Attachments huérfanos: pendiente auto-cleanup runbook |
| **Medidas de seguridad** | RLS por workspace_id, ON DELETE CASCADE en FK, uploads con magic-bytes validation (post B-CRIT-01 audit) |
| **⚠️ Riesgo especial** | Cards pueden contener categorías especiales Art. 9 RGPD (datos salud, religión, sindicales) si usuarios las introducen libremente. **Decisión pendiente operador: prohibición explícita en T&C o filtrado automático** |

---

## Actividad 3 — Notificaciones dentro de la aplicación

| Campo | Valor |
|---|---|
| **Finalidad** | Avisar al usuario sobre asignaciones, due dates, menciones |
| **Base legal** | Ejecución contractual (RGPD Art. 6(1)(b)) |
| **Categorías de titulares** | Colaboradores con account activa |
| **Categorías de datos** | user_id, contenido de notificación (referencia a card/comment), timestamp |
| **Categorías de destinatarios** | Ninguno externo: la notificación no sale del sistema |
| **Transferencias internacionales** | Ninguna |
| **Plazo de conservación** | Notificaciones leídas: 90 días |
| **Opt-out** | No hay opt-out: el aviso está ligado al uso del servicio y no sale de él |

> **⏹ El envío por correo de esta actividad CESÓ el 25-ago-2026.** Hasta esa fecha
> esta finalidad incluía un resumen diario por email, con base de consentimiento
> —un `toggle` de preferencias—, destinatario **Resend Inc.** y transferencia a
> Estados Unidos. Se retiró el envío entero; lo que queda es el aviso in-app, que
> no sale del sistema y por eso ya no tiene destinatario externo ni transferencia.
>
> **La actividad se marca como cesada en lugar de borrarse:** hubo datos tratados
> de verdad entre el 27-may y el 25-ago-2026, y un registro del Art. 30 que borra
> su pasado no puede responder qué se hizo con los datos de alguien entonces.

---

## Actividad 4 — Backups operacionales (post B-CRIT-02 audit)

| Campo | Valor |
|---|---|
| **Finalidad** | Continuidad de negocio + recuperación ante incidentes |
| **Base legal** | Obligación legal de seguridad (RGPD Art. 32) + interés legítimo |
| **Categorías de titulares** | Todos los usuarios del sistema (snapshot completo DB) |
| **Categorías de datos** | Dump completo Postgres (auth + public schema) — incluye TODA la PII del sistema |
| **Categorías de destinatarios** | Cloudflare R2 (storage europeo WEUR — Western Europe) |
| **Transferencias internacionales** | Cloudflare = US incorporada pero los buckets WEUR almacenan en EU |
| **Plazo de conservación** | 30 días automática (workflow `db-backup.yml`) |
| **Cifrado** | TLS in-transit. Cloudflare R2 encrypted at rest por defecto |

---

## Actividad 5 — Audit trail de envíos de correo (`digest_logs`) · ⏹ **CESADA**

| Campo | Valor |
|---|---|
| **Estado** | **Cesada el 25-ago-2026.** El tratamiento no existe y sus datos fueron **suprimidos** |
| **Finalidad (mientras estuvo activa)** | Trazabilidad de envíos de email (compliance + debugging) |
| **Base legal** | Interés legítimo del responsable (RGPD Art. 6(1)(f)) |
| **Categorías de titulares** | Cualquier user que recibía email |
| **Categorías de datos** | Tipo (admin/user), recipient email, status (sent/failed), error message, timestamp, user_id |
| **Plazo de conservación anunciado** | 12 meses (política v1.0) |
| **Destino real de los datos** | **Supresión total el 25-ago-2026**, antes de agotar ese plazo, al retirarse el correo. No se conservó copia |
| **Medidas (mientras existió)** | RLS — solo admins leían el audit trail |

> **Se conserva esta entrada, vacía de tratamiento, a propósito.** Es la única
> constancia de que entre el 27-may y el 25-ago-2026 existió un registro con
> direcciones de correo de titulares. Borrar la entrada haría desaparecer también
> esa constancia, que es lo contrario de lo que un registro del Art. 30 sirve.

---

## Resumen de PII por tabla DB

| Tabla | PII contenida | Sensibilidad |
|---|---|---|
| `auth.users` (Supabase Auth) | email, password hash, last_sign_in, IP de último login | 🔴 ALTA |
| `public.users` | email, name, role, organization_id | 🟠 MEDIA |
| `public.organizations` | name, slug, plan | 🟢 BAJA (datos corporativos, no personales directo) |
| `public.workspaces` | name, emoji, type, organization_id, created_by | 🟢 BAJA |
| `public.workspace_members` | user_id, workspace_id, role, invited_by | 🟢 BAJA (referencias) |
| `public.boards` | title, workspace_id | 🟡 MEDIA-BAJA (puede contener PII en título) |
| `public.columns` | title, board_id | 🟡 MEDIA-BAJA |
| `public.cards` | title, description (texto libre), priority, due_date, owner_id, organization_id, **checklist** (con asignaciones + texto libre), **attachments** (filenames + URLs) | 🔴 ALTA — texto libre puede contener cualquier categoría de datos |
| `public.categories` | name, color | 🟢 BAJA |
| `public.notifications` | user_id, type, payload (referencia a card), read_at | 🟢 BAJA |
| ~~`public.digest_logs`~~ | *(tabla suprimida el 25-ago-2026; contenía user_id, email de destinatario, estado, mensaje de error y timestamp)* | — |

---

## Decisiones pendientes operador

Marcadas en `docs/legal/README.md` — sin estas decisiones el RAT queda como borrador:

1. Retention exacta cards archivadas/comments/attachments
2. Política sobre categorías especiales RGPD Art. 9 en cards (texto libre)
3. DPO designación + email dedicado
4. Representante UE (RGPD Art. 27)
