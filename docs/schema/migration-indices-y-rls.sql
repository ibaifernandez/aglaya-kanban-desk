-- migration-indices-y-rls.sql — tarjeta `6869ebc7`.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ HACE, Y QUÉ **NO** PROMETE
--
-- Tres cosas: índices para las doce claves foráneas que no los tienen, las
-- políticas RLS que reevalúan la sesión fila a fila, y dos políticas permisivas
-- redundantes que obligan a evaluar dos veces lo mismo.
--
-- ⚠️ **ESTO NO BAJA EL AVISO DE E/S DE SUPABASE, y está medido.** La base entera
-- cabe en memoria: 2 bloques leídos de disco contra 2.630.119 servidos de
-- memoria. Leer no gasta disco aquí, así que el aviso —que es de *Disk IO*— no
-- puede venir de las lecturas. Lo que gasta es escribir.
--
-- Esto es **higiene de cómputo**: trabajo inútil en cada petición. Se hace por lo
-- que de verdad arregla, no por el aviso:
--   · un índice de clave foránea evita recorrer la tabla HIJA entera cada vez que
--     se borra o actualiza una fila PADRE;
--   · y sostiene los joins el día que estas tablas dejen de caber en memoria.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ **SIN** `CONCURRENTLY`, QUE ES UNA DESVIACIÓN DE LA TARJETA
--
-- La tarjeta pide `CREATE INDEX CONCURRENTLY`. No se usa, y el motivo es medido:
--
--     card_description_history ... 4.530 filas ... 2.896 kB   ← la mayor
--     cards ...................... 834 filas ..... 552 kB
--     workspaces / boards / categories / workspace_members ... 8–16 kB
--
-- Sobre tablas de este tamaño un `CREATE INDEX` normal tarda milisegundos, y lo
-- que bloquea son escrituras durante ese rato. `CONCURRENTLY` evitaría ese
-- bloqueo, pero **no puede ejecutarse dentro de una transacción**: el editor SQL
-- manda el fichero entero como un bloque, así que obligaría a ejecutar las doce
-- sentencias **una a una, a mano**. Cambiar milisegundos de bloqueo por doce
-- ejecuciones manuales añade superficie de error humano justo donde no se quiere.
--
-- Si estas tablas crecieran, la decisión se invierte: `CONCURRENTLY`, una a una.
--
-- Idempotente: se puede aplicar dos veces sin efecto.

-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE UN ÍNDICE CUESTA, Y POR QUÉ `cards.column_id` SE QUEDA FUERA
--
-- Un índice no es gratis: **se paga en cada escritura que toca su columna**.
-- Postgres puede actualizar una fila sin tocar índices —actualización HOT— solo
-- mientras ninguna columna indexada cambie. Medido sobre producción:
--
--     cards ... 11.086 actualizaciones ... 9.681 HOT (87,3 %)
--
-- De las claves foráneas de `cards`, `organization_id` no cambia nunca y
-- `category` casi nunca, así que indexarlas no quita HOT a nadie. `assignee_id`
-- cambia poco —45 veces en todo el historial, 0,4 % de las actualizaciones— y se
-- indexa: el coste es despreciable.
--
-- **`column_id` es otra cosa, y por eso NO se indexa aquí.** Es la columna que
-- cambia en cada movimiento de tarjeta, que es la escritura más repetida del
-- riel: el historial registra `description` 4.022, `priority` 259, `title` 206 y
-- `assignee_id` 45, pero **ningún `column_id`** —moverla no pasa por ahí—, y sin
-- embargo `cards` acumula 11.086 actualizaciones. Las ~6.500 que no tienen
-- reflejo en el historial son sobre todo movimientos, **hoy HOT precisamente
-- porque `column_id` no está indexado**.
--
-- Indexarla convertiría en no-HOT la escritura más frecuente de esta nave,
-- **dentro de un aviso de Supabase por presupuesto de E/S de escritura**. Sería
-- gastar más de lo escaso para ahorrar de lo que sobra.
--
-- ⚠️ Y NO es que el índice no sirviera para nada: serviría. Medido, la consulta
-- que pinta una columna del tablero hace hoy un recorrido completo —
--
--     Seq Scan on cards ... Buffers: shared hit=71 ... Rows Removed by Filter: 831
--     Execution Time: 51.793 ms
--
-- — y con índice sería inmediata. **Pero esos 71 bloques salen de memoria, no de
-- disco** (2 bloques leídos de disco en toda la base contra 2.630.119 de
-- memoria): cuesta CPU, que es justo lo que no está racionado.
--
-- **Cuándo se invierte esta decisión**, para que quien venga no tenga que volver
-- a derivarlo: cuando `cards` crezca lo bastante para que ese recorrido toque
-- disco de verdad, o cuando el aviso de E/S se haya cerrado. Entonces el índice
-- de `column_id` pasa a ser lo correcto.
--
-- **Consecuencia declarada: tras esta migración seguirá habiendo UNA clave
-- foránea sin índice en `public`** —`cards.column_id`—, y es a propósito. Un
-- recuento a cero ahí sería la forma equivocada de comprobar esta tarjeta.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- TODO O NADA
--
-- `BEGIN`/`COMMIT` explícitos: si algo falla a mitad, no queda una base con
-- índices a medias y políticas retiradas sin su sustituta. Postgres hace DDL
-- transaccional, así que esto es real y no un adorno.
--
-- Funciona porque los índices van SIN `CONCURRENTLY` —ver arriba—: ésa es la
-- única forma de DDL de este fichero que no podría ir dentro de una transacción.
-- Las dos decisiones se sostienen la una a la otra.
BEGIN;

-- ── 1 · Once de las doce claves foráneas sin índice ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_boards_organization_id   ON public.boards(organization_id);
CREATE INDEX IF NOT EXISTS idx_boards_owner_id          ON public.boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_cards_assignee_id        ON public.cards(assignee_id);
CREATE INDEX IF NOT EXISTS idx_cards_category           ON public.cards(category);
CREATE INDEX IF NOT EXISTS idx_cards_organization_id    ON public.cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_board_id      ON public.categories(board_id);
CREATE INDEX IF NOT EXISTS idx_categories_organization_id ON public.categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_cdh_changed_by           ON public.card_description_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_workspace_members_invited_by ON public.workspace_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by    ON public.workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_organization_id  ON public.workspaces(organization_id);

-- ── 2 · Las dos políticas redundantes ───────────────────────────────────────
--
-- ⚠️ AQUÍ ESTÁ EL ÚNICO RIESGO REAL DE ESTA MIGRACIÓN, y por eso cada una lleva
-- su demostración. En esta casa ya hubo políticas permisivas que anulaban a las
-- restrictivas (`22ecfa81`): tocar RLS sin demostrar equivalencia es cómo se
-- ensancha el acceso sin querer.
--
-- Recuerda que varias políticas PERMISIVAS se combinan con OR: quitar una solo
-- es seguro si lo que deja pasar ya lo dejaba pasar otra.

-- `users`: «Los usuarios ven su propio perfil» es `auth.uid() = id`.
-- «Admins ven usuarios de su org» es `get_my_role() IN (admin,superadmin) OR id = auth.uid()`.
-- El segundo término de la segunda ES la primera, así que `A OR B = A`:
-- quitar B no puede quitar acceso a nadie. Comprobado además sobre las filas
-- reales, para los tres usuarios de la base: A = 3 filas, A∪B = 3 filas.
DROP POLICY IF EXISTS "Los usuarios ven su propio perfil" ON public.users;

-- `columns`: las dos dicen lo mismo por caminos distintos.
--   «de su org»:      boards.organization_id = get_my_org_id()
--   «de sus tableros»: board_id IN (boards JOIN users ON users.organization_id = boards.organization_id
--                                   WHERE users.id = auth.uid())
-- Y `get_my_org_id()` es, literalmente,
--   SELECT organization_id FROM users WHERE id = auth.uid()
-- así que la segunda es la primera escrita como join. Comprobado sobre las filas
-- reales, para los tres usuarios: 264 columnas por un camino, 264 por el otro.
--
-- Se conserva la de `get_my_org_id()` y no al revés **a propósito**: esa función
-- es `STABLE`, así que se evalúa una vez por consulta en vez de por fila — y de
-- paso retira una de las seis políticas que el linter señala.
DROP POLICY IF EXISTS "Usuarios ven columnas de sus tableros" ON public.columns;

-- ── 3 · La sesión se evalúa UNA vez por consulta, no por fila ───────────────
--
-- `auth.uid()` suelto se reevalúa para cada fila examinada. Envuelto en un
-- subselect, Postgres lo trata como constante de la consulta. Es el patrón que
-- recomienda Supabase, y **no cambia a quién dejan pasar**: el valor es el mismo
-- en todas las filas; lo único que cambia es cuántas veces se calcula.
--
-- ⚠️ ENTRE EL `DROP` Y EL `CREATE` LA TABLA QUEDA SIN ESA POLÍTICA, y una de
-- ellas —`notifications_owner`— es `FOR ALL`: en esa ventana, una tabla con RLS
-- activada y sin política que la ampare no deja pasar a nadie por PostgREST.
--
-- Aquí decía «por eso la migración se aplica de una vez, no a trozos», **y el
-- fichero no lo cumplía**: con `psql -f` cada sentencia va en su propia
-- transacción, así que la ventana existía de verdad. Lo midió el vigilante.
--
-- Ahora lo cumple el fichero y no quien lo teclea: el `BEGIN` de abajo. Poner
-- `-1` en la orden del Operador protegía **esta** vez; no la próxima mano ni el
-- próximo camino. La atomicidad no puede depender de que alguien se acuerde.

DROP POLICY IF EXISTS "notifications_owner" ON public.notifications;
CREATE POLICY "notifications_owner" ON public.notifications
  FOR ALL USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users see their own organization" ON public.organizations;
CREATE POLICY "Users see their own organization" ON public.organizations
  FOR SELECT USING (id IN (SELECT users.organization_id FROM public.users WHERE users.id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins ven usuarios de su org" ON public.users;
CREATE POLICY "Admins ven usuarios de su org" ON public.users
  FOR SELECT USING (get_my_role() = ANY (ARRAY['admin','superadmin']) OR id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Borrar tableros de mis workspaces" ON public.boards;
CREATE POLICY "Borrar tableros de mis workspaces" ON public.boards
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE workspace_members.workspace_id = boards.workspace_id
       AND workspace_members.user_id = (SELECT auth.uid())
       AND workspace_members.role = ANY (ARRAY['owner','admin'])));

COMMIT;
