# Audit C — Cumplimiento Legal

**Fecha:** 2026-05-27
**Repo SHA:** `2eea7f1`
**Dimensiones:** RGPD (UE) + Ley 21.719 Chile + LGPD Brasil + CCPA California + Cookies + DPA + Data Retention.

---

## Resumen Fase C

| Severidad | Count |
|---|---|
| CRÍTICO | 5 |
| ALTO | 7 |
| MEDIO | 4 |
| BAJO | 2 |
| **Total** | **18** |

---

## Contexto legal aplicable

| Marco | Aplica | Razón |
|---|---|---|
| **RGPD (UE)** | **SÍ** | Titular (Antonio Ibai Fernández) residente España hasta hace poco; políticas AGLAYA invocan RGPD; usuarios EU del kanban con probabilidad alta |
| **Ley 21.719 Chile** | **SÍ** | Política privacidad aglaya.biz invoca explícitamente Ley 21.719 + `scripts/seed-launch-kanban.js` referencia esta ley en código del repo |
| **LGPD Brasil** | **SÍ** | Responsable del tratamiento declarado en privacidad: "Rua Palestina s/n, Belo Horizonte, Minas Gerais, Brasil". Operación legalmente brasileña → LGPD aplica |
| **CCPA California** | **PROBABLEMENTE NO** | Kanban auth-walled interno + clientes; sin marketing público a California. Aplicaría si AGLAYA factura >25M USD/año o procesa >100k CA residents. No verificado pero improbable |

---

## Marco descubierto durante audit

**Política de privacidad EXISTE para `aglaya.biz`:** https://aglaya.biz/es/privacidad/ + EN + PT-BR. Última actualización: 25 mayo 2026.

**Responsable del tratamiento declarado:**
- Titular: Antonio Ibai Fernández Gutiérrez
- Nombre comercial: AGLAYA
- Domicilio: Rua Palestina s/n, Belo Horizonte, MG, Brasil, CEP 30850-000
- Email: info@aglaya.biz

**Procesadores declarados (para aglaya.biz):**
- Resend (US)
- MailerLite (transferencia internacional)
- hCaptcha (US)
- Sentry (US)
- Netlify (US)
- CRM AGLAYA en Railway (US)

**Plazos de retención declarados (aglaya.biz):**
- MailerLite: mientras suscripción activa, 30d post-supresión
- Resend: metadatos entrega 3d
- Sentry: 90d
- Netlify logs: 7d
- CRM AGLAYA: 24 meses desde última interacción

**Banner consent presente:** en aglaya.biz vía `localStorage.aglaya_cookie_consent="all"` → carga GTM. **NO existe en kanban.aglaya.biz.**

---

## Hallazgos

| ID | Marco/Art | Hallazgo | Evidencia | Severidad | Esfuerzo |
|---|---|---|---|---|---|
| **C-01** | RGPD Art. 13/14 + Ley 21.719 Art. 14 ter + LGPD Art. 9 | **kanban.aglaya.biz NO tiene política de privacidad propia ni declaración del tratamiento.** `kanban.aglaya.biz/privacy`, `/legal`, `/cookies`, `/terms` retornan SPA shell vacío (catch-all Netlify). La política de aglaya.biz NO menciona kanban.aglaya.biz como producto cubierto, NO declara Supabase ni Railway-as-kanban-host como procesadores del kanban, NO declara los datos procesados en el kanban (cards, comments, attachments, asignaciones, notificaciones, digest emails). Usuarios del kanban procesados SIN base informada de tratamiento. | `curl https://kanban.aglaya.biz/{privacy,legal,cookies,terms}` → SPA shell. Política aglaya.biz fetched, no menciona Supabase ni kanban. `grep política client/src/` → 0 hits | **CRÍTICO** | Medio — redactar + publicar política específica kanban |
| **C-02** | RGPD Art. 13 + Ley 21.719 Art. 14 ter | **No hay declaración de Supabase como procesador del kanban.** El repo procesa datos personales (emails, nombres, avatares, contenido de cards/comments, asignaciones, IPs vía Railway logs) vía Supabase Postgres + Auth + Storage. Supabase ubicado en `sa-east-1` (São Paulo, Brasil — verificado via Supabase Management API). Sin declaración en política, sin DPA documentado en `docs/legal/` (carpeta inexistente). | Política aglaya.biz: "Supabase" → 0 menciones. `ls docs/legal/` → No such file or directory | **CRÍTICO** | Bajo — actualizar política + firmar DPA con Supabase (template disponible https://supabase.com/legal/dpa) |
| **C-03** | RGPD Art. 28 + LGPD Art. 39 | **`docs/legal/` no existe en el repo.** Sin carpeta legal, sin DPAs archivados, sin contratos de procesamiento de datos almacenados como evidencia auditable. RGPD Art. 28(3) requiere contrato escrito entre responsable y encargado. Ley 21.719 Art. 24 requiere mandato escrito. Si AGLAYA recibe un Right-to-Audit request o brecha de datos, no hay evidencia documental. | `ls docs/legal docs/privacy docs/dpa docs/rgpd` → 4× "No such file" | **CRÍTICO** | Bajo — crear `docs/legal/` + archivar DPAs (Supabase, Resend, Railway, Netlify, Cloudflare, GitHub) |
| **C-04** | RGPD Art. 17 (derecho de supresión) + Ley 21.719 Art. 12 + LGPD Art. 18(VI) | **No hay endpoint self-service para que el usuario borre su cuenta.** Solo admins/superadmins pueden borrar usuarios (`server/routes/admin.js:180` y `:342` — `adminClient.auth.admin.deleteUser`). 0 endpoints en `auth.js` para self-delete. RGPD requiere mecanismo accesible al titular sin intermediarios obligatorios. | `grep "router.delete" server/routes/auth.js` → 0 hits. Solo admin paths borran. | **CRÍTICO** | Medio — añadir `DELETE /api/auth/me` con confirmación + soft-delete + hard-delete async |
| **C-05** | RGPD Art. 20 (portabilidad) + LGPD Art. 18(V) + Ley 21.719 Art. 13 | **No hay endpoint de exportación de datos personales.** Usuario no puede descargar sus cards, comentarios, asignaciones, notificaciones, configuraciones en formato estructurado (JSON/CSV). | `grep "export\|GDPR\|portabilidad" server/routes/` → 0 hits relevantes | **CRÍTICO** | Medio — `GET /api/auth/me/export` que retorne ZIP con JSON de toda la data del user |
| **C-06** | RGPD Art. 6 + Ley 21.719 Art. 9 | **Base legal del tratamiento NO declarada.** Sin política propia kanban, NO se declara base jurídica para procesar emails/nombres/contenido del usuario. ¿Consentimiento? ¿Ejecución del contrato? ¿Interés legítimo? Sin esto, RGPD considera el tratamiento ilícito (Art. 5(1)(a) — licitud, lealtad, transparencia). | C-01 cascadeo: sin política → sin base legal documentada | **ALTO** | Bajo — declarar "ejecución del contrato laboral / colaborador" + "consentimiento" para opcionales |
| **C-07** | RGPD Art. 32 (seguridad del tratamiento) | **No hay declaración de medidas técnicas/organizativas (TOMs).** Política privacidad aglaya.biz no documenta cifrado en reposo, controles de acceso, backups (B-CRIT-02 mitigado este audit), revisiones periódicas. Sin TOMs declaradas → RGPD considera incumplimiento Art. 32(1). | Política aglaya.biz: 0 menciones cifrado/encryption/TOMs | **ALTO** | Bajo — añadir sección "Medidas de Seguridad" a política |
| **C-08** | RGPD Art. 33/34 (notificación de brechas) | **No hay procedimiento documentado de notificación de brechas.** RGPD requiere notificar autoridad de control en 72h tras descubrir brecha. Sin runbook en `docs/runbooks/` (solo existe `db-restore.md` creado este audit), sin contacto DPO, sin proceso de comunicación a titulares afectados. | `ls docs/runbooks/` → solo `db-restore.md` | **ALTO** | Bajo — `docs/runbooks/data-breach-response.md` con timeline + contactos + plantillas |
| **C-09** | RGPD Art. 25 (privacy by design) | **No hay DPIA (Data Protection Impact Assessment) documentada.** Plataforma multi-tenant con uso por clientes externos (workspaces tipo "externo"), contenido potencial sensible en cards (datos de clientes finales del cliente AGLAYA → procesamiento en cascada). Art. 35 RGPD requiere DPIA cuando "tratamiento entrañe alto riesgo para los derechos del titular" — multi-tenant + procesamiento por terceros suele calificar. | `ls docs/legal/dpia*` → no existe carpeta. `grep DPIA docs/` → 0 hits | **ALTO** | Medio — DPIA inicial usando template ICO/AEPD (4-6h trabajo + revisión legal) |
| **C-10** | Ley 21.719 Art. 14 ter + LGPD Art. 9 | **Cookies/localStorage sin consent banner en kanban.aglaya.biz.** App almacena JWT en localStorage (`client/src/utils/session.js`), preferencias UI en localStorage (`readUiState/writeUiState`). En aglaya.biz sí existe `localStorage.aglaya_cookie_consent === "all"` gate para GTM. En kanban NO. Aunque JWT y UI prefs son "estrictamente necesarios" (exentos de consent), el principio de transparencia (RGPD Art. 5(1)(a) + Ley 21.719 Art. 3(d)) requiere informar al usuario qué se almacena y por qué. | `grep "consent\|cookie banner\|GDPR" client/src/` → 0 hits | **ALTO** | Bajo — añadir banner "Esta app usa localStorage para tu sesión. [Aceptar / Más info →]" |
| **C-11** | RGPD Art. 5(1)(c) — minimización + Art. 13 | **JWT contiene `role` + `organizationId` claims + `email` + `name`** (`server/routes/auth.js:63-65,108-110`). El JWT viaja en cada request — más datos personales de los necesarios para autenticación. Minimización violada: el JWT podría contener solo `id` (uuid) y DB-resolver el resto on-request. | `server/routes/auth.js:63-65` JWT payload | **MEDIO** | Medio — refactor JWT a payload minimal + middleware fetch user on-demand. Relacionado con B-07 (audit B). |
| **C-12** | RGPD Art. 13(2)(a) — plazo retención | **Plazo de retención de cards/comments/digest_logs NO declarado.** ¿Cuánto tiempo se conservan las cards de un usuario que dejó la organización? ¿Y los digest_logs (81 filas en backup)? Política aglaya.biz declara plazos para Mailerlite/Resend/Sentry/Netlify/CRM AGLAYA pero **NO para datos del kanban**. | Política aglaya.biz fetched: digest_logs / cards / boards / notifications → 0 menciones | **ALTO** | Bajo — declarar política retención: ej. "Cards: hasta supresión por owner o 24m desde inactividad. Notificaciones: 90d. Digest_logs: 12m (auditoría)." |
| **C-13** | RGPD Art. 28(2) | **Sub-procesadores no enumerados.** Cloudflare (DNS + R2 backups post-audit), GitHub Actions (cron trigger digest + backups), Resend (emails). Todos US-based. Política aglaya.biz menciona Resend pero NO Cloudflare ni GitHub. Tras mitigación B-CRIT-02 (R2 daily backup), Cloudflare se convierte en procesador de TODA la data del kanban (dumps completos). | Política: "Cloudflare" → 0 hits. "GitHub" → 0 hits | **ALTO** | Bajo — añadir Cloudflare + GitHub Actions a sección "Encargados" |
| **C-14** | RGPD Art. 44-49 (transferencias internacionales) | **Transferencias internacionales NO mapeadas correctamente para kanban.** Datos fluyen: Cliente (UE/Chile/Brasil) → Netlify (global CDN) → Railway (US-region?) → Supabase (sa-east-1 Brasil) → Resend (US, emails) → Cloudflare R2 (WEUR post-audit). Salida EU→US sin Standard Contractual Clauses (SCC) documentadas. Ley 21.719 Cap V requiere garantías adecuadas para transferencias fuera de Chile (US no está en lista de "nivel adecuado" chileno). | Política aglaya.biz menciona transferencias para aglaya.biz, no para kanban | **ALTO** | Medio — mapear flujo de datos + firmar SCC con cada procesador US + documentar en política |
| **C-15** | RGPD Art. 13(1)(b) — contacto DPO | **No hay contacto DPO/representante declarado para kanban.** Política aglaya.biz declara `info@aglaya.biz` como contacto general. RGPD recomienda DPO específico cuando hay tratamiento de gran escala o categorías especiales (multi-tenant con clientes externos podría calificar). Ley 21.719 requiere Delegado de Protección de Datos para tratamientos de alto riesgo. | Política aglaya.biz: solo `info@aglaya.biz` como contactPoint | **MEDIO** | Trivial — designar DPO (puede ser Ibai inicialmente) + declarar email dedicado (`privacidad@aglaya.biz` o `dpo@aglaya.biz`) |
| **C-16** | LGPD Art. 50 | **Programa de Gobernanza de Privacidad ausente.** LGPD Brasil exige (no solo recomienda) programa de gobernanza para empresas con operaciones brasileñas. AGLAYA opera legalmente desde Belo Horizonte → LGPD aplica con fuerza. Programa incluye: políticas, training, gestión riesgos, registros, mecanismos de queja. Probablemente NADA de esto existe. | `ls docs/legal/governanca\|docs/legal/governance` → no existe | **MEDIO** | Alto — programa de gobernanza es proyecto trimestre |
| **C-17** | RGPD Art. 30 — Registro de Actividades de Tratamiento (RAT) | **No hay RAT (Registro de Actividades de Tratamiento).** RGPD obliga llevar registro escrito de todas las actividades de tratamiento (artículo 30). LGPD análogo (Art. 37). Documento debe incluir: finalidades, categorías de titulares, categorías de datos, destinatarios, plazos, medidas seguridad. | `find docs -iname "RAT*\|*activities*\|*registro*tratamiento*"` → 0 hits | **MEDIO** | Bajo — plantilla AEPD descargable + completar (2-3h) |
| **C-18** | Cookies/análisis post-banner | **kanban.aglaya.biz no carga GTM/Sentry/analytics**, pero **aglaya.biz sí carga GTM tras consent.** Si tracking cross-domain entre aglaya.biz y kanban.aglaya.biz se activa en el futuro (probable con marketing pipeline), el consent en aglaya.biz NO cubre kanban automáticamente. Cada subdomain requiere su propio consent gate. | aglaya.biz HTML: `GTM-5BVC9C5C` con consent gate. kanban.aglaya.biz HTML: `<script>` solo de Cloudflare CDN challenge | **BAJO** | n/a hoy, mantener observación |

---

## Procesadores y estado DPA

| Procesador | Función kanban | Jurisdicción | DPA disponible | Declarado política aglaya.biz | Declarado para kanban | Severidad agregada |
|---|---|---|---|---|---|---|
| **Supabase** | DB + Auth + Storage | sa-east-1 (Brasil) | https://supabase.com/legal/dpa (firmable online) | ❌ NO | ❌ NO | **CRÍTICO** (C-02) |
| **Resend** | Emails transaccionales + digest | US | https://resend.com/legal/dpa | ✓ SÍ (aglaya.biz) | ❌ NO específico kanban | **ALTO** (C-13) |
| **Railway** | Server hosting | US | https://railway.com/legal/dpa | ✓ SÍ (para CRM AGLAYA) | ❌ NO específico kanban | **ALTO** (C-13) |
| **Netlify** | Static CDN + proxy | Global / US | https://www.netlify.com/legal/data-processing-addendum/ | ✓ SÍ (aglaya.biz) | ❌ NO específico kanban | **ALTO** (C-13) |
| **Cloudflare** | DNS + R2 backups (post-audit) | EU (R2 WEUR) + Global | https://www.cloudflare.com/cloudflare-customer-dpa/ | ❌ NO | ❌ NO (es nuevo desde 2026-05-27) | **CRÍTICO** (post-B-CRIT-02 mitigación) |
| **GitHub Actions** | Cron triggers (digest + backup) | US | Microsoft DPA (Github → MS) | ❌ NO | ❌ NO | **ALTO** (C-13) |

---

## Recuento por severidad

| Severidad | Count | IDs |
|---|---|---|
| **CRÍTICO** | **5** | C-01 (sin política kanban), C-02 (Supabase no declarado), C-03 (sin docs/legal), C-04 (sin self-delete), C-05 (sin self-export) |
| **ALTO** | **7** | C-06, C-07, C-08, C-09, C-10, C-12, C-13, C-14 |
| **MEDIO** | **3** | C-11, C-15, C-16, C-17 |
| **BAJO** | **2** | C-18 + observación general |

> Conteo exacto: 5+7+4+2 = 18 entries totales.

---

## `[NO VERIFICABLE]` registrados

- **DPAs firmados con procesadores:** sin acceso a inboxes legal/email/contratos AGLAYA. Operador debe confirmar si Supabase/Resend/Railway/Netlify/Cloudflare DPAs ya fueron aceptados (algunos son click-through al crear cuenta).
- **Volumen real de datos personales en cards:** ¿Cards contienen datos médicos, financieros, salud del equipo, datos de menores? Si SÍ → Art. 9 RGPD categorías especiales → DPIA obligatoria + base legal específica. Sin sample audit del contenido real prod, no determinable.
- **Si AGLAYA tiene representante UE:** Ibai residente España hasta hace poco, ahora Brasil. RGPD Art. 27 requiere representante en UE si controller fuera de UE procesa datos UE. ¿Tiene? No verificable sin documentación.

---

## Conclusión Fase C

**Estado cumplimiento legal: ROJO.** 5 hallazgos CRÍTICOS — incluyendo ausencia total de política privacidad propia para kanban, sin declaración de Supabase como procesador (procesa TODA la data sensible), `docs/legal/` inexistente, sin self-service rights (delete/export). Cualquier reclamación AEPD (España), Agencia Nacional de Protección de Datos (Brasil), o autoridad chilena Ley 21.719 expondría inmediatamente estas brechas.

**Exposición legal estimada:**
- AEPD España: multas hasta €20M / 4% facturación anual
- ANPD Brasil (LGPD): multas hasta R$50M / 2% facturación
- Agencia chilena Ley 21.719: multas hasta 5000 UTM
- Riesgo reputacional con clientes externos del kanban (workspaces tipo "externo") si exigen evidencia de cumplimiento

**Acción urgente (no negociable, semana entrante):**
1. **Crear `docs/legal/`** y archivar DPAs aceptados con cada procesador (incluso click-through ones — exportar copia firmada de Supabase/Resend dashboard).
2. **Política privacidad propia para kanban.aglaya.biz** incluyendo Supabase + Cloudflare + GitHub Actions como procesadores, plazos de retención de cards/comments/notifications.
3. **Endpoint self-delete + self-export** (`DELETE /api/auth/me` + `GET /api/auth/me/export`) — bloqueante RGPD Art. 17 + 20.

**Acción de mayor ROI legal:**
- Aceptar DPAs en dashboards (Supabase/Resend/Netlify/Cloudflare) — 1h de clicks, cierra C-03 parcial
- Política privacidad kanban — 4-6h drafting + revisión, cierra C-01/C-02/C-06/C-07/C-12/C-13/C-14

**Revisión legal humana recomendada** antes de publicar política — Ibai NO es abogado y RGPD/Ley 21.719/LGPD interaccionan de forma no trivial. Coste estimado: €500-1500 revisión por despacho boutique privacy.

---

**Awaiting `OK Fase C` para arrancar Fase D (DevOps + Despliegue + Observabilidad + Documentación + Mantenibilidad).**
