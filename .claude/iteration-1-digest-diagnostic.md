# Iteración 1 — Diagnóstico del Sistema de Digest

**Fecha:** 2026-04-27  
**Scope:** Revisión completa del sistema de digest (admin + user, cron + manual)  
**Archivos analizados:** `server/digest.js`, `server/userDigest.js`, `server/routes/digestRoute.js`

---

## Resumen Ejecutivo

El sistema de digest está **funcional pero frágil**. Ambas implementaciones (admin y user) funcionan correctamente en el happy path, pero carecen de:
- Desfase de cron jobs (potential SMTP spike)
- Feedback visual cuando los envíos async fallan
- Concurrency limiting para grandes bases de usuarios
- Validación de configuración SMTP en tiempo de startup
- Persistencia de errores más allá del console.log

**Prioridad crítica:** Implementar desfase de cron jobs (7 AM → 8 AM) para evitar picos de carga SMTP simultáneos.

---

## Hallazgos Detallados

### 1. Cron Job Scheduling — ⚠️ CONFLICTO POTENCIAL

#### Situación actual:
- **Admin digest** (`digest.js:435-445`): Cron `0 ${DIGEST_HOUR} * * *`
  - Defaults a `DIGEST_HOUR = 7`
  - Env var `DIGEST_HOUR` puede sobrescribir
  
- **User digest** (`userDigest.js:483-495`): Cron `0 ${USER_DIGEST_HOUR} * * *`
  - Defaults a `USER_DIGEST_HOUR = 8`
  - Env var `USER_DIGEST_HOUR` puede sobrescribir

#### Problema:
```javascript
// En digest.js:35
const DIGEST_HOUR = Number.isFinite(parseInt(process.env.DIGEST_HOUR)) 
  ? parseInt(process.env.DIGEST_HOUR) 
  : 7;

// En userDigest.js:14  
const USER_DIGEST_HOUR = Number.isFinite(parseInt(process.env.USER_DIGEST_HOUR))
  ? parseInt(process.env.USER_DIGEST_HOUR)
  : 8;
```

**Impacto:** Si ambos defaults se usan, corren a `7:00 AM` y `8:00 AM` (orden correcto). Pero:
- No hay documentación clara de esto
- Si alguien accidentalmente asigna `DIGEST_HOUR=8` e `USER_DIGEST_HOUR=8`, ambos cron corren simultáneamente
- El servidor SMTP recibe un pico de carga: admin digest (~5-10 queries) + N user digests (4*N queries Supabase + N emails SMTP)

**Acción requerida (Iteration 1):**
1. ✅ Dejar defaults: admin 7 AM, user 8 AM
2. Documentar esto en `.env.example` y en comentario del código
3. Agregar validación en startup que alerte si ambos cron tienen el mismo horario

---

### 2. Feedback Visual para Async Sends — ❌ INEXISTENTE

#### Situación actual:
```javascript
// digestRoute.js:31-98 — endpoint /api/digest/send-my-digest
res.json({ 
  ok: true, 
  message: `Tu digest personal está en camino a ${user.email}...` 
});

sendUserDigest({ ... }).catch((err) => {
  console.error('[digest/send-my-digest]', err.message);
});
```

El cliente recibe `ok: true` inmediatamente. Si el envío SMTP falla 5 segundos después, el usuario nunca se entera.

**Impacto:** UX confusa — usuario ve "Tu digest está en camino" pero nunca recibe el email si SMTP falló.

**Acción requerida (Iteration 1):**
1. Implementar polling endpoint: `GET /api/digest/status/<requestId>` que devuelva `{ sent, failed, pending }`
2. Guardar estado de envío async en Redis (o en-memory si Redis no está disponible)
3. Cliente poll cada 2s durante 30s, luego notifica resultado final

**Alternativa rápida (MVP):**
- Cambiar endpoint para ser **síncrono** y esperar el envío
- Agregar timeout de 10s; si SMTP no responde, devolver error 500
- Más simple pero bloquea la UI

---

### 3. Concurrency y Rate Limiting — ⚠️ INEFICIENTE PARA GRANDES BASES

#### Situación actual:
```javascript
// userDigest.js:451-479 — sendAllUserDigests()
for (const user of (users ?? [])) {
  if (!user.email) { results.skipped++; continue; }
  try {
    const result = await sendUserDigest({ ... });
    if (result.sent) results.sent++;
  } catch (err) { ... }
}
```

**Problema:** 100% secuencial. Si hay 1000 usuarios:
- Cada `buildUserCards()` hace 4 queries Supabase (workspaces, boards, columns, cards)
- Total: 4000 queries Supabase + 1000 envíos SMTP
- En serie, esto toma **10–30 minutos** dependiendo de latencia SMTP

**Impacto actual:** Bajo (plataforma pequeña). Pero no escala.

**Acción requerida (Iteration 2–3, no Iteration 1):**
1. Implementar batching: procesar usuarios en lotes de 10
2. Usar `Promise.all()` para paralelizar dentro de cada lote
3. Validar que Supabase no throttle en más de 50 QPS

---

### 4. Validación de Configuración SMTP — ⚠️ TARDÍA

#### Situación actual:
```javascript
// digest.js:60-68 — sendDigest()
if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
  throw new Error('SMTP no configurado...');
}
// Pero esto se ejecuta en tiempo de envío, no en startup

// userDigest.js:420-422 — sendUserDigest()
if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
  throw new Error('SMTP no configurado...');
}
```

**Problema:** La validación ocurre cuando se intenta enviar, no al iniciar el servidor. Si SMTP_HOST está vacío, el error solo aparece a las 7 AM cuando cron intenta correr.

**Acción requerida (Iteration 1):**
1. Crear función `validateSmtpConfig()` que verifique en startup
2. Llamar desde `server/index.js` antes de iniciar cron schedulers
3. Throw error si falta cualquier env var requerido

---

### 5. Persistencia de Errores — ❌ NINGUNA

#### Situación actual:
```javascript
// Todos los errores van a console.error()
console.error('[digest/send-me]', err.message);
console.error('[userDigest] Scheduled send failed:', err.message);
```

**Problema:** Logs desaparecen cuando reinicia el servidor. No hay forma de auditar qué pasó hace 3 días.

**Impacto actual:** Bajo (desarrollo). Sera crítico en Phase 5 (SaaS scale).

**Acción requerida (Iteration 1):**
1. Crear tabla `digest_logs` en Supabase: `{ id, type (admin|user), user_id?, recipient, status (sent|failed|pending), error_msg, created_at }`
2. Insertar registro DESPUÉS de cada intento (éxito o fallo)
3. Agregar endpoint `GET /api/digest/logs` (admin-only) para auditar

**Alternativa rápida (MVP):**
- Guardar logs en archivos en `./logs/digest-YYYY-MM-DD.log`
- Rotar diariamente

---

### 6. HTML Email — ✅ BIEN

- Diseño responsive con dark theme
- Prioridades coloreadas (urgent rojo, high naranja, etc.)
- Badges de due date, checklist progress
- Agrupación clara: personal → interno → externo
- CTA button visible
- Pie con copyright

No hay issues aquí.

---

### 7. Queries a Supabase — ✅ EFICIENTES

- `buildUserCards()` usa `.in()` para bulk queries
- Excluye columnas "done" antes de filtrar cards
- No hay N+1 queries

No hay issues aquí.

---

## Plan de Acción — Iteration 1

### Must-have (bloqueante):
1. **Validación SMTP en startup** (15 min)
   - Crear `validateSmtpConfig()` en `server/utils/smtp.js`
   - Llamar desde `server/index.js` antes de iniciar schedulers
   
2. **Desfase de cron jobs** (15 min)
   - Documentar en env vars que admin=7, user=8
   - Agregar console.warn() si detecta conflicto
   - Actualizar `.env.example`

3. **Feedback visual básico** (30 min — MVP síncrono)
   - Cambiar endpoints a síncrono con timeout 10s
   - Devolver `{ ok: false, error }` si falla
   - Cliente maneja el error y muestra toast

### Nice-to-have (Iteration 2):
- Tabla de audit logs `digest_logs`
- Endpoint `GET /api/digest/logs` con paginación
- Concurrency limiting para sendAllUserDigests()

### Status quo (OK):
- Lógica de selección de cards (actionable filter)
- HTML design
- Supabase queries

---

## Tests Requeridos

### Test: SMTP validation en startup
```javascript
// server/utils/smtp.test.js
test('throws error si SMTP_HOST está vacío', () => {
  delete process.env.SMTP_HOST;
  expect(() => validateSmtpConfig()).toThrow('SMTP_HOST requerido');
});
```

### Test: Endpoint síncrono con timeout
```javascript
// server/routes/digestRoute.test.js  
test('POST /api/digest/send-my-digest responde en < 10s', async () => {
  const start = Date.now();
  const res = await request(app).post('/api/digest/send-my-digest');
  expect(Date.now() - start).toBeLessThan(10000);
});
```

---

## Timeline Estimado

| Tarea | Tiempo | Bloqueante |
|-------|--------|-----------|
| Validación SMTP | 15 min | Sí |
| Desfase cron + docs | 15 min | Sí |
| Feedback visual (MVP sync) | 30 min | Sí |
| Tests básicos | 20 min | Sí |
| **Total Iteration 1** | **80 min** | — |

**Dependencias:** Ninguna. Puedes empezar inmediatamente.

---

## Próximas Iteraciones

**Iteration 2:** Tests suite expansion + audit logs  
**Iteration 3:** Concurrency + error recovery  
**Iteration 4:** Alertas automáticas (overdue)  
**Iteration 5:** Infrastructure (Docker + PM2)
