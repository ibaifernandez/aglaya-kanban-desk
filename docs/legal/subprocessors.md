# Sub-procesadores activos

**Marco legal:** RGPD Art. 28(2) — el encargado del tratamiento no podrá contratar a otro encargado sin autorización del responsable + obligación de informar sub-procesadores
**Última actualización:** 2026-05-27 (post audit Mariana — Cloudflare añadido)

> Esta lista debe mantenerse actualizada y sincronizada con la política privacidad kanban. Cambios requieren notificación al titular según contrato.

---

## Sub-procesadores DIRECTOS de AGLAYA Kanban Desk

### Infraestructura y hosting

| # | Procesador | Función | Región datos | DPA | Página subprocesadores |
|---|---|---|---|---|---|
| 1 | **Supabase** | Database (Postgres), Auth, Storage | sa-east-1 (Brasil) | [Link](https://supabase.com/legal/dpa) | [Link](https://supabase.com/legal/subprocessors) |
| 2 | **Railway** | Server hosting (Express) | US (default plan) | [Link](https://railway.com/legal/dpa) | [Link](https://railway.com/legal/subprocessors) |
| 3 | **Netlify** | Static CDN (cliente React build) + reverse proxy | Global CDN | [Link](https://www.netlify.com/legal/data-processing-addendum/) | [Link](https://www.netlify.com/gdpr-ccpa/subprocessors/) |
| 4 | **Cloudflare** | DNS authoritative + R2 storage (backups daily desde 2026-05-27) | EU (R2 WEUR), Global (DNS) | [Link](https://www.cloudflare.com/cloudflare-customer-dpa/) | [Link](https://www.cloudflare.com/cloudflare-customer-subprocessors/) |

### Servicios operativos

| # | Procesador | Función | Región datos | DPA |
|---|---|---|---|---|
| 5 | **Resend** | Email transaccional (digest + notificaciones + welcome + password reset) | US | [Link](https://resend.com/legal/dpa) |
| 6 | **GitHub Actions** | Cron triggers (digest-cron + db-backup) | US (cubierto Microsoft Online Services DPA) | [Link](https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA) |

---

## Sub-procesadores INDIRECTOS (sub-sub-procesadores)

A través de los procesadores directos:

| Procesador directo | Sub-procesador indirecto | Función |
|---|---|---|
| Supabase | AWS (RDS Postgres, S3 Storage) | Infra Supabase |
| Railway | Google Cloud Platform | Infra Railway |
| Netlify | AWS, Cloudflare | Infra Netlify |
| Cloudflare | AWS (algunos servicios), GCP | Infra Cloudflare |
| Resend | AWS | Infra Resend |
| GitHub Actions | Microsoft Azure | Infra GitHub |

---

## Cambios recientes

| Fecha | Cambio | Razón |
|---|---|---|
| 2026-05-27 | **Cloudflare añadido como procesador kanban** (antes solo DNS) | Mitigación B-CRIT-02 audit Mariana — backups daily a R2 bucket `aglaya-kanban-backups-prod` (WEUR) |

---

## Procesadores que NO son del kanban

Política aglaya.biz menciona los siguientes, pero kanban NO los usa:

- **MailerLite** — marketing emails aglaya.biz only
- **hCaptcha** — anti-bot aglaya.biz forms only
- **CRM AGLAYA** — sistema interno separado, sin sync con kanban

---

## Transferencias internacionales

### Resumen por jurisdicción destino

| Destino | Procesadores | Mecanismo de transferencia |
|---|---|---|
| **Brasil (sa-east-1)** | Supabase | Dentro de Brasil. Desde UE: SCCs requeridas (Brasil no está en lista RGPD "países adecuados") |
| **US** | Railway, Resend, GitHub Actions | SCCs (Standard Contractual Clauses) — cada procesador incluye SCCs en su DPA |
| **EU (Cloudflare R2 WEUR)** | Cloudflare (backups) | Dentro UE → desde Brasil: garantías adecuadas requeridas |
| **Global CDN** | Netlify | Datos pueden replicarse globalmente — política Netlify cubre SCCs |

### SCCs aplicables

- **EU → US:** Modelo EU SCCs 2021 (Implementing Decision 2021/914)
- **Brasil → EU/US:** ANPD reconoce SCCs equivalentes
- **UE → Brasil:** SCCs específicas (Brasil no es país adecuado bajo RGPD por ahora)

---

## Pruebas de garantías

Para cada procesador listed, verificar (operador):

- [ ] DPA aceptado (ver `DPA-registry.md`)
- [ ] SCCs incluidas en DPA (típico en DPAs modernos)
- [ ] Política privacidad procesador publicada
- [ ] Notificación de sub-procesadores configurada (si procesador lo ofrece — Supabase, Cloudflare lo notifican)

---

## Procedimiento de adición nuevo procesador

Antes de añadir un nuevo procesador al stack:

1. Verificar DPA template disponible
2. Verificar jurisdicción + transferencia internacional
3. Evaluar test interés legítimo / necesidad
4. Aceptar DPA en dashboard del procesador
5. Actualizar `subprocessors.md` (este archivo)
6. Actualizar `DPA-registry.md`
7. Actualizar política privacidad kanban
8. Notificar a usuarios afectados según contrato (típico: aviso en política con efecto 30 días después)
