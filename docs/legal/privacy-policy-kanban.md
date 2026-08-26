# Política de Privacidad — AGLAYA Kanban Desk

> **✅ APROBADA PARA PUBLICACIÓN.**
> Generada y revisada durante audit Mariana 2026-05-27 (hallazgo C-01).
> Revisión legal externa formalmente declinada por el operador (Antonio Ibai Fernández — info@aglaya.biz).
> Esta versión refleja la realidad operativa del sistema documentada en `docs/legal/` (RAT, TOMs, DPA-registry,
> retention-policy, base-legal, breach-notification-procedure, subprocessors, DPIA).
> Cambios sustanciales requieren nueva versión documentada en este mismo archivo (Sec. 12).

**Última actualización:** 2026-08-26
**Versión:** 1.2
**Aplicable a:** https://kanban.aglaya.biz (y subdominios `*.kanban.aglaya.biz` futuros)

---

## 1. Responsable del Tratamiento

| | |
|---|---|
| **Titular** | Antonio Ibai Fernández Gutiérrez |
| **Nombre comercial** | AGLAYA |
| **Domicilio** | Rua Palestina s/n, Belo Horizonte, Minas Gerais, Brasil, CEP 30850-000 |
| **Email general** | info@aglaya.biz |
| **Email privacidad / ejercicio de derechos** | info@aglaya.biz (asunto: `[Privacidad]` o `[RGPD]`) |
| **Responsable interno de privacidad** | Antonio Ibai Fernández — info@aglaya.biz |
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
| Enviar notificaciones dentro de la aplicación | Ejecución contractual |
| Backups operacionales | Obligación legal de seguridad (Art. 6(1)(c) + Art. 32 RGPD) |

> **Decisiones automatizadas (Art. 22 RGPD):** AGLAYA Kanban Desk NO toma decisiones automatizadas con efectos jurídicos sobre ti ni realiza profiling significativo. Las prioridades, asignaciones y aprobaciones siempre son humanas.

---

## 4. Encargados del Tratamiento (Sub-procesadores)

Compartimos datos con los siguientes encargados, sujetos a DPA (Data Processing Agreement) que asegura el cumplimiento del RGPD/LGPD/Ley 21.719:

| Encargado | Función | Jurisdicción de datos | Página oficial sub-procesadores |
|---|---|---|---|
| **Supabase Inc.** | Base de datos (PostgreSQL), autenticación, almacenamiento | sa-east-1 (São Paulo, Brasil) | https://supabase.com/legal/subprocessors |
| **Railway Corp.** | Hosting del servidor backend | Estados Unidos | https://railway.com/legal/subprocessors |
| **Netlify Inc.** | CDN del cliente web + proxy `/api/*` y `/uploads/*` | Global (red de distribución) | https://www.netlify.com/gdpr-ccpa/subprocessors/ |
| **Cloudflare Inc.** | DNS de `aglaya.biz` + bucket R2 para backups diarios cifrados (WEUR — Europa) | Europa occidental (WEUR) para backups; DNS global | https://www.cloudflare.com/cloudflare-customer-subprocessors/ |
| **GitHub Inc. (Microsoft)** | Trigger por reloj del backup diario | Estados Unidos | Cubierto por Microsoft Online Services DPA |

> **Encargado cesado — Resend Inc. (envío de correo), hasta el 25-ago-2026.**
> Prestó el envío de emails transaccionales, con transferencia a Estados Unidos
> amparada en SCCs. **AGLAYA Kanban Desk dejó de enviar correo el 25-ago-2026** y
> ese encargado ya no interviene en ningún tratamiento.
>
> Se declara como cesado en vez de borrarse: **hubo datos tratados de verdad**
> mientras estuvo activo, y un registro que borra su pasado deja sin respuesta a
> quien pregunte qué se hizo con los suyos entonces.

> No vendemos tus datos personales. No compartimos datos con terceros más allá de los encargados listados.

---

## 5. Transferencias Internacionales

Algunos encargados están fuera del Espacio Económico Europeo:

- **Supabase / Railway / GitHub:** Estados Unidos. Garantías: Standard Contractual Clauses (SCCs) Implementing Decision 2021/914 incluidas en cada DPA.
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
| Cards archivadas | 24 meses post-archive, después hard-delete automático |
| Notificaciones leídas | 90 días |
| Logs de envío de correo (`digest_logs`) | **Suprimidos de la base el 25-ago-2026**, antes de agotar los 12 meses que se anunciaban. **Persisten en las copias de seguridad operacionales hasta su rotación (~24-sep-2026)**, como cualquier otro dato: ver la fila de backups, más abajo, y `docs/legal/retention-policy.md`. |
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
| **Supresión / "derecho al olvido" (Art. 17 RGPD)** | `DELETE /api/auth/me` — elimina tu cuenta. UI disponible en tu perfil. **La supresión no alcanza retroactivamente a las copias de seguridad ya creadas**: esos datos desaparecen con la rotación, a los 30 días como máximo |
| **Oposición a comunicaciones (Art. 21 + Art. 6 LGPD)** | **No hay comunicaciones a las que oponerse: esta aplicación no envía correo.** Los avisos ocurren dentro de la aplicación, ligados al uso del servicio |

### 7.2 Derechos vía contacto directo

| Derecho | Cómo ejercerlo |
|---|---|
| **Rectificación (Art. 16 RGPD)** | Edita tu perfil directamente. Si necesitas corregir datos no editables, contacta `info@aglaya.biz` |
| **Limitación del tratamiento (Art. 18 RGPD)** | Email a `info@aglaya.biz` con asunto `[RGPD] Limitación` + justificación |
| **No estar sujeto a decisiones automatizadas (Art. 22 RGPD)** | N/A — AGLAYA Kanban Desk no toma decisiones automatizadas significativas |
| **Retirar consentimiento** | **Hoy ningún tratamiento se apoya en consentimiento**, así que no hay consentimiento que retirar. El único que lo usaba —el resumen por correo— cesó el 25-ago-2026. |

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

- **Notificación dentro de la aplicación**, con un mínimo de 30 días de antelación
- Actualización de la fecha de "Última actualización" al inicio del documento
- Si el cambio lo requiere, aviso por correo **enviado a mano por el responsable**
  desde `info@aglaya.biz`

> **Por qué ya no dice «email a usuarios con cuenta activa» sin más:** desde el
> 25-ago-2026 **la aplicación no envía ningún correo**. Prometer un aviso
> automático que el sistema no puede mandar es prometer lo que no se tiene, y es
> el mismo defecto que esta versión viene a corregir.

Si no estás de acuerdo con cambios sustanciales, puedes solicitar la supresión de tu cuenta (Art. 17 RGPD) en cualquier momento.

---

## 13. Contacto

Para cualquier consulta relacionada con privacidad:

- **Email general y privacidad:** info@aglaya.biz (asunto: `[Privacidad]` o `[RGPD]`)
- **Responsable interno de privacidad:** Antonio Ibai Fernández

Para ejercer derechos RGPD/LGPD/Ley 21.719 que requieran contacto humano, escribe a `info@aglaya.biz` con asunto `[Privacidad]`. Plazo de respuesta máximo: 30 días (RGPD Art. 12(3)).

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

## Historial de versiones

### 1.2 — 2026-08-26 · la copia que sí queda

**La versión 1.1 introdujo una frase que no era cierta**, y se corrige aquí en vez
de reescribirla en silencio. Decía, sobre los registros de envío suprimidos: *«No
queda copia»*.

**Se desmentía dos filas más abajo, en la misma tabla:** las copias de seguridad
diarias vuelcan la base **entera** —`pg_dump` sin exclusiones— y se conservan
**30 días**. Se tomaron copias el 25-ago-2026 a las 15:14Z y 15:18Z; la supresión
fue hacia las 20:30Z del mismo día.

**Por qué importa más que una imprecisión:** esa frase estaba en la fila que
responde al **derecho de supresión**. A quien lo ejerza se le decía que su dato ya
no existe en ninguna parte, cuando existía y con fecha de caducidad conocida — es
la afirmación que lleva a alguien a dejar de preguntar.

**Las copias son una excepción legítima a la supresión** —ya declarada en
`retention-policy.md` §3— **y lo correcto es declararlas, no ocultarlas.** Ahora
se dice hasta cuándo persisten, y el derecho de supresión lleva el mismo aviso.

**Y el defecto de fondo, dicho:** aquella frase se afirmó **sin poder
comprobarla** — nadie listó el bucket de copias, ni al escribirla ni al
corregirla. Lo comprobable es la ventana de retención, y es lo que se declara.

---

### 1.1 — 2026-08-25 · se retira el correo de esta política

**Qué cambia y por qué.** El 25-ago-2026 AGLAYA Kanban Desk **dejó de enviar
correo**: se retiraron los resúmenes por email, su reloj, sus rutas y el
encargado que los enviaba. Esta política seguía describiéndolos, así que
**prometía a un tercero cosas que ya no existían** — y una política publicada es
el documento con el que alguien ejerce sus derechos, no una nota interna.

Lo que se retira, uno a uno:

| decía | por qué se va |
|---|---|
| un `toggle` en preferencias para deshabilitar los resúmenes | **ese control ya no existe**: se prometía un botón que no se puede pulsar |
| «retirar consentimiento: toggle directo, efecto inmediato» | ningún tratamiento se apoya hoy en consentimiento |
| `digest_logs` como dato tratado, con 12 meses de retención | la tabla **se suprimió el 25-ago-2026**, antes de agotar ese plazo |
| **Resend Inc.** como encargado, con transferencia a EE. UU. | ya no interviene — queda **declarado como cesado**, no borrado |
| aviso de cambios «por email a usuarios con cuenta activa» | la aplicación no puede mandarlo; ahora se avisa dentro de la aplicación |

**La dirección del error era la benigna** —declaraba de más, no de menos— pero
declarar de más en un registro de encargados **es afirmar un flujo de datos que
no ocurre**, y eso tampoco es inocuo.

**Qué NO cambia:** ninguna base legal de los tratamientos que siguen vivos,
ningún derecho, ningún plazo de conservación de lo demás, ningún otro encargado.
Por eso es 1.1 y no 2.0.

**Los tratamientos cesados se marcan, no se borran** — aquí y en `RAT.md`,
`DPA-registry.md` y `subprocessors.md`. Hubo datos tratados de verdad mientras
estuvieron activos, y un registro que borra su pasado deja sin respuesta a quien
pregunte qué se hizo con los suyos entonces.

---

## Decisiones tomadas (2026-05-27 — versión 1.0)

- ✅ **Revisión legal externa declinada** por el operador. Esta versión es la fuente de verdad. Cambios sustanciales generarán versión 1.1+ documentada en este archivo.
- ✅ **DPO informal:** Antonio Ibai Fernández (info@aglaya.biz). Sin email dedicado (decisión coste). Asunto del email diferencia: `[Privacidad]` / `[RGPD]`.
- ✅ **Plazos retención fijados:** cards archivadas 24 meses, notificaciones leídas 90 días. *(Los `digest_logs`, con 12 meses fijados aquí, se suprimieron el 25-ago-2026 al retirarse el correo.)*
- ⚠️ **Representante UE (Art. 27 RGPD):** operador Brasil. Decisión: AGLAYA opera principalmente con titulares en Brasil/España; mientras el volumen de titulares EU sea bajo (<5000 únicos/año estimado) y no haya tratamiento sistemático, la designación de representante no es obligatoria. Re-evaluar si la base de usuarios EU crece.

## Acciones pendientes (operador — sin coste externo)

- [ ] **Aceptar DPAs en dashboards procesadores** (todos free / click-through). Lista paso a paso en `docs/operator-checklist.md`.
- [ ] **Publicar esta política como URL pública** `kanban.aglaya.biz/privacidad`. Mecanismo: añadir ruta SPA en `client/src/App.jsx` que sirva un componente que renderice este markdown vía `react-markdown` (ya está como dep).
- [ ] **Versión trilingüe** ES/EN/PT-BR opcional — esperar hasta que haya tracción EN/PT-BR real para justificar el esfuerzo de mantener 3 versiones sincronizadas.
- [ ] **Versionado de cambios** vía git history + lista en sección 12 de cambios sustanciales.
