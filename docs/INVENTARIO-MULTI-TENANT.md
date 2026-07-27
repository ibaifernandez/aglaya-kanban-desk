# Inventario — la maquinaria multi-tenant que ya no se usa

> **Qué es este documento.** Un inventario para que Ibai decida, no una decisión ni una
> recomendación disfrazada. Enumera qué superficie multi-tenant existe, qué cuesta
> conservarla y qué costaría retirarla. **No se retira nada por iniciativa propia.**
>
> **Qué NO es.** No es el custodio de nada. No dice cuántos usuarios hay, cuántos
> espacios, ni cuántos tests pasan: eso lo contestan la DB y el runner. Si aquí
> apareciera una cifra, sería una copia envejeciendo.

---

## El cambio de premisa

Esta nave nació producto multi-tenant: marca LFi, organizaciones, clientes externos,
plan free con límites, invitaciones. Hoy es otra cosa: **el riel de comandas de la
flota AGLAYA**. Un espacio por nave, los asientos que enumera `CLAUDE.md` (Ibai, Món y
la cuenta de servicio del riel), y cero clientes.

La maquinaria del producto anterior **sigue construida y sigue corriendo**. No se
apagó: se quedó sin usuarios. Eso es distinto de estar muerta — sigue en la ruta de
cada petición, sigue siendo superficie de ataque, y sigue teniendo que ser correcta.

Lo que se conserva y lo que se retira es decisión de Ibai. Lo que sigue es el material.

---

## La superficie, pieza a pieza

### 1 · Tipos de espacio (`personal` · `interno` · `externo`)

| | |
|---|---|
| **Dónde vive** | `workspaces.type` · `server/routes/workspaces.js` (`VALID_TYPES`) · `client/src/pages/WorkspaceDashboard.jsx` · `client/src/components/Workspace/WorkspaceSettings.jsx` |
| **¿Se usa hoy?** | **Sí, y de forma crítica.** No es residuo |
| **Coste de conservar** | Nulo — ya se paga |
| **Coste de retirar** | Alto, y sería un error |

**Esta pieza no es candidata a retirada, y conviene decirlo antes que nada.** `type` es
el único sitio del sistema donde está escrito si un espacio es zona intocable o zona de
trabajo. Es de lo que cuelga la regla dura del espacio personal, y es la pieza sobre la
que se apoya el detector de puntos ciegos diseñado en [`BACKLOG.md`](./BACKLOG.md).
Nació como concepto de producto multi-tenant y **se ha convertido en infraestructura del
riel**. Retirarla por venir del multi-tenant sería confundir el origen con la función.

### 2 · Rol `cliente`

| | |
|---|---|
| **Dónde vive** | `server/middleware/workspace.js` · `server/routes/workspaces.js` (filtrado de listado, invitación) · `server/routes/admin.js` (`ALLOWED_ROLES`) · `server/routes/auth.js` · `client/src/pages/AdminPage.jsx` (`ASSIGNABLE_ROLES`) · `client/src/pages/WorkspaceDashboard.jsx` |
| **¿Se usa hoy?** | **No.** Ninguna cuenta lo tiene — lo contesta `SELECT role, email FROM users` |
| **Cubierto por tests** | Sí — `server/tests/workspaces.test.js` ejercita el rol |
| **Coste de conservar** | Bajo en mantenimiento, **no nulo en riesgo** — ver abajo |
| **Coste de retirar** | Medio: toca middleware, rutas, panel de admin y sus tests |

**El hallazgo que importa de esta pieza.** El aislamiento del rol `cliente` —que solo ve
espacios `externo`— está implementado **únicamente en la capa Express**. Consultado
`pg_policies`, **ninguna política RLS lo codifica**. Hoy no es explotable, porque el
servidor habla con Supabase por `service_role` y es él quien filtra; pero significa que
esta restricción tiene una sola implementación y ninguna defensa en profundidad.

Eso convierte la pregunta en una de verdad interesante: **es más barato retirar el rol
que asegurarlo bien.** Conservarlo «por si acaso» no es gratis — es mantener correcta,
para cero usuarios, una frontera que solo existe en un `if`.

### 3 · Organizaciones (`organizationId`)

| | |
|---|---|
| **Dónde vive** | Transversal: `server/middleware/auth.js` · `routes/{admin,auth,boards,cards,categories,internalRoute,workspaces}.js` · seeds y scripts · buena parte de la suite |
| **¿Se usa hoy?** | Existe una sola organización — lo contesta `SELECT count(*) FROM organizations` |
| **Coste de conservar** | Bajo — es inercia, ya está pagada y funciona |
| **Coste de retirar** | **Alto.** Es la pieza más entretejida de las cuatro |

Está en el JWT, en el aislamiento de casi cada ruta y en muchos tests. `BACKLOG.md` ya
tiene una entrada abierta para consolidar este aislamiento en helpers compartidos, lo
que sugiere que ni siquiera es uniforme hoy.

**Valoración honesta: retirar esto es un refactor grande a cambio de poca cosa.** No
estorba, no confunde a nadie, y es la única pieza que habría que reconstruir de cero si
alguna vez vuelve a haber una segunda organización. Candidata débil a retirada.

### 4 · Invitaciones y visibilidad controlada

| | |
|---|---|
| **Dónde vive** | `server/routes/workspaces.js` (miembros y roles) · `server/routes/admin.js` · Supabase Auth invite · `docs/mails/supabase-email-invite.html` · `client/src/pages/AdminPage.jsx` |
| **¿Se usa hoy?** | **Sí, pero para otra cosa.** No hay tabla de invitaciones pendientes: la membresía se materializa en `workspace_members` |
| **Coste de conservar** | Ya se paga, y **es lo que mantiene vivo al riel** |
| **Coste de retirar** | Alto, y sería un error |

Igual que `type`: nació multi-tenant y hoy es infraestructura. `workspace_members` es
literalmente el mecanismo por el que el riel ve o no ve un espacio. La parte
específicamente de cliente —«un `cliente` solo puede ser invitado a un `externo`»— cae
con la pieza 2 si se retira el rol.

---

## Cómo se lee este inventario

Las cuatro piezas no son la misma clase de cosa, y ese es el resultado principal:

- **`type` e invitaciones/membresía** vinieron del multi-tenant pero **ya no son
  multi-tenant**: son el sistema nervioso del riel. Retirarlas por su origen sería
  romper lo que hoy funciona.
- **El rol `cliente`** es la única pieza que está de verdad sin usar, y la única con un
  argumento de seguridad *a favor* de retirarla en vez de en contra.
- **`organizationId`** está sin usar en la práctica pero es caro de sacar y barato de
  tener. Es el caso clásico de deuda que no conviene pagar todavía.

**No se ha retirado nada.** La decisión es de Ibai, y este documento existe para que la
tome con el mapa delante en vez de con una intuición.

## Lo que este documento no puede contestar

Cuántas cuentas hay, cuántos espacios, cuántas políticas RLS, cuántos tests cubren el
rol `cliente`. Todo eso se consulta: la DB y `npm test` lo contestan gratis y sin
envejecer. Si alguna de esas cifras acaba escrita aquí, es que este documento empezó a
mentir — y lo cazará [`scripts/docs-guard.sh`](../scripts/docs-guard.sh) el día que se
amplíe su ámbito hasta aquí.
