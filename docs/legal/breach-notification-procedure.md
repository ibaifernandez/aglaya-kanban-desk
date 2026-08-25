# Procedimiento de Notificación de Brechas

**Marco legal:** RGPD Art. 33 (notificación a autoridad de control en 72h) + Art. 34 (notificación al titular) + LGPD Art. 48 + Ley 21.719 Chile (régimen breach)
**Última actualización:** 2026-08-25 *(v1.1 — cesa el correo)*
**Owner runbook:** DPO designado (🟠 pendiente C-15) o Antonio Ibai Fernández (info@aglaya.biz)

---

## Definición de brecha

RGPD Art. 4(12): "Violación de la seguridad que ocasione la destrucción, pérdida o alteración accidental o ilícita de datos personales transmitidos, conservados o tratados de otra forma, o la comunicación o acceso no autorizados a dichos datos."

**Ejemplos aplicables a AGLAYA Kanban Desk:**

- **Confidencialidad:** acceso no autorizado a DB (compromiso `SUPABASE_SERVICE_ROLE_KEY`, leak JWT, SQL injection — mitigado, XSS — mitigado B-CRIT-01)
- **Integridad:** modificación no autorizada de cards/users (atacante con JWT robado)
- **Disponibilidad:** DROP TABLE accidental, ransomware en local dev, Supabase down >tiempo de SLA, **pérdida de backups** (mitigado B-CRIT-02 quick-win)

---

## Timeline RGPD (HARD)

```
T+0h        Detección de brecha (logs, monitoring, report externo)
T+24h       Assessment inicial: scope, datos afectados, severidad
T+48h       Decisión: notificable o no (criterios Art. 33(1))
T+72h       🔴 DEADLINE notificación AEPD/ANPD/agencia chilena
T+72h+      Si afecta titulares con alto riesgo: notificación a titulares (Art. 34)
T+30 días   Post-incident report + acciones correctivas documentadas
```

---

## Procedimiento (paso a paso)

### Fase 1 — Detección (T+0)

**Fuentes de detección:**

- Sentry (🔴 PENDIENTE D-01 — sin error tracking, ceguera operativa actualmente)
- Logs Railway (manual review)
- ~~`digest_logs`~~ — suprimida el 25-ago-2026. **Esa señal de detección ya no existe**, y se dice en vez de dejarla en la lista: quien siga este procedimiento buscaría una tabla que no está
- Report externo (usuario, security researcher, bug bounty)
- npm audit / Dependabot
- Auditoría manual (como audit Mariana)

**Acciones inmediatas:**

1. Crear incidente en `docs/INCIDENTS.md` con timestamp inicial.
2. Notificar a DPO (si distinto del developer que detectó).
3. **NO comunicar públicamente todavía** hasta assessment.

### Fase 2 — Contención (T+0 a T+6h)

**Acciones técnicas según tipo de incidente:**

| Tipo de incidente | Contención inmediata |
|---|---|
| Credencial leaked | Rotar inmediatamente — ver `docs/runbooks/key-rotation.md` |
| Vulnerabilidad explotable (XSS, SQLi, etc.) | Deshabilitar endpoint afectado (Railway env var `MAINTENANCE_MODE=true` — runbook por crear) o deploy fix urgente |
| Atacante con JWT robado | Rotar `JWT_SECRET` → invalida TODAS las sesiones (impacto operativo aceptable ante breach) |
| DB corrupta / DROP TABLE | Restore desde último backup R2 — ver `docs/runbooks/db-restore.md` |
| Dev con malware | Aislar la máquina + rotar TODAS las credenciales que tuvo (key-rotation.md) |

### Fase 3 — Assessment (T+6h a T+48h)

**Documentar en `docs/INCIDENTS.md`:**

- **¿Qué datos afectados?** Categorías + estimación volumen (¿n users? ¿qué tablas? ¿qué campos?)
- **¿Quiénes los titulares?** Colaboradores AGLAYA, clientes externos, terceros mencionados en cards
- **¿Probabilidad y gravedad de riesgo para los titulares?**
- **¿Es transferencia internacional comprometida?**
- **¿Categorías especiales (Art. 9) involucradas?**

**Criterios Art. 33(1) — cuándo NO notificar:**

> "...salvo que sea improbable que dicha violación de la seguridad constituya un riesgo para los derechos y las libertades de las personas físicas."

**Ejemplos de NO notificable:**

- Brecha en datos cifrados con clave que NO fue comprometida (cifrado fuerte mitiga el riesgo)
- Datos públicos no sensibles afectados
- Detección + contención antes de cualquier acceso

**Ejemplos de SÍ notificable:**

- Cualquier compromiso de `auth.users` (passwords, incluso hasheadas si hash débil)
- Acceso no autorizado a tabla `cards` (contenido potencialmente sensible)
- Leak de `SUPABASE_SERVICE_ROLE_KEY` (acceso administrativo total)
- Backup R2 expuesto públicamente (dump completo DB)

### Fase 4 — Notificación (T+48h a T+72h)

#### 4.1 — Autoridad de control

**Españoles / titulares UE:** AEPD — https://www.aepd.es/notificacion-brechas-seguridad

**Brasileños:** ANPD — https://www.gov.br/anpd/pt-br/canais_atendimento/comunicado-de-incidente-de-seguranca

**Chilenos:** Agencia chilena protección de datos (en proceso de constitución bajo Ley 21.719 — verificar canal vigente)

**Contenido obligatorio (Art. 33(3)):**

1. Naturaleza de la violación + categorías + número aproximado de titulares + registros afectados
2. Nombre y datos de contacto del DPO (o representante)
3. Consecuencias probables
4. Medidas adoptadas o propuestas para mitigar

**Plantilla email:**

```
Asunto: Notificación de brecha de seguridad — AGLAYA Kanban Desk — [fecha incidente]

Estimada AEPD,

En cumplimiento del artículo 33 del Reglamento (UE) 2016/679 (RGPD),
notifico la siguiente violación de seguridad detectada en AGLAYA Kanban Desk:

1. Fecha de detección: [fecha + hora]
2. Fecha estimada de inicio: [fecha o "desconocida"]
3. Naturaleza de la violación: [confidencialidad / integridad / disponibilidad]
4. Categorías de titulares afectados: [colaboradores / clientes externos / terceros]
5. Número aproximado de titulares: [N]
6. Categorías de datos: [email / nombres / contenido cards / ...]
7. Consecuencias probables: [evaluación riesgo]
8. Medidas adoptadas:
   - [acción contención 1]
   - [acción contención 2]
9. Medidas propuestas:
   - [acción mitigación 1]

Responsable del tratamiento:
   Antonio Ibai Fernández Gutiérrez (AGLAYA)
   Rua Palestina s/n, Belo Horizonte, MG, Brasil
   info@aglaya.biz

DPO: [nombre DPO o "tratamiento conducido directamente por el responsable"]

Quedo a disposición para información adicional.

Atentamente,
[nombre + fecha]
```

#### 4.2 — Notificación a titulares (Art. 34)

**Cuándo:** "alto riesgo para los derechos y libertades" — ejemplos:

- Compromiso de credenciales (passwords)
- Datos financieros / salud / categorías especiales
- Identificadores que permitan suplantación

**Cómo:**

- Email a titulares afectados — plantilla genérica + ID único del incidente
- Si volumen alto / contactos no disponibles: anuncio público en https://kanban.aglaya.biz + redes sociales + nota en política privacidad

**Contenido obligatorio (Art. 34(2)):**

1. Naturaleza de la violación (lenguaje claro y sencillo)
2. Datos de contacto del DPO
3. Consecuencias probables
4. Medidas adoptadas + recomendadas al titular (ej. "cambia tu password")

---

## Documentación interna (Art. 33(5))

> "El responsable del tratamiento documentará todas las violaciones de la seguridad de los datos personales, incluyendo hechos, efectos y medidas correctivas adoptadas."

**Documentar TODA brecha en `docs/INCIDENTS.md`** incluso las NO notificables (auditoría interna).

---

## Contactos clave

| Contacto | Función | Cuándo |
|---|---|---|
| Antonio Ibai Fernández (info@aglaya.biz) | Responsable del tratamiento | Siempre |
| DPO | Coordinación interna + cara visible | Tras designación (🟠 C-15 pendiente) |
| AEPD | Autoridad UE | Titulares UE afectados |
| ANPD Brasil | Autoridad Brasil | Titulares brasileños afectados |
| Agencia chilena | Autoridad Chile | Titulares chilenos afectados |
| Despacho legal | Asesoría externa | Brechas complejas / cifras altas |

---

## Checklist post-incidente

- [ ] Incidente documentado en `docs/INCIDENTS.md` con timeline detallado
- [ ] Causa raíz identificada
- [ ] Acciones correctivas implementadas + push a `main`
- [ ] Si notificable: notificación AEPD/ANPD/agencia chilena enviada en plazo
- [ ] Si Art. 34: titulares notificados
- [ ] Si rotación claves: ejecutar `docs/runbooks/key-rotation.md`
- [ ] Lessons learned añadidas a runbook relevante
- [ ] Audit Mariana / próximo audit incorpora este incidente

---

## Mejoras pendientes al procedimiento

- 🔴 Sentry / error tracking (D-01) → mejora detección automática
- 🟠 Slack/email webhook alerts on cron failures (D-08) → reduce TTD
- 🟠 Healthcheck deep (D-16) → detecta caída dependency antes que usuario
- 🟠 Endpoint "maintenance mode" para deshabilitar app durante contención
