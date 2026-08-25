# DPIA — Data Protection Impact Assessment (Plantilla)

**Marco legal:** RGPD Art. 35 (Evaluación de impacto relativa a la protección de datos)
**Creado:** 2026-05-27 (post audit Mariana C-09)
**Estado:** 🟡 Plantilla inicial — completar por DPO/responsable cuando aplique

> Art. 35 obliga DPIA cuando un tratamiento "entrañe un alto riesgo para los derechos y libertades de las personas físicas". Multi-tenant + clientes externos + texto libre en cards califica probablemente.

---

## 1. Descripción sistemática de las operaciones

### Naturaleza del tratamiento
- Plataforma kanban multi-tenant SaaS para gestión de proyectos
- Procesamiento server-side con base de datos compartida + Row Level Security
- Usuarios humanos consultan/editan datos via web

### Alcance
- Volumen estimado: [N usuarios actuales / proyección]
- Categorías de titulares: empleados AGLAYA + freelancers + clientes externos invitados
- Geografía: principal España + Brasil + Chile; potencial UE/LATAM

### Contexto
- Plataforma interna AGLAYA + extendida a clientes finales en workspaces tipo "externo"
- Tratamiento conducido directamente por AGLAYA como responsable
- Clientes externos pueden actuar como responsables secundarios para datos de SUS propios miembros

### Finalidades
Detalle en `RAT.md`. Resumen:
1. Gestión de cuentas y acceso autenticado
2. Coordinación de trabajo (cards, comments, asignaciones)
3. Notificaciones operativas dentro de la aplicación
4. Backups de continuidad
5. Audit trail

---

## 2. Evaluación de la necesidad y proporcionalidad

### ¿Es necesario procesar estos datos?

| Categoría dato | Necesidad | Alternativa? |
|---|---|---|
| Email + nombre | Sí — auth + comunicación | N/A |
| Avatar | No — opcional UX | Iniciales generadas (default actual) |
| Contenido cards (texto libre) | Sí — propósito del producto | Sanitización + categorías estructuradas (no resuelve) |
| Asignaciones checklist | Sí — coordinación equipo | N/A |
| Adjuntos | Sí — contexto trabajo | Restricciones MIME + size aplicadas |
| IP address (logs) | Sí — security audit | Anonimización IPv4 → /24 / IPv6 → /48 (TODO) |

### ¿Es proporcional?

- ✅ Datos limitados a lo necesario para finalidad declarada
- ✅ Acceso restringido por workspace_id (RLS)
- ✅ Retención limitada (ver `retention-policy.md`)
- 🟠 Texto libre en cards → riesgo de PII no controlada (test pendiente — política de uso T&C)

---

## 3. Evaluación de riesgos

### Identificación de riesgos para los titulares

| Riesgo | Probabilidad | Impacto | Severidad |
|---|---|---|---|
| Acceso no autorizado por compromiso de credenciales | Media | Alto | 🟠 ALTO |
| Filtración de contenido de cards (PII de terceros mencionados) | Baja-Media | Medio-Alto | 🟠 ALTO |
| Brecha por XSS / vulnerabilidad en uploads | Baja (post B-CRIT-01 mitigado) | Alto | 🟡 MEDIO |
| Pérdida de datos por corruption / DROP / migration | Baja (post B-CRIT-02 mitigado quick-win) | Alto | 🟡 MEDIO |
| Atacante con JWT vigente 7d sin rotación | Baja-Media | Medio | 🟠 ALTO (B-02 abierto) |
| Stale role en JWT post-cambio admin→user | Baja | Medio | 🟡 MEDIO (B-07 abierto) |
| Multi-tenant leak via RLS bypass / bug | Muy baja | Alto | 🟡 MEDIO |
| Brecha en backups expuestos | Muy baja | Crítico | 🟡 MEDIO |

### Categorías especiales (Art. 9 RGPD)

🟠 **Riesgo controlado parcialmente:** cards permiten texto libre. Usuario malintencionado podría introducir datos de salud, religión, sindicales en cards.

**Mitigación actual:** ninguna técnica. Solo confianza en T&C.

**Mitigaciones propuestas:**
- T&C explícitos prohibiendo Art. 9 (Sprint 4)
- Filtrado automático con keyword detection (no viable hoy — texto libre + multi-idioma)
- Aceptar el riesgo declarado en política privacidad

---

## 4. Medidas previstas para hacer frente a los riesgos

### Aplicadas (post audit Mariana)

- ✅ XSS uploads mitigado (4-layer defense)
- ✅ Backup daily a Cloudflare R2
- ✅ RLS en 9/9 tablas
- ✅ Self-delete + self-export endpoints (RGPD Art. 17 + 20)
- ✅ Helmet headers en API
- ✅ Rate limiting en `/api/auth`
- ⏹ ~~Audit trail `digest_logs`~~ — suprimido el 25-ago-2026 con el correo
- ✅ docs/legal/ completo (DPA, TOMs, RAT, retention, base-legal, breach-procedure, subprocessors)
- ✅ CI workflow gate en PRs
- ✅ Error tracking Sentry (operador setea DSN)

### Pendientes (Sprint 2-4 audit roadmap)

- 🟠 JWT refresh token + access token corto (15 min) — B-02
- 🟠 Re-validación claims JWT contra DB — B-07
- 🟠 Rate limit global (no solo `/api/auth`) — B-06
- 🟠 CSP headers en HTML Netlify — B-05
- 🟠 Railway URL custom domain o WAF — B-03
- 🟠 Política T&C explícita Art. 9 — operador
- 🟠 IP anonymization en logs — server middleware

---

## 5. Consulta con titulares afectados

> Art. 35(9) recomienda recabar opinión de titulares afectados o sus representantes.

**Plan:** después de revisión legal de política privacidad + designación DPO, encuesta a usuarios actuales (10 al momento audit) sobre:
- Comprensión de la política
- Aceptación de términos de uso (incl. prohibición Art. 9)
- Preocupaciones específicas

---

## 6. Conclusión

🟡 **DPIA inicial PENDIENTE COMPLETAR** por DPO designado.

**Acción inmediata:** evaluar si tratamiento actual entra en lista AEPD/ANPD/Chile de tratamientos que requieren DPIA obligatoria (multi-tenant + datos potenciales Art. 9 sugiere SÍ).

**Próxima revisión DPIA:** cada 12 meses + tras cualquier cambio sustancial en finalidades, encargados, o categorías de datos.

---

## Referencias

- AEPD DPIA Guide: https://www.aepd.es/prensa-y-comunicacion/blog/guia-evaluaciones-impacto-de-proteccion-datos
- ICO DPIA Template: https://ico.org.uk/media/for-organisations/documents/2553993/dpia-template.docx
- ANPD Brasil DPIA: https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-orientativo-rendimento-da-anpd
- RAT relacionado: `RAT.md`
- TOMs aplicadas: `TOMs.md`
- Procesadores: `subprocessors.md`
