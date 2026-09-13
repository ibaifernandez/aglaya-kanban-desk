# Registro de DPAs (Data Processing Agreements)

**Marco legal:** RGPD Art. 28(3) — contrato escrito entre responsable y encargado. Ley 21.719 Art. 24. LGPD Art. 39.
**Última actualización:** 2026-08-25 *(v1.1 — Resend pasa a cesado)*

> Este documento registra los DPAs firmados con cada encargado del tratamiento que procesa datos personales para AGLAYA Kanban Desk.

---

## Procesadores activos

### 1. Supabase

- **Función:** Base de datos Postgres + Auth + Storage
- **URL del proyecto:** https://supabase.com/dashboard/project/jowtasxhnluqqcgkeoll
- **Región datos:** sa-east-1 (São Paulo, Brasil)
- **DPA template oficial:** https://supabase.com/legal/dpa
- **Estado DPA:** ✅ **ARCHIVADO 2026-05-27** — firmado vía PandaDoc 2026-05-26 (ronda completa same-day). PDF (790 KB) **fuera del repositorio desde el 2026-09-13**: contiene la dirección personal del Operador, y este repositorio es público. Se conserva en la máquina del Operador, en `~/Local Sites/mis-dpa/aglaya-kanban-desk/supabase-dpa-2026-05-26.pdf` — carpeta **sin remoto, por decisión suya** (tarjeta `9dbfbd0d`). Huella para comprobar que la copia es la misma que estuvo versionada hasta `26a93a5`: `sha256 1c07eddb7e01c29bc67fd980ba2a2e4c84333b8e610fdd88754901266eaba9c7`.
- **TIA archivado:** ✅ `docs/legal/dpas/supabase-tia-2025-03-14.pdf` (descargado 2026-05-27 — Transfer Impact Assessment Supabase oficial fechado 2025-03-14, sirve para flujo Brasil↔EU↔US).
- **Sub-procesadores Supabase:** AWS (infra), ver https://supabase.com/legal/subprocessors
- **Transferencia internacional:** Brasil (sa-east-1) — no es transferencia desde Brasil. Desde UE → Brasil requiere garantías adicionales (Brasil tiene LGPD pero NO está en lista RGPD países adecuados → SCCs requeridos)

### 2. Resend · ⏹ **ENCARGADO CESADO EL 2026-08-25**

- **Estado:** **ya no interviene en ningún tratamiento.** AGLAYA Kanban Desk dejó
  de enviar correo el 25-ago-2026 y no se sustituyó por otro proveedor.
- **Por qué esta entrada no se borra:** el DPA archivado es la prueba de con qué
  garantías se trataron los datos **mientras estuvo activo** (27-abr → 25-ago-2026).
  Un registro de DPAs que borra a los encargados cesados no puede acreditar el
  pasado, que es justo para lo que sirve.
- **Función que prestó:** Envío de emails transaccionales (resumen diario + avisos de asignación)
- **DPA template oficial:** https://resend.com/legal/dpa
- **Estado DPA:** ✅ **ARCHIVADO 2026-05-27** — auto-firmado al signup (modelo Resend). PDF en `docs/legal/dpas/resend-dpa-2026-05-27.pdf` (197 KB).
- **Acción:** ninguna. **No hay que re-descargar nada**: el contrato ya no se ejerce. El PDF archivado se conserva como prueba del periodo en que sí.
- **Sub-procesadores Resend:** AWS, ver https://resend.com/legal/subprocessors
- **Transferencia internacional:** US — SCCs incluidas en el DPA descargado

### 3. Railway

- **Función:** Hosting del server Express (kanban backend)
- **URL prod:** https://web-production-099a0.up.railway.app
- **DPA template oficial:** https://railway.com/legal/dpa
- **Estado DPA:** ✅ **ARCHIVADO 2026-05-27** — Railway Corporation Data Processing Addendum descargado. PDF (427 KB) **fuera del repositorio desde el 2026-09-13**: contiene la dirección personal del Operador, y este repositorio es público. Se conserva en la máquina del Operador, en `~/Local Sites/mis-dpa/aglaya-kanban-desk/railway-dpa-2026-05-27.pdf` — carpeta **sin remoto, por decisión suya** (tarjeta `9dbfbd0d`). Huella para comprobar que la copia es la misma que estuvo versionada hasta `26a93a5`: `sha256 d7566ea1905ad4c0b53e5cff190b972af645021ef79474fdb1f8ff6cc6567fc4`.
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

- **Función:** Trigger por reloj del backup diario (`db-backup.yml`). *(El reloj del digest se retiró el 25-ago-2026 con el correo.)*
- **DPA template:** GitHub está cubierto por Microsoft Online Services DPA — https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA
- **Estado DPA:** ✅ **ARCHIVADO 2026-05-27** — Microsoft Products and Services DPA (WW) versión May 2026 (CR). DOCX en `docs/legal/dpas/microsoft-dpa-2026-05.docx`.
- **Tipo de cuenta GitHub verificado:** `ibaifernandez` cuenta personal free (plan: None). DPA Microsoft aplica automáticamente al uso del servicio.
- **Acción:** completada. Re-descargar si Microsoft publica versión nueva.
- **Sub-procesadores:** Microsoft Azure (infra GitHub)
- **Transferencia internacional:** US — SCCs incluidas en el DPA Microsoft

---

## Resumen del estado

| Procesador | DPA aceptado | Declarado en política | Sub-procesadores doc | Transferencia |
|---|---|---|---|---|
| Supabase | ✅ archivado 2026-05-27 + TIA archivado ✅ | ✅ kanban-policy v1.0 | ✅ Supabase doc | Brasil |
| ~~Resend~~ ⏹ cesado 2026-08-25 | ✅ archivado 2026-05-27 *(se conserva como prueba del periodo activo)* | ✅ declarado como cesado en kanban-policy v1.1 | ✅ Resend doc | US *(ya no hay transferencia)* |
| Railway | ✅ archivado 2026-05-27 | ✅ kanban-policy v1.0 | ✅ Railway doc | US |
| Netlify | ✅ archivado 2026-05-27 | ✅ kanban-policy v1.0 | ✅ Netlify doc | Global |
| Cloudflare | ✅ archivado 2026-05-27 (v6.4) | ✅ kanban-policy v1.0 | ✅ Cloudflare doc | EU (WEUR) |
| GitHub Actions | ✅ archivado 2026-05-27 (Microsoft DPA WW May 2026) | ✅ kanban-policy v1.0 | Microsoft Azure | US |
| **Sentry** | ✅ **ACEPTADO 2026-09-13 — versión 5.1.0**, por **aceptación electrónica en el panel** de la organización. **Se comprueba en:** Sentry → *Settings → Legal & Compliance → Data Processing Amendment* («Version 5.1.0 signed Sep 13, 2026»). Texto público del acuerdo: https://sentry.io/legal/dpa/ . **No hay PDF que archivar, y es deliberado:** la página del acuerdo no ofrece descarga, y la prueba de la firma la custodia Sentry en la cuenta. Imprimir la página pública solo guardaría un texto ya publicado, sin prueba de firma — y a diferencia de Railway y Supabase, **no hay ningún fichero firmado con datos personales que tener que sacar del repositorio**. *(Medido el 13-sep-2026 con dos instrumentos, insensibles a mayúsculas: el de Railway lleva la dirección personal del Operador **4 veces en los bytes crudos**; el de Supabase, **2 veces en el texto extraído** con `pdftotext` y **0 en los bytes crudos** — un recuento solo por bytes da limpio el de Supabase, y no lo está. Detalle en la tarjeta `9dbfbd0d`.)* *(Hasta el 13-sep decía «⏳ sin archivar — acto del Operador».)* | ✅ kanban-policy **v1.4** *(activo desde mayo de 2026 sin declarar: la v1.0–1.3 lo daban por «futuro»)* | https://sentry.io/legal/subprocessors/ | US — **verificado** en el panel (*Data Storage Region: United States of America*), captura del Operador del 13-sep-2026 |

---

## Procesadores DESCARTADOS / no usados en kanban

Los siguientes están en política aglaya.biz pero NO se usan en kanban:

- **MailerLite** — marketing emails aglaya.biz; **kanban no envía ningún correo desde el 25-ago-2026**
- **hCaptcha** — protección anti-bot en aglaya.biz forms; kanban no expone forms públicos
- **CRM AGLAYA** — sistema interno separado; kanban no se sincroniza con CRM

---

## Plantilla para aceptar DPA

Cuando aceptes un DPA en dashboard del procesador:

1. Descargar copia (PDF / link permanente).
2. **Mirar antes si el PDF lleva datos personales** —firma, correo o nombre de quien firma—, **con dos instrumentos**: bytes crudos (`grep -ai`) **y** texto extraído (`pdftotext`), los dos insensibles a mayúsculas. Cada uno por separado es ciego a un fichero real de esta casa: el de Railway solo aparece en bytes crudos, el de Supabase solo en el texto, y uno de sus correos va en mayúsculas.
   - **Si lleva datos personales** → guardar en `~/Local Sites/mis-dpa/aglaya-kanban-desk/` (sin remoto) y escribir aquí la ruta y su `sha256`. **Nunca** en el repositorio: es público.
   - **Si no lleva ninguno** → `docs/legal/dpas/`.
   *(Aquí decía «Guardar en `docs/legal/dpas/`» sin condición, y por eso entraron los dos DPA firmados en un repositorio público.)*
3. Actualizar este documento con fecha de aceptación + link a la copia archivada.
4. Verificar que la política privacidad kanban (cuando se publique) lista al procesador.

---

## Acciones pendientes (operador)

- [x] Verificar/aceptar DPA Supabase (2026-05-27 firmado vía PandaDoc + archivado — **fuera del repositorio desde el 2026-09-13**, ver la ficha de Supabase arriba) + TIA archivado en `docs/legal/dpas/supabase-tia-2025-03-14.pdf`
- [x] Verificar/aceptar DPA Resend (2026-05-27 archivado en `docs/legal/dpas/resend-dpa-2026-05-27.pdf`) — *encargado cesado el 2026-08-25; el archivo se conserva como prueba del periodo activo*
- [x] Verificar/aceptar DPA Railway (2026-05-27 archivado — **fuera del repositorio desde el 2026-09-13**, ver la ficha de Railway arriba)
- [x] Verificar/aceptar DPA Netlify (2026-05-27 archivado en `docs/legal/dpas/netlify-dpa-2026-05-27.pdf`)
- [x] **🔴 PRIORITARIO:** aceptar DPA Cloudflare (2026-05-27 archivado en `docs/legal/dpas/cloudflare-dpa-v6.4-2026-04-03.pdf`)
- [x] Verificar status GitHub DPA (2026-05-27 Microsoft Products and Services DPA WW May 2026 archivado en `docs/legal/dpas/microsoft-dpa-2026-05.docx`; cuenta GitHub personal free → DPA Microsoft aplica)
- [ ] Crear carpeta `docs/legal/dpas/` cuando empiecen a archivarse PDFs
- [ ] Documentar cada aceptación en este archivo con fecha + path a copia archivada
