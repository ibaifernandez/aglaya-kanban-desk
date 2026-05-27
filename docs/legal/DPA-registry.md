# Registro de DPAs (Data Processing Agreements)

**Marco legal:** RGPD Art. 28(3) — contrato escrito entre responsable y encargado. Ley 21.719 Art. 24. LGPD Art. 39.
**Última actualización:** 2026-05-27

> Este documento registra los DPAs firmados con cada encargado del tratamiento que procesa datos personales para AGLAYA Kanban Desk.

---

## Procesadores activos

### 1. Supabase

- **Función:** Base de datos Postgres + Auth + Storage
- **URL del proyecto:** https://supabase.com/dashboard/project/jowtasxhnluqqcgkeoll
- **Región datos:** sa-east-1 (São Paulo, Brasil)
- **DPA template oficial:** https://supabase.com/legal/dpa
- **Estado DPA:** 🟠 **PENDIENTE confirmación operador** — verificar si aceptado en dashboard
- **Acción:** ir a Supabase → Organization Settings → Legal → DPA → click-through accept + descargar copia firmada
- **Sub-procesadores Supabase:** AWS (infra), ver https://supabase.com/legal/subprocessors
- **Transferencia internacional:** Brasil (sa-east-1) — no es transferencia desde Brasil. Desde UE → Brasil requiere garantías adicionales (Brasil tiene LGPD pero NO está en lista RGPD países adecuados → SCCs requeridos)

### 2. Resend

- **Función:** Envío de emails transaccionales (digest + notificaciones + welcome)
- **DPA template oficial:** https://resend.com/legal/dpa
- **Estado DPA:** 🟠 **PENDIENTE** — política aglaya.biz menciona Resend pero DPA específico no archivado
- **Acción:** Resend dashboard → Settings → Legal → accept DPA
- **Sub-procesadores Resend:** AWS, ver https://resend.com/legal/subprocessors
- **Transferencia internacional:** US — SCCs requeridas para datos UE

### 3. Railway

- **Función:** Hosting del server Express (kanban backend)
- **URL prod:** https://web-production-099a0.up.railway.app
- **DPA template oficial:** https://railway.com/legal/dpa
- **Estado DPA:** 🟠 **PENDIENTE** — política aglaya.biz menciona Railway pero solo para CRM AGLAYA, no específico para kanban
- **Acción:** Railway dashboard → Settings → Account → Legal → DPA
- **Sub-procesadores Railway:** GCP (infra), ver https://railway.com/legal/subprocessors
- **Transferencia internacional:** US — SCCs requeridas

### 4. Netlify

- **Función:** Static CDN para client SPA + proxy `/api/*` y `/uploads/*` a Railway
- **DPA template oficial:** https://www.netlify.com/legal/data-processing-addendum/
- **Estado DPA:** 🟠 **PENDIENTE** — verificar si aceptado
- **Acción:** Netlify dashboard → Team Settings → Privacy & Data Processing
- **Sub-procesadores Netlify:** AWS, Cloudflare, ver https://www.netlify.com/gdpr-ccpa/subprocessors/
- **Transferencia internacional:** Global CDN — datos pueden replicarse mundialmente

### 5. Cloudflare (post audit Mariana B-CRIT-02)

- **Función:** R2 bucket para backups diarios DB completa + DNS para `aglaya.biz`/`kanban.aglaya.biz`
- **Bucket:** `aglaya-kanban-backups-prod` (WEUR — Western Europe)
- **DPA template oficial:** https://www.cloudflare.com/cloudflare-customer-dpa/
- **Estado DPA:** 🔴 **PENDIENTE — más urgente** — Cloudflare se añadió como procesador en este audit (2026-05-27) para almacenar dumps completos DB. NUNCA declarado en política aglaya.biz para kanban
- **Acción:** Cloudflare dashboard → Profile → Legal → DPA (puede ser self-serve)
- **Transferencia internacional:** WEUR mantiene datos en EU (preferible para UE/Brasil/Chile)

### 6. GitHub Actions

- **Función:** Cron triggers para digest (`digest-cron.yml`) + backup daily (`db-backup.yml`)
- **DPA template:** GitHub está cubierto por Microsoft Online Services DPA — https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA
- **Estado DPA:** 🟠 **VERIFICAR** — si AGLAYA tiene cuenta GitHub Business/Enterprise, el DPA Microsoft aplica
- **Acción:** verificar tipo de cuenta GitHub + descargar DPA si aplica
- **Sub-procesadores:** Microsoft Azure (infra GitHub)
- **Transferencia internacional:** US

---

## Resumen del estado

| Procesador | DPA aceptado | Declarado en política | Sub-procesadores doc | Transferencia |
|---|---|---|---|---|
| Supabase | 🟠 verificar | ❌ NO | ✅ Supabase doc | Brasil |
| Resend | 🟠 verificar | ✅ SÍ (aglaya.biz) | ✅ Resend doc | US |
| Railway | 🟠 verificar | ✅ SÍ (CRM only) | ✅ Railway doc | US |
| Netlify | 🟠 verificar | ✅ SÍ (aglaya.biz) | ✅ Netlify doc | Global |
| Cloudflare | 🔴 NUEVO post-audit | ❌ NO | ✅ Cloudflare doc | EU (WEUR) |
| GitHub Actions | 🟠 verificar | ❌ NO | Microsoft Azure | US |

---

## Procesadores DESCARTADOS / no usados en kanban

Los siguientes están en política aglaya.biz pero NO se usan en kanban:

- **MailerLite** — marketing emails aglaya.biz; kanban usa solo Resend
- **hCaptcha** — protección anti-bot en aglaya.biz forms; kanban no expone forms públicos
- **CRM AGLAYA** — sistema interno separado; kanban no se sincroniza con CRM

---

## Plantilla para aceptar DPA

Cuando aceptes un DPA en dashboard del procesador:

1. Descargar copia (PDF / link permanente).
2. Guardar en `docs/legal/dpas/` (carpeta a crear cuando exista primer DPA archivable).
3. Actualizar este documento con fecha de aceptación + link a la copia archivada.
4. Verificar que la política privacidad kanban (cuando se publique) lista al procesador.

---

## Acciones pendientes (operador)

- [ ] Verificar/aceptar DPA Supabase (15 min)
- [ ] Verificar/aceptar DPA Resend (5 min)
- [ ] Verificar/aceptar DPA Railway (10 min)
- [ ] Verificar/aceptar DPA Netlify (5 min)
- [ ] **🔴 PRIORITARIO:** aceptar DPA Cloudflare (procesador nuevo desde audit Mariana — backup diario)
- [ ] Verificar status GitHub DPA (Microsoft Online Services DPA cubre)
- [ ] Crear carpeta `docs/legal/dpas/` cuando empiecen a archivarse PDFs
- [ ] Documentar cada aceptación en este archivo con fecha + path a copia archivada
