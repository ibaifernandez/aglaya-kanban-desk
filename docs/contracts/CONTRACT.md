# Contrato — Inyección de comandas en el riel

- **Dueño canónico:** `aglaya-kanban-desk` (este repo)
- **Versión:** 2.0.0
- **Última modificación:** 2026-08-06

> **Este fichero es la autoridad sobre cómo se le clava trabajo a esta nave.**
> Hasta hoy no existía: el registro de contratos del capitán describía la puerta
> desde fuera, y su ficha traía el `curl` completo. Funcionaba —y coincidía— pero
> era una descripción de mi interfaz custodiada por alguien que no puede
> ejecutarla. Ahora vive aquí, y allí se apunta.
>
> El contrato SÍ es custodio de su propia versión: para eso existe `firmas()`.
> Lo que no puede hacer es describir estado — cuántos espacios hay, cómo se llaman
> o qué corre en producción. Eso se pregunta.

---

## Qué garantiza esta nave

Que un trabajo entregado por cualquiera de las dos puertas **aterriza donde se
dijo, con lo que se dijo, o falla diciéndolo**.

Esa frase es el contrato entero. Todo lo de abajo la desarrolla.

**Y su negativo, que es igual de vinculante:** esta nave **no** promete que un
`201` signifique que el trabajo esté bien formado. Promete que, si no lo está, lo
dirá en la misma respuesta. Verificar en la UI sigue siendo del llamante.

---

## Puerta 1 — MCP `aglaya-kanban-desk`

El canal preferente. Crea y mueve trabajo sin navegador.

**El catálogo de tools lo declara el servidor MCP.** No se enumera aquí: una
lista escrita a mano envejece sola y quien la lea creerá que está completa.
Introspecciona la tool antes de llamarla.

Lo que el catálogo no te dice, y este contrato sí:

- **El destino es obligatorio y se valida.** `create_card` exige `workspace_id` y
  lo comprueba contra la columna: si la columna no pertenece a ese espacio, **no
  se escribe nada**. Exigirlo sin comprobarlo daría sensación de control sin
  control.
- **El brief llega por cualquiera de sus dos nombres.** `description_md` es el
  documentado; `description` es alias del mismo campo, porque así se llama en la
  Puerta 2 y quien venga de allí pasará ese nombre. Si los dos traen texto, gana
  el alias explícito. Un campo vacío nunca tapa a uno con contenido.
- **Una tarjeta sin contenido lo dice.** Si el brief sale vacío, la respuesta trae
  un `warning`. No es un error —una tarjeta solo-título es legítima a veces— pero
  deja de parecerse a una que salió bien.
- **Las destructivas están cerradas con llave:** exigen `confirm=true`. Es diseño.
  No desactivar la compuerta.
- **Asignar suena.** Asignar no es etiquetar: dispara la notificación in-app real
  a un humano.
- **`list_workspaces` NO contesta «¿existe X?».** Filtra por membresía del riel, no
  por lo que hay en la tabla. Preguntarle si algo existe es preguntarle al
  custodio equivocado; contesta la base de datos.

**Alcance:** solo los espacios de los que la cuenta de servicio del riel es
miembro. Ese alcance **se mantiene a mano**, y hay un guardián en CI que se pone
rojo si aparece un espacio inalcanzable que nadie ha justificado
([`scripts/rail-blindspot.sh`](../../scripts/rail-blindspot.sh)).

## Puerta 2 — la puerta HTTP con `x-task-secret`

Tres endpoints: uno escribe, dos leen. Usan `service_role`: **saltan RLS y ven lo
que el riel no ve.** Los dos alcances son distintos y confundirlos ya costó un
diagnóstico entero.

**Autenticación (los tres):** `x-task-secret` debe igualar exactamente
`TASK_SECRET`. Si falta la variable → 500; si no coincide → 401. No hay más
capas: quien tenga el secreto, entra. Trátalo como llave maestra.

### Lectura — `GET /api/internal/list-workspaces` · `GET /api/internal/list-boards`

*(v1.1.0 — aditivo.)* Existen porque este contrato **exige listar los destinos
antes de clavar** («no se teclean nunca») y hasta hoy no había forma de listarlos
desde fuera de esta máquina: el riel lista por membresía y solo aquí; la puerta
HTTP alcanzaba todo pero solo escribía. Una nave externa tenía llave para
escribir y ningún mapa, así que la instrucción era incumplible.

- `GET /list-workspaces` → `{ workspaces: [{ id, name, type, emoji, organization_id }] }`, ordenado por nombre.
- `GET /list-boards?workspaceId=<uuid>` → `{ boards: [{ id, title, workspace_id, order }] }`, ordenado por `order`. Sin `workspaceId` → 400.

**Alcance, con su asimetría dicha en voz alta:** es el de `service_role` —todo lo
que hay en la tabla, sin filtro de membresía— **menos los espacios de tipo
`personal`, que se excluyen por REGLA.** Es la tercera superficie automática de
esta nave que los excluye, y las otras dos ya estaban: el digest (fijado por su
propio test) y `scripts/rail-blindspot.sh` (`WHERE w.type <> 'personal'`).

El motivo es concreto y no es simetría por simetría: `TASK_SECRET` vive **fuera
de esta máquina**, y sin ese filtro esta puerta entregaba el UUID del espacio
personal de Ibai a cualquiera que lo tuviese. **Enumerar no es escribir**: antes
había que adivinar el nombre; un identificador no se adivina. Que la puerta de
escritura alcance ese espacio no obliga a que la de lectura lo anuncie.

**Y lo que esto NO cierra, para que nadie lo lea como cerrado:** la puerta de
escritura **sigue aceptando** un `workspaceName` que resuelva a un espacio
personal. La lista ya no lo ofrece; la puerta todavía lo acepta. Deuda con
tarjeta en el kanban de esta nave.

### Escritura — `POST /api/internal/create-card`

Crea una tarjeta sin JWT y sin login.

**Payload:**

| Campo | Req. | Default | Notas |
|---|---|---|---|
| `title` | sí | — | Se hace `trim()`; vacío → 400 |
| `boardName` | sí | — | Match parcial case-insensitive; vacío → 400, sin match → 404 |
| `workspaceName` | sí | — | **Sin default, por diseño.** Omitirlo → 400 |
| `priority` | no | `medium` | `urgent`\|`high`\|`medium`\|`low`\|`none`. **Inválido → 400** con la lista de válidas *(v2.0.0; antes caía a `medium` en silencio)* |
| `description` | no | `""` | El brief |
| `dueDate` | no | `null` | ISO 8601 |

**Comportamiento:** busca el espacio por nombre parcial; **si casa con más de uno
→ 400 con `candidates` (`id` y `name` de cada uno) y no se escribe nada**. Luego
el tablero dentro de él, por nombre parcial, y ahí **sí toma el primero todavía**
—la ambigüedad de tablero sigue abierta, ver más abajo—; elige la columna que
case con `/backlog/i` o la primera por orden; inserta al final.

**Acuse (`201`):** `card` trae `id`, `title`, `priority` y los **tres destinos
resueltos, con id y nombre**: `workspace_id`/`workspace`, `board_id`/`board`,
`column_id`/`column`. Hasta v1.0.0 el campo `workspace` devolvía **la entrada sin
resolver**, que era justo el campo por el que se puede aterrizar mal y el único
que el acuse no permitía comprobar. **Cambio incompatible:** un consumidor que
comparase `workspace` con lo que envió ahora recibe el nombre canónico.

**Ambigüedad de TABLERO — abierta, y se declara aquí para que no se lea como
cerrada.** El `400` de arriba cubre el espacio, no el tablero: dos tableros con
nombres solapados dentro del mismo espacio siguen resolviendo al primero y
devolviendo `201`. Es el mismo defecto un nivel más abajo. Seguimiento en el
kanban de esta nave, no en este documento.

**Por qué `workspaceName` no tiene default, y por qué no se repone.** Lo tuvo, y
apuntaba al espacio **personal de Ibai**, zona intocable. Omitirlo no fallaba:
devolvía `201` y la tarjeta aterrizaba ahí. Un `400` avisa; un `201` miente. Hay
un test que se pone rojo si alguien lo repone «por comodidad»
([`server/tests/internal-create-card.test.js`](../../server/tests/internal-create-card.test.js)).

---

## Lo que este contrato NO cubre

- **Los nombres e IDs de destino.** No se teclean nunca: el match es parcial y un
  nombre viejo aterriza en el sitio equivocado devolviendo `201`. Se listan antes
  de clavar.
- **A qué tablero va cada cosa.** El criterio de enrutado lo custodia el capitán;
  se le pregunta por su MCP, no se copia aquí.
- **Paridad con la UI.** La Puerta 2 es una tubería administrativa: inserta en
  crudo, sin notificaciones, sin validación de negocio, sin comprobar membresías.

## Cómo se cambia esto

Cualquier cambio en la forma de las dos puertas —nombres de campo, obligatoriedad,
códigos de error, compuertas— **se propone aquí primero** y se avisa al capitán,
que es hoy el único consumidor declarado. SemVer: rompe compatibilidad → mayor;
añade sin romper → menor.

Lo que **no** se hace es cambiarlo en el código y confiar en que alguien lo note:
un consumidor que pasa un nombre que ya no existe recibe un `201` con la tarjeta a
medias, y esa es exactamente la factura que este repo ya pagó.

### Historial de versiones

**v2.0.0 — 2026-08-06 · MAYOR.** Tres cambios, dos incompatibles.

- *(rompe)* `priority` inválida: antes caía a `medium` en silencio, ahora **400**.
- *(rompe)* `workspaceName` ambiguo: antes tomaba el primero y devolvía `201`,
  ahora **400 con `candidates`**. No es cosmético — contra la base real, **7 de 13
  espacios casan con `%AGLAYA%`**, así que el «toma el primero» de v1.0.0 era una
  moneda al aire sobre un orden que nadie fijaba.
- *(añade, v1.1.0 dentro de este mismo bump)* los dos `GET` de lectura, y el acuse
  con los tres destinos resueltos.

**Cómo llegó, porque importa más que el qué.** Los tres cambios los escribió un
obrero automático en tres PR (#13, #14, #15) que **no tocaron este archivo**: ni
una línea, ni un bump, ni aviso al capitán. Los tres pasaron CI en verde, porque
ningún guardián ata `server/routes/internalRoute.js` a este documento. Es
literalmente lo que el párrafo de arriba prohíbe —«cambiarlo en el código y
confiar en que alguien lo note»— y lo que lo detectó fue una revisión humana, que
es la red que este contrato existe para no necesitar.

El código se aceptó porque era correcto y lo pedían las tarjetas; la contabilidad
se corrigió después, aquí. Que haga falta un guardián para esto es hallazgo, y
tiene tarjeta.
