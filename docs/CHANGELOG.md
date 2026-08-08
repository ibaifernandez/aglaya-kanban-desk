# CHANGELOG — AGLAYA Kanban Desk

Registro de cambios por versión. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)

---

## [Unreleased]

### Security
- **Sobrescribir la descripción de una tarjeta ya no se puede hacer sin querer.**
  Tarjeta `f19dda2d`. Contrato `riel` **v3.3.0** — modo de fallo nuevo.
  - **Qué pasó, y lo hice yo.** El 8-ago-2026 un obrero —éste— reconstruyó la
    descripción de `6b1a11f3` desde una copia vieja y la mandó entera. Se
    perdieron la medición del vigilante y **un hallazgo escrito ahí precisamente
    para viajar de un papel a otro**. Se recuperó porque el historial guarda
    versiones, y **eso es suerte de implementación, no una garantía**: nadie mira
    el historial salvo que ya sospeche.
  - **Por qué era `high` y no una anécdota:** todo el protocolo descansa en «no
    hay partes — lo que no quepa en la tarjeta o en el PR, no existe». La tarjeta
    **es** el registro, y se podía sobrescribir entero sin aviso ni marca.
  - **La compuerta:** `PUT /api/cards/:id` devuelve **`409`** si la descripción
    entrante **no contiene** la que ya había, salvo que traiga
    `replacesDescriptionOnPurpose: true`. No escribe nada — ni la tarjeta ni el
    historial.
  - **Añadir no se entera.** Un texto que contiene el anterior pasa sin bandera,
    que es el caso normal de un agente que amplía una tarjeta. **Si pidiera acuse
    también para añadir, la compuerta se volvería un trámite y se pasaría
    siempre** — que es como mueren las compuertas.
  - **La asimetría que lo hace funcionar:** el navegador **ha leído el texto por
    construcción** —su editor lo trae dentro—, así que el cliente afirma la
    bandera siempre y quien compacta desde ahí está mirando lo que borra. El riel
    manda una cadena armada en otro sitio, y **su valor por omisión es el
    seguro**.
  - **Por qué no un aviso en el acuse:** esta casa ya midió que **nadie compara un
    acuse de éxito** (`5d8a5fd8`). Lo que no cuesta nada no cambia lo que pasa.
  - **Vaciar también es destruir**, y también exige la bandera. **No mandar la
    descripción** sigue significando «no la toques» y no dispara nada.
  - Ocho pruebas nuevas y seis mutaciones, las seis cazadas.
  - ⚠️ **Lo que NO cubre:** los demás campos —prioridad, responsable, columna—
    se siguen sobrescribiendo sin rastro. Eso es `cfeccbc4`. Y no protege de
    quien pasa la bandera sin mirar; nada puede.
- **`grants-guard` deja de ser tuerto: vigila `anon` y `authenticated`, con
  excepciones por tabla derivadas del esquema.** Tarjeta `cf3303c7`.
  - **Vigilaba un solo rol, siempre `anon`.** `authenticated` —de quien se
    recortaron `MAINTAIN`, `REFERENCES`, `TRIGGER` y `TRUNCATE` el 6-ago— **no lo
    miraba nadie**. El rol del que se acababa de recortar era justo el ciego.
  - **Y cierra un segundo hueco que parecía necesitar a una persona:** `eeaebd9f`
    no podía certificarse porque la única medición que existe **la ejecutó quien
    aplicó el recorte**, y quien ejecuta no certifica su propio resultado. Este
    job sí puede: tiene credenciales propias y su verde queda **en el registro**,
    no en la palabra de nadie.
  - **Lo permitido dejó de ser una variable: se DERIVA del esquema**
    (`scripts/grants-expectativa.py`). Cada rol tiene su conjunto, y hay
    **excepciones por tabla** — una tabla-historial no puede dar `UPDATE` ni
    `DELETE` a quien genera lo que guarda.
  - **Las excepciones se declaran donde se declara el esquema, no dentro del
    guardián.** Una lista escrita a mano en un script es completa el día que se
    escribe: es la avería que el #35 cerró para `contract-guard`. **Comprobado
    contra las dos versiones del esquema que existían el 8-ago**: sobre `main` da
    solo los defaults; sobre la rama del #42 saca sola la excepción por tabla,
    sin tocar una línea del guardián.
  - **La comparación se movió del `HAVING` de SQL al script**, porque la
    expectativa ya no es una cadena única. Efecto lateral bueno: la decisión
    quedó visible y sellable. Efecto lateral que hubo que cubrir: **«sin filas»
    dejó de significar «ninguna se sale» y pasa a significar «no se midió nada»**,
    que ya no es verde.
  - **El sello exige los DOS roles.** La comprobación de que `anon` sigue vigilado
    —añadida al cerrar `8eb39541` para que nadie desviara el guardián— **no se
    retira: se le suma la de `authenticated`**. 22 casos, y uno comprueba que
    ninguna excepción por tabla viva dentro del script.
  - **Nueve mutaciones. Una escapó** —la defensa contra una fila de un rol que
    nadie declara no la ejercía ningún caso— y ya tiene el suyo.
  - ⚠️ **Lo que NO cierra:** sigue ciego a `MAINTAIN`, porque consulta
    `information_schema`, que solo expone los siete del estándar SQL. Es
    `11f1be5b`, y esto no la absorbe.
- **Ya no puede entrar una dirección de correo nueva en el árbol sin que alguien
  lo decida.** `scripts/email-guard.sh` corre en CI y se pone rojo ante cualquier
  dirección que no esté **declarada** en `scripts/email-guard.allowed`. Cierra el
  «ni impide que vuelva a entrar una» de la entrada de abajo — tarjeta `a3a3104c`.
  - **Lo que decide no es la forma de la dirección, sino si está declarada.** Un
    guardián que se pusiera rojo ante cualquier `@` nacería rojo: el árbol está
    lleno de plantillas y fixtures que tienen que estar. Declarar cuesta un acto
    deliberado con su motivo escrito al lado.
  - **Dos formas de declarar, y la asimetría es el guardián entero.** `dominio`
    abre un dominio entero —los de ejemplo, los de la casa, los propios de quien
    publicó el repo—; `sha256` declara **una** dirección exacta. `gmail.com` **no**
    se abre entero: ahí es donde tiene buzón el resto del mundo, y abrirlo dejaría
    entrar en silencio la siguiente dirección de un tercero, que es el fallo que
    esto cierra.
  - **Las declaraciones no llevan la dirección en claro, sino su `sha256`** y una
    máscara en el comentario. El fichero de declaraciones vive en el mismo
    repositorio público: escribirla ahí sería publicarla en un sitio nuevo con la
    excusa de vigilarla.
  - **Estrenó verde** sobre el árbol real (200 ficheros versionados, ninguna
    dirección sin declarar), y su sello —17 casos, las dos direcciones— corre
    **antes** que él en el job.
  - **Lo que NO cubre, declarado en su cabecera:** la historia de git (sigue
    siendo `abf77bce`, en «🙋 Decide Ibai»), los ficheros no versionados, los
    binarios, los lockfiles de dependencias —excluidos por regla de nombre, porque
    sus direcciones son metadatos de terceros que se regeneran solos— y las
    direcciones ofuscadas. Un verde suyo dice «no entró ninguna sin declarar», no
    «no hay correos expuestos».
- **Fuera del árbol la dirección de correo de la única persona que no decidió
  publicarla.** El repositorio pasó de privado a **público** el 6-ago-2026 sin que
  nadie comprobara antes qué había dentro. No había ninguna credencial —barrido de
  los 304 commits, cuatro coincidencias y las cuatro marcadores de posición— pero sí
  direcciones personales, y **una no era de quien publicó el repo**.
  - **`CLAUDE.md`**: la línea que declara quién puede tener cuenta nombraba a las dos
    personas **con su dirección**. Ahora las nombra sin publicarla. Se conserva
    `kanban-rail@aglaya.biz`, que **no es una persona** sino la cuenta de servicio del
    riel. El dato exacto lo custodiaba ya la tabla `users`; este archivo solo custodiaba
    la **decisión** de quién puede existir, y eso no necesita el correo escrito al lado.
  - **`docs/BACKLOG.md`**: una atribución de dos workspaces citaba la dirección para
    decir de quién eran. Basta el nombre.
  - **Barrido del árbol entero al hacerlo**, y el resultado conviene que conste: las
    demás direcciones son **del propio Ibai** (incluidas las legadas de `lfi.la`),
    **fixtures de test** (`user@gmail.com`, que existe precisamente para comprobar que
    un dominio no corporativo se rechaza) o **direcciones corporativas de proveedores**
    en `docs/operator-checklist.md`. Ninguna otra es de un tercero.
  - **Lo que esto NO cierra, y no se lea como cerrado:** las direcciones **siguen en la
    historia de git**, que es pública. Quitarlas del árbol de hoy no toca los commits
    antiguos. Eso es una decisión con tres salidas —no hacer nada, reescribir la
    historia, volver el repo privado— y está parada en «🙋 Decide Ibai» en el tablero
    «🛠 Operaciones», tarjeta `abf77bce`.
  - **Ni impide que vuelva a entrar una.** Hoy nada lo comprueba: éstas llegaron
    escribiéndolas, sin más. Hay tarjeta abierta para el guardián (`a3a3104c`), con la
    dificultad real dentro — distinguir una dirección de verdad de `usuario@example.com`
    no lo hace un regex de correo, y un guardián que nace rojo se normaliza.

### Changed
- **CI deja de correr trabajo que nadie mira** (`concurrency` en los seis
  workflows + los tres guardianes deciden dentro si tienen algo que mirar).
  **No es ahorro de dinero:** este repo es **público**, y en los públicos Actions
  con corredores estándar es gratis. Lo que se recorta es **espera** — cada
  revisión aguarda esos minutos, y hoy 6-ago-2026 el repo hizo **231 corridas**
  contra 11-16 los días previos.
  - **`concurrency` con cancelación**, agrupando por workflow + rama. **`ci.yml` ya
    lo tenía**, y eso mismo dice que sus 349 minutos no los arregla este flag.
  - **La cancelación es solo en `pull_request`, a propósito.** En `main` la corrida
    **es** el registro de que lo puesto pasó sus comprobaciones.
  - **Los guardianes arrancan SIEMPRE y deciden dentro.** La primera versión de
    este cambio filtraba por rutas en el disparador, y estaba mal por dos motivos:
    un guardián que no se dispara **no aparece en el PR**, y una comprobación
    ausente no se distingue de una que pasó —esta casa lo pagó el mismo día con
    el [#34](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/34), nueve
    checks frente a diez—; y la lista de rutas en el YAML era una **segunda
    lista**. El vigilante lo midió inyectando una violación real en una ruta que
    el filtro dejaba fuera: el guardián la cazaba y el filtro no lo despertaba.
  - **Y no hay lista: se DERIVA de `FILES`**, la misma construcción que usa el
    guardián al correr. `--relevante` contesta él mismo si el cambio le toca.
    - **Primero se hizo mal, y merece constar.** La primera versión movió la
      decisión al script pero **le puso su propia lista**: cambió el mecanismo y
      dejó el conjunto aparte. El guardián lee **nueve** ficheros y aquella lista
      reconocía **dos**. Lo ejerció el vigilante: una versión literal en
      `docs/SECURITY.md` la caza el guardián con `exit=1`, y la relevancia decía
      `NO`. **Dos listas escritas aparte divergen; la pregunta no es si, es
      cuándo** — y habría sido la tercera vez en un día.
    - **El sello tampoco tiene copia:** `--entradas` expone esa misma derivación
      y el sello **itera sobre ella** exigiendo `SI` para cada fichero, más una
      guarda de que la lista no venga vacía. Si el sello tuviera su propia lista
      sería la tercera copia.
  - **Hay una entrada que NINGUNA lista de rutas puede expresar**, y por eso esto
    no podía ser un `paths:`: la regla LINKS de `docs-guard` comprueba que los
    enlaces apunten a ficheros que existen, así que **un borrado o un renombrado
    en cualquier rincón del repo** puede romperla. Por eso mira el diff con su
    estado (`--name-status`), no solo los nombres.
  - **Sellos: docs-guard 70 → 77 casos, rail-blindspot 22 → 26.** Cuatro mutantes
    sobre la decisión nueva, los cuatro cazados: siempre-NO (6 fallos),
    olvida-borrados-y-renombrados (2), lista-recortada-a-los-dos-md (3) y
    siempre-SI (1) — este último no miente, pero no ahorra, y el sello también lo
    nota.
  - **Los tres guardianes tienen su decisión en el script, ninguno en el YAML.**
    `schema-guard` era el que faltaba —no tenía script cuando esto se escribió— y
    al entrar el [#33](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/33)
    la decisión se fue con él, como quedó anunciado. Cero `paths:` en los seis
    workflows, y cero listas de rutas en YAML.
  - **`digest-cron` NO cambia de cadencia.** La hora la elige cada usuario
    (`users.digest_hour`): correr menos veces no manda menos correo, manda **cero**
    a quien tenga una hora que ya no se visita, y sin error.
- **La prioridad de una tarjeta sobrevive a «✅ Hecho»** — se retira la regla de
  `CLAUDE.md` que ordenaba ponerla a `none` al cerrar, y entra
  `server/tests/move-card-preserva-prioridad.test.js` para que no vuelva.
  - **El mecanismo no era código, y por eso costó encontrarlo.** El síntoma medido
    era 10 de 10 tarjetas en «Hecho» con `priority: none` y 0 de 23 en el resto,
    seis de ellas nacidas con otra prioridad. Se auditaron los **cinco** caminos
    que escriben —`moveCard` y `updateCard` de la puerta HTTP, `move_card` y
    `update_card` del riel, y la interfaz web, que llama
    `api.moveCard(id, { columnId, order })`— y **ninguno toca la prioridad**.
    Quien la borraba era **una línea de `CLAUDE.md` ejecutada a mano por cada
    sesión de Claude que cerraba una tarjeta**.
  - **La firma lo decía desde el principio:** 100 % de un grupo y 0 % del resto es
    la huella de *una instrucción obedecida*, no la de un defecto — un defecto
    reparte al azar. Se buscó un culpable con la forma equivocada.
  - **Por qué se retira la regla y no se implementa en el código.** Borraba un
    dato para arreglar una vista, y la vista ya tenía arreglo sin pérdida: quien
    ordena por prioridad puede filtrar por columna, que es lo que ya hace
    `digest/user.js`. Una prioridad borrada no se recupera —no tiene historial— y
    es la única señal de cuánto importaba aquel trabajo, justo en la columna que
    lee quien audita.
  - **La prueba vigila que algo SIGA sin hacerse**, que es raro, y por eso lo
    explica en su cabecera. Muerde donde no se puede acertar por casualidad: no en
    la respuesta, sino en **lo que se escribe en la base** — exige que el `update`
    de mover lleve exactamente `column_id`, `board_id`, `order` y `updated_at`.
    Verificada con **las dos** reimplementaciones posibles, no solo con la fácil:
    la incondicional tira **7 de 7**, y la **condicional al nombre de la columna
    destino** —que es como estaba escrita la regla, y por tanto la única que
    alguien escribiría de verdad— tira **5 de 7**.
  - **La segunda no siempre cayó, y ahí estuvo el hueco.** La primera versión de
    esta prueba montaba la columna destino **sin nombre**, así que un `if` sobre
    cómo se llama la columna era **invisible** y pasaba en verde. Lo encontró el
    revisor reimplementando la regla *tal y como estaba redactada* en vez de la
    forma cómoda de mutar. **Una prueba que solo caza la mutación ingenua no
    vigila la regla: vigila una versión de juguete de la regla.**
  - `none` sigue siendo una prioridad válida y elegible a mano. Lo que se retira
    es que se ponga sola.
### Security
- **`anon` y `authenticated` recortados a lo que el esquema declara — APLICADO EN
  PRODUCCIÓN el 6-ago-2026** (`docs/schema/migration-recorte-privilegios-anon-authenticated.sql`).
  Cierra la tarjeta `eeaebd9f` por el lado de la base.
  - **Medido, no leído:** `authenticated` tenía `MAINTAIN`, `REFERENCES`,
    `TRIGGER` y **`TRUNCATE`** de más en once tablas; `anon` tenía `MAINTAIN` en
    diez. El grave es `TRUNCATE`: **salta RLS**, y toda la separación entre
    organizaciones de esta nave vive en RLS.
  - **Por qué nadie lo vio, que es la mitad interesante.** `MAINTAIN` es un
    privilegio **nuevo de PostgreSQL 17** (esta base corre 17.6) y **no aparece en
    `information_schema`**, que solo expone los siete del estándar SQL. Y
    `scripts/grants-guard.sh` consulta justamente `information_schema`: llevaba
    días en verde sobre tablas con un privilegio de más. **No mentía — miraba por
    una ventana que no da a ese lado.** Se ve con `aclexplode(relacl)`.
  - **La tarjeta se quedaba corta:** decía tres privilegios de sobra en
    `authenticated`. Son cuatro.
  - **Radio del cambio: cero, y también medido.** Ningún camino de esta aplicación
    lee ni escribe tablas como `anon` o `authenticated` — todo pasa por Express
    con `service_role`, y la llave anónima del cliente solo se usa para
    autenticarse (`LoginPage`, `ResetPasswordPage`).
  - **La sección 9 del esquema ahora RECORTA antes de conceder.** Solo concedía, y
    un `GRANT` no quita nada: correr el esquema no arreglaba la divergencia, la
    dejaba igual.
  - **Media puerta queda abierta, y se dice:** `ALTER DEFAULT PRIVILEGES` solo
    toca los defaults del rol que lo ejecuta. En `public` hay dos concesionarios
    —`postgres` y `supabase_admin`— y los de `supabase_admin` siguen dando los
    ocho. No se tocan a propósito: son configuración de Supabase. Esa mitad la
    tiene que vigilar el guardián.
  - **Y por eso esto NO cierra la tarjeta entera:** falta que
    `scripts/grants-guard.sh` lea `aclexplode` en vez de `information_schema`, con
    un caso de sello que inyecte `MAINTAIN` y exija rojo. Hoy ese caso pasaría en
    verde, y ése es el defecto.


### Fixed
- **El guardián del esquema distingue estructura de datos** (`scripts/schema-guard.sh`
  + su sello). La regla exigía tocar `docs/schema/supabase-schema.sql` ante
  **cualquier** fichero de migración, aunque solo moviera filas. Pasó de verdad
  con la migración que renumeraba columnas: **un guardián que obliga a un gesto
  vacío enseña a hacer gestos vacíos**, y a partir de ahí su verde no informa.
  - **Clasifica por contenido, no por una marca.** Una casilla que se marca sola
    acaba marcándose siempre: cambiaría un falso positivo por un falso negativo,
    que es peor porque no se nota.
  - **Y la lógica sale del workflow a un script con sello**, como los otros cuatro
    guardianes. Dentro del YAML no se podía correr en local ni sellar: para saber
    si mordía había que empujar y mirar.
  - **Corrige una regresión que la primera versión introdujo**, encontrada por el
    vigilante: anclar la detección a principio de línea dejaba pasar
    `BEGIN; CREATE TABLE …; COMMIT;` en un renglón, que la comprobación anterior
    **sí veía** — una tabla naciendo sin `GRANT` ni RLS, la avería que esta casa
    ya pagó. El arreglo no es desanclar (eso convierte un `-- ALTER TABLE` en
    comentario en un falso rojo) sino **normalizar**: comentarios fuera —de línea
    y de bloque— y una sentencia por línea. Las dos trampas caen a la vez.
  - **`SELECT … INTO tabla` crea una tabla sin decir `CREATE`** y ahora cuenta
    como tal, con `GRANT`/RLS exigidos.
  - **Sello de 11 a 15 casos.** Uno de los nuevos es **heredado de la comprobación
    que sustituye** —el caso que el guardián viejo cazaba y el nuevo no—, que es
    la única forma de probar que un reemplazo no pierde cobertura. **Ocho
    mutantes, los ocho cazados**, incluidos tres que atacan lo nuevo: volver a
    anclar en crudo, un normalizador que no quita comentarios, y quitar la
    detección de `SELECT … INTO`.
  - **Las tres limitaciones que quedan están escritas en la cabecera**, y son dos
    más de las que declaraba la primera versión. Las encontró midiendo el
    vigilante, no leyendo.

- **El guardián del contrato deriva qué vigila en vez de tenerlo tecleado** (PR
  [#35](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/35)). Su lista
  eran tres rutas escritas a mano, y **envejeció el mismo día que se escribió**:
  ese 6-ago-2026 el PR [#22](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/22)
  sacó las prioridades válidas a `server/constants/priorities.js` —hoy el único
  sitio donde vive el conjunto que decide el `400` y el texto del error, los dos
  declarados en el contrato— y el PR
  [#24](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/24) montó el
  guardián sobre la lista de antes. **Ninguno de los dos estaba mal por su
  cuenta: se encontraron mal.** Quitar `urgent` de ese fichero cambiaba la forma
  de la Puerta 2 y CI se quedaba en verde.
  - **Ahora se parte de las dos puertas y se sigue lo que importan**, y lo que
    importan ellas, hasta agotar. Si mañana alguien saca otro trozo de la forma
    de una puerta a un fichero nuevo, el guardián lo hereda solo.
  - **El cierre son cinco ficheros**, no tres. El quinto es
    `server/utils/supabase.js`, y no es sobre-inclusión: el contrato declara que
    la Puerta 2 usa `service_role` y salta RLS, y ahí es donde se elige la llave.
    Cambiar `SERVICE_ROLE_KEY` por `ANON_KEY` cambiaría el alcance prometido, en
    verde. Dos commits en toda su vida, así que no cuesta falsos rojos.
  - **Cierra además un hueco que la tarjeta no pedía:** una puerta que se moviera
    de sitio se caía de la lista **en silencio** y el guardián seguía dando verde
    con lo que quedara. Ahora se declara roto.
  - **Estrena verde, medido:** corrido contra los PR #13–#33, ninguno cambia de
    veredicto. El único que toca los dos ficheros nuevos es el #22, y ya salía
    rojo con la lista de antes.
  - **Lo que el cierre no ve, y está en su cabecera:** sigue imports estáticos y
    literales. Un `require(variable)`, un import dentro de una función o un
    `importlib` se le escapan. Barrido hoy: no hay ninguno en las puertas.

- **`update_card` dejaba caer el brief en silencio si venía con su nombre
  documentado** (PR [#32](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/32),
  contrato del riel a **v3.2.0**). `create_card` aceptaba el brief por sus dos
  nombres —`description_md` y `description`—; `update_card` **solo aceptaba el
  alias**, y lo que llegaba con el otro se descartaba sin avisar.
  - **Cómo se descubrió:** en carne propia, actualizando tarjetas de este mismo
    tablero. Solo saltó un error porque no iba ningún otro campo. **Con un `title`
    acompañando, el título se habría actualizado, el brief se habría perdido, y la
    respuesta habría dicho que fue bien.**
  - **Y al actualizar, «no mandarlo» y «mandarlo vacío» pasan a ser órdenes
    distintas** — la primera deja la descripción como está, la segunda la vacía.
    Se distinguen con un centinela, porque `None` no puede: confundirlas borraría
    el brief de cualquier tarjeta a la que solo se le cambiara el título.
  - **El contrato afirmaba lo de los dos nombres sin acotar**, cierto para crear y
    falso para actualizar. Ahora es cierto para las dos puertas.

- **El fallo de la copia de seguridad deja de ser silencioso** (PR
  [#31](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/31)). El aviso era
  un `::error::` en el log y un `TODO`: la copia —**la única red bajo esta nave**—
  fallaba exactamente de la forma contra la que se montó, la que nadie ve hasta
  que hace falta la copia. Ahora abre una **incidencia** en el repo, y **comenta
  en la abierta si ya existe** en vez de abrir una por día: una racha tiene que
  leerse como una racha, no como veinte avisos que se aprenden a ignorar.
  - **Por qué una incidencia y no un correo ni una tarjeta:** medido —los secretos
    de este repo son seis y **no incluyen `TASK_SECRET` ni `RESEND_API_KEY`**, así
    que no se puede clavar una tarjeta en el riel ni mandar correo. `GITHUB_TOKEN`
    siempre está. Lo nativo de la flota sería una tarjeta, y para eso hace falta
    un acto humano que queda dicho en la tarjeta, no simulado aquí.

### Added
- **El volcado se verifica ANTES de subirlo** (PR #31). `pg_dump` puede terminar
  en `0` y escribir casi nada, y a partir de ahí lo que hay en R2 es **un fichero
  con el nombre correcto y sin copia dentro** — que no se nota hasta el único día
  en que importa. Ahora se exige un suelo de tamaño (20 KB, un orden de magnitud
  por debajo de los 195 KB medidos) **y** que el volcado contenga las tablas
  esperadas: el tamaño dice que hay bytes, las tablas dicen que son los de esta
  base.
  - **No sustituye a una restauración de prueba**, que sigue sin hacerse nunca y
    tiene su propia deuda. Es la comprobación más barata que separa «hay un
    fichero» de «hay una copia».

### Fixed
- **El presupuesto de tiempo de las pruebas vive en un solo sitio** (PR
  [#30](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/30)).
  `package.json` decía `10000` y CI pasaba `--testTimeout=15000`, así que
  **`npm test` y CI juzgaban con reglas distintas** según dónde se corriera. Ahora
  el valor lo custodia `package.json` (15000) y CI no lo repite.
  - **Y corrige una medición del vigilante, no solo la configuración.** La tarjeta
    `711c6868` afirmaba que la prueba lenta de `digest.test.js` pasaba «con margen
    ~0» contra el timeout global. **Es falso:** esa prueba declara su propio
    presupuesto (`}, 20000`), que **anula el global**, así que nunca usó el de
    `package.json`. Comprobado corriendo la suite con `--testTimeout=1000`: sigue
    pasando, en ~10 s. El margen real es **~2×**. Se había medido contra la
    constante equivocada.
  - **Lo que sigue abierto:** esos ~10 s son más de la mitad de lo que tarda la
    suite entera, y son de reloj real. Recuperarlos pide temporizadores falsos
    mezclados con `supertest`, que abre un socket de verdad — otro riesgo, otra
    tarjeta.

### Added
- **Columna `cards.created_by_caller`, sola y sin nadie que la lea todavía**
  (`docs/schema/migration-card-caller.sql`). `TEXT` NULLable, más un índice
  parcial. Guardará qué nave clavó cada tarjeta por `POST
  /api/internal/create-card`, que hoy se autentica con **un** secreto compartido:
  con N naves, todo lo clavado dice lo mismo y no hay a quién preguntar cuando
  algo aparece mal puesto. **No es autenticación** — quien tiene el secreto
  declara el nombre que quiera.
  - **Por qué entra sola, antes que el código que la usa.** Nació junto a su
    código en un solo PR, y así montado tenía un orden obligatorio: mergear el
    código antes de aplicar la migración deja la puerta escribiendo en una
    columna que no existe, es decir producción rota. Ese orden estaba **escrito
    en un aviso dentro del PR**, y un aviso compite con las prisas de quien
    mergea. Partido en dos, la dependencia deja de existir: esta mitad es inerte
    —columna NULLable que nadie lee, índice parcial sobre nada— y se puede
    aplicar y mergear en cualquier orden sin romper nada. Una dependencia que ya
    no existe no compite con nada.
  - **`NULL` es el valor correcto para lo anterior, y se queda.** Rellenarlo con
    algo inventado convertiría «no lo sabemos» en «lo clavó fulano». El hueco se
    lee; una atribución falsa, no.
  - **Sin GRANT ni RLS nuevos, a propósito:** es una columna sobre una tabla que
    ya los tiene. El patrón obligatorio de `CLAUDE.md` aplica a tablas **nuevas**.
  - **Lo que un verde de `schema-guard` aquí NO significa:** que la columna exista
    en la base. Ese guardián compara la migración con el esquema **documentado**,
    no con el servidor. Aplicarla sigue siendo un paso humano — y esa asimetría
    tiene tarjeta propia en el Backlog.
- **Guardián del enganche de permisos en CI** (`scripts/hook-guard.sh` + su sello,
  PR [#29](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/29)). CI se
  pone rojo si `.claude/settings.json` deja de declarar un `PreToolUse` que
  invoque el script de permisos.
  - **Pagado en carne propia el mismo día:** el enganche se instaló, se verificó
    que denegaba subir a la rama principal, y **al cambiar de rama volvió a `{}`**
    — el cambio vivía en una rama y la principal aún no lo tenía. La protección
    existía en todas partes **menos justo donde había ocurrido el incidente que
    la motivó**, y no dio aviso: un fichero de configuración que se queda vacío
    no se queja.
  - **Lo que un verde aquí significa, y está escrito en su cabecera:** «el fichero
    declara el enganche», **no** «el enganche está vivo». No comprueba que el
    script exista —vive en el repo del capitán y CI solo tiene este— ni que el
    enganche esté **cargado** en la sesión, que solo se ve intentando una
    operación denegada. Menos de lo que suena, y más de lo que había.
  - **Lo que queda abierto es una decisión, no código:** dejar el script
    compartido en un solo sitio (y aceptar que si allí lo mueven, el enganche
    muere en silencio) o vendorizarlo aquí (y crear la novena copia de una
    política de flota). Sigue en la tarjeta `56c215cf`.

### Fixed
- **El paso que verifica la rotación de `TASK_SECRET` pasa a verificar de verdad**
  (`docs/runbooks/key-rotation.md`, PR
  [#27](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/27)). Era un
  `POST` a `create-card` que **fallaba por tres motivos a la vez**, acumulados por
  dos arreglos sucesivos del mismo comando: un espacio inexistente, un `boardName`
  que en realidad es una **columna**, y el responsable ausente desde v3.0.0.
  Un paso de verificación que siempre falla **enseña a ignorar el fallo**, y era
  justo el que comprueba que la llave nueva sirve.
  - **El arreglo no es corregir el destino: es quitarlo.** Pasa a ser un `GET` a
    `list-workspaces`. Los tres endpoints de `/api/internal/*` comparten el mismo
    `verifySecret`, así que **una lectura prueba el header igual que una escritura
    y no deja nada detrás**. La forma más segura de que un ejemplo no caduque es
    que no tenga destino que acertar.
  - **Y había un motivo nuevo que no existía cuando se escribió el paso:** con el
    responsable ya obligatorio, una tarjeta de prueba a nombre de la cuenta de
    servicio **la coge un obrero automático y se pone a trabajarla**. Verificar una
    rotación no puede inyectar trabajo falso en la cola.

### Added
- **Guardián de privilegios del rol anónimo en CI** (`scripts/grants-guard.sh` + su
  sello, PR [#25](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/25),
  obrero automático). Se pone rojo si alguna tabla de `public` concede a `anon`
  algo distinto de `SELECT`, que es lo que el esquema declara para todas.
  - **Cierra un defecto que se repetía en cada tabla nueva.** Las
    `DEFAULT PRIVILEGES` del proyecto conceden a `anon` los **siete** privilegios
    sobre toda tabla creada en `public`; las hermanas tienen uno. Y el patrón
    obligatorio de `CLAUDE.md` **concedía sin revocar**, así que una tabla creada
    siguiendo la instrucción al pie de la letra nacía más abierta de lo que el
    propio esquema declara — y quien leyera el esquema vería lo concedido a mano,
    no lo que la tabla tenía de verdad.
  - **El patrón de `CLAUDE.md`, corregido:** `REVOKE ALL … FROM anon` va **primero**.
    Cuando el `GRANT` se ejecuta, lo que sobra ya está puesto; un `GRANT` no quita.
  - **Su primera pasada ES el barrido** que la tarjeta pedía: no hace falta una
    consulta suelta. Medido por CI contra la base real — **ninguna tabla se sale
    de lo declarado**, así que el guardián **estrena verde**.

### Changed
- **El sello del guardián de privilegios comprueba también la consulta**, no solo
  el manejo de filas (añadido por el vigilante al revisar el #25). El obrero dejó
  escrito —y es exacto, verificado— que **con filas inyectadas el SQL no se
  ejecuta**, así que el sello medía qué hace el guardián *con* las filas y nunca
  *cuáles* le llegan: quitarle el `HAVING` pasaba **9 de 9 en verde**.
  Y había una segunda del mismo origen que no estaba dicha: **cambiar el rol
  vigilado de `anon` a `authenticated` también pasaba 9 de 9.** Tres
  comprobaciones nuevas cierran las dos; las tres mutaciones ahora muerden.
### Changed
- **El detector de alcance del riel mira ahora las DOS direcciones, y corre por
  reloj** (`scripts/rail-blindspot.sh` + `.github/workflows/rail-scope.yml`).
  Implementa el diseño que llevaba escrito en `docs/BACKLOG.md` desde el 2026-07-27.
  - **La dirección que faltaba es la que protege lo ajeno.** Antes solo vigilaba
    que no *faltara* alcance —un espacio al que el riel no llega—; ahora también
    que no *sobre*: el riel metido en un espacio fuera de su alcance puede escribir
    donde no le toca, y eso no da error — da una tarjeta en casa de otro. Es la
    mitad que importa el día que haya un cliente.
  - **El alcance se deriva de la PROPIEDAD, no del tipo.** El criterio anterior
    —«todo lo que no sea `personal`»— hacía que el alcance del riel dependiera de
    cómo tipe Món sus propios espacios. Ahora es: los espacios cuyo `owner` es
    Ibai, excluidos los que **él** tipe como `personal`. Y manda
    `workspace_members.role = 'owner'`, no `workspaces.created_by`: el segundo es
    un hecho del pasado y no se mueve, así que el día que un espacio cambiara de
    dueño el detector exigiría meter el riel en casa ajena.
  - **Los dos errores dicen remedios opuestos** —meter al riel dentro, o sacarlo—
    así que el mensaje distingue cuál es cuál. Uno que no lo hiciera mandaría a
    quien lo lea a hacer justo lo contrario.
  - **Sale de `ci.yml` a su propio workflow con `schedule`.** `ci.yml` solo se
    dispara con empujes y PR: un espacio creado un martes, sin que nadie tocara el
    repo, quedaba invisible para toda la flota hasta el siguiente commit. El
    guardián existía para que un olvido no pasara desapercibido, y estaba atado a
    que hubiera trabajo.
  - **Lo que NO está verificado, y lo decide el revisor:** la consulta nueva **no
    se ha corrido contra la base real** — en esta sesión no hay credenciales, así
    que todo el sello va por inyección de filas. El criterio nuevo puede sacar
    desviaciones que el criterio por tipo tapaba con entradas en
    `rail-blindspot.allowed`. **Antes de mergear hay que correrlo contra
    producción**: si sale rojo es un hallazgo, no un fallo del guardián — pero un
    guardián no puede estrenar en rojo.

### Fixed
- **El mensaje de prioridad inválida omitía `urgent`, que sí es válida**
  (`server/routes/cards.js`). El conjunto aceptaba `urgent` y el `400` respondía
  «priority must be low, medium, high, or none» — dos listas separadas por seis
  líneas, y la escrita a mano ya había divergido.
  **Por qué no era cosmético:** el mensaje de error es la única documentación que
  lee quien acaba de fallar. Quien lo recibía concluía que `urgent` no existe y
  bajaba su tarjeta a `high` — la misma degradación silenciosa que el contrato
  v2.0.0 se puso a evitar, cometida por el llamante en vez de por el servidor y
  por eso invisible desde este lado.

### Changed
- **Las prioridades válidas viven en un solo sitio** (`server/constants/priorities.js`).
  Había **tres** copias en JavaScript, no dos: el `Set` de `cards.js`, el `Set` de
  `internalRoute.js` y el texto del error. Ahora el mensaje **se deriva** del
  conjunto — no se escribe al lado— y las dos puertas leen la misma lista.
  Prueba nueva con dos aserciones que no son la misma: que el mensaje nombra
  **todas** las válidas (escrita como bucle sobre la lista viva, no contra un
  literal, que sería otra copia), y que **las dos puertas aceptan el mismo
  conjunto**, para que separarlas otra vez se ponga rojo antes de que un llamante
  descubra que una acepta lo que la otra rechaza.
  **Lo que NO cierra:** `kanban-mcp/validation.py` mantiene su copia — es otro
  lenguaje y otro proceso. Que las dos digan lo mismo no lo garantiza nadie.

### Added
- **Guardián contrato ↔ código en CI** (`scripts/contract-guard.sh` + su sello, PR
  [#24](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/24), obrero
  automático). Se pone **rojo** si un cambio toca la forma de una puerta
  —`server/routes/internalRoute.js`, `kanban-mcp/server.py`,
  `kanban-mcp/validation.py`— y **no** toca `docs/contracts/CONTRACT.md`.
  - **Cierra el agujero que costó tres PR seguidos.** #13, #14 y #15 cambiaron
    códigos de error y forma de respuesta sin tocar el contrato, los tres pasaron
    CI en verde, y lo cazó una persona leyendo diffs. Medido contra los ficheros
    reales de esos PR: **los tres en rojo**; #16 a #21, verdes.
  - **Estrenó verde**, que era la condición: un guardián que nace rojo se
    normaliza hasta que deja de mirarse.
  - **Exige tocar el fichero, no subir la versión.** Un refactor interno no mueve
    SemVer, y exigirlo enseñaría a inflar versiones para pasar el guardián. Para
    ese caso el error pide una línea en el historial — que **es** el aviso al
    capitán que el contrato ya pedía.
  - **El sello corre ANTES que el guardián** en el mismo job: si el guardián está
    destripado se sabe ahí, y da igual lo que conteste después.
  - **Lo que NO puede hacer, declarado en su cabecera y en el contrato:** comprueba
    que alguien **tocó** el documento, no que fuera honesto al tocarlo. Un espacio
    en blanco lo satisface. Que el texto describa el código sigue siendo trabajo
    del vigilante; lo que cierra es el caso en que **nadie miró**.

### Added
- **El envoltorio del riel entra en CI** (`kanban-mcp/test_server.py`, 17 casos).
  `validation.py` —la lógica pura— estaba sellada; las **666 líneas** que la rodean
  se verificaban a mano contra la base. *Lo que no corre en CI es decoración*, y era
  justo la capa donde han vivido los fallos que este repo ha pagado.
  - **Sin `pip install`, que era la razón por la que no existía.** `server.py`
    importa `httpx` y `mcp`, y ese trabajo corre con un `python3` pelado a
    propósito. La salida no fue aflojar esa regla: el banco **sustituye los dos
    módulos por dobles antes de importar**, y `mcp.tool()` pasa a devolver la
    función tal cual, así que las tools quedan invocables como funciones normales.
  - **Lo que se fija no es el valor devuelto, es si salió algo a la red.** Un dict
    de error se parece mucho a otro; la diferencia entre «no se creó nada» y «se
    creó a medias y me lo callé» solo se ve mirando las escrituras. La prueba
    principal es la que esa tarjeta existía para poder escribir: **un `assignee`
    que no resuelve no deja la tarjeta escrita**.
  - Cubre además las **compuertas destructivas** —`delete_card`, `delete_board`,
    `delete_workspace`, `clear_workspace` sin `confirm` no emiten una sola
    escritura—, el enrutado de `list_cards` y el rechazo de prioridades inválidas.
  - **Lo que NO cubre, dicho en voz alta:** solo comportamiento correcto. Los
    defectos conocidos —la ventana entre crear y asignar, el `description_md` que
    `update_card` descarta— tienen tarjeta propia y **no se fijan aquí**: un test
    que afirma en verde un defecto es una afirmación falsa con palomita, y esta
    casa ya pagó una hoy.

### Added
- **Las columnas se pueden renombrar y borrar desde el riel, y los números dejan de
  chocar** (PR [#19](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/19),
  obrero automático, 2026-08-06). Contrato del riel a **v3.1.0**, aditivo.
  - Tools `update_column` (renombra y reposiciona) y `delete_column` (**con
    compuerta `confirm=true`**). El servidor ya tenía `updateColumn`/`deleteColumn`:
    lo que faltaban eran las tools.
  - **La numeración se normaliza a 1..N tras cualquier cambio.** No se parchea la
    fila tocada; se renumera el tablero entero — más escritura y ningún estado
    intermedio que pueda quedarse. Antes se insertaba con el número pedido encima de
    quien lo tuviera, y dos columnas acababan compartiendo posición, con el orden
    visual decidido por el desempate de la interfaz.
  - Migración que limpia el único par repetido que había en la base.

### Fixed
- **Borrar una columna con tarjetas dentro se las llevaba por delante y devolvía
  éxito** (PR #19). `cards.column_id` es `ON DELETE CASCADE`. Ahora devuelve **`409`
  y no borra nada**, diciendo cuántas tarjetas hay.
  **No estaba en la tarjeta: apareció al medir.** Llevaba ahí sin molestar porque
  solo se podía borrar desde la interfaz, donde quien borra ve lo que hay dentro —
  pero la tarjeta pedía dársela al riel, que no ve nada, así que el agujero lo abría
  el propio cambio. La guarda entró en el mismo commit que la herramienta, no
  después.

### Changed
- **`order` sale del parche de `updateColumn`** (PR #19). Escribirlo ahí era el
  defecto: ponía el número pedido sin mirar quién lo ocupaba. Reposicionar es ahora
  un solo camino — renumerar el tablero entero.

### Added
- **Historial de la descripción de una tarjeta: sobrescribir deja rastro y se puede
  deshacer** (PR [#18](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/18),
  obrero automático, 2026-08-06). Contrato del riel a **v2.1.0**, aditivo.
  - Tabla `card_description_history`: guarda la versión **anterior** cada vez que la
    descripción cambia. `GET /api/cards/:id/history` la lee, la más reciente primero,
    y la tool `card_history` la expone por el riel.
  - **Deshacer no tiene endpoint propio a propósito:** se lee la versión que toca y se
    vuelve a mandar por `PUT /api/cards/:id`, de modo que la restauración deja su
    propia entrada como cualquier otra edición.
  - **Qué cierra:** la puerta de actualizar recibe la descripción completa y la
    reemplaza, así que un llamante que no lea antes de escribir destruía lo que había
    **devolviendo éxito**. Pagado el 6-ago-2026: un obrero sustituyó la descripción de
    una tarjeta por el texto de otra, y se recuperó **por casualidad** porque alguien
    tenía el original en su contexto.
  - **Lo que NO cubre, dicho en voz alta:** una escritura directa a la base salta este
    historial. Se eligió la capa que se puede sellar en CI (todas las escrituras de
    descripción pasan por `PUT /api/cards/:id`, medido) en vez de un trigger, que no se
    puede probar sin escribir filas de mentira en el tablero vivo.

### Changed
- **`update_card` tiene un modo de fallo nuevo, y es deliberado** (PR #18). Si la
  versión anterior no se puede guardar, **el update se aborta con `500` y la tarjeta
  queda intacta**. Un historial que falla en silencio da la sensación de que se puede
  deshacer justo en la escritura que había que poder deshacer. **El precio, dicho:** si
  la tabla de historial no está disponible, no se puede editar ninguna descripción.

### Changed — INCOMPATIBLE
- **Contrato del riel a v3.0.0: responsable y prioridad pasan a ser obligatorios en
  las dos puertas** ([`docs/contracts/CONTRACT.md`](contracts/CONTRACT.md), obrero
  automático, 2026-08-06).
  - `priority` **deja de tener default**. Antes ausente → `medium` en silencio; ahora
    error por las dos puertas. La prioridad *inválida* ya se rechazaba desde v2.0.0:
    esto cierra la mitad callada del mismo defecto — quien creía no haber decidido
    había decidido, y su tarjeta se ordenaba con un valor que nadie eligió.
  - **El responsable pasa a ser obligatorio.** El riel lo tenía como opcional; la
    puerta HTTP **no tenía el campo siquiera**, así que para ella es campo nuevo *y*
    obligatorio a la vez, con el responsable resuelto por email, nombre exacto o id,
    escrito en la tarjeta y devuelto resuelto en el acuse.
  - **Por qué:** el sistema de trabajo reparte por responsable y ordena por prioridad.
    A una tarjeta a la que le falte cualquiera de los dos no la coge nadie, y **no
    falla**: envejece pareciendo trabajo pendiente. Pasó de verdad el 6-ago-2026 —
    tres tarjetas bien escritas nacieron sin responsable y las asignó el capitán a
    mano al detectarlo. Es la peor variante del `201` que miente: aterrizar mal se
    nota tarde, nacer invisible no se nota nunca.
  - ⚠️ **Rompe a todos los llamantes actuales, el capitán incluido.** **Sin ventana de
    deprecación, por decisión tomada** (Ibai, delegada en el capitán): el radio medido
    son **tres llamantes, los tres DOCUMENTACIÓN y ninguno un servicio** — el `curl` de
    `CLAUDE.md`, el paso de verificación de `docs/runbooks/key-rotation.md` (el más
    dañino: una rotación correcta habría parecido fallida) y la firma en
    `kanban-mcp/README.md`, que anunciaba `assignee?` como opcional. No se cae nada, así
    que la ventana solo compraría tiempo para nadie. Los tres se arreglan **en el mismo
    cambio** que los invalida.

### Added
- **Puerta de lectura del riel HTTP** (PR [#13](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/13),
  obrero automático, 2026-08-06): `GET /api/internal/list-workspaces` y
  `GET /api/internal/list-boards?workspaceId=…`, con el mismo `x-task-secret` que la puerta
  de escritura. Cierran un hueco real: el contrato **exige** listar destinos antes de clavar
  y no había forma de listarlos desde fuera de esta máquina — el riel lista por membresía y
  solo aquí, la puerta HTTP alcanzaba todo pero solo escribía. Una nave externa tenía llave
  y ningún mapa. **Corregido al aceptarlo:** excluyen `type = 'personal'` por regla. El PR
  los listaba, alegando «la misma amplitud que la puerta de escritura» — cierto para
  escribir, falso como equivalencia: `TASK_SECRET` vive fuera de esta máquina y enumerar
  entregaba el UUID del espacio personal de Ibai, que es justo lo que hace falta para
  apuntar ahí. Antes había que adivinar el nombre; un UUID no se adivina.

### Changed
- **Contrato del riel a v2.0.0** ([`docs/contracts/CONTRACT.md`](contracts/CONTRACT.md)).
  Dos cambios incompatibles y uno aditivo, todos ya en el código:
  - `priority` inválida ya **no se corrige en silencio a `medium`**: devuelve 400 con las
    válidas (PR [#15](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/15)).
  - `workspaceName` ambiguo ya **no aterriza en el primero devolviendo `201`**: devuelve 400
    con `candidates` (PR [#14](https://github.com/ibaifernandez/aglaya-kanban-desk/pull/14)).
    Medido contra la base real: **7 de 13 espacios casan con `%AGLAYA%`**, sobre un `ilike`
    sin `ORDER BY`. Era una moneda al aire, no un riesgo teórico.
  - El acuse devuelve los **tres destinos resueltos** (`workspace_id`/`board_id`/`column_id`
    + nombres canónicos). Antes `workspace` devolvía la entrada sin resolver: el único campo
    por el que se puede aterrizar mal era el único que no se podía comprobar.

### Fixed
- **Ratas en las pruebas de los tres PR del obrero**, retiradas al aceptarlos. Los tres
  llegaron en verde y con recuentos de pruebas en la descripción; el verde y los recuentos
  eran ciertos, y aun así seis mutaciones sobre código que las pruebas decían vigilar
  **seguían pasando**:
  - `internal-create-card-defects.test.js` afirmaba en verde **idempotencia que el código no
    tiene** — pasaba solo porque el mock devolvía el literal `'card-123'` en toda inserción;
    basta con que devuelva un id distinto por inserción, como hace una DB real, para que se
    ponga roja. El propio PR decía en su descripción que dejaba la idempotencia sin tocar:
    la suite contradecía al PR, y quien leyera la suite habría concluido que estaba resuelto.
    Junto a ella, un `expect(true).toBe(true)` para el defecto de orden. Ambas retiradas: una
    deuda se lleva en su tarjeta, donde se puede priorizar; un test que no puede fallar no es
    un recordatorio, es una afirmación falsa con palomita.
  - Borrar entero el payload `candidates` —la mitad útil del 400 nuevo— pasaba en verde.
  - En `internal-read.test.js`, el mock ignoraba `.select()` y `.eq()`: quitar `emoji` de la
    proyección **o quitar el filtro `workspace_id`** —fuga de tableros entre espacios— no
    rompía nada.
  - En `internal-create-card-contract.test.js`, la única prueba del acuse iba envuelta en
    `if (res.status === 201)` y asertaba un campo de cuatro: borrar `board_id` y `column_id`,
    o revertir la resolución del nombre de espacio —el defecto exacto que el PR decía
    cerrar— pasaba en verde.

  Mocks fieles (proyección y filtros reales) y las aserciones que faltaban. Las seis
  mutaciones ahora muerden, verificadas una a una.
- **El punto ciego del riel, implementado** (`scripts/rail-blindspot.sh` + su sello +
  `scripts/rail-blindspot.allowed`, en CI). Estaba diseñado en `docs/BACKLOG.md` desde el
  2026-07-27 por la mañana. Un espacio sin `kanban-rail@aglaya.biz` dentro queda invisible
  para toda la flota **sin dar error**, y el riel no puede contestar esa pregunta sobre sí
  mismo: sus puntos ciegos no salen en su propia lista, por definición. Lo contesta la DB
  con el secret `DATABASE_URL`, que ya existía para el backup. **Quién custodia qué:** la
  DB dice qué espacios existen; el fichero `.allowed` dice cuáles están ciegos a sabiendas,
  por UUID —renombrar no reabre una decisión— y con el porqué; los `personal` se excluyen
  por **regla en el SQL**, no por lista, para que cubra también los que se creen mañana.
  Estrenó verde, medido antes de escribirlo. **No se salta en verde si le faltan
  credenciales**: un guardián que se omite cuando no puede mirar es el falso negativo
  silencioso que este repo persigue, y ya pasó una vez con `PORTS`.
- **`docs-guard` · regla ATLAS** (cruzada): una ruta dentro del repo del capitán se pone
  roja. Era el agujero que quedaba tras ELIDED, y se descubrió **probándolo**: se escribió
  una ruta entera del atlas en un documento y el guardián dio verde por los dos lados —
  ELIDED solo mira la elisión interior, y LINKS ignora a propósito lo que no es de este
  repo, que es justo por donde se cuela. La forma es la **barra**: el nombre del repo a
  secas es legítimo y hay que poder decirlo; en cuanto lleva una barra detrás y un segmento
  más, es un puntero que caduca en silencio cuando él reorganiza. *(Esta entrada no puede
  escribir el ejemplo sin que la muerda su propia regla, igual que le pasa a la de ELIDED
  justo debajo. Es correcto: la excepción «lo decía de ejemplo» mata guardianes.)*
  Ámbito ancho como ELIDED, más las
  fuentes del riel, porque un docstring es lo que el modelo lee antes de llamar a la tool.
- **`docs/contracts/CONTRACT.md`** — el contrato de inyección de comandas, declarado por su
  dueño. El registro del capitán lo listaba como propiedad de esta nave y no tenía dónde
  vivir salvo su descripción del endpoint. Mismo patrón que las otras naves dueñas, y con
  versión propia, que es lo que `firmas()` sabe leer. Un contrato **sí** es custodio de su
  versión: por eso no entra bajo V1.
- **Parte al capitán** — qué debía actualizar el orquestador en su extremo, con una tabla
  de cómo comprobar cada afirmación sin creerse ninguna. **Entregado, aplicado y borrado el
  mismo día:** era un documento de un solo uso, y conservarlo lo habría convertido en una
  descripción del atlas viviendo aquí — la misma copia que venía a quitar, en espejo.
  Queda el rastro en este registro, que es su sitio.
  *(Lo que la tabla de comprobación sirvió para pillar: el capitán apuntó su registro y su
  ficha a una puerta nueva sin cablearla, así que resolvía al registro entero y parecía
  funcionar. Un puntero roto se lee mejor que una copia mala y engaña más.)*
- **`docs/PUERTA-EXTERNA.md`** — inventario de qué probar para poder afirmar que la puerta
  de cliente externo sigue abriendo. Comprobado que **abre hoy**: el filtro de dominio vive
  solo en el registro self-service, no en la invitación de admin ni en el login.

### Changed
- **El brief del riel, extraído y sellado.** El alias `description` ↔ `description_md` se
  añadió tras las cuatro cards que salieron vacías devolviendo `201`, pero vivía dentro de
  `create_card`, que necesita red: **nadie lo probaba**. Ahora es función pura en
  `validation.py`. De paso, una precedencia que reproducía el mismo fallo por otra puerta —
  era por `is not None`, así que un `description=""` explícito tapaba un `description_md`
  con texto. Y como no hay lista de nombres que prevenga el tercero que alguien invente,
  `create_card` avisa por **resultado** (la card salió sin contenido), no por nombre.
- **`docs-guard` amplía ámbito** a `docs/SECURITY.md`, `PERMISSIONS.md`, `RUNBOOK.md`,
  `PRD.md` y `PUERTA-EXTERNA.md`, **solo bajo V1**, con su costura de prueba para que «aquí
  V2 no se aplica» no lo sostenga únicamente un comentario. La versión no la custodia
  ningún documento; sus otras cifras sí son suyas —una política de retención, un registro
  fechado de auditoría, la especificación del plan Free— y V2 no sabe distinguirlas de un
  fósil. Fuera con motivo escrito: `ARCHITECTURE.md` (un ADR que dice «downgrade a
  jest@29.7.0» tiene la versión como contenido, no como copia) y `operator-checklist.md`
  (evidencia RGPD fechada, y una checklist cuyas casillas mordería V3).
- **`CLAUDE.md` deja de copiar el contrato** del endpoint interno. Tenía la tabla del
  payload al lado del custodio recién creado.

### Fixed
- **Cifras fósiles en `docs/SECURITY.md`**, sustituidas por el nombre de su custodio:
  decía «9/9 tablas con RLS» en una línea y «10/10» catorce líneas más abajo — el documento
  contradiciéndose a sí mismo en la misma página—; decía cuatro vulnerabilidades residuales
  donde el runner dice cinco; y contaba a mano los casos de un fichero de tests. La versión
  la tenía tecleada **dentro de la frase que nombraba `package.json` como fuente única**:
  la causa raíz de este guardián, textual, en un fichero fuera de su alcance.
- **Versión tecleada** también en `ARCHITECTURE.md`, `PERMISSIONS.md`, `RUNBOOK.md` y
  `PRD.md` (que además duplicaba la fase, custodiada por `ROADMAP.md`). Las cinco acertaban
  hoy, que es la forma más difícil de detectar.
- **`docs/BACKLOG.md` decía «🔴 Bug vivo»** de un bug cerrado seis días antes, con el
  checkbox de debajo dándolo por cerrado. Ser custodio de la cola no da autoridad sobre si
  un bug respira: eso lo custodia el código.
- **Los cuatro tests apagados desde el audit de mayo, encendidos.** Solo uno esperaba de
  verdad una decisión de producto —si el login debe filtrar por dominio; decisión de Ibai:
  **no**, el candado está en el registro, y filtrar aquí habría dejado fuera a Món y tapiado
  la puerta de cliente externo—. Los otros tres eran mocks viejos: apagar un test por un
  mock viejo deja sin vigilancia el comportamiento, no el mock. Uno se reescribió porque su
  premisa había dejado de ser verdad: esperaba que la ruta reconstruyera un perfil huérfano
  y hoy devuelve 409, que es mejor — adoptar en silencio una cuenta de auth que nadie sabe
  de dónde salió es justo lo que no puede pasar sin un humano delante.
- **`docs-guard` · regla ELIDED** (cruzada): caza la ruta que sustituye su parte de **en
  medio** por puntos suspensivos, dejando un segmento a cada lado. Era el agujero de LINKS
  y se colaba por sus dos escapes a la vez — parece un placeholder rellenable y su primer
  segmento es de otro repo — con la diferencia de que nunca apunta a nada. Distingue elidir
  de **truncar**: los puntos al **final** son mostrar, no apuntar, y no muerden
  (`/Users/AGLAYA/Local Sites/…`, `app.use('/api/...')`). Nótese que esta misma entrada no
  puede escribir un ejemplo de la forma prohibida sin que el guardián la muerda, y **eso es
  correcto**: la regla no distingue usar de citar, igual que V1 muerde la versión escrita
  dentro de la frase que nombra `package.json` como fuente. Una excepción para «lo decía de
  ejemplo» es por donde se mueren los guardianes. Ámbito **ancho** al revés que V1/V2/V3,
  y a propósito: aquéllas
  son estrechas porque CHANGELOG, ROADMAP, BACKLOG y audits **son** custodios de estado y
  tienen derecho a sus cifras; ninguno tiene derecho a un puntero que no se puede seguir.
  La lista sale de `git ls-files` (incluidos los `.md` nuevos sin commitear), así que se
  mantiene sola. Medido antes de adoptarla: la forma interior aparecía una sola vez en todo
  el repo, y era la que la motivó.
- **`docs-guard` vigila también las fuentes del riel** (`kanban-mcp/server.py`,
  `kanban-mcp/validation.py`). La descripción de `list_workspaces` afirmaba cuántas filas
  veía el riel de cuántas había: un estado escrito **dentro de una puerta**, que es donde
  peor envejece, porque es lo que el modelo lee justo antes de llamar a la tool. V2 sí
  mordía esa línea; nunca se la habíamos puesto delante, y no por sutileza: por no ser un
  markdown. Ojo con lo que esto es — un regex por línea sobre todo el fichero, no un parser
  de docstrings. Los tres ficheros del riel dan verde hoy.
- **Diseño del detector de puntos ciegos del riel** — `docs/BACKLOG.md`, sección «El punto
  ciego del riel». La membresía del riel se mantiene a mano y falla en silencio: un espacio
  sin el riel dentro no da error, sencillamente no existe para la flota. El cruce va en
  ambas direcciones —punto ciego **y** fuga— y lo contesta `service_role`, **nunca el riel**,
  que por definición no ve sus propios puntos ciegos.
  **Criterio de alcance, resuelto por Ibai:** manda la **propiedad**, no el tipo. El riel
  debe estar en los espacios cuyo owner es Ibai, salvo los que él tipe como `personal`; todo
  lo demás queda fuera por definición, sin mirarlo. Descartado el criterio por tipo, que era
  la primera propuesta: habría hecho depender el alcance del riel de cómo tipe Món sus
  propios espacios, es decir, habría convertido el detector en una petición permanente a otra
  persona. De las dos columnas de propiedad manda `workspace_members.role = 'owner'` y no
  `created_by`: hoy coinciden, pero coincidir no es corroborar — `created_by` no se mueve
  cuando la propiedad sí, y entonces exigiría meter el riel en un espacio ajeno.
  Comprobado con `service_role` antes de escribirlo: **cero desviaciones, nace verde**. El
  criterio por tipo habría nacido rojo, y no porque la realidad estuviera sucia: porque
  pedía meter el riel donde no debe entrar. El rojo era el síntoma; la causa era la medida.
  Implementación (endpoint, workflow, test) pendiente en el backlog.
- **`docs/INVENTARIO-MULTI-TENANT.md`** — inventario de la maquinaria multi-tenant que
  quedó sin usuarios (tipos de espacio, rol `cliente`, `organizationId`, invitaciones), con
  coste de conservar frente a retirar. **No se retira nada**; la decisión es de Ibai. El
  resultado principal es que las piezas no son la misma clase de cosa: `type` y la
  membresía nacieron multi-tenant pero hoy **son** el sistema nervioso del riel; el rol
  `cliente` es el único de verdad sin usar, y el único con un argumento de seguridad a
  favor de retirarlo (su aislamiento vive solo en la capa Express — ninguna política RLS
  lo codifica).
- **Riel · `update_board`** — renombra un tablero conservando columnas y tarjetas. Antes,
  la única vía por el riel era `delete_board` + recrear, que arrastra todas las cards
  dentro: eso no es renombrar, es pérdida de datos con otro nombre. Mover un tablero
  **entre** workspaces queda deliberadamente fuera: cambia quién ve el trabajo.
- **Riel · `update_workspace`** — renombra un workspace (`name`, `emoji`, `description`).
  **`type` queda deliberadamente fuera:** pasar un espacio de `interno` a `externo` lo hace
  visible a las cuentas `cliente`. Eso es una decisión de visibilidad, no un renombrado, y
  en la práctica no se deshace una vez alguien lo ha visto. La UI lo confirma con un aviso;
  una llamada del riel no lo haría.
- **Guardián `docs-guard`** (CI): impide que vuelva a entrar estado copiado en `README.md`
  y `CLAUDE.md` — versiones literales (V1), conteos (V2) y fase/backlog duplicados de
  `ROADMAP.md`/`BACKLOG.md` (V3). Ámbito estrecho a propósito; excluidos por diseño
  `CHANGELOG.md`, `docs/legal/` (bajo Art. 30 el RAT **debe** fechar tratamientos),
  `ROADMAP.md`, `BACKLOG.md` y `docs/audits/`.
- **Sello del guardián** (`scripts/docs-guard.test.sh`): sabotea un fichero con cada forma
  vigilada y exige rojo, más casos de no-falso-positivo. Un guardián que corre y da verde
  estando destripado es peor que no tenerlo, porque además tranquiliza.
- **Mutación del sello** (`scripts/docs-guard.mutation.sh`): amputa cada regla del guardián
  y exige que el sello lo note. Sin esto, el sello podría ser decoración.
- **`docs-guard` · regla PORTS** (cruzada, no regex): el canon sale del **código**
  (`vite.config.js`, `server/index.js`), `launch.json` debe repetirlo, y **cada puerto
  citado** en `CLAUDE.md` y `README.md` —tabla, prosa, `localhost:`, `PORT=`— debe estar
  en él. Ancla por contexto, no por forma: `ISO 8601` y el `5432` de Postgres viven en
  estos docs y no son puertos. Sustituye a la confesión escrita que había en `CLAUDE.md`
  («no modificar launch.json sin actualizar este archivo») — una copia documentando su
  propio procedimiento manual sigue siendo una copia.
- **`docs-guard` · regla LINKS** (cruzada): toda ruta de fichero citada en los docs
  vigilados debe resolver en disco — enlaces markdown, backticks y **bloques de código**.
  Es la parte tratable de la clase «el documento nombra algo que puede no existir»: un
  fichero se comprueba, un nombre de workspace no. Ignora, autodetectándolo: externos,
  plantillas con `<>`, rutas gitignoreadas y rutas de otros repos.
- **`.env.example`**, que **no existía** pese a que el README mandaba copiarlo. Derivado
  del código (`process.env.*`), no del bloque del README: ese llevaba 15 variables y el
  servidor lee 24 — faltaban `JWT_REFRESH_SECRET` y el `TASK_SECRET` del riel de comandas.
- **`validateCoreConfig()`** en `server/utils/smtpConfig.js`, llamado **antes** de
  `require('./app')`.

### Fixed
- **`create_card` · `workspace_id` era decorativo.** Estaba declarado en la firma y **no
  se usaba para nada**: quien lo pasara creyendo que dirigía la card a un espacio no
  dirigía nada, y recibía `201`. Tercer parámetro tragado en silencio de la semana, tras
  `description` y el default de `workspaceName`. Ahora es **obligatorio y validado** contra
  la columna: si la columna no pertenece a ese espacio, no se escribe nada y el error
  muestra los dos IDs. Fijado por `kanban-mcp/test_validation.py`, que corre en CI con un
  `python3` pelado (`validation.py` no importa terceros a propósito).
- **`list_cards` no devolvía `description`.** El API la entrega; el MCP la descartaba al
  construir la lista. Quien escribe por el riel no podía leer lo que escribió — verificar
  que un brief había entrado obligaba a crear una tarjeta de prueba y pedirle a un humano
  que la abriera.
- **Las portadas de workspace (y los avatares) no se podían cambiar tras la primera vez.**
  Reportado por Ibai. La ruta en Storage es determinista (`workspace-covers/<id><ext>`,
  `avatars/<id><ext>`) y la subida usa `upsert: true`: el fichero **sí** se sobrescribía,
  la DB **sí** se actualizaba y la respuesta era `200` — pero `getPublicUrl()` devolvía
  siempre la **misma URL**, así que el navegador y el CDN seguían sirviendo la imagen
  cacheada. Nada fallaba; por eso nadie lo detectó. Confirmado con una predicción falsable:
  subir la misma imagen con otra extensión sí funcionaba, porque cambia la ruta.
  Arreglado con `server/utils/mediaUrl.js` (`withCacheBuster`), que versiona la URL en cada
  subida. La ruta sigue siendo determinista a propósito — no acumula ficheros huérfanos.
  Fijado por `server/tests/media-cache-busting.test.js`.
- **`docs-guard` · V2 ampliada.** Nació mirando `tests|suites|pruebas` — una lista escrita
  a mano, que es el vicio que este guardián persigue. Dejaba pasar cualquier otro conteo.
  Ahora la forma es «cifra + sustantivo en plural»; los números en palabra («tres tipos de
  workspace») no muerden, porque describen diseño. En su primera pasada cazó dos derivas
  vivas en `README.md` que la versión estrecha no veía:
  - «7 índices de rendimiento» — hay **13** (`pg_indexes`).
  - «JWT con expiración de 7 días» — fósil pre-B-02: hoy es access de 15 min + refresh de
    30 días (`ACCESS_TTL` / `REFRESH_TTL` en `server/routes/auth.js`). Es el modelo de
    seguridad, no un conteo cosmético.
- **`README.md`**: retirados esos dos datos y el valor único de rate limiting (hay varios
  limitadores; nombrar uno daba a entender que era el que hay). Todos apuntan a su custodio.
- **`CLAUDE.md`**: retirada la ruta absoluta en disco y el host de Supabase tecleado — el
  host ahora se **deriva** de `SUPABASE_URL` en el propio snippet de `psql` (verificado:
  conecta). Retirados también los puertos de los repos hermanos (estado de otro repo,
  incomprobable desde aquí); la regla que protegía —investigar el proceso antes de
  matarlo— se queda y no caduca. La lista de tres cuentas se reformula como **decisión**
  («quién puede existir»), no como informe: quién existe lo custodia la tabla `users`.
- **`README.md` · árbol de arquitectura**: describía la forma **y enumeraba los ficheros**.
  La enumeración ya estaba desviada (11 rutas listadas, 12 reales — faltaba `uploads`) y
  `kanban-mcp/` no aparecía en absoluto pese a ser el riel por el que entra el trabajo de
  la flota. Ahora describe la forma y el papel de cada carpeta; el inventario lo custodia
  `ls`.
- **Criterio de enrutado**: `CLAUDE.md` no decía a qué tablero va cada cosa —vive en el
  atlas del capitán— ni que hubiera que preguntarlo. Ahora apunta al custodio.
- **`docs-guard` · tres defectos de `PORTS`**, encontrados con un método nuevo: correr el
  guardián sobre un documento que **no es de este repo** (la ficha del atlas del capitán).
  Un texto ajeno usa el idioma de otra forma y ejercita lo que el propio nunca toca.
  - *Ancla demasiado estrecha:* exigía la cifra a ≤3 caracteres de «puerto», así que un
    adjetivo la derrotaba — «Puertos sagrados 9999» pasaba verde.
  - *Años tratados como puertos:* «el puerto 3003 se fijó en 2026» marcaba `2026`.
  - *Falso negativo silencioso (el grave):* `read -r -a` partía la ruta por espacios y este
    repo vive en `/Users/AGLAYA/Local Sites/…`. Con la ruta partida el fichero no existía,
    el bucle lo saltaba y **el guardián daba verde sin haber leído nada**. Un guardián que
    no encuentra el fichero debe fallar ruidoso o no fallar; lo que no puede es aprobar lo
    que no ha leído. Costó además una afirmación falsa en un informe.
- **Deriva de métricas de tests en README** (13 suites / 106 tests / 102 verde frente a
  14 / 107 / 103 reales). Origen documentado: `d6f3494` (12-jul) escribió las cifras
  correctas; `bff1ab8` (13-jul) añadió `digest-personal-filter.test.js` y las dejó fósiles;
  el pase de higiene `b6104ba` del mismo día pasó por delante sin verlas. El arreglo manual
  duró un día y sobrevivió a dos revisiones — de ahí el guardián.

### Changed
- **Doctrina de custodios:** un documento puede describir diseño y decisiones; no puede
  describir estado. De la versión manda `package.json`; de los tests, el runner; del
  despliegue, Railway; del schema, `supabase-schema.sql`; de la fase y la cola,
  `ROADMAP.md` y `BACKLOG.md`.
- **README.md**: badge de versión ahora derivado de `package.json` vía shields (no copiado);
  badge de tests sustituido por el de CI; retirados el sello de versión del título de
  características, el conteo de la tabla de stack y la tabla de suites con cifras. También
  las versiones mayores tecleadas del stack (`React 18`, `Express 4`): acertaban hoy, pero
  son copias de `package.json` con suerte y rotarían en el próximo salto de mayor.
- **CLAUDE.md**: retiradas las secciones «Fase actual» y «Backlog priorizado» (tercera copia
  de `ROADMAP.md` y `BACKLOG.md`); sustituidas por una tabla de custodios. La URL de
  producción de Railway deja de escribirse aquí — se consulta con `servicios()`.
- **Sección de flota**: la tabla de tools del MCP `aglaya-atlas` pasa de inventario a
  enrutador, y declara explícitamente que mandan las tools disponibles, no la tabla.

### Removed
- **Las rutas del atlas del capitán, en todo el repo — incluido el código del riel.**
  `kanban-mcp/server.py` y `kanban-mcp/validation.py` tecleaban la ruta del manual de
  enrutado, y una de ellas (`_MANUAL`) **se devuelve dentro del texto de error** de una
  validación fallida. Ahora dicen el **repo** (`aglaya-orchestrator`, que no caduca) y la
  **pregunta**: `donde_pregunto("tarea")` en el MCP `aglaya-atlas`, que resuelve al manual
  vivo y cita su fuente. Comprobado contra la puerta real.
  Un error tiene que seguir diciendo a dónde ir —quien se lo come no puede navegar a otro
  sitio— y ese es justamente el argumento **a favor** del cambio, no en contra: una ruta
  muerta en un mensaje de error manda a la nada y encima suena autorizada.
  `test_validation.py` fijaba el nombre del fichero del atlas; ahora fija la pregunta y
  exige que no aparezca ninguna ruta. Cerraba la mitad floja del problema (que no se copiara
  el manual) dejando abierta la que de verdad rompe: que el capitán lo mueva.
- **Las rutas del atlas en los documentos, también las escritas en pasado.** Fuera la
  elidida de `docs/BACKLOG.md` y fuera la ruta real que quedaba en la sección «Las
  lecciones», más los fixtures y comentarios de `docs-guard` que tecleaban una. Al capitán **se le pregunta, no
  se le cita**. La defensa que se le dio a la segunda —«es relato fechado, no un puntero»—
  es la misma excepción que se había rechazado unas líneas antes al morder `ELIDED` un
  ejemplo puesto a propósito en este mismo fichero: si «lo decía de ejemplo» no vale, «lo
  decía en pasado» tampoco. Los fixtures del sello pasan a rutas **inventadas**
  (`repo-vecino/manual.md`): prueban exactamente lo mismo —primer segmento que no es un
  directorio de este repo— y no caducan cuando el capitán reorganice lo suyo.
- **El grafo de graphify deja de estar versionado.** Decisión de flota: ningún repo guarda
  su grafo. Desinstalado el hook de git que lo reconstruía en cada commit y cada cambio de
  rama, `graphify-out/` fuera del índice y dentro de `.gitignore`, y retirada la sección
  `## graphify` de `CLAUDE.md`. **Nada del código lee un grafo**: era un derivado commiteado
  que envejece con pinta de autoridad — se lee como el estado de la codebase cuando es una
  foto del día que se construyó, y la misma clase de copia que este repo lleva un mes
  retirando de sus documentos. Se corre a demanda; no se mantiene. Se conserva
  `.graphifyignore`, que es configuración de una corrida, no un derivado.
- **El hook de Claude Code de graphify en `.claude/settings.json`.** Obligaba a consultar el
  grafo antes de cada `Bash`, `Read` y `Glob`. Contradice lo anterior de la forma más
  directa posible —«a demanda» y «obligatorio en cada llamada» no caben juntos— y además
  apuntaba a una ruta de la máquina de Ibai (`/Users/AGLAYA/.local/bin/`) estando
  versionado, así que en cualquier otro clon era un hook roto en cada herramienta.
- **`AGENTS.md`**: se declaraba «resumen de CLAUDE.md». Un resumen es una copia, y una copia
  diverge: llegó a afirmar Phase 4 completada mientras `CLAUDE.md` la daba pendiente.
- **Default de `workspaceName`** en `POST /api/internal/create-card`. Apuntaba a
  `"Ibai Fernández"` — que existe y es su workspace **personal**, zona intocable. Omitir el
  campo no fallaba: devolvía `201` y la card aterrizaba ahí. `key-rotation.md` lo omitía en
  su paso de verificación tras rotar `TASK_SECRET`. Ahora es obligatorio: `400` con un error
  que nombra la causa. Cambio de contrato del riel, firmado por Ibai.
- **`.claude/handoffs/` vaciada.** Tres instantáneas de abril, mayo y julio; ninguna
  describía el estado de hoy. Un informe de auditoría fechado se archiva y se cita; un
  handoff caducado no informa, **compite con la fuente viva**. Sus cifras ya estaban
  desviadas al día siguiente de escribirse. El estado del repo ya tiene custodios que
  contestan gratis. La historia sigue en git.

### Governance
- **Los workspaces `3` y `4` se conservan.** Son el espacio de pruebas de Món. Que uno esté
  vacío no lo hace basura: lo hace suyo y vacío. Que la DB devuelva seis workspaces y no
  cuatro no es una anomalía a corregir — es el número correcto. Decisión de Ibai, cerrada
  en `docs/BACKLOG.md` (escrita, no borrada, para que ninguna auditoría futura la levante
  otra vez como hallazgo).

### Security
- **Arranque sin credenciales dejaba de avisar.** `index.js` tenía validación amistosa,
  pero corría después de `require('./app')`, que construye los clientes de Supabase en
  carga de módulo: un clon limpio recibía `Error: supabaseUrl is required` desde dentro de
  la librería. La red de seguridad estaba puesta detrás del agujero. Ahora el error nombra
  todas las variables que faltan y apunta a `.env.example`.
- **Alcance del riel documentado** (`CLAUDE.md`, `kanban-mcp/server.py`): las dos puertas
  de entrada de trabajo tienen alcance distinto — el MCP solo alcanza los workspaces de
  los que el riel es **miembro**; el endpoint HTTP alcanza todos (`service_role`). Y el
  alcance del riel se mantiene **a mano**: un workspace nuevo sin el riel dentro queda
  invisible en silencio y ninguna nave puede dejar cards ahí.
- **Fuga silenciosa hacia el espacio privado cerrada** (la del default anterior). Sin rastro:
  0 cards de prueba en ese workspace — el paso del runbook nunca llegó a ejecutarse.
- **`kanban-mcp/server.py`**: `list_workspaces` declaraba «every workspace the rail can see
  (all — the rail is superadmin)». Falso — `GET /workspaces` filtra por
  `workspace_members.user_id` y el rol no concede nada ahí; el riel ve 3 de 6 filas. Una
  tool que miente sobre su propio alcance envenena a todo el que se fíe de su respuesta.

---

## [1.4.0] - 2026-07-13

### Added
- **Riel MCP `kanban-mcp/`** (stdio, Python): el orquestador opera el kanban vía la API con una cuenta de servicio superadmin dedicada (ADR-026). Tools de lectura / estructura / comanda / flujo / asignación + destructivas gated. Asignar responsable (card o ítem de checklist) dispara las notificaciones in-app existentes (`card_assignment` / `checklist_mention`).
- **Member tools** en el riel: `list_members`, `remove_member` (gated).
- **Vacuna B-10:** CI `schema-guard` que rechaza migraciones SQL sin actualizar el schema doc + GRANT/RLS.

### Changed
- **Digest diario excluye workspaces de tipo `personal`** (`services/digest/user.js`); la petición contextual explícita con `workspaceId` se respeta. Test: `digest-personal-filter.test.js`.
- **`supabase-schema.sql` regenerado como espejo fiel de la DB real** (columnas `title`/`order`, tabla `digest_logs`, GRANTs, 35 policies RLS) por introspección directa. Fuente única de versión = raíz `package.json`.
- `create_card`/`list_cards` del riel: `board_id` derivado de `column_id` (opcional).

### Fixed
- **Reconciliación DB↔doc** (migración 2026-07-12, DOC-02/03/04): `workspaces.type` default coherente, `anon` sin escritura, rebrand org `LFi Agency`→`AGLAYA`. Ver INCIDENTS.md.
- **Vulnerabilidades B-08 remediadas** (27→4 residuales justificados): CRÍTICA + todas las HIGH cerradas; `nodemailer` (muerto) eliminado.
- **SECURITY.md** sincronizado al estado real post-fixes (B-02/05/06/07/09 constaban abiertos por error).
- Higiene documental: versión única, enlaces rotos, métricas de tests reales, cruft borrado.

### Governance
- **Purga de usuarios:** el kanban pasa a 3 cuentas (Ibai, riel, Món). 8 cuentas borradas + rastro limpio; cards huérfanas conservadas sin responsable; 5 workspaces no-keeper borrados.

---

## [1.3.1] - 2026-04-29

### Added
- **`NotificationBell` como componente independiente**: campana extraída de `Toolbar` a `components/UI/NotificationBell.jsx` con su propio polling (45 s). Reutilizada en `WorkspaceDashboard` y `Toolbar` — ahora visible desde la lista de espacios de trabajo, no solo dentro de un tablero.
- **Buscador typeahead en «Añadir miembro»**: el `<select>` del modal de invitación reemplazado por `UserSearchInput` — campo de texto libre con filtrado en tiempo real por nombre o email y chip de confirmación al seleccionar.
- **Búsqueda en selector de asignación de checklist**: campo `autoFocus` siempre visible en el panel de asignación por ítem, filtra la lista de miembros del workspace en tiempo real.
- **`server/tests/notifications.test.js`** (suite nº 10): 16 tests cubriendo GET, PATCH /read-all y PATCH /:id/read — autenticación, aislamiento por `user_id`, formato, degradación a 500 JSON y verificación de que la ruta estática no es capturada por la dinámica.
- **Tests de 404 JSON** en `security.test.js`: rutas inexistentes devuelven `application/json`, no HTML.
- **Global error handler + 404 handler** en `server/app.js` (ADR-023): cualquier excepción no capturada responde con JSON; en producción el mensaje es genérico.
- **ADR-020 a ADR-024** en `ARCHITECTURE.md`: single-tenant intencional, FK de categoría, índices de rendimiento, error handler, separación app/index.

### Fixed
- **`cards.category` migrada de TEXT a UUID FK** (ADR-021): limpieza de strings vacíos y huérfanos, cast a UUID, FK con `ON DELETE SET NULL`. El `updateCard` del backend normaliza `category || null` para no enviar strings vacíos a la columna UUID.
- **Chips de asignación siempre visibles**: cuando un ítem tiene asignados, los avatares se muestran sin necesidad de hover; tamaño aumentado de 16 px a 24 px.

### Performance
- **7 índices de BD** (ADR-022): `workspace_members(user_id)`, `notifications(user_id)`, partial index `notifications WHERE read = false`, `cards(board_id)`, `columns(board_id)`, `boards(workspace_id)`, `users(organization_id)`.

### Refactor
- **Separación `server/app.js` / `server/index.js`** (ADR-024): `app.js` exporta la aplicación Express sin `listen()`; `index.js` es el punto de entrada puro. Los 10 ficheros de tests usan `require('../app')`.

---

## [1.3.0] - 2026-04-28

### Added
- **Asignaciones por ítem de checklist**: cada ítem puede asignarse a ninguno, uno, varios o todos los miembros del workspace. El campo `assignees` se añade al JSONB `checklist` en `cards` (sin cambio de schema SQL). La UX es un selector de avatares por ítem, con opción "Todos los miembros".
- **Notificaciones in-app**: nueva tabla `notifications` en Supabase (SQL proporcionado manualmente). Cuando se guarda una tarjeta con nuevos asignados en checklist, el backend crea notificaciones para los usuarios afectados (`POST /api/cards/:id` con diff de `assignees`).
- **Rutas de notificaciones**: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`. Registradas en `server/routes/notifications.js`.
- **Campana en Toolbar**: icono `Bell` (lucide-react) con badge de conteo de no leídas. Dropdown con lista de notificaciones (max 50, no leídas primero). Polling cada 45 s. Marcar individualmente o todas como leídas. Cierra con Escape o clic fuera.
- **Digest — sección "Tus asignaciones pendientes"**: el user digest incluye ahora una sección con los ítems de checklist asignados al usuario (no terminados), antes de las secciones de tarjetas urgentes/vencidas. El digest se envía también si solo hay asignaciones pendientes (sin tarjetas urgentes).
- **Tests Phase 4 — auth**: nuevo test que confirma que el login NO tiene restricción de dominio (cualquier email puede autenticarse si existe en la BD).
- **Tests Phase 4 — workspaces**: nuevos tests para coerción de tipo (`colaborador` forzado a `personal` al pedir `externo`; `admin` puede crear `interno` y `externo`).

### Fixed
- **Sintaxis pre-existente en `auth.test.js`**: paréntesis de más en `makeUsersTable.update.eq` (line 46) impedía que la suite arrancara.

---

## [1.2.2] - 2026-04-28

### Added
- **Iteración 1 — Sistema de digest robusto**: validación de config de email en startup (fail-fast), desfase configurable entre admin digest y user digest, endpoints `/api/digest/send-me` y `/api/digest/send-my-digest` síncronos con feedback inmediato de éxito/error.
- **`DIGEST_MINUTE` y `USER_DIGEST_MINUTE`**: variables de entorno para controlar el minuto exacto de cada scheduler (default: 0). Expresión cron pasa de `0 ${hour} * * *` a `${minute} ${hour} * * *`.
- **Iteración 2 — Audit logs de digest**: nueva tabla `digest_logs` en Supabase (migration: `migrations/create_digest_logs.sql`) con RLS admin-only. Logging automático de cada intento de envío (éxito y fallo). Endpoint `GET /api/digest/logs` con filtros por `type`, `status`, rango de fechas y paginación.
- **Migración a Resend**: reemplazado nodemailer/SMTP por el SDK de Resend. Centralizado en `server/utils/mailer.js` (12 líneas). Elimina la dependencia de configuración SMTP y los problemas de IPv6 en Railway.

### Fixed
- **Timezone en Railway**: añadida variable `TZ=America/Sao_Paulo` en producción. Los cron jobs ahora respetan horario Brasil en lugar de UTC.
- **`validateSmtpConfig()` actualizado para Resend**: ya no exige `SMTP_HOST/PORT/USER/PASS` (eliminadas). Ahora valida `RESEND_API_KEY` y `SMTP_FROM`. Sin este fix el servidor no arrancaría tras eliminar las variables SMTP.
- **`validateDigestSchedules()` corregido**: la advertencia de "misma hora" ahora compara hora Y minuto, eliminando el falso positivo cuando ambos digests comparten hora pero tienen minutos distintos.
- **Cleanup de variables Railway**: eliminadas 6 variables SMTP obsoletas (`SMTP_HOST`, `SMTP_HOSTNAME`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`). Variables activas: 13 de servicio + 8 de sistema Railway.
- **Documentación movida a `docs/`**: archivos de testing e iteraciones reubicados desde `.claude/` a `docs/` donde corresponden.

- **Flujo de invitación corregido** (`server/routes/admin.js`): sustituido `resetPasswordForEmail` por `generateLink({ type: 'invite' })` + envío vía Resend con la plantilla AGLAYA. El token llega como `type=invite` (no `type=recovery`), activa la pantalla "Configura tu contraseña" en el cliente, y el usuario queda logueado tras establecerla.
- **Nombre del proyecto Supabase** cambiado de `MyBoardLFi` a `AGLAYA Kanban Desk` — corrije el remitente en emails enviados por Supabase directamente.
- **`App.jsx` — detección de invitaciones**: detecta `type=invite` en el hash de URL y muestra `ResetPasswordPage` con `isInvite=true`. Tras configurar contraseña el usuario va al dashboard (no al login).
- **`ResetPasswordPage`**: acepta prop `isInvite` para ajustar evento Supabase (`SIGNED_IN` vs `PASSWORD_RECOVERY`), título y mensaje post-configuración.

### Improved
- **Toast de confirmación al mover tarjeta cross-board**: cuando una tarjeta se mueve a otro tablero (mismo o distinto workspace) desde el CardModal, aparece brevemente un banner en la parte inferior del tablero con el nombre del destino. Evita la confusión de que la tarjeta "desaparezca" sin explicación.

### Verified
- **Tests Iteraciones 1 y 2 completados** (2026-04-28): todos los endpoints verificados contra el servidor local y producción Railway. Emails confirmados recibidos vía Resend desde `info@aglaya.biz`.
- **Flujo invite email end-to-end** (2026-04-28): email recibido con SPF/DKIM/DMARC PASS, asunto «Bienvenid@ a AGLAYA Kanban Desk», botón «Activar mi cuenta» con `type=invite` en URL.
- **Mover tarjeta cross-board y cross-workspace desde CardModal**: selector agrupado por workspace con carga lazy de tableros y columnas. Lógica completa en `CardModal → Board.handleSave → useBoardData.moveCard → PUT /api/cards/:id/move`.

---

## [1.1.5] - 2026-04-13/14
### Fixed
- **Estabilización de RLS (Identidad Blindada)**: Resolución definitiva de los errores "Failed to fetch" y violaciones de políticas RLS al crear o eliminar workspaces.
- **Backend Robustness**: Implementación de instancias locales "frescas" del cliente de Supabase Admin (`freshAdmin`) en rutas críticas para evitar la contaminación de sesiones del singleton global.
- **Auto-healing de JWT**: El backend ahora recupera automáticamente el `organization_id` directamente de la base de datos si el token del usuario está desactualizado, evitando fallos en claves foráneas.
- **Permisos GUI/API alineados**: La UI deja de mostrar acciones de workspace y tablero que el backend no autoriza por rol micro (`workspace.myRole`), reduciendo conflictos de validación falsos en creación, edición, movimiento e invitaciones.
- **Invitaciones de workspace saneadas**: Nuevo flujo con endpoint dedicado de usuarios disponibles por workspace, validación de organización y tipo (`cliente` solo en workspaces `externo`), y protección de invariantes del `owner`.
- **Panel admin coherente**: Eliminada la opción `guest` del panel global de usuarios; ese rol queda restringido al ámbito del workspace, como dicta la arquitectura del producto.
- **Sesión sensible endurecida**: Migración de autenticación desde `localStorage` a `sessionStorage` con compatibilidad de migración para sesiones ya existentes.
- **Reorder de tableros protegido**: `PUT /api/boards/reorder` ahora exige `workspaceId` y valida permisos micro antes de persistir el cambio.
- **Invitación admin más resistente**: `POST /api/admin/users/invite` ya no confía ciegamente en el `organizationId` del JWT, recupera la organización real desde base de datos, repara estados parciales donde existe el usuario en Auth pero no en `public.users`, y degrada conflictos de unicidad a `409` en vez de `500`.
- **Aislamiento de clientes Supabase en backend**: `auth` y `admin` dejan de reutilizar el singleton global para flujos sensibles; ahora crean clientes frescos por request para evitar contaminación de sesión y errores RLS tras login.
- **Borrado de tarjetas con contexto explícito**: el frontend envía `boardId` al eliminar tarjetas y el middleware backend ya no depende de relaciones implícitas `cards -> boards(workspace_id)` para resolver el workspace; ahora hace resolución determinista en dos pasos.
- **Protecciones UX para borrado estructural**: eliminar columnas y tableros ahora exige confirmación explícita desde la GUI, evitando ejecuciones destructivas directas por clic accidental.
- **Teclado consistente en overlays**: los diálogos principales de workspace, tarjeta, invitación y confirmación ahora responden a `Escape`, alineando el comportamiento con expectativas de escritorio.
- **Modal de categorías alineado con teclado**: `Categorías` ya se cierra con `Escape` y respeta la edición inline sin cerrar el diálogo por accidente.
- **Workspace cards más operables**: los owners disponen de papelera directa en cada tarjeta de workspace sin depender del menú contextual.
- **Toolbar interior más legible en resoluciones pequeñas**: el filtro local `Filtrar tablero…` se oculta en anchos reducidos para preservar la visibilidad del botón de vuelta.
- **Panel admin con menú de perfil coherente**: la cabecera reutiliza el mismo icono y menú de usuario que el dashboard principal, incluyendo cambio de avatar y logout.
- **Digest contextual del workspace**: el icono de correo de la navbar interior deja de invocar el admin digest global y pasa a enviar el resumen personal filtrado por el workspace actual, con confirmación previa y mensaje de destino correcto.
- **Sincronización defensiva de email**: login, `GET /api/auth/me` y digest personal corrigen divergencias entre Supabase Auth y `public.users.email`, evitando feedback con direcciones legadas.

### Added
- **Cobertura renovada de validación**: Nuevas suites y smoke checks para auth, workspaces y administración, enfocadas en los flujos de permisos que estaban desalineados entre GUI, backend y Supabase.
- **Cobertura anti-regresión para invitaciones admin**: Tests específicos para JWT con organización obsoleta, recuperación de usuarios parciales y conflictos de email ya existente.
- **Registro de incidencias operativo**: nuevo documento `docs/INCIDENTS.md` con fallos reales, causa raíz, correctivos y notas pendientes de operación.
- **Cobertura anti-regresión de identidad**: tests dirigidos para drift de email Auth/perfil y digest contextual por workspace.

### Docs
- **Sincronización documental completa con `v1.1.5`**: `PRD`, `PERMISSIONS`, `SECURITY`, `RUNBOOK`, `ROADMAP`, `BACKLOG` y el schema documentado reflejan ya los nombres reales de roles micro (`member/guest`), la restricción de dominio solo en registro, la separación de clientes Supabase en backend y el digest contextual por workspace.
- **Poda del backlog**: `docs/BACKLOG.md` elimina tareas ya absorbidas o contradictorias, actualiza el estado real del correo transaccional, saca del documento la fase descartada de pitch interno y compacta la siguiente etapa de infraestructura soberana.

## [1.1.1] - 2026-04-12

## [1.1.0.0] — 2026-04-11 — Certificación "Kosher" · Nutrición Atlas · v1.1.0 Global Sync

Versión de consolidación documental y técnica para el Atlas de Proyectos, sincronizando todo el ecosistema AGLAYA tras la publicación oficial.

### Added
- **Atlas de Proyectos (Ficha Visual)**: Reconstrucción total de `index.html` bajo el estándar v1.0.0 del Atlas, incluyendo matriz de roles, stack técnico detallado y pipeline de despliegue.
- **Registro de Archivo Nutrido**: Expansión profunda de `archive/aglaya-kanban-desk.md` con ADRs, lógica de permisos y métricas de salud del código.

### Changed
- **Salto Versional Global**: Sincronización de todas las cabeceras técnicas y archivos `package.json` a la versión **v1.1.0.0** (o 1.1.0 semver).
- **Hardening de Documentación**: Certificación "Kosher" de toda la suite `docs/`, eliminando cualquier residuo de marca externa y validando la precisión técnica.

---

## [1.0.0.0] — 2026-04-11 — Lanzamiento Oficial GitHub

Hito de publicación oficial del repositorio en GitHub como plataforma base estable.


## [0.9.0.0] — 2026-04-11 — Estabilización AGLAYA · Fix Avatar · Jest Downgrade

Versión de consolidación de marca y corrección de bugs críticos de la Phase 1.

### Fixed
- **Persistencia de Avatar**: `server/routes/auth.js` ahora incluye `avatarUrl` en la respuesta de login, evitando que el perfil se "resetee" al cerrar sesión.
- **Identidad AGLAYA**: Eliminación total de referencias residuales a la marca anterior en código, tests y documentación.
- **Seguridad**: Implementación de restricción de dominios corporativos (`@aglaya.biz`, `@ibaifernandez.com`) en el backend y actualización del email del Superadmin.

### Infrastructure
- **Jest Downgrade**: Bajada a `jest@29.7.0` (versión estable) para mitigar procesos huérfanos.
- **Cleanup**: Purga sistemática de procesos zombis (Node/Playwright/Chrome) en el entorno de desarrollo.

### Known Issues
- **Jest Hanging**: La suite de tests automatizada presenta bloqueos en el runner (Mac/Node 18). Verificada la lógica del código manualmente; queda como pendiente técnico para la próxima iteración.

---

## [1.2.1] — 2026-04-10 — Tests · Mover tarjetas cross-workspace · Settings de workspace

### Added
- Mover tarjetas a otro tablero (cross-workspace): `CardModal` muestra selector agrupado por espacio de trabajo con `<optgroup>` cuando hay más de un tablero accesible; carga lazy con `api.getBoards()` + `api.getWorkspaces()`, fallback inmediato a los tableros del workspace activo mientras carga
- Workspace settings panel: panel lateral accesible desde el Toolbar (icono `SlidersHorizontal`) para owners y admins del workspace; permite editar nombre, emoji, descripción, tipo (con aviso amber cuando el cambio es a `externo`) y portada sin salir del workspace
- Tests backend actualizados: `server/tests/workspaces.test.js` (nuevo, 13 tests) cubre validación de `POST /api/workspaces`, coerción de tipo por rol, `requireWorkspaceMember` y gestión de miembros; `auth.test.js` añade test de no-restricción de dominio desde v1.1.0; `cards-validation.test.js` añade `'urgent'` a la lista de prioridades válidas

---

## [1.2.0] — 2026-04-10 — Workspace UX · Movilidad de tableros · Digest personal

### Added
- Mover tableros entre workspaces: botón en Sidebar (hover sobre tablero) → `BoardMoveModal` con selector de workspace destino y carga lazy; validación de organización en backend (`PUT /api/boards/:id` acepta `workspaceId`); `useBoards.moveBoard()` elimina el tablero de la lista local del workspace origen
- User digest personal diario: `server/userDigest.js` — agrupa tarjetas urgentes/vencidas del usuario por workspace y tablero (Personal → Interno → Clientes); badges de prioridad, fechas de vencimiento y progreso de checklist en el email; endpoints `POST /api/digest/send-my-digest` (cualquier usuario) y `POST /api/digest/send-all-digests` (admin); arranca con `startUserDigestScheduler` en `index.js`
- Confirmaciones al borrar tarjetas: diálogo inline en `CardModal` (estado `confirmDelete` con botones Sí/No en el header)
- Confirmaciones al borrar columnas: modal de confirmación en `Board` (menú contextual), misma lógica para tarjetas desde ese contexto
- Workspace settings — botón lápiz visible al hover en tarjetas de workspace (junto al de portada), para acceso directo al modal de edición sin depender del menú contextual
- Aviso amber al cambiar un workspace a tipo `externo`: informa al usuario que pasará a ser visible para usuarios con rol `cliente`

### Fixed
- Workspace settings: inicialización del tipo en el formulario usaba `'personal'` como fallback para el tipo `'externo'`; ahora preserva el tipo real del workspace al abrir el modal de edición
- `Toolbar.jsx`: clave localStorage unificada a `aglaya_token` (residuo de rebranding previo)
- `server/index.js`: mensaje de arranque actualizado con nombre del proyecto

### Chore
- Repo GitHub renombrado: `aglaya-board` → `aglaya-kanban-desk`
- `.claude/launch.json`: nombres de servidor actualizados a "AGLAYA Kanban Desk Server/Client"
- `CLAUDE.md`: identidad del proyecto, carpeta local y backlog actualizados

---

## [1.1.1] — 2026-04-08 — Fixes post-migración + herramientas de migración

### Fixed
- `server/routes/cards.js`: `VALID_PRIORITIES` no incluía `'urgent'`; cualquier tarjeta con prioridad urgente fallaba al guardar con 400. Bug preexistente que la migración de MyBoard hizo visible (14 tarjetas afectadas)
- `WorkspaceDashboard`: opción `personal` ausente en selector de tipo al crear workspace — el auto-creado en registro no cubría usuarios existentes

### Added
- `server/scripts/migrate-myboard.js` — script de migración one-shot desde MyBoard (tasks.json) a AGLAYA Kanban (Supabase): mapea categorías a UUIDs, asigna workspace_id correcto, preserva checklists y metadatos
- Migración ejecutada en producción: 7 tableros, 35 columnas, 10 categorías, 61/62 tarjetas importadas (1 tarjeta con columna huérfana en origen)
- `docs/BACKLOG.md`: sección «Movilidad de objetos» — workspace type editing, mover boards entre workspaces, mover cards entre boards; principio de diseño de visibilidad

---

## [1.1.0] — 2026-04-07 — Rebrand AGLAYA + Workspace Types + Acceso por Rol

Migración completa de la marca anterior → AGLAYA Kanban Desk. Cuatro fases ejecutadas en una sola iteración desde la rama `feature/rebrand-aglaya`, mergeada a `main` y desplegada en producción.

### Fase A — Rebrand visual y de dominio
- Producto renombrado: **AGLAYA Kanban Desk**
- Repo renombrado en GitHub: `aglaya-kanban-desk`
- `package.json`: `name: aglaya-kanban-desk`, `version: 1.1.0`
- Dominio de producción: `kanban.aglaya.biz`
- CORS producción restringido a `https://kanban.aglaya.biz`
- localStorage keys: `aglaya_token/user`
- Logo y favicon → assets AGLAYA (SVG rojo, blanco, negro, color)
- Restricción de dominio corporativo eliminada — la plataforma acepta cualquier email
- Placeholder de email en login: `tu@empresa.com`

### Fase B — Workspace types
- Tipos de workspace renombrados: `general/departamento/cliente` → `personal/interno/externo`
- SQL migration `002-workspace-types-aglaya.sql` (DROP constraint + UPDATE + ADD constraint)
- Constraint `workspaces_type_check` actualizado a nuevos valores
- Auto-creación de workspace `personal` al registrar nuevos usuarios

### Fase C — Control de acceso por tipo de usuario
- Rol `cliente`: solo puede ver y acceder a workspaces de tipo `externo`
- Middleware `workspace.js`: bloquea con 403 a clientes intentando acceder a workspaces `personal` o `interno`
- `server/routes/workspaces.js`: filtrado de tipos permitidos según rol en creación

### Fase D — UI diferenciada por rol
- `WorkspaceDashboard`: vista en secciones para colaboradores (Personal / Internos / Clientes), vista plana para clientes
- `TYPE_LABELS` actualizadas a nuevos tipos
- Logo y branding AGLAYA en toda la UI

### Infraestructura y deploy
- Supabase Auth → Site URL: `https://kanban.aglaya.biz`
- Supabase Auth → Redirect URLs: añadidas con wildcard `/**`
- Railway `SITE_URL` actualizado
- Tests de auth reescritos: eliminada suite de restricción de dominio, añadido test de nombre requerido

---

## [0.8.1] — 2026-03-27 — Hotfix: categoría hardcodeada en tarjetas

### Fixed
- `CardModal`: `EMPTY.category` era `'personal'` en lugar de `''`; las nuevas tarjetas se guardaban con esa cadena literal si las categorías no estaban cargadas al abrir el formulario
- `Card`: la categoría ya no muestra el valor crudo cuando no se encuentra en el contexto; si no hay match simplemente no se renderiza el badge

---

## [0.8.0] — 2026-03-27 — Sesión 7: Sub-fase 2.1 + bug sweep + performance

### Supabase Storage
- Bucket `media` creado (público, 5 MB), 3 RLS policies (INSERT/UPDATE/SELECT)
- SQL migrations: `users.avatar_url`, `workspaces.cover_url`, `workspaces.type`
- Endpoints `POST /api/media/users/me/avatar` y `POST /api/media/workspaces/:id/cover`

### Foto de perfil
- Avatar con foto real en header (Toolbar y WorkspaceDashboard); fallback a inicial
- `ProfileDropdown`: click en avatar → cropper → upload → persiste en DB y localStorage
- Fix: mousedown del dropdown cerraba el `AvatarCropModal`; añadida guardia `cropSrcRef`

### Espacios de trabajo — identidad visual
- Portada (`cover_url`): imagen real en tarjeta del workspace; fallback al mini-kanban
- Menú contextual (clic derecho) en cada tarjeta: Editar / Eliminar
- Modal de edición: selector de tipo (Cliente / Departamento), portada, icono, nombre, descripción
- `WorkspaceForm` acepta `onCoverChange` para upload directo de portada desde el modal de edición
- Filtro de tipo simplificado: solo «Clientes» y «Departamentos» (sin «General»)

### Asignación y filtros en tarjetas (Bani #1 y #3)
- Campo `assignee_id` en `cards` (SQL migration ya ejecutada)
- Backend: `getCardsByBoard` hace JOIN `users!assignee_id(id, name, email)`
- `CardModal`: selector de responsable (visible solo si el workspace tiene miembros)
- `Card`: avatar del responsable (inicial en círculo índigo) en el footer
- `Card`: contador de días reemplaza icono de prioridad (hoy=rojo, ≤3d=ámbar, >3d=gris, vencida=rojo)
- `Toolbar`: filtro por responsable + toggle «Vencidas»
- `Board`: aplica filtros `assignee` y `overdue`

### Categorías por tablero
- SQL: `categories.board_id UUID REFERENCES boards(id) ON DELETE CASCADE`
- Backend `GET/POST/PUT/DELETE /api/categories` filtran y guardan por `boardId`
- `useCategories(boardId)`: guardia si `boardId` es null (evita request innecesaria al mount)

### Performance
- `GET /api/workspaces`: reemplazado bucle N+1 (1+2N queries) por 3 queries de agregado
  - De ~21 round-trips para 10 workspaces a **3 fijos**, ~85% menos latencia en dashboard

### Bug sweep
- **Crítico**: `activeBoardId` referenciado antes de su `useState` → `ReferenceError` → pantalla negra en producción. Corregido reordenando declaraciones
- `Card.jsx`: `assignee.name || assignee.email` sin fallback → crash si ambos son null; añadido `|| '?'`
- `dates.js`: `parseLocalDate` sin guardia de longitud mínima; añadida

### Seguridad
- `express-rate-limit`: límite de 20 req/15 min en todos los endpoints de auth
- CORS diferenciado por entorno: solo `localhost:5175` en dev, dominios corporativos en prod
- Helmet CSP activado en producción (desactivado solo en dev)
- `PUT /api/cards/:id`: validación explícita de `priority` (enum), `title` (non-empty, <255 chars), `dueDate` (fecha válida o null)
- `GET /api/cards/search`: input capeado a 100 chars
- `express.json()` limitado a 2 MB
- `server/index.js`: app exportada como módulo → permite tests sin arrancar el servidor

### Tests
- Suite Jest + Supertest: 26 tests en 4 suites, 0.59s (`npm test`)
  - `health.test.js`: smoke test del endpoint `/api/health`
  - `auth.test.js`: validación de inputs, restricción de dominio corporativo, protección JWT en `/api/auth/me`
  - `cards-validation.test.js`: validación de enums, tipos y edge cases en `PUT /api/cards/:id`
  - `security.test.js`: 11 rutas protegidas devuelven 401 sin token; rutas públicas accesibles

### Infraestructura
- SMTP migrado de Migadu a Resend (`smtp.resend.com`) — confirmado operativo en Railway
- Email de invitación Supabase: plantilla corporativa configurada; subject «¡Hola! Te han invitado a AGLAYA Kanban Desk.»; URL de redirección verificada ✅ (cierra KNOWN-02)
- Supabase Index Advisor habilitado (`index_advisor` + `hypopg`) — analiza queries y sugiere índices

### WorkspaceDashboard
- Botón Admin movido a header del WorkspaceDashboard (visible para admin/superadmin); eliminado de la Toolbar
- `sessionStorage` persiste vista activa entre recargas (workspace + tablero)
- History API: botón Atrás del navegador navega entre workspaces y dashboard

---

## [0.7.0] — 2026-03-25 — Sesión 6: UI Polish — display name, logo, mini-kanban, espacios de trabajo

### Identidad visual
- Display name oficial: **AGLAYA Kanban Desk** (nombre técnico/repo permanece aglaya-kanban-desk)
- Actualizado en: título de pestaña (`index.html`), LoginPage, ResetPasswordPage, Sidebar, WorkspaceDashboard, footer copyright
- Logo AGLAYA en header del WorkspaceDashboard (reemplaza la «M» genérica en azul)

### WorkspaceDashboard
- Tarjetas de espacios de trabajo muestran ahora **counts reales** de tableros y miembros (cierra KNOWN-01)
  - `GET /api/workspaces` enriquece cada workspace con `memberCount` y `boardCount` vía `Promise.all` de queries `count:exact`
- Añadido **mini-kanban abstracto** en cada tarjeta: 4 columnas con barras de color de altura variable, generadas deterministamente desde `ws.id` (visual decorativo, no refleja datos reales)
- Botón Admin eliminado del header del WorkspaceDashboard (acceso admin sigue disponible en la Toolbar dentro de un tablero)

### Lenguaje
- Renombrado «workspace/workspaces» → «espacio de trabajo / espacios de trabajo» en toda la UI (WorkspaceDashboard, WorkspaceMembers, Toolbar)

---

## [0.6.0] — 2026-03-24 — Sesión 5: Phase 2 — Workspaces completa en producción

### Backend — Workspaces
- `server/routes/workspaces.js`: CRUD completo de workspaces + gestión de miembros
  - `GET /api/workspaces` — lista de workspaces del usuario autenticado
  - `POST /api/workspaces` — crear workspace (creator → owner)
  - `GET /api/workspaces/:id` — detalle + memberCount + boardCount
  - `PATCH /api/workspaces/:id` — editar (requiere admin/owner)
  - `DELETE /api/workspaces/:id` — eliminar (requiere owner)
  - `GET /api/workspaces/:id/members` — lista de miembros
  - `POST /api/workspaces/:id/members` — añadir miembro
  - `PATCH /api/workspaces/:id/members/:userId` — cambiar rol
  - `DELETE /api/workspaces/:id/members/:userId` — eliminar miembro
- `server/middleware/workspace.js`: `requireWorkspaceMember` + `requireWorkspaceRole`
- `GET /api/boards` ahora acepta `?workspaceId=` para filtrar por workspace
- Fix 504 en Railway: digest con fire-and-forget (responde 200 inmediatamente, procesa en background)

### Base de datos (Supabase)
- Tablas: `workspaces`, `workspace_members` (roles: owner/admin/member/guest)
- RLS activa con funciones `SECURITY DEFINER` para evitar recursión:
  - `get_workspace_role(workspace_id uuid)` → role del usuario actual
  - `is_workspace_member(workspace_id uuid)` → boolean
- FK disambiguation: `workspace_members` tiene dos FKs a `users` — siempre usar `.select('user:users!user_id(...)')`

### Frontend — Workspaces
- `WorkspaceDashboard.jsx`: grid de tarjetas de workspaces, modal de creación, estado vacío
- `WorkspaceMembers.jsx`: panel lateral de miembros con gestión de roles (solo admin/owner)
- `useWorkspaces.js`: hook de estado para lista de workspaces
- `useBoards.js` modificado: acepta `workspaceId`, usa `getWorkspaceBoards`
- `App.jsx`: estado `view` con valores `'workspaces' | 'board' | 'admin'`; punto de entrada siempre `'workspaces'`
- `Toolbar.jsx`: breadcrumb espacio de trabajo → tablero; botón UserCog para panel de miembros
- `api/client.js`: 10 métodos nuevos para workspaces

### Conocido
- ⚠️ KNOWN-02: Email de invitación de nuevos usuarios no funciona — requiere configurar template en Supabase Auth (pendiente)

---

## [0.5.0] — 2026-03-24 — Sesión 4: Producción completa + Resend + seguridad RLS

### Email transaccional — migración a Resend completada
- El departamento de TI del entorno previo verificó el dominio corporativo en Resend
- Railway actualizado: `SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend`, `SMTP_FROM=myboard@dominio-previo.com`
- Supabase → Authentication → Email → SMTP Settings: mismas credenciales configuradas
- Probado y confirmado: email de recuperación de contraseña llega correctamente desde el dominio configurado
- Ver ADR-007 (estado actualizado a Activa)

### Seguridad — RLS restaurada correctamente en public.users
- Restaurada la protección RLS eliminada en v0.4.0, ahora sin recursión
- Creada función `public.get_my_role()` con `SECURITY DEFINER` para obtener el rol del usuario sin releer `public.users` bajo RLS
- Policy `"Admins ven usuarios de su org"` recreada usando dicha función: admins ven todos, cualquier usuario ve su propia fila
- La `anon` key de Supabase puede estar en el bundle del cliente con seguridad (solo permite Auth + leer propia fila)
- `SECRETS_SCAN_OMIT_KEYS` eliminado de `netlify.toml` — ya no hace falta suprimir el escáner de Netlify

### Deploy Netlify — resolución de bloqueo por escáner de secretos
- `VITE_SUPABASE_ANON_KEY` y `VITE_SUPABASE_URL` reconfiguradas como **Plain text** (no Secret) en Netlify UI
- Netlify solo escanea en el bundle las variables marcadas como Secret; la anon key es una variable pública por diseño de Supabase
- Deploy limpio confirmado: `main` publicado con dominio corporativo

### UI — mejoras menores
- Añadido toggle de visibilidad de contraseña (ojito) en `LoginPage.jsx` y `ResetPasswordPage.jsx`
- Enlace "¿Olvidaste tu contraseña?" centrado correctamente en `LoginPage.jsx`

### Verificado en producción
- Login con cuenta administrativa funciona en el dominio de producción
- 5 tableros corporativos cargando desde Supabase (datos filtrados por `organization_id`)
- Email de recuperación de contraseña entregado vía Resend en menos de 1 minuto

---

## [0.4.0] — 2026-03-23 — Sesión 3: Fix login + deploy Netlify + migración schema

### Bug crítico resuelto: login bloqueado por RLS recursiva
- **Causa raíz:** La policy RLS `"Admins ven todos los usuarios de su org"` en `public.users` hacía una subconsulta a `public.users` para comprobar el rol del usuario autenticado, creando una recursión infinita que bloqueaba *todas* las consultas a la tabla, incluso las realizadas con la `service_role` key desde el servidor.
- **Síntoma:** Login fallaba con "Error al obtener el perfil de usuario" aunque las credenciales fueran correctas y la fila existiera en `public.users`.
- **Solución:** `DROP POLICY IF EXISTS "Admins ven todos los usuarios de su org" ON public.users;` ejecutado en Supabase SQL Editor. Ver ADR-009.

### Cuenta corporativa de acceso
- Creado usuario administrador en Supabase Auth (sin necesidad de email; contraseña asignada directamente desde el dashboard)
- Insertada la fila correspondiente en `public.users` con rol `superadmin` y la organización base
- Confirmado que el login funciona correctamente tras eliminar la policy RLS

### Deploy frontend — Netlify
- Frontend desplegado en Netlify: `https://kanban.aglaya.biz` (dominio primario)
- `netlify.toml` configurado: build desde `client/`, proxy `/api/*` y `/uploads/*` → Railway, SPA fallback
- CORS del servidor Express ya incluía el dominio Netlify
- Supabase Auth → URL Configuration: Site URL actualizado a `https://kanban.aglaya.biz`; Redirect URLs añadida
- Variables de entorno Netlify: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas
- Ver ADR-010

### Migración de schema — alineación camelCase frontend/backend
Ejecutado en Supabase SQL Editor para alinear nombres de columna con la API del frontend:
```sql
ALTER TABLE public.boards   RENAME COLUMN name     TO title;
ALTER TABLE public.boards   RENAME COLUMN position TO "order";
ALTER TABLE public.columns  RENAME COLUMN name     TO title;
ALTER TABLE public.columns  RENAME COLUMN position TO "order";
ALTER TABLE public.cards    RENAME COLUMN position TO "order";
ALTER TABLE public.cards    RENAME COLUMN category_id TO category;
ALTER TABLE public.cards    ADD COLUMN IF NOT EXISTS tags           JSONB DEFAULT '[]';
ALTER TABLE public.cards    ADD COLUMN IF NOT EXISTS checklist_title TEXT DEFAULT '';
ALTER TABLE public.columns  ADD COLUMN IF NOT EXISTS default_sort   TEXT DEFAULT NULL;
```

### Seguridad — limpieza de secretos en repositorio
- `docs/ARCHITECTURE.md` (sección ADR): clave API real de Resend que estaba hardcodeada en el ADR-007 → redactada y sustituida por placeholder. **Clave revocada y nueva generada por Ibai; guardada a buen recaudo hasta poder configurar Resend.**
- `.env.example`: placeholders de SMTP neutralizados para no activar detectores de secretos (GitGuardian)
- `docs/RUNBOOK.md`: URL real de Supabase sustituida por placeholder
- GitGuardian: 3 incidentes resueltos (2 falsos positivos de `.env.example`, 1 clave Resend real ya revocada)

---

## [0.3.0] — 2026-03-18 — Sesión 2: Admin Digest + correcciones de flujo auth

### Admin Digest (reescritura completa)
- `server/digest.js` reconvertido de "resumen de tareas personales" a **admin digest con estadísticas de uso**
- Contenido del digest: estado global (tableros / columnas / tarjetas / % completadas), alertas automáticas (tarjetas vencidas, tarjetas huérfanas sin columna), pendientes por prioridad, top 10 tableros por volumen de tarjetas
- **Integración Supabase Admin API**: si está disponible, el digest incluye tabla de usuarios con total, confirmados, activos en 24h, activos en 7 días y último login de cada usuario
- Endpoint `POST /api/digest/send-me` restringido a roles `admin` y `superadmin` (antes cualquier usuario autenticado podía invocarlo)
- Botón de digest en Toolbar visible **solo para admins/superadmins**
- `DIGEST_TO` y `DIGEST_HOUR` mantienen su función pero ahora alimentan un informe ejecutivo de uso, no un resumen de tareas

### Correcciones auth
- `App.jsx`: detección del token de recuperación de contraseña corregida — Supabase redirige a `/#access_token=...&type=recovery` (hash en raíz), no a `/reset-password`; el condicional ahora detecta ambas variantes
- `App.jsx`: redirección post-reset cambiada de `history.replaceState` (sin re-render) a `window.location.replace('/')` (recarga completa al login)

### Supabase — fixes operativos
- SQL de schema corregido: `DROP POLICY IF EXISTS` antes de `CREATE POLICY` para evitar error `42710` al re-ejecutar el schema
- `public.users`: row de Ibai debe insertarse manualmente cuando la cuenta se crea desde el Dashboard de Supabase (no desde el formulario de registro de la app)

### Conocido / Limitaciones
- Supabase free tier: límite de ~3 emails de recuperación por hora (`email rate limit exceeded`). No afecta al login ni al funcionamiento general.
- El `UPDATE role = 'admin'` debe ejecutarse en SQL Editor tras el primer login, o usar el INSERT directo con rol incluido

---

## [0.2.0] — 2026-03-19 — Sesión 1: Phase 1 — Autenticación, Supabase y email

### Infraestructura
- Proyecto Supabase creado (`aglaya-kanban`, región São Paulo) y conectado al servidor
- Schema inicial ejecutado: tablas `organizations`, `users`, `boards`, `columns`, `cards`, `categories` con RLS activado
- Organización principal AGLAYA insertada como tenant base
- `@supabase/supabase-js` instalado en server y client
- `jsonwebtoken` y `bcryptjs` instalados en server

### Autenticación
- `server/utils/supabase.js` — cliente Supabase admin + anon para el servidor
- `server/middleware/auth.js` — middleware `requireAuth` (JWT) y `requireRole(...roles)`
- `server/routes/auth.js` — endpoints `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Restricción de dominio corporativo: solo dominios autorizados pueden registrarse o iniciar sesión (validación en servidor y en frontend)
- Usuario superadmin creado con rol `superadmin` en la organización base

### Frontend — Autenticación
- `client/src/context/AuthContext.jsx` — estado global de sesión (token + user en localStorage)
- `client/src/pages/LoginPage.jsx` — pantalla de login con branding AGLAYA, diseño corporativo oscuro
- `client/src/pages/ResetPasswordPage.jsx` — página de restablecimiento de contraseña (flujo Supabase Auth)
- `client/src/utils/supabaseClient.js` — cliente Supabase anon para el frontend
- `client/.env` — variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- `client/src/api/client.js` — interceptor JWT: todas las peticiones incluyen `Authorization: Bearer <token>`
- `client/src/main.jsx` — envuelto en `AuthProvider`
- `App.jsx` — gate de autenticación: muestra `LoginPage` si no hay sesión; detecta ruta `/reset-password`
- Flujo "Olvidé mi contraseña" integrado en `LoginPage` (sin página separada)
- Toolbar actualizado: avatar con inicial, nombre de usuario y botón de logout

### Branding
- Branding AGLAYA visible en: pantalla de login, sidebar, página de reset de contraseña
- Sidebar renombrada de "MyBoard" a "AGLAYA Kanban Desk"
- Footer del digest actualizado: "AGLAYA Kanban Desk · © 2026 AGLAYA"

### Email — Digest bajo demanda
- `server/routes/digestRoute.js` — endpoint `POST /api/digest/send-me` (requiere auth JWT)
- Botón "Enviarme mis tareas" (icono sobre) en Toolbar — envía el digest al email del usuario autenticado
- Feedback visual en botón: verde si OK, rojo si error, desaparece a los 4 segundos
- `digest.js` refactorizado: `sendDigest(to?)` acepta destinatario arbitrario; rebrandeado a AGLAYA Kanban Desk

### SMTP / Email
- SMTP configurado con Migadu (provisional para pruebas — ver nota de migración)
- Cuenta Resend creada — pendiente verificación de dominio por el departamento técnico
- ⚠️ **Pendiente migración a Resend** tan pronto el dominio corporativo esté verificado

### Seguridad
- Claves Supabase (service_role) solo en servidor, nunca expuestas al cliente
- Validación de dominio corporativo en dos capas: frontend (UX inmediato) + servidor (fuente de verdad)
- JWT con expiración de 7 días

---

## [0.1.0] — 2026-03-18 — Sesión 0: Limpieza y documentación inicial

### Fork
- Proyecto creado como fork de MyBoard (versión personal de Ibai Fernández, Phase 1 completa)
- Renombrado a MyBoard Legacy con enfoque corporativo multi-tenant para AGLAYA

### Eliminado
- Datos personales de Ibai en `server/data/tasks.json` → respaldados en `tasks.personal-backup.json`
- Adjuntos personales en `server/uploads/` (5 archivos: 2 PNG, 1 PDF, 1 CSV, 1 MD)
- `estrategia.ibaifernandez.com.md` de la raíz del proyecto
- Credenciales SMTP personales (info@ibaifernandez.com) del archivo `.env`

### Añadido
- **Dummy data corporativa** en `server/data/tasks.json`:
  - 5 tableros: 🚀 Proyectos Activos, 📧 Campañas Email, 🤝 Clientes, ⚙️ Automatizaciones, 🏢 Operaciones AGLAYA
  - 18 columnas distribuidas entre los 5 tableros
  - 30 tarjetas con datos verosímiles de agencia de marketing (prioridades, fechas, checklists, categorías)
  - 8 categorías: email-marketing, web, social-media, automatizacion, clientes, operaciones, contenido, analytics
- Variable `PORT=3003` en `.env`

### Modificado
- **Puertos actualizados de 3001/5173 → 3003/5175:**
  - `server/index.js`: `PORT = process.env.PORT || 3003`
  - `client/vite.config.js`: port 5175, proxy → localhost:3003
  - `.claude/launch.json`: configuraciones actualizadas a 3003/5175
- `server/index.js`: CORS actualizado para aceptar `localhost:5175`

### Documentación reescrita
- `CLAUDE.md` — contexto AGLAYA Kanban Desk, puertos 3003/5175, reglas Phase 0
- `AGENTS.md` — identidad, comportamiento, convenciones, reglas de datos e IP
- `README.md` — orientado a gerencia AGLAYA + equipo técnico propio
- `docs/ROADMAP.md` — 4 fases: Phase 0→4 con objetivos y entregables
- `docs/BACKLOG.md` — tareas por fase (Phase 0 completada, Phases 1–3 planificadas)
- `docs/ARCHITECTURE.md` — arquitectura actual (Phase 0) + arquitectura objetivo (Phase 1) con esquema Supabase, roles, multi-tenancy
- `docs/ARCHITECTURE.md` — ADRs y decisiones estructurales: Supabase, auth JWT, Infra-Soberana, freemium, IP, fork
- `docs/PRD.md` — visión de producto para stakeholders AGLAYA, comparativa herramientas y modelo freemium

---

## Versiones heredadas de MyBoard (referencia)

### [0.3.0] — 2026-03-03 (MyBoard personal)
- Columnas por defecto al crear tablero
- Búsqueda global
- Filtros por categoría y prioridad

### [0.2.0] — 2026-03-02 (MyBoard personal)
- Sistema de categorías via API
- Drag & drop de columnas y tarjetas

### [0.1.0] — 2026-03-01 (MyBoard personal)
- MVP inicial: tableros, columnas, tarjetas, CRUD completo
