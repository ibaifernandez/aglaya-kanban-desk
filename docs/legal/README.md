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
| [`privacy-policy-kanban.draft.md`](privacy-policy-kanban.draft.md) | Borrador política privacidad kanban.aglaya.biz | RGPD Art. 13/14 | 🟡 borrador — **revisión legal externa requerida antes de publicar** |

---

## Flujo de mantenimiento

1. **Tras cambio de procesadores** (añadir Sentry, cambiar email provider, etc.): actualizar `subprocessors.md` + `DPA-registry.md` + `privacy-policy-kanban.draft.md`.
2. **Tras cambio en categorías de datos** (añadir campo PII a alguna tabla): actualizar `RAT.md` + `retention-policy.md`.
3. **Tras incidente de seguridad**: ejecutar `breach-notification-procedure.md`.
4. **Quarterly review**: revisar todos los documentos contra realidad del repo.

---

## Decisiones de negocio pendientes (operador)

Sister NO puede tomar estas decisiones — requieren input del operador:

- [ ] **DPO designación.** ¿Ibai inicial? Crear `privacidad@aglaya.biz` o `dpo@aglaya.biz`?
- [ ] **Retention exacta:**
  - ¿Cards activas? ¿24 meses post-archive? ¿perpetua mientras workspace activo?
  - ¿Comments? ¿siguen la vida de la card o tienen retención propia?
  - ¿Attachments huérfanos? ¿auto-cleanup tras X meses sin card asociada?
  - ¿`digest_logs`? (audit trail — sugerido 12-24 meses)
  - ¿`notifications` leídas? (sugerido 90 días — ya están particionadas)
- [ ] **Upgrade Supabase Pro $25/mo** (PITR + daily backups gestionados → reemplaza workflow custom B-CRIT-02 mitigación)
- [ ] **Representante UE** (RGPD Art. 27). Ibai operación en Brasil → si procesa datos UE, requiere representante UE designado. ¿Asesor legal asignado?
- [ ] **Revisión legal externa** política privacidad kanban antes de publicar. Coste estimado €500-1500 despacho boutique privacy.

---

## Referencias

- Audit Mariana fase C: `docs/audits/2026-05-27-mariana/audit-C.md`
- Política aglaya.biz vigente: https://aglaya.biz/es/privacidad/
- Política inglés: https://aglaya.biz/privacy/
- Política portugués: https://aglaya.biz/pt/privacidade/
