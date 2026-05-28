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
- **Estado DPA:** ✅ **ARCHIVADO 2026-05-27** — firmado vía PandaDoc 2026-05-26 (ronda completa same-day). PDF en `docs/legal/dpas/supabase-dpa-2026-05-26.pdf` (790 KB).
- **TIA archivado:** ✅ `docs/legal/dpas/supabase-tia-2025-03-14.pdf` (descargado 2026-05-27 — Transfer Impact Assessment Supabase oficial fechado 2025-03-14, sirve para flujo Brasil↔EU↔US).
- **Sub-procesadores Supabase:** AWS (infra), ver https://supabase.com/legal/subprocessors
- **Transferencia internacional:** Brasil (sa-east-1) — no es transferencia desde Brasil. Desde UE → Brasil requiere garantías adicionales (Brasil tiene LGPD pero NO está en lista RGPD países adecuados → SCCs requeridos)

### 2. Resend

- **Función:** Envío de emails transaccionales (digest + notificaciones + welcome)
- **DPA template oficial:** https://resend.com/legal/dpa
- **Estado DPA:** ✅ **ARCHIVADO 2026-05-27** — auto-firmado al signup (modelo Resend). PDF en `docs/legal/dpas/resend-dpa-2026-05-27.pdf` (197 KB).
- **Acción:** completada. Re-descargar si Resend actualiza versión.
- **Sub-procesadores Resend:** AWS, ver https://resend.com/legal/subprocessors
- **Transferencia internacional:** US — SCCs incluidas en el DPA descargado

### 3. Railway

- **Función:** Hosting del server Express (kanban backend)
- **URL prod:** https://web-production-099a0.up.railway.app
- **DPA template oficial:** https://railway.com/legal/dpa
- **Estado DPA:** ✅ **ARCHIVADO 2026-05-27** — Railway Corporation Data Processing Addendum descargado. PDF en `docs/legal/dpas/railway-dpa-2026-05-27.pdf` (427 KB).
- **Acción:** completada. Re-descargar si Railway actualiza versión.
- **Sub-procesadores Railway:** GCP (infra), ver https://railway.com/legal/subprocessors
- **Transferencia internacional:** US — SCCs incluidas en el DPA

### 4. Netlify

- **Función:** Static CDN para client SPA + proxy `/api/*` y `/uploads/*` a Railway
- **DPA template oficial:** https://www.netlify.com/legal/data-processing-addendum/
- **Estado DPA:** ✅ **ARCHIVADO 2026-05-27** — DPA estándar Netlify descargado (free tier no expone self-serve, version pública es pre-firmada por Netlify). PDF en `docs/legal/dpas/netlify-dpa-2026-05-27.pdf` (282 KB).
- **Acción:** completada. Re-descargar si Netlify actualiza versión.
- **Sub-procesadores Netlify:** AWS, Cloudflare, ver https://www.netlify.com/gdpr-ccpa/subprocessors/
- **Transferencia internacional:** Global CDN — datos pueden replicarse mundialmente. SCCs incluidas en DPA

### 5. Cloudflare (post audit Mariana B-CRIT-02)

- **Función:** R2 bucket para backups diarios DB completa + DNS para `aglaya.biz`/`kanban.aglaya.biz`
- **Bucket:** `aglaya-kanban-backups-prod` (WEUR — Western Europe)
- **DPA template oficial:** https://www.cloudflare.com/cloudflare-customer-dpa/
- **Estado DPA:** ✅ **ARCHIVADO 2026-05-27** — DPA v6.4 fechado April 3 2026 descargado. PDF en `docs/legal/dpas/cloudflare-dpa-v6.4-2026-04-03.pdf`.
- **Acción:** completada. Re-descargar si Cloudflare publica v6.5+.
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
| Supabase | ✅ archivado 2026-05-27 + TIA archivado ✅ | ✅ kanban-policy v1.0 | ✅ Supabase doc | Brasil |
| Resend | ✅ archivado 2026-05-27 | ✅ kanban-policy v1.0 | ✅ Resend doc | US |
| Railway | ✅ archivado 2026-05-27 | ✅ kanban-policy v1.0 | ✅ Railway doc | US |
| Netlify | ✅ archivado 2026-05-27 | ✅ kanban-policy v1.0 | ✅ Netlify doc | Global |
| Cloudflare | ✅ archivado 2026-05-27 (v6.4) | ✅ kanban-policy v1.0 | ✅ Cloudflare doc | EU (WEUR) |
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

- [x] Verificar/aceptar DPA Supabase (2026-05-27 firmado vía PandaDoc + archivado en `docs/legal/dpas/supabase-dpa-2026-05-26.pdf`) + TIA archivado en `docs/legal/dpas/supabase-tia-2025-03-14.pdf`
- [x] Verificar/aceptar DPA Resend (2026-05-27 archivado en `docs/legal/dpas/resend-dpa-2026-05-27.pdf`)
- [x] Verificar/aceptar DPA Railway (2026-05-27 archivado en `docs/legal/dpas/railway-dpa-2026-05-27.pdf`)
- [x] Verificar/aceptar DPA Netlify (2026-05-27 archivado en `docs/legal/dpas/netlify-dpa-2026-05-27.pdf`)
- [x] **🔴 PRIORITARIO:** aceptar DPA Cloudflare (2026-05-27 archivado en `docs/legal/dpas/cloudflare-dpa-v6.4-2026-04-03.pdf`)
- [ ] Verificar status GitHub DPA (Microsoft Online Services DPA cubre)
- [ ] Crear carpeta `docs/legal/dpas/` cuando empiecen a archivarse PDFs
- [ ] Documentar cada aceptación en este archivo con fecha + path a copia archivada
