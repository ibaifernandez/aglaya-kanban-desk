# Política de Retención de Datos

**Marco legal:** RGPD Art. 5(1)(e) — limitación del plazo de conservación. RGPD Art. 13(2)(a) — información al titular del plazo. LGPD Art. 15. Ley 21.719 — principio de proporcionalidad.
**Última actualización:** 2026-08-25 *(v1.1 — cesa el correo)*

> RGPD obliga a definir y comunicar plazos de retención. Este documento es **borrador inicial** — los plazos exactos requieren decisión del operador (marcado 🟠 PENDIENTE DECISIÓN).

---

## Principios

1. **Necesidad:** datos conservados solo mientras sean necesarios para la finalidad.
2. **Transparencia:** plazos comunicados al titular en política privacidad.
3. **Supresión automática:** preferida sobre supresión manual.
4. **Soft delete + hard delete:** datos marcados como eliminados primero (soft) y borrados físicamente (hard) tras período de gracia.

---

## Plazos propuestos por categoría

### Cuentas de usuario (`auth.users` + `public.users`)

| Estado | Retención |
|---|---|
| Usuario activo | Indefinida mientras cuenta activa |
| Usuario solicita supresión (RGPD Art. 17) | Hard-delete en 30 días desde solicitud verificada |
| Usuario sin login >24 meses | 🟠 **PENDIENTE DECISIÓN**: ¿auto-eliminación? ¿email aviso 30 días antes? |
| Backup snapshots con la cuenta | 30 días (sin auto-supresión retroactiva en backups — limitación técnica común aceptable según AEPD) |

### Workspaces (`public.workspaces` + `workspace_members`)

| Estado | Retención |
|---|---|
| Workspace activo | Indefinida |
| Workspace archivado por owner | 🟠 **PENDIENTE**: sugerido 12 meses post-archive, después hard-delete |
| Último miembro abandona | 🟠 **PENDIENTE**: ¿soft-delete inmediato? ¿buffer 30 días recovery? |

### Cards y contenido (`public.cards` + `columns` + `boards`)

| Estado | Retención |
|---|---|
| Card en columna activa | Indefinida mientras workspace activo |
| Card en columna "done"/"archive" | 🟠 **PENDIENTE**: sugerido 24 meses, después hard-delete |
| Card sin actividad >12 meses (no edita, no mueve, no comenta) | 🟠 **PENDIENTE**: ¿auto-archive? |
| Tras supresión de usuario que creó la card | Card permanece (owner queda null por `ON DELETE SET NULL`) — workspace ownership conserva |

### Adjuntos (`server/uploads/` + Supabase Storage)

| Estado | Retención |
|---|---|
| Adjunto referenciado por card activa | Mientras card activa |
| Adjunto huérfano (card eliminada, attachment quedó) | 🟠 **PENDIENTE**: cron de cleanup mensual sugerido — borrar tras 90 días huérfano |
| Avatares de usuarios | Mientras cuenta activa. Tras supresión cuenta: 30 días |

### Notificaciones (`public.notifications`)

| Estado | Retención |
|---|---|
| Notificación no leída | Indefinida hasta lectura o cleanup |
| Notificación leída | **Sugerido 90 días** post-`read_at` |
| Notificaciones tras supresión usuario | Hard-delete inmediato (`ON DELETE CASCADE` ya configurado) |

### ~~Audit trail (`public.digest_logs`)~~ · ⏹ **SUPRIMIDO**

| Estado | Retención |
|---|---|
| Logs de envío de correo | **Suprimidos de la base el 25-ago-2026.** Persisten en copias operacionales hasta su rotación (~24-sep-2026), igual que el resto de datos — ver §3 y el punto 3 de las limitaciones |

La política publicada anunciaba 12 meses. Al retirarse el correo, el registro se
**destruyó antes de agotar ese plazo** — que es la dirección segura del error:
se conservó menos de lo anunciado, no más.

⚠️ **Y una corrección del 26-ago-2026:** este documento y la política publicada
decían *«no queda copia»*. **No era cierto, y se desmentía dos filas más abajo**
en la misma tabla: las copias diarias a Cloudflare R2 vuelcan la base **entera**
—`pg_dump` sin exclusiones— y se conservan **30 días**. Se tomaron copias el
25-ago a las 15:14Z y 15:18Z, y el `DROP` fue hacia las 20:30Z del mismo día.

La excepción de las copias **ya estaba declarada aquí** (§3 y limitación 3) y es
legítima; lo que fallaba era una frase absoluta escrita al lado. **Nadie había
listado el bucket** —no hay credencial para hacerlo— así que se afirmó lo que no
se podía comprobar. Lo comprobable es la ventana, y es lo que ahora se declara.

Se deja la entrada, vacía: es la constancia de que ese registro existió.

### Backups operacionales (Cloudflare R2)

| Estado | Retención |
|---|---|
| Backup diario | **30 días automática** (configurado en `db-backup.yml` workflow) |
| Backup forensic (pre-restore) | 🟠 sugerido 90 días — runbook db-restore.md lo crea bajo demanda |

### Logs Railway / Netlify / Cloudflare

| Procesador | Retención (por el procesador) |
|---|---|
| Railway logs | Según plan Railway — typical 7-30 días |
| Netlify function logs | 7 días (declarado en política aglaya.biz para aglaya.biz, mismo para kanban) |
| Cloudflare access logs | Plan free típicamente sin logs persistentes |

---

## Implementación técnica

### Cron de retention (NO implementado todavía)

Sugerido workflow `.github/workflows/retention-cron.yml` con cadencia semanal (domingo 04:00 UTC):

```yaml
# Pseudo-código de las queries que ejecutaría:

-- 1. Notificaciones leídas >90d
DELETE FROM public.notifications
WHERE read_at < NOW() - INTERVAL '90 days';

-- 2. Cards en columnas "done" >24 meses sin actividad
DELETE FROM public.cards
WHERE column_id IN (
  SELECT id FROM public.columns
  WHERE title ~* '✅|hecho|done|entregado|completado'
)
AND updated_at < NOW() - INTERVAL '24 months';

-- 3. Adjuntos huérfanos >90d
-- (requiere cleanup en Supabase Storage + server/uploads/)

-- 4. Workspaces archivados >12 meses sin actividad
-- (requiere campo `archived_at` en schema — TODO)
```

**Pendiente:**
- Schema: añadir `archived_at` a `workspaces` + `cards`
- Workflow: crear `.github/workflows/retention-cron.yml`
- Pre-deletion email aviso a usuarios afectados (30 días antes)
- Audit log de cada retention sweep (qué se borró)

---

## Excepciones legales

Casos donde la retención propuesta NO aplica:

1. **Procesos judiciales / requerimientos autoridad:** retener hasta que el procedimiento finalice (RGPD Art. 17(3)(b)).
2. **Obligaciones fiscales/contables AGLAYA:** datos de facturación retenidos según legislación brasileña/española (típicamente 5 años post emisión).
3. **Backup snapshots:** la supresión no aplica retroactivamente a snapshots ya creados — política industria aceptada por AEPD/ANPD.

---

## Comunicación al titular

La política privacidad publicada (`privacy-policy-kanban.draft.md`) DEBE incluir resumen de plazos:

```markdown
## Plazo de conservación

Conservamos tus datos personales únicamente mientras sean necesarios para la
finalidad descrita. Plazos específicos:

- Datos de cuenta: mientras tu cuenta esté activa. Tras solicitud de supresión:
  borrado en 30 días.
- Contenido de cards: mientras el workspace asociado esté activo. Cards
  archivadas: 24 meses adicionales, después borrado.
- Notificaciones leídas: 90 días.
- Audit logs de envío de email: 12-24 meses.
- Backups: 30 días con rotación automática.
```

---

## Acciones pendientes (operador)

- [ ] Decidir retention exacta para cards archivadas (sugerido 24 meses)
- [ ] Decidir retention para workspaces archivados (sugerido 12 meses)
- [ ] Decidir auto-delete cuentas inactivas (sugerido aviso 24m + delete a 27m)
- [x] ~~Decidir retention `digest_logs`~~ — sin objeto: la tabla se suprimió el 25-ago-2026
- [ ] Implementar `archived_at` en schema (cards, workspaces)
- [ ] Implementar workflow `retention-cron.yml`
- [ ] Implementar pre-deletion email aviso
- [ ] Actualizar política privacidad kanban con plazos finales
