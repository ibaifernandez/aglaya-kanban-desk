# Runbook — Railway Custom Domain `api.kanban.aglaya.biz`

**Mitigación:** B-03 audit Mariana (Railway URL pública sin gateway)
**Esfuerzo estimado:** 30 min operador + 10 min propagación DNS
**Pre-requisitos:** dominio `aglaya.biz` con DNS en Cloudflare (asumido)

---

## Contexto

Hoy `web-production-099a0.up.railway.app/api/*` responde a request anónimos.
Cualquiera con un JWT robado puede bypass del proxy Netlify y hablarle directo
al Railway server, evitando logging/observabilidad de Netlify y revelando
proveedor en URL.

Plan: poner `api.kanban.aglaya.biz` como custom domain. Cloudflare proxy (orange
cloud) añade WAF gratis. URL `web-production-099a0.up.railway.app` sigue
accesible pero queda fuera del código frontend (info disclosure resuelta).

---

## Pasos

### 1. Railway — añadir custom domain

1. Ir a https://railway.app/project/<project-id>/service/<service-id>/settings
2. Tab **Networking** → sección **Public Networking** → **Custom Domains**
3. Click **Custom Domain** → ingresar `api.kanban.aglaya.biz`
4. Railway muestra un valor CNAME tipo `<random>.up.railway.app`. Copialo.

### 2. Cloudflare — crear CNAME

1. Cloudflare dashboard → zona `aglaya.biz` → **DNS** → **Records**
2. **Add record**:
   - Type: `CNAME`
   - Name: `api.kanban`
   - Target: pegar el valor que Railway dió en paso 1.4
   - Proxy status: **Proxied (orange cloud)** ← importante para WAF gratis
   - TTL: Auto
3. Save.

### 3. Verificar propagación DNS (~5 min)

```bash
dig api.kanban.aglaya.biz +short
# Debería resolver a IPs de Cloudflare (104.21.x.x o 172.67.x.x)

curl https://api.kanban.aglaya.biz/api/health
# Debería retornar {"status":"ok","timestamp":"..."}
```

Si retorna 404/502: esperar otros 5 min. Si persiste: revisar Railway custom
domain settings + Cloudflare CNAME target.

### 4. Cloudflare — Firewall Rules (Free plan)

Una vez `api.kanban.aglaya.biz` activo, agregar regla WAF para denegar
tráfico anómalo:

1. Cloudflare → `aglaya.biz` → **Security** → **WAF** → **Custom Rules**
2. Create rule:
   - Name: `kanban-api-block-non-netlify`
   - When: `Hostname` equals `api.kanban.aglaya.biz` AND
           `User Agent` does not contain `Netlify` (heurística — Netlify proxy
           NO siempre añade User-Agent fingerprint, ajustar tras observar
           tráfico real durante 1 semana)
   - Then: **Log** (no Block hasta validar pattern)
3. Save. Después de 1 semana de observar logs, cambiar a **Block** si pattern
   estable.

> Alternativa más robusta: usar Cloudflare Workers que sale del WAF y permite
> lógica custom (validar header `x-netlify-proxy` o IP de origen).

### 5. Update netlify.toml (yo lo hago tras verificación operador)

Cuando confirmes que `https://api.kanban.aglaya.biz/api/health` retorna 200:

```toml
[[redirects]]
  from   = "/api/*"
  to     = "https://api.kanban.aglaya.biz/api/:splat"
  status = 200
  force  = true

[[redirects]]
  from   = "/uploads/*"
  to     = "https://api.kanban.aglaya.biz/uploads/:splat"
  status = 200
  force  = true
```

### 6. Update server CORS (yo tras tu confirmación)

En `server/app.js`:

```js
const allowedOrigins = isProd
  ? ['https://kanban.aglaya.biz', 'https://api.kanban.aglaya.biz']
  : ['http://localhost:5175'];
```

### 7. Deshabilitar URL pública Railway (opcional, requiere Pro)

Railway plan Pro permite "Private Networking" — deshabilitar la URL
`web-production-099a0.up.railway.app` y forzar acceso solo via custom domain.

En plan Free, la URL queda accesible. Mitigación parcial pero suficiente
combinado con Cloudflare WAF.

---

## Hardening alternativo (avanzado)

**Cloudflare Tunnel** cierra el puerto público del Railway server entirely.
Tráfico solo entra via tunnel Cloudflare → Railway. Bypass = imposible.

Setup:

1. Instalar `cloudflared` en Railway container (Dockerfile modify o GitHub Action)
2. Crear tunnel en Cloudflare Zero Trust dashboard (Free hasta 50 users)
3. Configurar `cloudflared` para forwarding desde tunnel → puerto local
4. Eliminar Railway public domain

Esfuerzo: 2-3h. Cierra B-03 al 100%.

---

## ⚠️ Paso que NO puede olvidarse: rearmar el monitor B-03

**Mientras no exista el dominio, el monitor de bypass está inerte a propósito**
(`server/middleware/hostMonitor.js`). Lo estuvo emitiendo un evento de Sentry por
**cada petición** durante tres meses porque la condición que miraba —«el Host es
de Railway»— la cumplía el 100% del tráfico: no había otra puerta. Se agotó la
cuota de Sentry **de toda la organización**.

Al terminar este runbook, en el mismo turno:

1. **Leer «⚠️ Lo que ese interruptor ARMA», justo debajo, y decidir si sigues.**
   No es contexto: enciendes **dos defectos conocidos**, y ahí está el criterio
   para saber si te dan igual o no. Si no lo has leído, no hagas el paso 2.
2. Configurar en Railway la variable **`PUBLIC_API_HOST`** con el dominio recién
   creado (`api.kanban.aglaya.biz`).
3. Comprobar en el registro de arranque que **ya no aparece** la línea
   `[B-03 monitor] INERTE: …`. Si sigue apareciendo, la variable no llegó y la
   alarma **no está mirando nada**.

Sin estos pasos, el dominio existe y el bypass sigue sin vigilarse — que es la
mitad de lo que este runbook viene a cerrar.

### ⚠️ Lo que ese interruptor ARMA — paso 1 de la lista de arriba

Configurar esa variable no solo enciende la vigilancia: enciende también **dos
defectos conocidos y medidos** que hoy no pueden morder porque el monitor está
inerte. **No están arreglados a propósito** —arreglarlos antes de que exista el
dominio sería construir para un mundo que no existe— pero quien acciona el
interruptor tiene derecho a saber qué acciona.

**1 · El recuento de repeticiones puede mentir a la baja.** El evento lleva un
campo «cuántas veces pasó mientras callaba». La poda borra la clave caducada con
su contador dentro, y la poda la dispara **cualquier otra ruta** al emitir. Si
eso ocurre en medio, el siguiente evento de la primera ruta declara **0
repeticiones donde hubo diez**.

*Medido el 02-sep-2026 sobre `28232cb`: diez peticiones a una forma, ventana
caducada, una ruta ajena emite en medio → el evento siguiente reporta `0`.*

**El daño es de lectura, no de cuota:** el aviso llega igual, con el volumen
subestimado. Si alguna vez se usa ese número para decidir algo, no vale como
medida — vale como «esto sigue pasando».

**2 · El techo de claves acota la MEMORIA, no los EVENTOS.** Un cliente que pida
rutas con formas irrepetibles genera **un evento por forma**. Medido: 20.000
formas distintas → **20.000 eventos**, con solo 461 claves vivas. La agregación
protege contra el tráfico repetido —que era el incidente del 1-sep— pero no
contra un patrón que nunca repite forma.

*Preexistente y no introducido por el arreglo de la agregación: comprobado
idéntico antes y después.*

**Qué hacer con esto el día que acciones el interruptor:**

- Si solo te importa la señal «hay tráfico fuera del dominio», enciéndelo: los
  dos defectos son tolerables para eso.
- Si vas a **contar** con el número de repeticiones, o si la API queda expuesta a
  clientes que no controlas, **arréglalos primero** — y entonces sí, con fecha y
  con causa, es trabajo que se cartea.

**Este aviso vive aquí, y no en una tarjeta, a propósito:** un runbook se lee
justo antes de ejecutar; una tarjeta en «Hecho» no se relee nunca.

---

## Validación post-setup

Tras completar pasos 1-6:

- `https://kanban.aglaya.biz/api/health` → 200 (proxiado por Netlify a `api.kanban.aglaya.biz`)
- `https://api.kanban.aglaya.biz/api/health` → 200 (directo Cloudflare → Railway)
- `https://web-production-099a0.up.railway.app/api/health` → 200 todavía (sin Tunnel)
- Cloudflare WAF log muestra tráfico legítimo en `api.kanban.aglaya.biz`

Documentar fecha completado en `docs/SECURITY.md` sección B-03.

---

## Referencias

- Audit B-03: `docs/audits/2026-05-27-mariana/audit-B.md`
- Cloudflare Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- Railway custom domains: https://docs.railway.com/guides/public-networking#custom-domains
