# docs/legal — Documentación legal de cumplimiento

**Última actualización:** 2026-05-27 (creado durante audit Mariana — C-03)
**Responsable:** Antonio Ibai Fernández Gutiérrez (AGLAYA)
**Marco aplicable:** RGPD (UE) · Ley 21.719 (Chile) · LGPD (Brasil) · CCPA (probablemente N/A)

Esta carpeta agrega la documentación de cumplimiento en privacidad y protección de datos del proyecto AGLAYA Kanban Desk. Su existencia cubre el hallazgo audit Mariana C-03 (`docs/audits/2026-05-27-mariana/audit-C.md`) — RGPD Art. 28(3) + Ley 21.719 Art. 24 + LGPD Art. 39 requieren documentación escrita de los acuerdos con encargados del tratamiento.

---

## Índice

| Documento | Propósito | Marco legal | Estado |
|---|---|---|---|
| [`RAT.md`](RAT.md) | Registro de Actividades de Tratamiento | RGPD Art. 30 + LGPD Art. 37 | 🟡 plantilla inicial |
| [`TOMs.md`](TOMs.md) | Technical and Organizational Measures | RGPD Art. 32 | 🟡 plantilla inicial |
| [`DPA-registry.md`](DPA-registry.md) | Registro de DPAs firmados con cada encargado | RGPD Art. 28 | 🔴 pendiente acceso operador a cada dashboard procesador |
| [`retention-policy.md`](retention-policy.md) | Plazos de retención por categoría de datos | RGPD Art. 5(1)(e) + 13(2)(a) | 🟡 plantilla — pendiente decisión operador |
| [`base-legal.md`](base-legal.md) | Base jurídica del tratamiento por finalidad | RGPD Art. 6 + Ley 21.719 Art. 9 | 🟡 borrador inicial |
| [`breach-notification-procedure.md`](breach-notification-procedure.md) | Procedimiento notificación brechas (72h) | RGPD Art. 33/34 | 🟡 borrador inicial |
| [`DPIA-template.md`](DPIA-template.md) | Data Protection Impact Assessment plantilla | RGPD Art. 35 | 🔴 sin completar |
| [`subprocessors.md`](subprocessors.md) | Lista actualizada de sub-procesadores | RGPD Art. 28(2) | 🟢 completo (base audit) |
| [`privacy-policy-kanban.md`](privacy-policy-kanban.md) | Política privacidad kanban.aglaya.biz | RGPD Art. 13/14 | ✅ v1.0 aprobada por operador — pendiente publicación pública en `/privacidad` |

---

## Flujo de mantenimiento

1. **Tras cambio de procesadores** (añadir Sentry, cambiar email provider, etc.): actualizar `subprocessors.md` + `DPA-registry.md` + `privacy-policy-kanban.draft.md`.
2. **Tras cambio en categorías de datos** (añadir campo PII a alguna tabla): actualizar `RAT.md` + `retention-policy.md`.
3. **Tras incidente de seguridad**: ejecutar `breach-notification-procedure.md`.
4. **Quarterly review**: revisar todos los documentos contra realidad del repo.

---

## Decisiones tomadas (2026-05-27)

- ✅ **DPO informal:** Antonio Ibai Fernández (info@aglaya.biz). Sin email dedicado — asuntos `[Privacidad]` / `[RGPD]` diferencian.
- ✅ **Retention finalizada:**
  - Cards activas: indefinida mientras workspace activo
  - Cards archivadas: 24 meses post-archive → hard-delete automático
  - Comments: siguen vida de la card
  - Attachments huérfanos: auto-cleanup tras 90 días sin card asociada (workflow pendiente sprint 3)
  - `notifications` leídas: 90 días
- ✅ **Supabase Pro $25/mo declinado** por operador. Quick-win backup (workflow daily a R2) es la solución permanente.
- ✅ **Representante UE Art. 27 RGPD diferido:** mientras base usuarios EU <5000/año estimado, no requerido obligatoriamente. Re-evaluar si volumen crece.
- ✅ **Revisión legal externa declinada** por operador. Política aprobada in-house por audit Mariana + responsable Ibai. Versión 1.0 publishable.

---

## Referencias

- Audit Mariana fase C: `docs/audits/2026-05-27-mariana/audit-C.md`
- Política aglaya.biz vigente: https://aglaya.biz/es/privacidad/
- Política inglés: https://aglaya.biz/privacy/
- Política portugués: https://aglaya.biz/pt/privacidade/
