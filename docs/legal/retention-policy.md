# Política de Retención de Datos

**Marco legal:** RGPD Art. 5(1)(e) — limitación del plazo de conservación. RGPD Art. 13(2)(a) — información al titular del plazo. LGPD Art. 15. Ley 21.719 — principio de proporcionalidad.
**Última actualización:** 2026-09-13 *(v1.2 — la supresión es a petición)*

> RGPD obliga a definir y comunicar plazos de retención. **Este documento y la política
> publicada (`privacy-policy-kanban.md` §6, y su HTML en `client/public/privacidad.html`)
> dicen lo mismo.** Si alguna vez no lo dicen, el defecto es de los dos.
>
> ⚠️ **Decidido por el Operador el 2026-09-12 (tarjeta `0779da47`): la supresión es a
> petición, no por calendario.** Hasta esa fecha este documento era un borrador con plazos
> automáticos «sugeridos» que **nunca se implementaron**, y la política publicada los
> prometía al titular como si ocurrieran. Los 🟠 PENDIENTE de abajo quedan resueltos por
> esa decisión.
>
> La supresión automática **no se descarta: se aparca con disparador** —el día que esta
> aplicación se ofrezca a un tercero— en la tarjeta `9167d685`. Ese día se construye, se
> prueba que borra, y se vuelve a prometer. No antes.

---

## Principios

1. **Necesidad:** datos conservados solo mientras sean necesarios para la finalidad.
2. **Transparencia:** plazos comunicados al titular en política privacidad — **y solo los que ocurren de verdad.**
3. **Supresión a petición, no automática.** Aquí decía «supresión automática: preferida sobre supresión manual». Era una preferencia sin mecanismo: se retira. La única supresión automática que existe es la rotación de las copias de seguridad a los 30 días.
4. ~~**Soft delete + hard delete**~~ — **no aplicado hoy.** Ninguna tabla tiene marca de borrado lógico: lo que se elimina, se elimina físicamente. Queda como diseño para `9167d685`.

---

## Plazos propuestos por categoría

### Cuentas de usuario (`auth.users` + `public.users`)

| Estado | Retención |
|---|---|
| Usuario activo | Indefinida mientras cuenta activa |
| Usuario solicita supresión (RGPD Art. 17) | Hard-delete en 30 días desde solicitud verificada |
| Usuario sin login >24 meses | **Sin supresión por inactividad** (decidido 2026-09-12). La cuenta se conserva hasta que se pida su supresión. |
| Backup snapshots con la cuenta | 30 días (sin auto-supresión retroactiva en backups — limitación técnica común aceptable según AEPD) |

### Workspaces (`public.workspaces` + `workspace_members`)

| Estado | Retención |
|---|---|
| Workspace activo | Indefinida |
| Workspace archivado por owner | **No existe el archivado de workspaces.** Se conservan hasta que alguien con permiso los elimina. |
| Último miembro abandona | **Se conserva.** Sin supresión automática (decidido 2026-09-12). |

### Cards y contenido (`public.cards` + `columns` + `boards`)

| Estado | Retención |
|---|---|
| Card, en cualquier columna | Indefinida mientras exista. Se suprime cuando un miembro la elimina, o al eliminarse su tablero o su workspace. |
| Card en columna "done"/"archive" | **Igual que cualquier otra.** No existe el archivado de cards, y no hay supresión por calendario (decidido 2026-09-12). |
| Card sin actividad >12 meses | **Se conserva.** Sin archivado automático ni supresión. |
| Tras supresión de usuario que creó la card | Card permanece (owner queda null por `ON DELETE SET NULL`) — workspace ownership conserva |

### Adjuntos (`server/uploads/` + Supabase Storage)

| Estado | Retención |
|---|---|
| Adjunto referenciado por card activa | Mientras card activa |
| Adjunto huérfano (card eliminada, attachment quedó) | **Se conserva: no hay limpieza automática.** Se elimina a petición (`DELETE /api/uploads/:filename`). |
| Avatares de usuarios | Mientras cuenta activa. Tras supresión cuenta: 30 días |

### Notificaciones (`public.notifications`)

| Estado | Retención |
|---|---|
| Notificación, leída o no | **Mientras exista la cuenta del destinatario.** No se suprime por calendario (decidido 2026-09-12). |
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

### Cron de retention — **aparcado con disparador**, no pendiente

**No se construye ahora, y es una decisión, no un olvido** (Operador, 2026-09-12). Vive en
la tarjeta `9167d685`, que tiene un solo disparador: el día que esta aplicación se ofrezca
a un tercero. Lo de abajo se conserva como **punto de partida para ese día**, no como
trabajo en cola.

⚠️ **Y su primera versión tiene que solo INFORMAR de qué borraría**, probada contra datos de
prueba antes de tocar producción: borrar por calendario es irreversible por diseño.

Diseño previo: `.github/workflows/retention-cron.yml` con cadencia semanal (domingo 04:00 UTC):

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

**Lo que haría falta ese día** (no hoy — ver `9167d685`):
- Schema: añadir `archived_at` a `workspaces` + `cards`
- Workflow: crear `.github/workflows/retention-cron.yml`
- Aviso previo a usuarios afectados. ⚠️ **No por correo: esta aplicación ya no envía correo** desde el 25-ago-2026.
- Audit log de cada retention sweep (qué se borró)
- Una prueba que se ponga roja si deja de borrar

---

## Excepciones legales

Casos donde la retención propuesta NO aplica:

1. **Procesos judiciales / requerimientos autoridad:** retener hasta que el procedimiento finalice (RGPD Art. 17(3)(b)).
2. **Obligaciones fiscales/contables AGLAYA:** datos de facturación retenidos según legislación brasileña/española (típicamente 5 años post emisión).
3. **Backup snapshots:** la supresión no aplica retroactivamente a snapshots ya creados — política industria aceptada por AEPD/ANPD.

---

## Comunicación al titular

Los plazos que se comunican al titular **viven en la política publicada**, §6 de
`privacy-policy-kanban.md` y su HTML `client/public/privacidad.html`. **No se copian aquí.**

Aquí había una plantilla con los plazos escritos otra vez —cards archivadas a 24 meses,
notificaciones leídas a 90 días, registros de correo a 12-24 meses— y apuntaba a un
fichero `privacy-policy-kanban.draft.md` que ya no existe. **Era una tercera copia del
mismo hecho, y las tres acabaron diciendo cosas distintas.** Se retira: lo que hay que
comunicar se lee en la política, y este documento dice por qué.

`server/tests/politica-publicada.test.js` fija que la tabla publicada no vuelva a
afirmar supresiones automáticas.

---

## Acciones pendientes (operador)

- [x] ~~Decidir retention exacta para cards archivadas~~ — **decidido 2026-09-12: a petición, sin plazo automático**
- [x] ~~Decidir retention para workspaces archivados~~ — **decidido 2026-09-12: a petición**; el archivado no existe
- [x] ~~Decidir auto-delete cuentas inactivas~~ — **decidido 2026-09-12: sin supresión por inactividad**
- [x] ~~Decidir retention `digest_logs`~~ — sin objeto: la tabla se suprimió el 25-ago-2026
- [x] ~~Implementar `archived_at` en schema~~ — **aparcado con disparador en `9167d685`**, no pendiente
- [x] ~~Implementar workflow `retention-cron.yml`~~ — **aparcado con disparador en `9167d685`**, no pendiente
- [x] ~~Implementar pre-deletion email aviso~~ — **sin objeto**: la aplicación ya no envía correo; si algún día hace falta aviso, no será por ahí
- [x] ~~Actualizar política privacidad kanban con plazos finales~~ — **hecho en su v1.3 (2026-09-13)**

*Se tachan en vez de borrarse: una casilla vacía en un documento legal se lee como un
pendiente sin dueño, y una casilla borrada no deja rastro de que la pregunta existió.*
