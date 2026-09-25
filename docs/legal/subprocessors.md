# Sub-procesadores activos

**Marco legal:** RGPD Art. 28(2) — el encargado del tratamiento no podrá contratar a otro encargado sin autorización del responsable + obligación de informar sub-procesadores
**Última actualización:** 2026-09-25 (v1.3 — se razona por qué Anthropic **no** figura como encargado)

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
| 5 | **GitHub Actions** | Trigger por reloj del backup diario | US (cubierto Microsoft Online Services DPA) | [Link](https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA) |
| 6 | **Sentry** (Functional Software, Inc.) | Registro de errores del servidor, **desde mayo de 2026** | US — **verificado** en el panel de Sentry (*Data Storage Region*), captura del Operador del 13-sep-2026 | [Link](https://sentry.io/legal/dpa/) · ✅ **aceptado 2026-09-13, v5.1.0** — ver `DPA-registry.md` |

**Qué recibe Sentry, medido y no supuesto** (tarjeta `f428d080`, 2026-09-13):

| recibe | **no** recibe |
|---|---|
| mensaje y traza de pila del error (con líneas del código del servidor) | cuerpo de la petición |
| método y ruta de la petición, **sin query** | cabeceras, cookies |
| ruta de las peticiones salientes, **sin query** | query de la petición ni de las salientes |
| tiempos de rendimiento, entorno y versión | IP, User-Agent |
| del monitor B-03 *(inerte hoy)*: forma de la ruta, host y recuentos | datos de usuario (`user`) |
| | **texto de los registros del servidor** (migas de consola) |
| | cualquier clave de `extra` o `tags` fuera de una **lista blanca** |

**Y una segunda vuelta, tras la revisión del vigilante:** las **líneas de log del servidor** llegaban como migas de pan —con `ip=… ua=…` del monitor B-03 e identificadores—, y `extra`, `tags` y `user` salían sin recortar. Ahora las migas de consola están desactivadas (y filtradas, por si alguien las reactiva), y `extra`/`tags` pasan por **lista blanca**: lo que no está permitido, no sale.

**Hasta esa fecha recibía también el cuerpo, la cookie de sesión, la query y el User-Agent** —medido provocando un error—, pese a `sendDefaultPii: false`. El recorte vive en `server/utils/sentry.js` y lo sostiene `server/tests/sentry-recorte.test.js`, que provoca el error de verdad.

**Residuo declarado:** el **mensaje** de una excepción lo escribe quien la lanza, y podría arrastrar un fragmento de dato. Como segunda capa se sanean por patrón correos y tokens; no hay forma de garantizar más sin dejar de mandar el mensaje, que es lo que hace útil el registro.

---

## Sub-procesadores CESADOS

Un encargado que deja de intervenir **se declara aquí, no se borra de este
documento**. Borrarlo dejaría sin respuesta a quien pregunte por dónde pasaron
sus datos mientras estuvo activo — que es exactamente lo que este registro sirve
para contestar.

| Procesador | Función que prestó | Región datos | Alta | Cese |
|---|---|---|---|---|
| **Resend** | Email transaccional (resumen diario + avisos de asignación) | US | 2026-04-27 | **2026-08-25** |

**Motivo del cese:** AGLAYA Kanban Desk **dejó de enviar correo**. No se
sustituyó por otro proveedor: se retiró el envío entero, así que hoy no hay
ningún encargado de correo ni transferencia asociada a él.

**Qué queda de aquel tratamiento:** nada en la base. El registro de envíos
(`digest_logs`) se **suprimió el 25-ago-2026**. Lo que Resend conserve por su
cuenta se rige por su propia política de retención, no por esta.

---

## Sub-procesadores INDIRECTOS (sub-sub-procesadores)

A través de los procesadores directos:

| Procesador directo | Sub-procesador indirecto | Función |
|---|---|---|
| Supabase | AWS (RDS Postgres, S3 Storage) | Infra Supabase |
| Railway | Google Cloud Platform | Infra Railway |
| Netlify | AWS, Cloudflare | Infra Netlify |
| Cloudflare | AWS (algunos servicios), GCP | Infra Cloudflare |
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

## Anthropic: por qué NO figura como encargado

**No es un olvido, y por eso se escribe.** El riel de comandas (`kanban-mcp`) lo
operan sesiones de Claude, así que **contenido de tarjetas pasa por el modelo de
Anthropic** cada vez que una sesión opera el kanban. La pregunta legítima —y la
que levantó la tarjeta `ed8910e2`— es por qué no está en la tabla de arriba, al
lado de Supabase o Sentry.

**Porque la figura depende de quién contrata qué, y aquí no hay contrato de
AGLAYA.** Esas sesiones corren bajo la **suscripción personal del Operador**, no
bajo un acuerdo comercial de la empresa. Y las dos condiciones de Anthropic dicen
cosas opuestas:

| | **Commercial Terms** (API, Team, Enterprise) | **Consumer Terms** — *las que aplican aquí* |
|---|---|---|
| Papel de Anthropic | encargado; el DPA se incorpora por referencia: *«Data submitted through the Services will be processed in accordance with the Anthropic Data Processing Addendum ("DPA"), which is incorporated into these Terms by reference»* | trata para fines propios; **no hay relación encargado-responsable con AGLAYA** |
| Entrenamiento | *«Anthropic may not train models on Customer Content from Services»* | *«We may use Materials to … develop other products and services, including training our models, unless you opt out of training through your account settings»* |

Fuentes: [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) ·
[Consumer Terms](https://www.anthropic.com/legal/consumer-terms) · leídas el
25-sep-2026.

**Consecuencia, dicha sin adornos:** no hay encargado que declarar, no hay DPA
que registrar y no hay transferencia internacional que documentar por esta vía
—**y tampoco hay garantías contractuales de AGLAYA sobre ese tratamiento**. Lo
que hay es una decisión de herramienta del Operador, tomada sobre su propia
cuenta.

**Dos hechos con fecha, que son los que cambian el riesgo:**

- **El ajuste de entrenamiento estaba activado, y el Operador lo desactivó el
  25-sep-2026.** Lo anterior a esa fecha ya ocurrió: no se persigue, se dice.
- **Desde el 25-sep-2026 el riel no manda direcciones de correo** al modelo:
  `list_members` devuelve `user_id`, `name` y `role` (tarjeta `ed8910e2`,
  contrato del riel 4.0.0). Lo que sigue pasando es el **contenido de las
  tarjetas**: títulos, descripciones y comentarios.

### ⚠️ Condición de reapertura

**Si estas sesiones pasan a una suscripción de empresa** —Team, Enterprise o
API—, la figura cambia: Anthropic **sí** sería encargado, con DPA incorporado y
transferencia a EE. UU. que documentar. Ese día, esta sección se sustituye por
una fila en la tabla de arriba y una entrada en `DPA-registry.md`.

---

## Transferencias internacionales

### Resumen por jurisdicción destino

| Destino | Procesadores | Mecanismo de transferencia |
|---|---|---|
| **Brasil (sa-east-1)** | Supabase | Dentro de Brasil. Desde UE: SCCs requeridas (Brasil no está en lista RGPD "países adecuados") |
| **US** | Railway, GitHub Actions | SCCs (Standard Contractual Clauses) — cada procesador incluye SCCs en su DPA |
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
