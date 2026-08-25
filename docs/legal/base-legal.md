# Base Jurídica del Tratamiento

**Marco legal:** RGPD Art. 6 (Licitud del tratamiento) + Ley 21.719 Art. 9 (Chile) + LGPD Art. 7 (Brasil)
**Última actualización:** 2026-08-25 *(v1.1 — cesa el correo)*

> RGPD Art. 5(1)(a) — principio de licitud: todo tratamiento requiere base jurídica explícita. Este documento la declara por finalidad.

---

## Resumen por actividad

| # | Actividad (ver `RAT.md`) | Base legal RGPD | Base legal LGPD | Base Ley 21.719 |
|---|---|---|---|---|
| 1 | Gestión de cuentas colaboradores | Art. 6(1)(b) ejecución contractual | Art. 7(V) ejecução de contrato | Art. 9 ejecución contrato |
| 2 | Cards y trabajo del equipo | Art. 6(1)(b) ejecución + Art. 6(1)(f) interés legítimo | Art. 7(V) + Art. 7(IX) interesse legítimo | Art. 9 consentimiento + interés legítimo |
| 3 | Notificaciones dentro de la aplicación | Art. 6(1)(b) ejecución | Art. 7(V) execução | Art. 9 ejecución |
| 4 | Backups operacionales | Art. 6(1)(c) obligación legal + Art. 6(1)(f) interés legítimo | Art. 7(II) cumprimento de obrigação legal | Art. 9 cumplimiento obligaciones legales |
| ~~5~~ | ~~Audit trail `digest_logs`~~ ⏹ **cesado 2026-08-25** | *(fue Art. 6(1)(f) interés legítimo)* | *(fue Art. 7(IX))* | *(fue Art. 9)* |

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

### Finalidad 3: notificaciones dentro de la aplicación

**Base primaria y única:** ejecución contractual (Art. 6(1)(b)) — comunicar al
colaborador su trabajo asignado.

> **⏹ La base secundaria de consentimiento CESÓ el 25-ago-2026.** Amparaba el
> resumen diario por correo, que era opt-out con un `toggle` de preferencias.
> **Ese tratamiento ya no existe**: la aplicación no envía correo.
>
> Consecuencia que conviene ver: **hoy ningún tratamiento de esta nave se apoya
> en consentimiento.** El aviso in-app va por ejecución contractual, está ligado
> al uso del servicio y por eso no tiene opt-out — que es distinto de habérselo
> quitado a alguien.

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

**Hoy no hay ningún tratamiento basado en consentimiento**, así que no hay nada
que retirar. El único que lo usaba —el resumen diario por correo— cesó el
25-ago-2026 junto con su mecanismo de retirada.

⚠️ **Y por eso esta sección no se borra:** si mañana entra un tratamiento con
consentimiento, tiene que traer su mecanismo de retirada **antes** de recogerlo,
y el usuario debe ser informado del derecho a retirar antes de darlo (Art. 7(3)
RGPD). Lo que aquí había —un `toggle` de efecto inmediato— es el listón, no una
sugerencia.

---

## Acciones pendientes (operador)

- [ ] Confirmar declaración base legal en política privacidad kanban
- [ ] Decidir política para categorías especiales Art. 9 en cards (prohibir vs filtrar vs permitir con DPIA)
- [ ] Template DPA AGLAYA-as-processor para clientes finales en workspaces "externos"
- [ ] Documentar mecanismo revocación consentimiento en política
