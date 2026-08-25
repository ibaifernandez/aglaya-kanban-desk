# La puerta externa — qué hay que probar para poder decir «esto sigue abriendo»

**Fecha:** 2026-07-27 · **Estado:** inventario para firmar. **No se ha tocado nada.**

---

## Por qué existe este documento

Esta nave nació multi-tenant y hoy tiene tres cuentas: Ibai, Món y el riel. El
rol `cliente`, los espacios de tipo `externo`, las invitaciones y la visibilidad
restringida siguen ahí, funcionando, para nadie.

La tentación fácil es llamarlo superficie muerta y proponer retirarla. **No lo
es:** es una puerta que Ibai quiere tener puesta para el día que exista un
cliente —«Industrias Stark», `tony@stark.com`— aunque hoy no la cruce nadie.

Lo que sí es cierto del argumento de seguridad: código que nadie usa y **nadie
prueba** se pudre en silencio. El día que llegue el cliente se descubre qué se
rompió hace ocho meses. Guardar la puerta es gratis; guardarla sin comprobar que
abre, no.

Así que esto no propone retirar nada. Propone **qué habría que probar** para que
«la puerta abre» deje de ser una creencia.

---

## La puerta abre hoy. Comprobado, no supuesto

El camino completo para dar de alta a `tony@stark.com`:

| Paso | Dónde | ¿Funciona? |
|---|---|---|
| Ibai invita desde el panel de admin con rol `cliente` | `server/routes/admin.js` | Sí — `cliente` está entre los roles admitidos |
| El correo NO es de un dominio corporativo | — | **No lo bloquea nada.** El filtro de dominio vive SOLO en el registro self-service (`server/routes/auth.js`), no en la invitación |
| Supabase manda el correo de invitación y Tony pone contraseña | `inviteUserByEmail` | Sí |
| Tony entra | `POST /api/auth/login` | Sí — el login no filtra por dominio |
| Tony solo ve el espacio externo | `server/routes/workspaces.js` | Sí, por código. **Sin ningún test** |
| Tony no puede entrar en un espacio interno | `server/middleware/workspace.js` | Sí, por código. **Sin ningún test** |
| Tony no puede crear espacios | `server/routes/workspaces.js` | Sí, **y hay test** |
| Tony no puede ser metido en un espacio no externo | `server/routes/workspaces.js` | Sí, **y hay test** |

> **Nota que vale la pena guardar.** Durante esta revisión propuse que el login
> filtrara por dominio, «para cumplir la regla de las tres cuentas». Habría hecho
> dos daños a la vez: dejar fuera a Món, cuyo correo es de gmail, y **tapiar esta
> puerta antes de que existiera el primer cliente.** La regla es la lista de
> cuentas autorizadas, no el dominio; y el candado que la aplica está en el
> registro, no en la entrada. Queda escrito para que la próxima persona a la que
> se le ocurra lo mismo lo lea antes.

---

## Lo que falta probar, por orden de daño

### 1 · Un cliente no ve los espacios internos — `GET /api/workspaces`

**El código:** `server/routes/workspaces.js` filtra las filas a las de tipo
`externo` cuando `req.user.role === 'cliente'`.

**El daño si se rompe:** el cliente abre el panel y ve los tableros internos de
AGLAYA. No hay error, no hay aviso: ve de más. Es la peor forma de fallo de esta
casa —éxito devuelto sobre un resultado equivocado— aplicada a datos ajenos.

**El test:** un token con rol `cliente` que sea miembro de un espacio `externo`
y de uno `interno`; la respuesta debe traer solo el externo. Y el simétrico, que
es el que suele faltar: el mismo montaje con rol `colaborador` debe traer los
dos, para que el test no pase por casualidad si alguien vacía la lista entera.

### 2 · Un cliente no entra en un espacio interno — `requireWorkspaceMember`

**El código:** `server/middleware/workspace.js` deniega con 403 si el rol es
`cliente` y el espacio no es `externo`, **incluso siendo miembro**.

**El daño si se rompe:** la lista del punto 1 le oculta el espacio interno, pero
el ID va en la URL. Sin esta segunda barrera, adivinarlo o recordarlo basta. Un
filtro de presentación no es control de acceso.

**El test:** cliente **que sí es miembro** de un espacio interno pidiendo sus
tableros → 403. Que sea miembro es la parte importante: si el test usa a alguien
que no lo es, lo que prueba es la comprobación de membresía, que ya está probada,
y el guardia del tipo de espacio sigue sin vigilancia.

### 3 · Invitar a un cliente de dominio ajeno funciona a propósito

**El código:** la invitación de admin no valida dominio; el registro sí.

**El daño si se rompe:** nadie se entera hasta que hay un cliente esperando.
Y se «rompería» por el camino más plausible de todos: alguien unificando ambas
rutas por higiene, sin saber que la asimetría es la puerta.

**El test:** invitar a `tony@stark.com` con rol `cliente` → 201. Con un comentario
que diga que la asimetría es deliberada, para que quien la vea no la «arregle».

### 4 · ~~El cliente no recibe lo que no es suyo — digests~~ · RETIRADO

**No hay digest.** Se retiró el correo entero de la nave el 25-ago-2026
(«cero mails», ADR-027). Este test describía la vía de fuga más silenciosa que
tenía el sistema —un correo sale sin que nadie mire la pantalla— y **la vía ya
no existe**, así que el test tampoco tiene qué vigilar.

Se tacha en vez de borrarse porque **el riesgo vuelve con el correo**: el día
que alguien reintroduzca un envío automático, esta es la comprobación que hay
que escribir antes de encenderlo.

---

## Lo que este documento NO propone

- **No propone retirar nada.** Decisión de Ibai, 2026-07-27: la puerta se queda.
- **No propone escribir estos tests ahora.** También decisión suya: primero el
  mapa, y la firma después. Están aquí descritos con suficiente detalle para que
  escribirlos sea mecánico.
- **No propone tocar la asimetría registro/invitación.** Es la puerta.

## Lo que sí conviene decidir cuando llegue el primer cliente

Nada de esto es urgente hoy, y ninguna es una decisión técnica:

- **Legal.** Un cliente externo con datos en la plataforma cambia el RAT. Lo
  custodia `docs/legal/`, no este documento.
- **La cuenta del riel.** Un espacio externo con cliente dentro, ¿debe recibir
  comandas automáticas? Si sí, el riel tiene que ser miembro —y entonces el riel
  ve un espacio con un cliente dentro—. Si no, va a `scripts/rail-blindspot.allowed`
  con su porqué.
- **Las tres cuentas autorizadas.** La regla dura dice tres. Un cliente es la
  cuarta. No es que la regla esté mal: es que dar de alta al primer cliente es
  exactamente el momento de reescribirla a propósito, en vez de que caduque sola.
