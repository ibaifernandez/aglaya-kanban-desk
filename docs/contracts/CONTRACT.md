# Contrato — Inyección de comandas en el riel

- **Dueño canónico:** `aglaya-kanban-desk` (este repo)
- **Versión:** 1.0.0
- **Última modificación:** 2026-07-27

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

## Puerta 2 — `POST /api/internal/create-card`

Crea una tarjeta sin JWT y sin login, autenticada por un header secreto. Usa
`service_role`: **salta RLS y ve lo que el riel no ve.** Los dos alcances son
distintos y confundirlos ya costó un diagnóstico entero.

**Autenticación:** `x-task-secret` debe igualar exactamente `TASK_SECRET`. Si
falta la variable → 500; si no coincide → 401. No hay más capas: quien tenga el
secreto, escribe. Trátalo como llave maestra.

**Payload:**

| Campo | Req. | Default | Notas |
|---|---|---|---|
| `title` | sí | — | Se hace `trim()`; vacío → 400 |
| `boardName` | sí | — | Match parcial case-insensitive; vacío → 400, sin match → 404 |
| `workspaceName` | sí | — | **Sin default, por diseño.** Omitirlo → 400 |
| `priority` | no | `medium` | `urgent`\|`high`\|`medium`\|`low`\|`none`. Inválido → cae a `medium` |
| `description` | no | `""` | El brief |
| `dueDate` | no | `null` | ISO 8601 |

**Comportamiento:** busca el espacio por nombre parcial y toma el primero; luego
el tablero dentro de él, igual; elige la columna que case con `/backlog/i` o la
primera por orden; inserta al final.

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
