# Registro de Actividades de Tratamiento (RAT)

**Marco legal:** RGPD Art. 30 (Registro de actividades de tratamiento) + LGPD Art. 37 (Registro das atividades de tratamento) + Ley 21.719 Chile (registro interno)
**Última actualización:** 2026-05-27
**Responsable del tratamiento:** Antonio Ibai Fernández Gutiérrez (AGLAYA) — Rua Palestina s/n, Belo Horizonte, MG, Brasil, CEP 30850-000 — info@aglaya.biz

> **Nota legal:** RGPD Art. 30 obliga al responsable a llevar un registro escrito de actividades de tratamiento. Este documento es la **fuente de verdad operativa** del proyecto AGLAYA Kanban Desk. Debe revisarse trimestralmente o tras cualquier cambio de schema/integración.

---

## Actividad 1 — Gestión de cuentas de colaboradores

| Campo | Valor |
|---|---|
| **Finalidad** | Permitir acceso autenticado al kanban a colaboradores AGLAYA |
| **Base legal** | Ejecución del contrato laboral / acuerdo de colaboración (RGPD Art. 6(1)(b)) |
| **Categorías de titulares** | Empleados AGLAYA, freelancers contratados, clientes externos invitados a workspaces |
| **Categorías de datos** | Email, nombre completo, role (superadmin/admin/colaborador/cliente/guest), organization_id, avatar_url, preferencias digest (hora + opt-out) |
| **Categorías de destinatarios** | Internos: equipo AGLAYA con role admin. Externos: Supabase (Auth + DB), Resend (emails transaccionales), Railway (server hosting) |
| **Transferencias internacionales** | Brasil (Supabase sa-east-1), US (Resend, Railway, Cloudflare, GitHub Actions). Ver `subprocessors.md` |
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

## Actividad 3 — Notificaciones in-app y digest emails

| Campo | Valor |
|---|---|
| **Finalidad** | Avisar al usuario sobre asignaciones, due dates, menciones |
| **Base legal** | Ejecución contractual (RGPD Art. 6(1)(b)) + consentimiento granular para opt-out (RGPD Art. 6(1)(a)) |
| **Categorías de titulares** | Colaboradores con account activa |
| **Categorías de datos** | Email destinatario, user_id, hora preferida digest, contenido de notificación (referencia a card/comment), timestamp |
| **Categorías de destinatarios** | Resend (proveedor email US) — sin acceso a contenido más allá del email body que enviamos |
| **Transferencias internacionales** | US (Resend) |
| **Plazo de conservación** | Notificaciones leídas: 90 días. Digest_logs (audit trail): **pendiente decisión** (sugerido 12 meses) |
| **Opt-out** | `users.digest_enabled = false` deshabilita digest. Notificaciones in-app actualmente no opt-out (mejora pendiente) |

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

## Actividad 5 — Audit trail (digest_logs)

| Campo | Valor |
|---|---|
| **Finalidad** | Trazabilidad de envíos de email (compliance + debugging) |
| **Base legal** | Interés legítimo del responsable (RGPD Art. 6(1)(f)) |
| **Categorías de titulares** | Cualquier user que recibe email |
| **Categorías de datos** | Tipo (admin/user), recipient email, status (sent/failed), error message, timestamp, user_id |
| **Plazo de conservación** | **Pendiente decisión** (sugerido 12-24 meses) |
| **Medidas** | RLS — solo admins leen audit trail |

---

## Resumen de PII por tabla DB

| Tabla | PII contenida | Sensibilidad |
|---|---|---|
| `auth.users` (Supabase Auth) | email, password hash, last_sign_in, IP de último login | 🔴 ALTA |
| `public.users` | email, name, role, organization_id, digest preferences | 🟠 MEDIA |
| `public.organizations` | name, slug, plan | 🟢 BAJA (datos corporativos, no personales directo) |
| `public.workspaces` | name, emoji, type, organization_id, created_by | 🟢 BAJA |
| `public.workspace_members` | user_id, workspace_id, role, invited_by | 🟢 BAJA (referencias) |
| `public.boards` | title, workspace_id | 🟡 MEDIA-BAJA (puede contener PII en título) |
| `public.columns` | title, board_id | 🟡 MEDIA-BAJA |
| `public.cards` | title, description (texto libre), priority, due_date, owner_id, organization_id, **checklist** (con asignaciones + texto libre), **attachments** (filenames + URLs) | 🔴 ALTA — texto libre puede contener cualquier categoría de datos |
| `public.categories` | name, color | 🟢 BAJA |
| `public.notifications` | user_id, type, payload (referencia a card), read_at | 🟢 BAJA |
| `public.digest_logs` | user_id, email recipient, status, errorMsg, timestamp | 🟠 MEDIA |

---

## Decisiones pendientes operador

Marcadas en `docs/legal/README.md` — sin estas decisiones el RAT queda como borrador:

1. Retention exacta cards archivadas/comments/attachments
2. Política sobre categorías especiales RGPD Art. 9 en cards (texto libre)
3. DPO designación + email dedicado
4. Representante UE (RGPD Art. 27)
