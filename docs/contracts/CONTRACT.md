# Contrato — Inyección de comandas en el riel

- **Dueño canónico:** `aglaya-kanban-desk` (este repo)
- **Versión:** 3.9.0
- **Última modificación:** 2026-08-25

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

  **Desde v3.7.0 las DOS puertas lo hacen.** Estaba escrito aquí, dentro de la
  sección de la Puerta 1, y la Puerta 2 creaba igual y callaba. No era
  incumplimiento —la cláusula solo prometía por el riel— pero sí una asimetría:
  quien probara una puerta creía conocer la otra.
- **Las destructivas están cerradas con llave:** exigen `confirm=true`. Es diseño.
  No desactivar la compuerta.
- **Asignar suena.** Asignar no es etiquetar: dispara la notificación in-app real
  a un humano. **También al nacer asignada** *(10-ago-2026)*.

  **Y desde v3.9.0 las DOS puertas suenan** *(25-ago-2026)*. Esta cláusula vivía
  solo aquí mientras la Puerta 2 creaba tarjetas asignadas y callaba: existían,
  tenían dueño y su dueño no se enteraba salvo que abriera el tablero. No era
  incumplimiento —la cláusula solo prometía por el riel— pero sí la misma
  asimetría que el `warning` de brief vacío cerró en v3.7.0, y en la puerta por
  la que entra el trabajo de fuera de esta máquina.

  **Y crear + asignar es UNA sola escritura** *(10-ago-2026)*. Eran dos —`POST` y
  luego `PUT`— y la segunda **no se comprobaba**: si fallaba, la tarjeta ya
  existía **sin dueño** y el llamante recibía una excepción que no decía que ya
  existía. Una fila que ningún proceso mira, que es la misma familia que «nacer
  invisible» y por el mismo motivo: no falla, envejece.

  El `PUT` tenía un motivo real —era el update quien notificaba— y por eso el
  arreglo no fue moverlo sin más: ahora **crear con responsable también notifica**,
  y entonces una escritura basta. La ventana se cierra **por construcción**, no
  compensando.

  **Sin cambio de versión, y es deliberado:** no cambia ni un campo ni un código
  de la puerta. Lo que desaparece es un modo de fallo, y eso no se le cobra a un
  consumidor como una versión nueva. Queda fechado aquí porque el capitán sí
  necesita saber que ya no puede pasar.
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
- **Sobrescribir texto exige decirlo** *(v3.3.0)*. **Modo de fallo nuevo: una
  descripción que NO contiene la que ya había se rechaza con `409` y no se
  escribe nada** — ni la tarjeta ni su historial. Para sustituirla hay que pasar
  `replacing_on_purpose=true` (`replacesDescriptionOnPurpose` en la Puerta 2).

  **Añadir no se ve afectado:** un texto que contiene el anterior pasa sin
  bandera, que es el caso normal de una nave que amplía una tarjeta. Lo que se
  rechaza es la **reescritura ciega**: mandar una cadena armada en otro sitio que
  se lleva por delante lo que otro había escrito.

  **Por qué no es un aviso en el acuse:** esta casa ya midió que *nadie compara
  un acuse de éxito*. Un aviso que se puede ignorar sin hacer nada no cuesta
  nada.

  **Por qué el navegador no lo nota:** su editor trae la descripción actual
  dentro, así que quien sustituye desde ahí está mirando lo que borra — y el
  cliente lo afirma siempre. La compuerta existe para el llamante que **puede no
  haber leído**, y por eso el valor por omisión de esta puerta es el seguro.

  **Vaciar la descripción también cuenta como destruir**, y también exige la
  bandera. **No mandarla** sigue significando «no la toques», y no dispara nada.
- **El historial cubre TODOS los campos, y `card_history` los expone** *(v3.4.0)*.
  Antes guardaba solo la descripción. Ahora cada campo que **cambia de valor**
  deja su versión anterior: título, prioridad, responsable, fechas, categoría,
  etiquetas, checklist y adjuntos.

  **`card_history` gana dos campos:** `field` —el nombre de la columna de
  `cards`— y `oldValue`, el valor anterior **siempre como texto**.

  ⚠️ **Y `description` pasa a poder venir `null`:** solo la traen las filas de
  descripción. Quien deshaga una descripción puede seguir usándola; quien lea el
  historial de otro campo tiene que mirar `oldValue`. Las filas anteriores a este
  cambio siguen leyéndose: `oldValue` cae a `description` cuando la columna nueva
  está vacía.

  **Una fila por campo que CAMBIA, no por campo aceptado.** La puerta acepta diez
  y una edición típica toca uno o dos; escribir por campo aceptado multiplicaría
  por diez un crecimiento que nadie ha medido.

  **Y si no había valor previo, no hay fila:** pasar de vacío a lleno no destruye
  nada. Sigue valiendo el modo de fallo de v2.1.0 — si el historial no se puede
  guardar, el update se aborta con `500` y la tarjeta queda intacta.
- **Se puede AÑADIR al brief sin reenviar lo que ya estaba** *(v3.5.0)*. Hasta
  hoy esta puerta solo sabía sustituir: apuntar tres párrafos en una tarjeta
  obligaba a volver a transmitir los quince o veinte mil caracteres anteriores,
  a mano y sin equivocarse en ninguno. Ahora
  `append_to_description(card_id, text)` manda **solo el texto nuevo** y el
  servidor compone el resultado leyendo lo que ya hay.

  **Qué garantiza:** el texto anterior se conserva **byte a byte y al
  principio**, y lo añadido va detrás con al menos una línea en blanco, para que
  markdown siga viendo dos párrafos. La compuerta del `409` **no se esquiva**: el
  texto compuesto pasa por la misma comparación y la supera por construcción.

  **Modos de fallo nuevos, los dos `400`:** texto vacío —añadir nada reescribiría
  la misma descripción sin rastro y sin aviso— y mandar a la vez lo que añade y
  lo que sustituye, que son dos órdenes contradictorias y elegir una en silencio
  es obedecer una intención que nadie declaró.

  **Lo que NO hace:** insertar en medio, editar ni quitar. Eso sigue siendo
  sustituir, y sigue costando un acto deliberado.
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

**⚠️ ASIMETRÍA DECLARADA: aquí NO se puede añadir al brief, y no es un olvido**
*(v3.5.0)*. La Puerta 1 estrena `append_to_description`; ésta no lo estrena
porque **no puede editar una tarjeta en absoluto**: su único endpoint de
escritura la CREA. No hay `update` que ampliar, y la paridad exigiría construir
aquí una puerta de edición entera.

Y eso no es aditivo, es una decisión con precio: esta puerta usa `service_role`
—salta RLS, alcanza todo, incluidos los espacios personales que su propia
lectura excluye por regla— y `TASK_SECRET` vive fuera de esta máquina. Una
puerta de edición con ese alcance permite **reescribir la descripción de
cualquier tarjeta de cualquier espacio** a quien tenga el secreto, que hoy no
puede.

**Y eso no es una deuda que deje este cambio: es un límite que se declara.** Esta
puerta nunca supo editar, así que aquí no falta nada que antes hubiera. Si algún
día se quiere que edite, es una decisión nueva con ese precio delante — no un
aditivo que se cuele en la que arregla el reenvío.

**Lo que esto significa para quien llame desde fuera de esta máquina:** para
añadir a una tarjeta hay que entrar por la Puerta 1. Se dice aquí para que la
ausencia no se lea como que la puerta lo hace y nadie lo documentó.

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
`personal`, que se excluyen por REGLA.** Era la tercera superficie
automática de esta nave que los excluye; hoy son dos, porque **el digest se
retiró entero** (25-ago-2026, «cero mails»). La otra sigue en pie:
`scripts/rail-blindspot.sh` (`WHERE w.type <> 'personal'`). Que quede una menos
no ablanda esta regla — la deja más sola.

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

**Payload:** `⭐` significa **uno de cada pareja es obligatorio** — espacio por id
o por nombre, tablero por id o por nombre. El destino nunca es opcional; lo que
v3.8.0 añade es una forma de darlo que no caduca.

| Campo | Req. | Default | Notas |
|---|---|---|---|
| `title` | sí | — | Se hace `trim()`; vacío → 400 |
| `workspaceId` | ⭐ | — | *(v3.8.0)* UUID del espacio. **Camino recomendado:** no es ambiguo y no caduca al renombrar. Mal formado → 400; sin match → 404 |
| `boardId` | ⭐ | — | *(v3.8.0)* UUID del tablero. **Camino recomendado.** Si no pertenece al espacio pedido → **400 y no se escribe nada** |
| `workspaceName` | ⭐ | — | Alternativa a `workspaceId`. **Sin default, por diseño.** Match parcial |
| `boardName` | ⭐ | — | Alternativa a `boardId`. Match parcial case-insensitive; sin match → 404 |
| `priority` | sí | — | `urgent`\|`high`\|`medium`\|`low`\|`none`. **Ausente → 400** *(v3.0.0; antes caía a `medium` en silencio)*. **Inválida → 400** con la lista de válidas *(v2.0.0)* |
| `assignee` | sí | — | *(v3.0.0, campo nuevo)* Email, nombre exacto o UUID del responsable. Ausente → 400; sin match → 404; nombre que casa con varios → 400 con `candidates` |
| `description` | no | `""` | El brief |
| `dueDate` | no | `null` | ISO 8601 |
| `idempotencyKey` | no | — | *(v3.6.0, campo nuevo)* UUID. Repetirla devuelve **`200` con la tarjeta que ya existe** en vez de crear otra. Presente y no-UUID → 400; presente y vacía → 400 (no se lee como ausente); `null` u omitida → sin idempotencia |

⭐ **Hace falta el espacio (por id o por nombre) y el tablero (por id o por
nombre).** Lo que v3.8.0 cambia no es la obligatoriedad del destino: es que ya
hay una forma de apuntar que no caduca.

**Apuntar por identificador es el camino principal desde v3.8.0.** El nombre es
comodidad humana; el identificador es lo único que **no cambia cuando alguien
renombra** desde la interfaz. Y el emparejamiento por nombre es parcial: medido
contra la base real, **7 de 13 espacios casaban con `%AGLAYA%`**. Cada destino por
nombre es una tirada; cada destino por identificador es determinista.

El hueco que cierra era **media conversación**: esta puerta ya sabía DEVOLVER
identificadores —`GET /list-workspaces` y `GET /list-boards` los dan— y una nave
que leía el id correcto **no tenía dónde metérselo**.

**Si vienen el id y el nombre, gana el id.** No se rechaza la pareja: quien manda
los dos no está en conflicto consigo mismo, está siendo redundante — y de las dos
lecturas, la que no depende de un renombrado es la buena.

**Un identificador mal formado NO cae al nombre: es `400`.** Tragárselo y
resolver por el nombre sería el destino a ciegas que esta puerta impide — el
llamante creería haber apuntado con precisión.

⚠️ **Y el tablero se comprueba contra el espacio** *(v3.8.0)*: un `boardId` que
pertenece a otro espacio devuelve **`400` y no se escribe nada**, con los dos
identificadores en el cuerpo. Sin esa guarda, aceptar identificadores habría
estrenado un camino nuevo para aterrizar donde no era. Es la misma comprobación
que la Puerta 1 hace entre espacio y columna, y existe por lo mismo: exigir un
destino sin comprobarlo da sensación de control sin control.

**Por el camino del nombre esa guarda no hace falta** — allí el tablero se busca
ya acotado al espacio, así que no puede salir de otro sitio.

**El nombre se queda, y no por nostalgia:** quitarlo sería incompatible, y este
contrato prohíbe destinos implícitos a propósito.

**Comportamiento (camino del nombre):** busca el espacio por nombre parcial; **si casa con más de uno
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

**Y desde v3.7.0, `warning` cuando la tarjeta sale sin contenido** — la misma
regla que la Puerta 1, que ya lo hacía. Va **junto a `card`, no dentro**, y solo
aparece cuando hay algo que avisar: un campo que siempre está deja de leerse.

**El texto NO es el mismo que el del riel, y es deliberado:** aquél manda a mirar
`description_md` y su alias, y esos nombres no existen aquí. Un aviso que nombra
un campo inexistente manda a arreglar donde no está. **Se comparte la regla; el
texto es de cada puerta.**

**Por qué aviso y no `400`.** Se consideró y se descarta: una tarjeta solo-título
es legítima a veces, así que un `400` rechazaría trabajo bueno para tapar un caso
dudoso — e impedir que el trabajo entre es peor que pedir que alguien mire.
Además obligaría a cambiar también el riel, que hoy avisa, y sería incompatible
en las dos puertas a la vez.

**Lo que este aviso NO cubre, dicho:** una **repetición** por `idempotencyKey`
devuelve la tarjeta que ya existe **sin `warning`**, aunque aquélla esté vacía. El
aviso es del acto de crear; la repetición no crea nada, y quien la recibe ya fue
avisado —o no— la primera vez.

**Ambigüedad de TABLERO — abierta, y se declara aquí para que no se lea como
cerrada.** El `400` de arriba cubre el espacio, no el tablero: dos tableros con
nombres solapados dentro del mismo espacio siguen resolviendo al primero y
devolviendo `201`. Es el mismo defecto un nivel más abajo. Seguimiento en el
kanban de esta nave, no en este documento.

**Idempotencia — `idempotencyKey`** *(v3.6.0)*. Sin ella, dos `POST` idénticos
creaban dos tarjetas y devolvían `201` las dos veces. Un humano ve el duplicado;
**una nave que reintenta al vencer el tiempo de espera, no** — y no puede
distinguir «se creó y perdí la respuesta» de «no se creó».

Con ella, la repetición devuelve **`200`** —no `201`— con `idempotent: true` y el
mismo `card` que la primera vez. **El `200` es la mitad útil:** distingue «te la
acabo de crear» de «ésta ya estaba», que es justo lo que el reintento necesita
saber y lo que un `201` repetido borraría.

**El acuse de la repetición se reconstruye desde la fila guardada, no desde lo
que trae la repetición.** Si el tablero se renombró entre medias, devuelve **dónde
está** la tarjeta, no dónde habría ido — y no falla con un `404` por un nombre que
ya no casa.

**El espacio de nombres es global y se dice aquí, no se descubre:** dos naves que
eligieran la misma clave se pisarían. No se acota por llamante **a propósito** —el
llamante se autodeclara, así que acotar por él sería una separación que la puerta
no puede verificar—. Lo que sí se verifica es la forma, y por eso se exige UUID.

**La garantía no es de la ruta: es del índice único** (`idx_cards_idempotency_key`).
Mirar antes de insertar deja una ventana que dos reintentos simultáneos cruzan los
dos; el choque se recoge y se contesta como repetición.

**Puerta 1 no la tiene.** El riel sigue creando una tarjeta por llamada. Se dice
para que no se lea como cubierto por las dos puertas.

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
- **Paridad con la UI.** La Puerta 2 sigue siendo una tubería administrativa:
  inserta en crudo, **sin validación de negocio y sin comprobar membresías**.

  **«Sin notificaciones» salió de esta lista en v3.9.0** *(25-ago-2026)*, y se
  dice en vez de borrarse: la puerta **sí avisa** a quien le clava trabajo. Lo
  demás de esta cláusula se queda tal cual — **avisar no es validar**, y hay una
  prueba que lo fija para que «ahora suena» no se lea como «ahora comprueba».

## Qué código implementa este contrato

**Esta lista la lee el guardián.** No es documentación decorativa:
[`scripts/contract-guard.sh`](../../scripts/contract-guard.sh) la extrae de aquí
y, partiendo de estos ficheros, sigue sus imports locales hasta agotar. Todo lo
que quede dentro de ese cierre exige tocar este documento cuando cambia.

<!-- contract-guard:puertas:inicio -->
- `server/routes/internalRoute.js` — la Puerta 2 entera: payload, códigos, acuse.
- `kanban-mcp/server.py` — las tools de la Puerta 1 y sus compuertas.
- `server/routes/cards.js` — tres cláusulas vivas se sirven desde aquí: el `500`
  que aborta el update si el historial no se puede guardar *(v2.1.0)*, el `409`
  de sobrescritura ciega *(v3.3.0)* y los campos `field`/`oldValue` de
  `card_history` *(v3.4.0)*.
<!-- contract-guard:puertas:fin -->

**Por qué la lista vive AQUÍ y no dentro del guardián.** Vivía allí, y el
8-ago-2026 se midió lo que eso cuesta: alguien cambió la forma de respuesta de
`card_history` en `server/routes/cards.js` y el guardián contestó *«ninguna
puerta tocada — OK»*. El contrato subió a v3.4.0 **porque quien lo tocaba quiso**,
no porque nada le obligara. Tres compuertas documentadas, servidas en vivo a la
flota, y ningún guardián atándolas a su código.

**Sigue siendo una lista, y conviene decirlo en vez de fingir que no.** Lo que
cambia es **quién la ve**: aquí la mira quien añade una cláusula, que es
exactamente el momento en que hay que preguntarse desde qué fichero se sirve. En
el guardián solo la veía quien iba a tocar el guardián — es decir, casi nadie.

**Añadir una cláusula que se sirve desde un fichero nuevo obliga a añadirlo aquí.**
Si no, el guardián no lo vigila y este documento puede desalinearse en verde. Y un
contrato desalineado no envejece en un rincón: **el capitán lo sirve en vivo**, así
que se reparte.

---

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
que se pone **rojo** si un cambio toca la forma de una puerta y **no** toca este
fichero. Tiene su propio sello
([`contract-guard.test.sh`](../../scripts/contract-guard.test.sh)), porque un
guardián que da verde estando destripado es peor que no tenerlo.

**Qué cuenta como «la forma de una puerta» no se enumera aquí, y ya no se
enumera tampoco allí.** El guardián parte de las dos puertas —la ruta HTTP y el
servidor MCP— y **deriva** el resto siguiendo lo que importan. Este párrafo
llegó a nombrar tres ficheros a mano; el mismo día, un cambio sacó las
prioridades válidas a un cuarto y la lista quedó corta sin que nadie lo notara.
Una lista de ficheros escrita en un documento envejece igual que una escrita en
un script — y ésta, además, la reparte el capitán.

Lo que ese guardián **no** puede hacer: comprueba que alguien tocó este
documento, no que fuera honesto al tocarlo. Verificar que el texto describe el
código sigue siendo trabajo del vigilante. Lo que cierra es el caso en que
**nadie miró** — que es el que pasó tres veces seguidas.

Y si el cambio de verdad **no** altera la forma, se dice igualmente en el
historial de abajo: esa línea **es** el aviso al capitán que este contrato pide,
y cuesta un renglón.

### Historial de versiones

**Sin bump — 2026-09-06 (b).** Segundo cambio del mismo día sobre
`server/routes/cards.js`, y **la misma ruta que el de abajo**:
`GET /api/cards/search`. Tampoco cambia la forma de ninguna puerta.

**Qué cambió.** La búsqueda metía el texto del usuario dentro de un grupo `or`
de PostgREST —donde la coma separa condiciones—, así que una búsqueda con coma
**añadía una condición al filtro**. Ahora son dos filtros por columna, unidos en
el servidor (tarjeta `2c6c81b3`).

**Medido, y acota lo que se puede afirmar:** el cliente **sí escapa `&`**, así
que aquel texto **no podía crear otro parámetro** y **no llegaba a los `AND`** de
organización ni de tablero. Era **ensanchado dentro del alcance ya permitido y
error de sintaxis, no fuga entre inquilinos**. Se arregló igual.

**Por qué le sigue sin afectar al capitán:** vale lo medido en la entrada de
abajo — el riel no expone búsqueda y este documento no la menciona.

**Y lo que sí es nuevo para quien escriba puertas aquí:** ninguna cláusula de
este contrato debe construir un filtro de PostgREST concatenando texto de fuera.
No es una obligación del contrato hacia sus consumidores; es una nota sobre cómo
se implementan sus rutas, y por eso no sube versión.


**Sin bump — 2026-09-06.** No cambia la forma de ninguna puerta: ni un campo, ni
un código, ni una obligatoriedad. Va aquí porque **se tocó `server/routes/cards.js`**,
que sirve tres cláusulas vivas de este documento, y esta sección **es** el aviso
al capitán.

**Qué cambió, y por qué no le afecta.** `GET /api/cards/search` aislaba solo por
organización, yendo por `service_role` —que salta las políticas de fila—, así que
devolvía tarjetas de espacios a los que quien preguntaba no pertenece. Ahora se
acota a **los espacios de los que el usuario es miembro** (tarjeta `0092a0c0`).

**Medido antes de escribir esto, no supuesto:** esa ruta **no la consume ninguna
puerta de este contrato**. El riel (Puerta 1) **no expone ninguna herramienta de
búsqueda** —comprobado en `kanban-mcp/server.py`— y este documento no la
mencionaba en ninguna cláusula. Su único llamante es la barra de la aplicación
web.

**Lo que sí conviene que el capitán sepa igualmente:** si algún día se añade una
búsqueda al riel, **verá solo los espacios de los que el riel sea miembro** — que
es el mismo alcance asimétrico que ya declara `GET /list-workspaces`, y el mismo
punto ciego. No es una regla nueva: es la de siempre, aplicada donde faltaba.


**v3.9.0 — 2026-08-25 · MENOR.** Aditivo: **la Puerta 2 dispara la notificación
in-app cuando la tarjeta nace asignada.** Decisión de Ibai. Ningún campo, ningún
código de error y ninguna obligatoriedad cambian; lo que cambia es que esta
puerta **promete un aviso que antes no prometía**, y por eso es MENOR y no «sin
bump»: una promesa nueva se le puede exigir a la puerta, un modo de fallo que
desaparece no.

**Qué lo motiva.** Hasta el #56 ninguna puerta avisaba al nacer asignada. Aquél
lo cerró para la Puerta 1 y para la UI, y dejó a la Puerta 2 sola: una comanda
del capitán a una persona **existía, tenía dueño y no avisaba a nadie**. Es la
familia «nace invisible» de esta casa — no falla, envejece.

**Lo que NO cambia, y hay prueba de cada cosa:** la Puerta 2 sigue insertando en
crudo, sin validación de negocio ni comprobación de membresías; el acuse tiene
la misma forma; **una repetición por `idempotencyKey` NO vuelve a sonar** —no
crea nada, y dos campanas por el mismo trabajo enseñan a ignorar la campana—; y
**un aviso que falla no tumba la creación**: la tarjeta ya existe y el llamante
recibe su `201`.

**Y una asimetría que se declara en vez de taparse:** la guarda «a uno mismo no
se le notifica» **no existe aquí**, porque por esta puerta no hay identidad de
llamante — entra un secreto, no un usuario. Por eso `assignedBy` viaja como
`null` en vez de inventarse un autor. Consecuencia aceptada: lo que se asigna al
propio riel genera avisos que nadie lee. El día que el llamante tenga identidad,
esa guarda entra sola.


**Sin bump — 2026-08-25.** No cambia la forma de ninguna puerta: ni un campo, ni
un código, ni una obligatoriedad. Lo que cambia es **quién vigila que este
documento no se desalinee del código**, y va aquí porque esta sección **es** el
aviso al capitán — y él sirve este contrato en vivo.

**Qué se midió.** `server/routes/cards.js` sirve **tres cláusulas vivas** de este
documento —el `500` que aborta el update si el historial no se puede guardar
*(v2.1.0)*, el `409` de sobrescritura ciega *(v3.3.0)* y los campos
`field`/`oldValue` de `card_history` *(v3.4.0)*— y **no estaba en la lista de
puertas que `contract-guard` vigila**. Cambiar la forma de respuesta de
`card_history` en ese fichero devolvía «ninguna puerta tocada — OK». La versión
subió porque quien la tocaba quiso, no porque nada le obligara.

**Qué cambia.** La lista de ficheros que implementan este contrato **se muda
aquí**, al bloque `contract-guard:puertas` de la sección «Qué código implementa
este contrato», y el guardián la lee de ahí. Sigue siendo una lista —se dice en
vez de fingir que no— pero **la mira quien añade una cláusula** en lugar de quien
venga a tocar el guardián.

**Y si el bloque desaparece, el guardián sale con `2`, no con verde.** «No he
visto ninguna puerta tocada» y «no sé qué es una puerta» se leen igual desde
fuera y significan lo contrario.

**v3.8.0 — 2026-08-25 · MENOR.** Aditivo: la Puerta 2 acepta **`workspaceId` y
`boardId`**, y apuntar por identificador pasa a ser el camino recomendado. Los
nombres siguen funcionando exactamente igual.

**Por qué importa más de lo que parece:** el emparejamiento por nombre es parcial,
y está medido contra la base real que **7 de 13 espacios casaban con `%AGLAYA%`**.
Un identificador no es ambiguo y **no caduca cuando alguien renombra**. Esta
puerta ya sabía devolver identificadores desde v1; lo que faltaba era poder
dárselos — media conversación.

**Modo de fallo nuevo, dicho:** un `boardId` que no pertenece al espacio pedido
devuelve **`400` y no escribe nada**. Sin esa guarda, el arreglo habría estrenado
un camino nuevo para aterrizar donde no era. Y un identificador **mal formado es
`400`, no un silencioso vuelta-al-nombre**.

**Absorbe dos cosas que estaban pendientes por separado:** la ambigüedad de
TABLERO —dos títulos solapados dentro del mismo espacio resolvían al primero y
devolvían `201`— deja de existir por este camino, porque con identificador no hay
ambigüedad que resolver. Y el aviso de que «AGLAYA Kanban Desk» es el nombre del
proyecto y no un destino válido **existía solo porque los nombres eran la forma
de apuntar**.

**v3.7.0 — 2026-08-25 · MENOR.** Aditivo: la Puerta 2 devuelve `warning` cuando
la tarjeta se crea **sin contenido**, igual que ya hacía la Puerta 1. Cierra una
asimetría, no un incumplimiento: la cláusula «una tarjeta sin contenido lo dice»
vivía dentro de la sección del riel, así que prometía por él y no por la otra.

**Por qué pesa aunque nada se rompiera:** la Puerta 2 es la que usan las naves de
fuera de esta máquina. Este contrato delega la verificación en el llamante
—«verificar en la UI sigue siendo del llamante»— y **esa frase se escribió para
un humano**. Una nave no abre la interfaz nunca, así que una tarjeta vacía creada
en silencio era trabajo que solo se veía mirando el tablero a ojo.

**No rompe a nadie:** el `201` y la forma de `card` no cambian, y `warning` solo
aparece cuando hay algo que avisar. **`400` se consideró y se descartó** — una
tarjeta solo-título es legítima, y rechazarla habría impedido que entrara trabajo
bueno, además de obligar a cambiar el riel.

**Y sí, este documento dice en v3.3.0 que «nadie compara un acuse de éxito» y que
por eso allí hubo compuerta y no aviso. No se contradice, y conviene ver la
diferencia:** allí lo que estaba en juego era **destruir** texto de otro, y un
aviso que se puede ignorar no habría impedido nada. Aquí no se destruye nada —la
tarjeta existe, está asignada y tiene prioridad, así que **es visible en el
tablero**—; lo único que falta es su contenido. Cuando el remedio es mirar, avisa;
cuando el remedio es no hacerlo, se cierra con llave.

**v3.6.0 — 2026-08-11 · MENOR.** Aditivo: la Puerta 2 acepta `idempotencyKey`
(UUID, opcional) y una repetición devuelve `200` con la tarjeta que ya existe.
**No rompe a nadie:** quien no mande el campo se comporta exactamente como antes
—dos `POST` idénticos siguen creando dos tarjetas—, y hay prueba que se pone roja
si eso cambia.

**El modo de fallo nuevo, dicho:** una clave presente y mal formada —incluida la
cadena vacía— devuelve `400` y **no escribe nada**. La vacía no se lee como
ausente a propósito: mandar el campo es haber decidido usarlo, y tragárselo
devolvería una tarjeta nueva por reintento mientras el llamante se cree protegido.

**Exigió tocar la base** (`docs/schema/migration-idempotency-key.sql`: columna
`cards.idempotency_key` e índice único parcial). La garantía vive en ese índice,
no en la ruta: la comprobación previa deja una ventana que dos reintentos
simultáneos cruzan los dos, y el `23505` se contesta como repetición.

**Lo que NO entra:** la Puerta 1 sigue sin clave de idempotencia.

**Sin bump — 2026-08-10.** No cambia la forma de ninguna puerta: ni un campo, ni
un código, ni una obligatoriedad. Lo que cambia es que **desaparece un modo de
fallo** de la Puerta 1, y por eso va aquí — esta sección **es** el aviso al
capitán, y un modo de fallo que deja de existir le importa tanto como uno nuevo.

**Dos cosas, y la primera explica la segunda:**

1. **Crear con responsable notifica también.** El aviso in-app vivía solo en el
   update. Ahora `POST /api/cards` lo dispara al nacer asignada, con las mismas
   dos guardas: sin responsable no hay a quién avisar, y a uno mismo no se le
   notifica.
2. **Crear + asignar es UNA sola escritura.** Eran dos —`POST` y luego `PUT`— y
   la segunda no se comprobaba: si fallaba, la tarjeta ya existía **sin dueño** y
   el llamante recibía una excepción que no decía que ya existía. Una fila que
   ningún proceso mira.

**Por qué no bastaba con mover el campo al `POST`, que es lo que parecía:** el
`PUT` estaba ahí porque era el update quien notificaba, y el update solo avisa si
el responsable **cambia**. Quitarlo sin lo primero habría cerrado la ventana
**perdiendo el aviso en silencio** — y un aviso que no llega no lo echa nadie de
menos. Por eso el orden importa: primero notificar al crear, y entonces una
escritura basta.

**Lo que el capitán puede dejar de asumir:** que una comanda suya pueda quedar
escrita sin responsable si algo falla a mitad. Ya no puede — no por compensación,
sino porque no hay segundo paso que falle.

**Lo que sigue igual:** la Puerta 2 no promete avisos y no los da.
*(⚠️ Cierto el 10-ago-2026, y **dejó de serlo en v3.9.0**. No se edita esta línea:
un historial de versiones registra lo que se dijo el día que se dijo, y
corregirlo hacia atrás borraría que la asimetría existió y durante cuánto.)*

**v3.5.0 — 2026-08-09 · MENOR.** Aditivo: la Puerta 1 estrena
`append_to_description`, que **añade al brief sin reenviar lo que ya estaba**.

**Por qué MENOR y no MAYOR:** no cambia ningún nombre existente, ninguna
obligatoriedad ni el comportamiento de `update_card`, que sigue sustituyendo
exactamente igual. Trae dos modos de fallo nuevos (`400` por texto vacío y `400`
por mandar añadir y sustituir a la vez) pero **solo alcanzan a llamadas que hoy
no existen**: nadie puede pasar hoy un campo que hasta hoy no se leía.

**Sale de un daño medido, y de tres mediciones independientes.** El 8-ago-2026 la
reconstrucción a mano de una descripción destruyó la medición de otro papel y un
hallazgo escrito ahí precisamente para viajar entre papeles; se recuperó porque el
historial se había construido esa misma mañana. Y los tres papeles del protocolo,
entrevistados por separado, señalaron el reenvío íntegro como el mayor coste de su
jornada. **La compuerta del `409` (v3.3.0) defendía de la reescritura ciega pero
dejaba intacto el reenvío**: era un guardián contra un defecto que no tenía por
qué existir.

**La asimetría con la Puerta 2 se declara arriba**, en su propia sección: allí no
se puede añadir porque allí no se puede editar. Darle esa capacidad con
`service_role` sería una decisión nueva con su propio precio, no algo que falte
aquí — esa puerta nunca supo editar.

**v3.4.0 — 2026-08-08 · MENOR.** Aditivo: el historial deja de ser solo de la
descripción y `card_history` expone `field` y `oldValue`. Es la mitad de código
de `cfeccbc4`, que puso las columnas.

**Por qué MENOR y no MAYOR:** no cambia ningún nombre existente ni ninguna
obligatoriedad, y las filas que hoy devuelve la tool siguen devolviéndose igual.
Lo único que un consumidor tiene que saber es que **`description` puede venir
`null`** en filas de otros campos — filas que antes no existían. Un consumidor
que solo mire historial de descripciones no nota nada.

**Sale de un daño medido:** el 6-ago-2026 once tarjetas perdieron su prioridad y
se recuperaron por dos casualidades. El que muerde más fuerte no es la prioridad
—ya cerrada por otra vía— sino el **responsable**: reasignar por error vuelve la
tarjeta invisible para su obrero, y sin historial nadie puede decir a quién
estaba asignada.


**v3.3.0 — 2026-08-08 · MENOR.** Aditivo con **modo de fallo nuevo**, que es lo
que obliga a que sea nota de contrato: `update_card` rechaza con `409` una
descripción que no contenga la que ya había, salvo que se pase
`replacing_on_purpose`. Añadir no cambia; reescribir a ciegas, sí.

**Sale de un daño medido, no de una idea.** El 8-ago-2026 un obrero reconstruyó
la descripción de una tarjeta desde una copia vieja y la mandó entera: se
perdieron la medición del vigilante y **un hallazgo escrito ahí precisamente
para viajar de un papel a otro**. Se recuperó porque `card_history` guarda
versiones — y eso es suerte de implementación, no una garantía: nadie mira el
historial salvo que ya sospeche, y para sospechar hay que haber leído la versión
anterior.

**Por qué MENOR y no MAYOR.** No cambia ningún nombre de campo ni ninguna
obligatoriedad: añade una compuerta con su código de error, igual que el `409`
de `delete_column` en v3.1.0. Rompe **solo** a quien reescribía a ciegas, que es
exactamente lo que se quiere que deje de pasar. Y el aviso al capitán es esta
línea.


**Sin bump — 2026-08-06.** No cambia la forma de ninguna puerta: se corrige la
descripción del guardián, que nombraba tres ficheros a mano y se había quedado
corta. Va escrito aquí porque esta sección **es** el aviso al capitán, y porque
el defecto fue de la clase que este documento persigue: **una copia de una lista
que envejece**. Nada lo habría cazado — el guardián vigila que se toque este
fichero cuando cambia una puerta, y aquí no cambió ninguna puerta. Lo destapó
leer en vivo lo que el capitán sirve y compararlo con el código.

**v3.2.0 — 2026-08-06 · MENOR.** Aditivo: `update_card` acepta el brief por sus
**dos** nombres, como ya hacía `create_card`. Hasta hoy solo aceptaba el alias, y
el texto enviado con el nombre **documentado** se descartaba **en silencio** — con
un `title` al lado, el título se actualizaba, el brief se perdía y la respuesta
decía que todo fue bien.

Y al actualizar, **«no mandarlo» y «mandarlo vacío» pasan a ser órdenes
distintas**: la primera deja la descripción como está, la segunda la vacía.
Confundirlas borraría el brief de cualquier tarjeta a la que solo se le cambiara
el título.

**La línea de arriba de este contrato afirmaba lo primero sin acotar**, y era
cierta para crear y falsa para actualizar. Quien viniera de crear con el nombre
documentado lo reutilizaba aquí y perdía el texto.

**El número lo puso el vigilante al revisar.** El PR tocó este fichero —y por eso
`contract-guard` dio verde— pero dejó la versión en 3.1.0. **Es la primera vez
que se ve en vivo la limitación que ese guardián declara en su propia cabecera:**
comprueba que alguien *tocó* el documento, no que fuera *honesto* al tocarlo.
Verificar que el texto describe el código, y que el número describe el cambio,
sigue siendo trabajo del vigilante.


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
