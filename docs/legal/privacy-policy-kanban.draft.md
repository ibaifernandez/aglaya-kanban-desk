# Política de Privacidad — AGLAYA Kanban Desk

> **🟡 BORRADOR — pendiente revisión legal externa antes de publicar.**
> Generado durante audit Mariana 2026-05-27 (hallazgo C-01).
> Despacho boutique privacy recomendado: €500-1500. Hasta revisión, NO publicar.

**Última actualización:** 2026-05-27
**Versión:** 1.0-draft
**Aplicable a:** https://kanban.aglaya.biz (y subdominios `*.kanban.aglaya.biz` futuros)

---

## 1. Responsable del Tratamiento

| | |
|---|---|
| **Titular** | Antonio Ibai Fernández Gutiérrez |
| **Nombre comercial** | AGLAYA |
| **Domicilio** | Rua Palestina s/n, Belo Horizonte, Minas Gerais, Brasil, CEP 30850-000 |
| **Email general** | info@aglaya.biz |
| **Email privacidad** | 🟠 [pendiente — sugerido `privacidad@aglaya.biz` o `dpo@aglaya.biz`] |
| **Sitio web** | aglaya.biz |
| **Aplicación** | kanban.aglaya.biz |

> AGLAYA opera legalmente desde Brasil. Cuando procesamos datos de residentes UE/EEE, lo hacemos en conformidad con el RGPD (Reglamento (UE) 2016/679). Cuando procesamos datos de residentes brasileños, aplicamos la LGPD (Lei nº 13.709/2018). Cuando procesamos datos de residentes chilenos, aplicamos la Ley 21.719.

---

## 2. Datos Personales que Recopilamos

### 2.1 Datos de cuenta

Al crear una cuenta (vía invitación de un administrador AGLAYA):

- **Email corporativo** (obligatorio)
- **Nombre completo** (obligatorio)
- **Avatar** (opcional — imagen que tú subes)
- **Rol asignado** (`superadmin`, `admin`, `colaborador`, `cliente`, `guest`)
- **Organización** asociada
- **Preferencias de digest:** hora preferida (0-23 UTC) + opt-out (`digest_enabled`)
- **Metadatos de autenticación** (gestionados por Supabase Auth): timestamp de último inicio de sesión, IP del último login (vía proveedor de auth), confirmación de email

### 2.2 Contenido que tú generas

Cuando usas el kanban:

- **Cards** (tareas): título, descripción (texto libre), prioridad, fecha límite, etiquetas
- **Comentarios** en cards
- **Checklist items** con asignaciones a otros usuarios
- **Adjuntos** que subes (imágenes, PDFs, CSV, TXT — formatos restringidos por seguridad)
- **Workspaces y boards** que creas
- **Categorías** definidas

> **Categorías especiales (Art. 9 RGPD):** NO autorizamos el procesamiento de datos de salud, ideología religiosa, opiniones políticas, afiliación sindical, vida sexual u origen racial/étnico en el contenido del kanban. Si introduces este tipo de datos voluntariamente, eres responsable. AGLAYA puede retirar cualquier contenido que viole estos términos.

### 2.3 Datos de uso operativo

Automáticamente generados:

- **Logs de envío de email** (`digest_logs`): tipo de envío, estado, mensajes de error
- **Notificaciones** generadas por asignaciones y menciones
- **Timestamps** de creación, edición y borrado de cada registro
- **Logs del servidor** (Railway): direcciones IP, user-agents, paths consultados — retenidos típicamente 7-30 días por Railway

### 2.4 Lo que NO recopilamos

- Información de tarjeta bancaria (kanban no procesa pagos)
- Cookies de tracking publicitario
- Datos de comportamiento para perfilado
- Información de salud, financiera personal, religión, política, sindicato, vida sexual, origen étnico
- Datos biométricos

---

## 3. Para Qué Usamos tus Datos (Finalidades)

Detalle completo en `docs/legal/RAT.md` (Registro de Actividades de Tratamiento). Resumen:

| Finalidad | Base legal |
|---|---|
| Permitir acceso al kanban | Ejecución contractual (RGPD Art. 6(1)(b)) |
| Mostrar y gestionar tu trabajo (cards, comments) | Ejecución contractual + interés legítimo |
| Enviar notificaciones en-app y digest emails | Ejecución contractual + consentimiento (opt-out granular vía `digest_enabled`) |
| Backups operacionales | Obligación legal de seguridad (Art. 6(1)(c) + Art. 32 RGPD) |
| Audit trail (`digest_logs`) | Interés legítimo |

> **Decisiones automatizadas (Art. 22 RGPD):** AGLAYA Kanban Desk NO toma decisiones automatizadas con efectos jurídicos sobre ti ni realiza profiling significativo. Las prioridades, asignaciones y aprobaciones siempre son humanas.

---

## 4. Encargados del Tratamiento (Sub-procesadores)

Compartimos datos con los siguientes encargados, sujetos a DPA (Data Processing Agreement) que asegura el cumplimiento del RGPD/LGPD/Ley 21.719:

| Encargado | Función | Jurisdicción de datos | Página oficial sub-procesadores |
|---|---|---|---|
| **Supabase Inc.** | Base de datos (PostgreSQL), autenticación, almacenamiento | sa-east-1 (São Paulo, Brasil) | https://supabase.com/legal/subprocessors |
| **Resend Inc.** | Envío de emails transaccionales (digest + notificaciones + recuperación de contraseña) | Estados Unidos | https://resend.com/legal/subprocessors |
| **Railway Corp.** | Hosting del servidor backend | Estados Unidos | https://railway.com/legal/subprocessors |
| **Netlify Inc.** | CDN del cliente web + proxy `/api/*` y `/uploads/*` | Global (red de distribución) | https://www.netlify.com/gdpr-ccpa/subprocessors/ |
| **Cloudflare Inc.** | DNS de `aglaya.biz` + bucket R2 para backups diarios cifrados (WEUR — Europa) | Europa occidental (WEUR) para backups; DNS global | https://www.cloudflare.com/cloudflare-customer-subprocessors/ |
| **GitHub Inc. (Microsoft)** | Triggers de cron jobs (digest horario, backup diario) | Estados Unidos | Cubierto por Microsoft Online Services DPA |

> No vendemos tus datos personales. No compartimos datos con terceros más allá de los encargados listados.

---

## 5. Transferencias Internacionales

Algunos encargados están fuera del Espacio Económico Europeo:

- **Supabase / Resend / Railway / GitHub:** Estados Unidos. Garantías: Standard Contractual Clauses (SCCs) Implementing Decision 2021/914 incluidas en cada DPA.
- **Cloudflare R2:** región WEUR (UE) para backups — sin transferencia fuera de UE para este flujo específico.
- **Netlify:** CDN global con SCCs.

> Para residentes de Chile (Ley 21.719): las transferencias internacionales se realizan con cláusulas contractuales modelo aprobadas o equivalentes, conforme al Capítulo V de la Ley 21.719.

---

## 6. Plazos de Conservación

Detalle completo en `docs/legal/retention-policy.md`. Resumen:

| Categoría | Plazo |
|---|---|
| Datos de cuenta (activa) | Indefinida mientras la cuenta esté activa |
| Datos de cuenta tras solicitud de supresión | Eliminados en máximo 30 días desde solicitud verificada |
| Cards y contenido del workspace | Indefinida mientras el workspace esté activo |
| Cards archivadas | 🟠 [pendiente decisión final operador — sugerido 24 meses post-archive] |
| Notificaciones leídas | 90 días |
| Audit logs (`digest_logs`) | 🟠 [pendiente — sugerido 12-24 meses] |
| Backups operacionales (Cloudflare R2) | 30 días con rotación automática |
| Logs de servidor (Railway) | 7-30 días según plan |
| Logs CDN (Netlify) | 7 días |

> Conservamos algunos datos durante períodos más largos si lo exige obligación legal (Art. 17(3)(b) RGPD): procesos judiciales, requerimientos de autoridad, obligaciones fiscales/contables brasileñas (5 años).

---

## 7. Tus Derechos

Como titular de los datos, tienes derecho a:

### 7.1 Derechos disponibles vía interfaz directa (self-service)

| Derecho | Mecanismo en la aplicación |
|---|---|
| **Acceso (Art. 15 RGPD)** | Tu perfil en el menú de usuario muestra tus datos básicos |
| **Portabilidad (Art. 20 RGPD)** | `GET /api/auth/me/export` — descarga JSON con todos tus datos. UI disponible en tu perfil |
| **Supresión / "derecho al olvido" (Art. 17 RGPD)** | `DELETE /api/auth/me` — elimina tu cuenta. UI disponible en tu perfil |
| **Oposición a comunicaciones (Art. 21 + Art. 6 LGPD)** | Toggle `digest_enabled` en preferencias de usuario deshabilita digest emails |

### 7.2 Derechos vía contacto directo

| Derecho | Cómo ejercerlo |
|---|---|
| **Rectificación (Art. 16 RGPD)** | Edita tu perfil directamente. Si necesitas corregir datos no editables, contacta `info@aglaya.biz` |
| **Limitación del tratamiento (Art. 18 RGPD)** | Email a `info@aglaya.biz` con asunto `[RGPD] Limitación` + justificación |
| **No estar sujeto a decisiones automatizadas (Art. 22 RGPD)** | N/A — AGLAYA Kanban Desk no toma decisiones automatizadas significativas |
| **Retirar consentimiento** | Para tratamientos basados en consentimiento (ej. digest), toggle directo en preferencias. Efecto inmediato. |

### 7.3 Reclamación ante autoridad

Si consideras que el tratamiento infringe la normativa, tienes derecho a presentar reclamación ante:

- **España / UE:** Agencia Española de Protección de Datos (AEPD) — https://www.aepd.es
- **Brasil:** Autoridade Nacional de Proteção de Dados (ANPD) — https://www.gov.br/anpd
- **Chile:** Agencia de Protección de Datos chilena (en proceso de constitución bajo Ley 21.719)
- **Cualquier otra UE:** tu autoridad de control nacional

---

## 8. Cookies y Almacenamiento Local

AGLAYA Kanban Desk NO usa cookies de tracking publicitario ni analytics de terceros.

**localStorage** del navegador almacena (estrictamente necesario para funcionamiento):

| Clave | Propósito |
|---|---|
| `aglaya_token` (o equivalente — JWT) | Token de autenticación firmado (RGPD Art. 6(1)(b) ejecución contractual) |
| `aglaya_session` | Estado de UI (workspace activo, board seleccionado) |

Estos elementos son estrictamente necesarios para que la app funcione. RGPD/Ley 21.719/LGPD exceptúan los elementos "estrictamente necesarios" del requisito de consentimiento previo.

> **Sentry (futuro):** si se activa la observabilidad técnica con Sentry, capturará información de errores anonimizada. Detalles técnicos: ver `docs/SECURITY.md` y `docs/legal/TOMs.md`. La política se actualizará para reflejar este uso antes de su activación.

---

## 9. Seguridad de los Datos

Aplicamos medidas técnicas y organizativas adecuadas (RGPD Art. 32). Detalle completo en `docs/legal/TOMs.md`. Resumen:

- HTTPS obligatorio en producción + HSTS
- Autenticación multi-capa (JWT firmado + middleware de autorización por workspace)
- Row Level Security (RLS) en base de datos para aislamiento multi-tenant
- Cifrado de datos en reposo (Supabase Postgres + Cloudflare R2)
- Validación de uploads en 4 capas (extension/MIME blocklist + MIME allowlist + magic-bytes)
- Backups diarios cifrados con retención 30 días
- Rate limiting en endpoints de autenticación
- Helmet (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Aislamiento de credenciales (service_role nunca expuesta al cliente)

---

## 10. Brechas de Seguridad

En caso de brecha de seguridad que comporte riesgo para tus derechos:

- **Notificación a autoridades:** en plazo de 72 horas (RGPD Art. 33).
- **Notificación a titulares afectados:** sin dilación indebida cuando exista alto riesgo (RGPD Art. 34).

Procedimiento documentado en `docs/legal/breach-notification-procedure.md`.

---

## 11. Menores

AGLAYA Kanban Desk está dirigido a uso profesional. NO recopilamos conscientemente datos de menores de 16 años. Si descubrimos que tenemos datos de un menor sin consentimiento parental válido, los eliminaremos en plazo máximo de 30 días.

---

## 12. Cambios en esta Política

Esta política puede actualizarse. Cambios sustanciales se notificarán:

- Email a usuarios con cuenta activa (mínimo 30 días antes del cambio)
- Notificación in-app
- Actualización de la fecha de "Última actualización" al inicio del documento

Si no estás de acuerdo con cambios sustanciales, puedes solicitar la supresión de tu cuenta (Art. 17 RGPD) en cualquier momento.

---

## 13. Contacto

Para cualquier consulta relacionada con privacidad:

- **Email general:** info@aglaya.biz
- **Email privacidad / DPO:** 🟠 [pendiente — sugerido `privacidad@aglaya.biz` o `dpo@aglaya.biz`]

Para ejercer derechos RGPD/LGPD/Ley 21.719 que requieran contacto humano, usa el email de privacidad. Plazo de respuesta máximo: 30 días (RGPD Art. 12(3)).

---

## 14. Información Legal Adicional

Detalle técnico y operativo en:

- **`docs/legal/RAT.md`** — Registro de Actividades de Tratamiento
- **`docs/legal/TOMs.md`** — Medidas Técnicas y Organizativas
- **`docs/legal/DPA-registry.md`** — Estado de DPAs con cada encargado
- **`docs/legal/base-legal.md`** — Base jurídica del tratamiento por finalidad
- **`docs/legal/retention-policy.md`** — Plazos de conservación detallados
- **`docs/legal/subprocessors.md`** — Lista actualizada de sub-procesadores
- **`docs/legal/breach-notification-procedure.md`** — Procedimiento de notificación de brechas

Estos documentos son fuente de verdad operativa y se actualizan con cada cambio en la infraestructura o procesadores.

---

## Pendiente antes de publicar (operador + abogado)

- [ ] **Revisión legal humana** por despacho boutique privacy (€500-1500 estimado). Pendiente especialmente:
  - Validar base legal por finalidad
  - Validar mecanismo de ejercicio de derechos (endpoints + email)
  - Validar plazos de retención propuestos
  - Validar redacción para clientes finales no técnicos
  - Verificar cumplimiento específico Ley 21.719 (Chile) — autoridad aún en constitución
- [ ] **Designar DPO** + crear email `privacidad@aglaya.biz` o `dpo@aglaya.biz`
- [ ] **Definir plazos retención exactos** (cards archivadas, digest_logs)
- [ ] **Decidir representante UE** (RGPD Art. 27) — operador domicilio Brasil
- [ ] **Aceptar DPAs en dashboards procesadores** y enlazar referencias en sección 4
- [ ] **Versión trilingüe** ES/EN/PT-BR (siguiendo patrón de aglaya.biz)
- [ ] **URL pública:** `kanban.aglaya.biz/privacidad` debe servir esta política (HTML estático en Netlify build o ruta SPA dedicada)
- [ ] **Versionado:** mantener histórico de versiones publicadas (no solo en git — usuario debe poder ver versiones previas)
