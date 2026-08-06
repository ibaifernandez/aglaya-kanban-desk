# Contrato — Inyección de comandas en el riel

- **Dueño canónico:** `aglaya-kanban-desk` (este repo)
- **Versión:** 3.1.0
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
- **El responsable y la prioridad también son obligatorios** *(v3.0.0)*.
  `create_card` exige `assignee` y `priority` explícitos, y sin ellos no escribe
  nada. `priority` tuvo default `medium`; ya no lo tiene. Ver
  [«Por qué responsable y prioridad no tienen default»](#por-qué-responsable-y-prioridad-no-tienen-default).
- **El brief llega por cualquiera de sus dos nombres, al crear Y al actualizar.**
  `description_md` es el documentado; `description` es alias del mismo campo,
  porque así se llama en la Puerta 2 y quien venga de allí pasará ese nombre. Si
  los dos traen texto, gana el alias explícito. Un campo vacío nunca tapa a uno
  con contenido.

  **Esta línea era falsa para `update_card` hasta el 6-ago-2026**, y se afirmaba
  sin acotar: aquella tool solo aceptaba el alias, y el texto que llegaba con el
  nombre documentado —el que este contrato recomienda— **se descartaba en
  silencio**. Ahora es cierta para las dos.

  **Y al actualizar, «no mandarlo» y «mandarlo vacío» son órdenes distintas:** lo
  primero deja la descripción como está, lo segundo la vacía. Confundirlas
  borraría el brief de cualquier tarjeta a la que solo se le cambie el título.
- **Una tarjeta sin contenido lo dice.** Si el brief sale vacío, la respuesta trae
  un `warning`. No es un error —una tarjeta solo-título es legítima a veces— pero
  deja de parecerse a una que salió bien.
- **Las destructivas están cerradas con llave:** exigen `confirm=true`. Es diseño.
  No desactivar la compuerta.
- **Asignar suena.** Asignar no es etiquetar: dispara la notificación in-app real
  a un humano.
- **Las columnas se pueden renombrar y borrar, y el tablero queda 1..N** *(v3.1.0)*.
  `update_column` renombra y reposiciona; `delete_column` borra, **con compuerta**.
  Tras cualquier cambio el tablero queda numerado **contiguo y sin repetidos**: no
  se parchea la fila tocada, se renumera el tablero entero.
  **Modo de fallo nuevo: borrar una columna CON tarjetas devuelve `409` y no borra
  nada.** No es cortesía — `cards.column_id` es `ON DELETE CASCADE`, así que sin esa
  guarda la llamada se llevaría las tarjetas por delante y contestaría éxito. No
  molestaba mientras solo se borraba desde la interfaz, donde quien borra ve lo que
  hay dentro; el riel no ve nada.
  **Lo que NO sostiene:** no hay restricción `UNIQUE` en la base, así que una
  escritura directa puede volver a romper la numeración. Ponerla sin diferir
  rompería el reordenado legítimo a medio camino.
- **Sobrescribir una descripción deja rastro, y puede fallar** *(v2.1.0)*.
  `update_card` reemplaza la descripción entera; ahora guarda la anterior antes
  de escribir. **Modo de fallo nuevo: si esa copia no se puede guardar, el
  update se aborta con `500` y la tarjeta queda intacta.** Es deliberado — un
  historial que falla en silencio da la sensación de que se puede deshacer justo
  en la escritura que había que poder deshacer. El precio, dicho: si la tabla de
  historial no está disponible, no se puede editar ninguna descripción.
  `card_history` lee las versiones, la más reciente primero; deshacer es leer la
  que toque y volver a mandarla por `update_card`, y esa restauración deja su
  propia entrada como cualquier otra edición.
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
| `priority` | sí | — | `urgent`\|`high`\|`medium`\|`low`\|`none`. **Ausente → 400** *(v3.0.0; antes caía a `medium` en silencio)*. **Inválida → 400** con la lista de válidas *(v2.0.0)* |
| `assignee` | sí | — | *(v3.0.0, campo nuevo)* Email, nombre exacto o UUID del responsable. Ausente → 400; sin match → 404; nombre que casa con varios → 400 con `candidates` |
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

Desde v3.0.0 trae además el **responsable resuelto**: `assignee_id`/`assignee`
(id y nombre canónico), por el mismo motivo que los tres destinos — es un campo
por el que se puede aterrizar mal, y quien mandó un nombre parcial necesita ver
en quién cayó.

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

## Por qué responsable y prioridad no tienen default

*(v3.0.0. Aplica a las DOS puertas, y por eso está aquí y no dentro de una.)*

El sistema de trabajo agéntico reparte por **responsable** —hay juez mecánico, o
hace falta criterio humano— y ordena por **prioridad**. Una tarjeta a la que le
falte cualquiera de los dos **no la coge nadie**: no es de nadie, o no tiene
sitio en la cola. Envejece en el backlog **pareciendo trabajo pendiente**.

**Es la misma familia que el `201` que miente, un piso más arriba.** Aterrizar
mal se nota tarde; nacer invisible no se nota nunca. No hay error que leer, no
hay tarjeta perdida que buscar: hay una fila correcta que ningún proceso mira.

Y el default de `priority` era el caso agudo: caía a `medium` sin decirlo, así
que quien creía **no haber decidido** había decidido `medium`, y su tarjeta se
ordenaba contra las demás con un valor que nadie eligió. Es exactamente la forma
del default de `workspaceName` — implícito, plausible y silencioso.

**Lo que las puertas comprueban, y lo que NO.** Comprueban que los campos vengan
y que resuelvan: `priority` contra la lista de válidas, `assignee` contra un
usuario real. **No** comprueban la semántica —quién es obrero y quién es humano,
o si esta tarjeta merece `urgent`—: eso es criterio, y no vive en una puerta.
Exigir el campo es lo que la puerta puede garantizar; acertar con él, no.

Hay pruebas que se ponen rojas si alguien repone cualquiera de los dos defaults
«por comodidad», en las dos puertas
([`server/tests/internal-create-card.test.js`](../../server/tests/internal-create-card.test.js)
y [`kanban-mcp/test_validation.py`](../../kanban-mcp/test_validation.py)).

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

**Y desde el 6-ago-2026 eso ya no depende de que alguien se acuerde.** Hay un
guardián en CI ([`scripts/contract-guard.sh`](../../scripts/contract-guard.sh))
que se pone **rojo** si un cambio toca la forma de una puerta
—`server/routes/internalRoute.js`, `kanban-mcp/server.py`,
`kanban-mcp/validation.py`— y **no** toca este fichero. Tiene su propio sello
([`contract-guard.test.sh`](../../scripts/contract-guard.test.sh)), porque un
guardián que da verde estando destripado es peor que no tenerlo.

Lo que ese guardián **no** puede hacer: comprueba que alguien tocó este
documento, no que fuera honesto al tocarlo. Verificar que el texto describe el
código sigue siendo trabajo del vigilante. Lo que cierra es el caso en que
**nadie miró** — que es el que pasó tres veces seguidas.

Y si el cambio de verdad **no** altera la forma, se dice igualmente en el
historial de abajo: esa línea **es** el aviso al capitán que este contrato pide,
y cuesta un renglón.

### Historial de versiones

**v3.1.0 — 2026-08-06 · MENOR.** Aditivo: `update_column` y `delete_column` en la
Puerta 1, y la numeración de columnas normalizada a 1..N. Es nota de contrato y no
solo entrada de changelog por el **modo de fallo nuevo**: `409` al borrar una
columna con tarjetas dentro.

**La escribió el vigilante al mergear, y es la segunda vez seguida.** El obrero
entregó el PR sin tocar este fichero; en el #18 pasó igual, allí por un motivo
bueno —había dos ramas en vuelo y cualquier número era falso— y aquí sin motivo.
Que dos PR de tres lleguen sin su nota **no es despiste: es que nada lo impide**.
La tarjeta `8407f7bc` pide justo ese guardián, y cada vez que esto pasa sube su
precio.

**v3.0.0 — 2026-08-06 · MAYOR.** Dos cambios, los dos incompatibles, en **las dos
puertas**.

- *(rompe)* **`priority` deja de tener default.** Antes ausente → `medium` en
  silencio; ahora **400** (Puerta 2) / error (Puerta 1). v2.0.0 ya había
  convertido la prioridad *inválida* en 400; esto cierra la *ausente*, que era la
  mitad silenciosa.
- *(rompe)* **el responsable pasa a ser obligatorio.** Puerta 1 exigía `assignee`
  como opcional; ahora sin él no escribe. Puerta 2 **no tenía el campo siquiera**:
  se añade `assignee` y se exige — de modo que para ella esto es campo nuevo *y*
  obligatorio a la vez.

**⚠️ Rompe a todos los llamantes actuales, el capitán incluido.** Cualquier
llamada que hoy omita `priority` o `assignee` empieza a fallar al mergear esto.

**No hay ventana de deprecación, y es una decisión tomada** (Ibai, delegada en el
capitán, 6-ago-2026), no un descuido. El motivo es el radio medido: **los únicos
llamantes que se rompen son DOCUMENTACIÓN, no servicios.** No se cae nada, así
que una ventana solo compraría tiempo para nadie. Los tres se arreglan en el
mismo cambio que los invalida, para que no exista ni un commit en el que el
contrato y sus ejemplos digan cosas distintas:

- [`CLAUDE.md`](../../CLAUDE.md) — el `curl` de ejemplo.
- [`docs/runbooks/key-rotation.md`](../runbooks/key-rotation.md) — el paso de
  verificación tras rotar `TASK_SECRET`. Era el más dañino de los tres: una
  rotación correcta habría parecido fallida.
- [`kanban-mcp/README.md`](../../kanban-mcp/README.md) — la firma de
  `create_card`, que anunciaba `assignee?` como opcional.

**Por qué se rompe en vez de avisar.** Un aviso no cierra el defecto: la tarjeta
invisible se crea igual y nadie lee el aviso a las 3 de la mañana. Es el mismo
razonamiento que quitó el default de `workspaceName`, y la misma frase: **un
`400` avisa, un `201` miente.** El precio es real y se paga una vez.

**Por qué 3.0.0 y no 3.1.0, que es lo que se pidió.** La comanda del capitán fijó
el orden #17 → #18 y con él un 3.1.0 para el historial. Medido al ir a ejecutarla,
el orden real había sido el contrario: **el #18 ya estaba mergeado** y `main`
estaba en 2.1.0. Así que la secuencia que de verdad ocurrió es `2.0.0 → 2.1.0`
(aditivo, el historial) `→ 3.0.0` (rompe, esto), y renumerar hacia atrás para que
encajara con el orden previsto habría hecho mentir al historial sobre en qué orden
pasaron las cosas. La instrucción decía «mídelo contra el diff, no contra esta
comanda»; esto es esa medición.
**v2.1.0 — 2026-08-06 · MENOR.** Aditivo: la tool `card_history` y el historial de
descripciones. Y un **modo de fallo nuevo** en `update_card` —`500` si no se puede
guardar la versión anterior, dejando la tarjeta intacta—, que es lo que obliga a
que esto sea nota de contrato y no solo entrada de changelog.

**La escribió el vigilante al mergear, y el obrero la dejó sin escribir a
propósito.** No fue olvido: cuando hizo la obra había **dos ramas tocando este
fichero a la vez** —`main` en 2.0.0 y el PR #17 llevándolo a 3.0.0— y cualquier
número que hubiera puesto habría sido falso bajo uno de los dos órdenes de merge.
Dejó dicho «quien mergee el segundo, la añade». Al entrar este PR primero, el
número correcto es 2.1.0.

Eso afila la deuda del guardián que ata código y contrato: no es solo que la nota
se pueda olvidar — es que **con dos ramas abiertas no hay forma correcta de
escribirla desde una sola**, y el guardián tendrá que tolerar ese caso o lo hará
imposible de cumplir.

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
