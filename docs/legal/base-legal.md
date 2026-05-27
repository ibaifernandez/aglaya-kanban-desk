# Base Jurídica del Tratamiento

**Marco legal:** RGPD Art. 6 (Licitud del tratamiento) + Ley 21.719 Art. 9 (Chile) + LGPD Art. 7 (Brasil)
**Última actualización:** 2026-05-27 (borrador post-audit Mariana C-06)

> RGPD Art. 5(1)(a) — principio de licitud: todo tratamiento requiere base jurídica explícita. Este documento la declara por finalidad.

---

## Resumen por actividad

| # | Actividad (ver `RAT.md`) | Base legal RGPD | Base legal LGPD | Base Ley 21.719 |
|---|---|---|---|---|
| 1 | Gestión de cuentas colaboradores | Art. 6(1)(b) ejecución contractual | Art. 7(V) ejecução de contrato | Art. 9 ejecución contrato |
| 2 | Cards y trabajo del equipo | Art. 6(1)(b) ejecución + Art. 6(1)(f) interés legítimo | Art. 7(V) + Art. 7(IX) interesse legítimo | Art. 9 consentimiento + interés legítimo |
| 3 | Notificaciones in-app + digest emails | Art. 6(1)(b) ejecución + Art. 6(1)(a) consentimiento (opt-out granular) | Art. 7(V) + Art. 7(I) consentimento | Art. 9 ejecución + consentimiento |
| 4 | Backups operacionales | Art. 6(1)(c) obligación legal + Art. 6(1)(f) interés legítimo | Art. 7(II) cumprimento de obrigação legal | Art. 9 cumplimiento obligaciones legales |
| 5 | Audit trail digest_logs | Art. 6(1)(f) interés legítimo | Art. 7(IX) interesse legítimo | Art. 9 interés legítimo |

---

## Detalle por finalidad

### Finalidad 1: gestión de cuentas

**Base:** ejecución de un contrato (RGPD Art. 6(1)(b)) en el que el titular es parte.

**Justificación:**
- AGLAYA y el colaborador tienen relación contractual (laboral / freelance / acuerdo de colaboración).
- Crear y mantener cuenta para acceder al kanban es **necesario para ejecutar dicho contrato**.
- Sin cuenta, el colaborador no puede realizar el trabajo contratado.

**Consentimiento NO aplica** porque:
- El consentimiento debe ser libre. En un contrato laboral hay desequilibrio de poder → consentimiento no genuino para el tratamiento necesario.
- Recomendado por EDPB Guidelines 5/2020 sobre consentimiento.

**Para colaboradores en workspaces "externos" (clientes finales):**
- Base: ejecución de contrato AGLAYA ↔ cliente final + ejecución contrato cliente ↔ colaborador del cliente.
- Cliente final actúa como responsable secundario para sus propios miembros.

---

### Finalidad 2: cards y trabajo

**Base primaria:** ejecución contractual (Art. 6(1)(b)).
**Base secundaria:** interés legítimo (Art. 6(1)(f)) cuando el tratamiento beneficia a AGLAYA sin afectar derechos del titular.

**Test de interés legítimo (RGPD Art. 6(1)(f)) — balance:**

| Factor | Análisis |
|---|---|
| Interés perseguido por AGLAYA | Coordinación operativa, gestión proyectos, audit trail de trabajo entregado |
| Necesidad del tratamiento | Sí — sin contenido de cards, no hay kanban |
| Balance vs derechos del titular | Bajo impacto cuando cards no contienen PII de terceros |
| Expectativas razonables del titular | Alta — colaborador espera que su trabajo quede registrado |

**Cuando cards contienen PII de terceros (clientes finales del cliente AGLAYA):**
- AGLAYA actúa como **encargado** del tratamiento (procesa por cuenta del cliente final como responsable).
- Requiere DPA AGLAYA ↔ cliente final (Art. 28(3)).
- 🟠 **PENDIENTE:** template DPA AGLAYA-cliente — `docs/legal/dpas/template-aglaya-as-processor.md` (no creado todavía).

---

### Finalidad 3: notificaciones + digest emails

**Base primaria:** ejecución contractual (Art. 6(1)(b)) — comunicar al colaborador su trabajo asignado.

**Base secundaria:** consentimiento (Art. 6(1)(a)) para digest emails (que el usuario puede deshabilitar individual con `digest_enabled = false`).

**Justificación opt-out granular:**
- Digest email no es estrictamente necesario para ejecución (in-app notifications ya cumplen el rol).
- Usuario puede deshabilitar sin afectar funcionalidad principal.
- Por tanto digest es opt-out → consentimiento revocable.

---

### Finalidad 4: backups

**Base primaria:** obligación legal de seguridad (RGPD Art. 6(1)(c) + Art. 32).
**Base secundaria:** interés legítimo de continuidad del negocio (Art. 6(1)(f)).

**Justificación:**
- Art. 32 RGPD exige "medidas técnicas y organizativas para garantizar un nivel de seguridad adecuado" — backups son medida estándar.
- Mitigación B-CRIT-02 audit Mariana 2026-05-27 implementó workflow daily.
- Retention 30 días proporcional al RPO objetivo.

---

### Finalidad 5: audit trail

**Base:** interés legítimo (Art. 6(1)(f)) en mantener trazabilidad de envíos de email.

**Test interés legítimo:**
- Interés AGLAYA: debugging + compliance audit trail (demostrar envío ante reclamación).
- Impacto titular: bajo — solo se registra email + status + timestamp.
- Acceso restringido: RLS limita lectura a admins.

---

## Categorías especiales (RGPD Art. 9)

**Tratamiento de categorías especiales NO está autorizado en kanban por defecto.**

🟠 **PENDIENTE DECISIÓN operador:**
- ¿Prohibición explícita en T&C de servicio? ("No introducir datos de salud, religión, sindicales en cards")
- ¿Filtrado automático? (técnicamente difícil con texto libre — solo posible patrón keyword)
- Si algún cliente externo necesita procesar Art. 9 → requiere DPIA específica (Art. 35) + consentimiento explícito (Art. 9(2)(a))

---

## Decisiones automatizadas / profiling (RGPD Art. 22)

**No aplica.** Kanban no realiza decisiones automatizadas que produzcan efectos jurídicos en el titular ni profiling significativo. Las prioridades de cards las asignan humanos.

---

## Revocación / retirada de consentimiento

Para tratamientos basados en consentimiento (digest emails, futuras opt-ins):

- **Mecanismo:** `PATCH /api/auth/me/preferences` con `{ digest_enabled: false }`.
- **Frontend:** UI de `DigestPreferences.jsx` permite toggle.
- **Efecto:** inmediato — próximo cron de digest excluye al usuario.
- **Información:** el usuario debe ser informado del derecho a retirar antes de dar consent (Art. 7(3) RGPD).

---

## Acciones pendientes (operador)

- [ ] Confirmar declaración base legal en política privacidad kanban
- [ ] Decidir política para categorías especiales Art. 9 en cards (prohibir vs filtrar vs permitir con DPIA)
- [ ] Template DPA AGLAYA-as-processor para clientes finales en workspaces "externos"
- [ ] Documentar mecanismo revocación consentimiento en política
