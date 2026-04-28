# Manual Testing Guide — Iteraciones 1 y 2

**Objetivo:** Verificar que todas las features de Iteration 1 y 2 funcionan correctamente  
**Fecha:** 2026-04-27 / Completado: 2026-04-28  
**Status:** ✅ COMPLETADO — todos los tests pasados en producción

---

## Prerequisitos

Antes de empezar, verifica:

1. **Migration aplicada en Supabase:**
   - [ ] Ir a Supabase SQL editor
   - [ ] Copiar todo el SQL de `migrations/create_digest_logs.sql`
   - [ ] Ejecutar el SQL
   - [ ] Verificar que la tabla `digest_logs` existe en Supabase

2. **Server corriendo en localhost:3003:**
   ```bash
   npm run dev  # o preview_start
   ```
   - [ ] Server inicia sin errores
   - [ ] Logs muestran: "AGLAYA Kanban Desk server → http://localhost:3003"

3. **Admin token disponible:**
   - [ ] Tienes un JWT token válido como admin/superadmin user
   - [ ] Puedes hacer requests autenticados

---

## ITERATION 1 — Validación SMTP, Desfase Cron, Feedback Visual

### Test 1.1: Validación SMTP en Startup

**Objetivo:** Verificar que el servidor valida las variables SMTP en startup (fail-fast)

**Pasos:**
1. Revisa los logs del servidor al iniciar
2. Busca estas líneas:
   ```
   AGLAYA Kanban Desk server → http://localhost:3003
   [digest] Scheduler started — daily at 07:00 local time
   [userDigest] Scheduler started — daily at 08:00 local time
   ```

**Resultado esperado:**
- ✅ Server inicia sin errores
- ✅ Ambos schedulers se registran
- ✅ No hay mensajes de error sobre SMTP

**Verificación:**
- [ ] Server started successfully
- [ ] Logs muestran 07:00 y 08:00

---

### Test 1.2: Desfase de Cron Jobs

**Objetivo:** Verificar que admin digest corre a 7 AM y user digest a 8 AM

**Pasos:**
1. En los logs de startup, busca exactamente:
   ```
   [digest] Scheduler started — daily at 07:00 local time
   [userDigest] Scheduler started — daily at 08:00 local time
   ```

**Resultado esperado:**
- ✅ Admin digest: 07:00 (no 08:00)
- ✅ User digest: 08:00 (no 07:00)
- ✅ Diferencia de 1 hora = desfase OK

**Verificación:**
- [ ] 07:00 para admin digest
- [ ] 08:00 para user digest
- [ ] 1 hora de diferencia

**Nota:** Si ves el mismo horario para ambos, hay un problema en las env vars.

---

### Test 1.3: Feedback Visual — Endpoint Síncrono

**Objetivo:** Verificar que `POST /api/digest/send-me` espera la respuesta SMTP y da feedback

**Pasos:**

1. **Obtén un admin token:**
   ```bash
   # O usa postman/insomnia para obtener token
   ADMIN_TOKEN="tu_jwt_token_aqui"
   ```

2. **Trigger el endpoint con curl:**
   ```bash
   curl -X POST http://localhost:3003/api/digest/send-me \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json"
   ```

3. **Verifica la respuesta:**

   **Si SMTP está OK:**
   ```json
   {
     "ok": true,
     "message": "Digest enviado a info@ibaifernandez.com."
   }
   ```

   **Si SMTP falla o timeout:**
   ```json
   {
     "ok": false,
     "error": "Error al enviar digest: SMTP connection failed"
   }
   ```

**Resultado esperado:**
- ✅ Response es síncrona (no async)
- ✅ `ok: true` = envío fue exitoso
- ✅ `ok: false` = hubo error (feedback inmediato)
- ✅ No `message: "en camino"` (antes sí decía eso)

**Verificación:**
- [ ] Response time < 2 segundos (esperando SMTP)
- [ ] Status 200 = éxito
- [ ] Status 500 = error (y mensaje claro)

---

### Test 1.4: Endpoint User Digest con Timeout

**Objetivo:** Verificar que `POST /api/digest/send-my-digest` también es síncrono

**Pasos:**

1. **Trigger el endpoint:**
   ```bash
   ADMIN_TOKEN="tu_jwt_token_aqui"
   curl -X POST http://localhost:3003/api/digest/send-my-digest \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json"
   ```

2. **Verifica respuesta:**
   - Si user tiene tareas accionables:
     ```json
     {
       "ok": true,
       "message": "Tu digest personal enviado a user@example.com."
     }
     ```
   - Si no hay tareas:
     ```json
     {
       "ok": true,
       "message": "No tienes tareas accionables ahora mismo."
     }
     ```

**Resultado esperado:**
- ✅ Respuesta síncrona (espera SMTP)
- ✅ `ok: true` = éxito
- ✅ Status 200 o 500 según resultado

**Verificación:**
- [ ] Respuesta recibida en < 10s
- [ ] `ok` field siempre presente

---

## ITERATION 2 — Audit Logs y Endpoint de Queries

### Test 2.1: Tabla digest_logs Creada en Supabase

**Objetivo:** Verificar que la tabla existe y tiene las columnas correctas

**Pasos:**

1. **En Supabase SQL editor:**
   ```sql
   SELECT * FROM digest_logs LIMIT 1;
   ```

**Resultado esperado:**
- ✅ Tabla existe
- ✅ 0 filas (está vacía al principio)
- ✅ Columnas visibles: id, type, user_id, recipient, status, error_msg, created_at, updated_at

**Verificación:**
- [ ] Tabla digest_logs existe
- [ ] 8 columnas presentes

---

### Test 2.2: Logging en Envío Admin Digest

**Objetivo:** Verificar que cuando se envía un admin digest, se registra en tabla

**Pasos:**

1. **Cuenta logs antes:**
   ```sql
   SELECT COUNT(*) FROM digest_logs WHERE type = 'admin';
   ```
   (Nota el número, ej: 5)

2. **Trigger endpoint:**
   ```bash
   ADMIN_TOKEN="tu_token"
   curl -X POST http://localhost:3003/api/digest/send-me \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

3. **Espera 2 segundos y cuenta logs después:**
   ```sql
   SELECT COUNT(*) FROM digest_logs WHERE type = 'admin';
   ```
   (Debería ser: 5 + 1 = 6)

4. **Verifica el log específico:**
   ```sql
   SELECT * FROM digest_logs 
   WHERE type = 'admin' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

**Resultado esperado:**
- ✅ Nuevo registro aparece
- ✅ type = 'admin'
- ✅ recipient = 'info@ibaifernandez.com' (o tu DIGEST_TO)
- ✅ status = 'sent' (si email se envió)
- ✅ error_msg = NULL

**Verificación:**
- [ ] Count aumentó en 1
- [ ] Nuevo registro tiene type='admin'
- [ ] status='sent' y error_msg=NULL

---

### Test 2.3: Logging en Envío User Digest

**Objetivo:** Verificar que user digests también se registran

**Pasos:**

1. **Cuenta logs user antes:**
   ```sql
   SELECT COUNT(*) FROM digest_logs WHERE type = 'user';
   ```

2. **Trigger endpoint:**
   ```bash
   curl -X POST http://localhost:3003/api/digest/send-my-digest \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

3. **Cuenta logs user después:**
   ```sql
   SELECT COUNT(*) FROM digest_logs WHERE type = 'user';
   ```

4. **Verifica registro:**
   ```sql
   SELECT * FROM digest_logs 
   WHERE type = 'user' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

**Resultado esperado:**
- ✅ Nuevo registro con type='user'
- ✅ user_id está poblado (no NULL)
- ✅ recipient = email del user
- ✅ status = 'sent'

**Verificación:**
- [ ] Count aumentó en 1
- [ ] type='user'
- [ ] user_id no es NULL
- [ ] status='sent'

---

### Test 2.4: Endpoint GET /api/digest/logs

**Objetivo:** Verificar que puedes querying los logs vía API

**Pasos:**

1. **Query todos los logs:**
   ```bash
   curl http://localhost:3003/api/digest/logs \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Verifica respuesta:**
   ```json
   {
     "ok": true,
     "total": 6,
     "limit": 50,
     "offset": 0,
     "logs": [
       {
         "id": "uuid",
         "type": "admin|user",
         "user_id": "uuid|null",
         "recipient": "email@domain.com",
         "status": "sent|failed|pending",
         "error_msg": null,
         "created_at": "2026-04-27T08:15:30Z",
         "updated_at": "2026-04-27T08:15:30Z"
       }
     ]
   }
   ```

**Resultado esperado:**
- ✅ ok=true
- ✅ total = número correcto de logs
- ✅ logs array contiene registros
- ✅ Cada log tiene todos los campos

**Verificación:**
- [ ] Response ok=true
- [ ] total > 0 (tienes logs)
- [ ] logs array no vacío
- [ ] Todos los campos presentes

---

### Test 2.5: Filtrado por Type

**Objetivo:** Verificar que puedes filtrar logs por tipo

**Pasos:**

1. **Query solo admin logs:**
   ```bash
   curl "http://localhost:3003/api/digest/logs?type=admin" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Verifica resultado:**
   - Todos los logs deben tener `type: "admin"`

3. **Query solo user logs:**
   ```bash
   curl "http://localhost:3003/api/digest/logs?type=user" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

4. **Verifica resultado:**
   - Todos los logs deben tener `type: "user"`

**Resultado esperado:**
- ✅ ?type=admin retorna solo admin logs
- ✅ ?type=user retorna solo user logs
- ✅ Sin ?type retorna todos

**Verificación:**
- [ ] type=admin filter funciona
- [ ] type=user filter funciona
- [ ] Sin filter retorna ambos tipos

---

### Test 2.6: Filtrado por Status

**Objetivo:** Verificar que puedes filtrar por status

**Pasos:**

1. **Query sent logs:**
   ```bash
   curl "http://localhost:3003/api/digest/logs?status=sent" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Verifica resultado:**
   - Todos los logs deben tener `status: "sent"`

3. **Intenta query failed logs:**
   ```bash
   curl "http://localhost:3003/api/digest/logs?status=failed" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

4. **Verifica resultado:**
   - Si hay failed logs, retorna solo esos
   - Si no hay, retorna vacío (ok=true pero logs=[])

**Resultado esperado:**
- ✅ ?status=sent funciona
- ✅ ?status=failed funciona
- ✅ Filtros son precisos

**Verificación:**
- [ ] status filter funciona
- [ ] Resultados son precisos

---

### Test 2.7: Paginación

**Objetivo:** Verificar que limit y offset funcionan

**Pasos:**

1. **Query con limit:**
   ```bash
   curl "http://localhost:3003/api/digest/logs?limit=2&offset=0" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Verifica resultado:**
   - `limit: 2`
   - `offset: 0`
   - `logs` array con max 2 items

3. **Query siguiente página:**
   ```bash
   curl "http://localhost:3003/api/digest/logs?limit=2&offset=2" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

4. **Verifica resultado:**
   - `offset: 2`
   - Logs diferentes a la página anterior

**Resultado esperado:**
- ✅ limit=2 retorna max 2 logs
- ✅ offset=2 retorna siguientes logs
- ✅ No hay overlaps entre páginas

**Verificación:**
- [ ] limit funciona
- [ ] offset funciona
- [ ] Pagination es correcta

---

### Test 2.8: Seguridad — Non-Admin No Puede Leer

**Objetivo:** Verificar que solo admins pueden ver los logs

**Pasos:**

1. **Con admin token (OK):**
   ```bash
   ADMIN_TOKEN="tu_admin_token"
   curl http://localhost:3003/api/digest/logs \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

   **Resultado:** Status 200 + logs

2. **Con non-admin token (debe fallar):**
   ```bash
   USER_TOKEN="token_de_user_normal"
   curl http://localhost:3003/api/digest/logs \
     -H "Authorization: Bearer $USER_TOKEN"
   ```

   **Resultado esperado:** Status 403 Forbidden o vacío

**Verificación:**
- [ ] Admin token: 200 OK
- [ ] User token: 403 o error

---

## RESUMEN DE TESTING

### Checklist Final

**Iteration 1:**
- [x] Test 1.1 — Validación Resend en startup (variables SMTP migradas a RESEND_API_KEY + SMTP_FROM)
- [x] Test 1.2 — Cron arranca con hora y minuto configurables (DIGEST_MINUTE / USER_DIGEST_MINUTE)
- [x] Test 1.3 — POST /send-me: `{ok:true, message:"Digest enviado a..."}` ✅
- [x] Test 1.4 — POST /send-my-digest: email recibido con 7 tareas urgentes ✅

**Iteration 2:**
- [x] Test 2.1 — Tabla `digest_logs` con 8 columnas verificada en Supabase ✅
- [x] Test 2.2 — Admin digest registrado (11 entradas total, 6 tipo admin) ✅
- [x] Test 2.3 — User digest registrado (5 tipo user, user_id poblado) ✅
- [x] Test 2.4 — GET /api/digest/logs: total=11, paginación y campos correctos ✅
- [x] Test 2.5 — ?type=admin → 6 registros, todos type=admin ✅
- [x] Test 2.6 — ?type=user → 5 registros, todos type=user ✅
- [x] Test 2.7 — ?limit=2&offset=0 → 2 devueltos de 11 ✅
- [x] Test 2.8 — Sin token → 401; colaborador → 403 ✅

---

## Si Algo Falla

**Problema:** Server no inicia  
→ Revisa logs en terminal  
→ ¿Faltan SMTP env vars?  
→ ¿Error en digestLogging.js?

**Problema:** GET /api/digest/logs retorna error  
→ ¿Tabla digest_logs existe en Supabase?  
→ ¿RLS policies aplicadas?  
→ ¿Token es admin?

**Problema:** Logs no aparecen después de trigger digest  
→ ¿La tabla está vacía?  
→ ¿El digest se envió exitosamente (ok:true)?  
→ ¿Esperaste 2s después del request?

---

## Notas

- Todos los timestamps están en UTC (created_at)
- Busca "enviado a" en logs del server = éxito
- Si ves "expirado (>10s)" en error, el timeout de 10s se activó
- Los logs persisten en Supabase (no se borran al reiniciar server)

---

**Status:** ✅ COMPLETADO 2026-04-28  
**Próximo:** Verificación flujo invite email end-to-end → kanban.aglaya.biz
