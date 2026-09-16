-- cifras-catalogo.sql — las cifras de la base que publica `scripts/publicar-cifras.sh`.
-- Tarjetas `c82aa8b9` (RLS), `fb44ba1a` (claves foráneas e índices) y `0ceaecac`
-- (se leen por nombre, no por posición).
--
-- SOLO CATÁLOGO: cero filas de datos. El repositorio es público y la salida
-- también. Lo leen el publicador (en CI) y su prueba en Postgres real
-- (`docs/schema/pruebas/cifras-catalogo.sh`): un solo fichero para que lo
-- medido a mano sea lo mismo que se publica.
--
-- Devuelve UNA FILA POR CIFRA, `clave | valor`. La clave es el nombre exacto en
-- `cifras.json`, y el publicador lee por clave: el ORDEN de las filas no importa.
-- Antes devolvía cinco columnas sin nombre leídas por posición, y cambiar el
-- orden del SELECT publicaba `tablas_rls` y `policies_rls` cambiadas de sitio
-- con la ejecución en verde. Si falta una clave, sobra una o se repite, el
-- publicador no publica.
--
--   tablas_rls               tablas de public con RLS activado
--   policies_rls             RECUENTO de políticas en public (contar no verifica)
--   foreign_keys             restricciones FOREIGN KEY de tablas de public
--   fk_con_accion_al_borrar  de esas, las que hacen algo al borrar: confdeltype
--                            distinto de 'a'. El catálogo guarda igual un
--                            ON DELETE NO ACTION escrito que uno omitido, así que
--                            «cláusulas ON DELETE» NO se puede medir; esto sí.
--   indices_adicionales      índices de tablas de public que NO sostienen una PK ni
--                            una restricción UNIQUE/EXCLUDE. «De rendimiento» no
--                            está en el catálogo; esto sí. OJO: una FK también
--                            rellena conindid (con el índice de la tabla a la que
--                            apunta), por eso se filtra por contype.
SELECT 'tablas_rls' AS clave, (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relrowsecurity) AS valor
UNION ALL
SELECT 'policies_rls', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')
UNION ALL
SELECT 'foreign_keys', (SELECT count(*) FROM pg_constraint co
     JOIN pg_class c ON c.oid = co.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND co.contype = 'f')
UNION ALL
SELECT 'fk_con_accion_al_borrar', (SELECT count(*) FROM pg_constraint co
     JOIN pg_class c ON c.oid = co.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND co.contype = 'f' AND co.confdeltype <> 'a')
UNION ALL
SELECT 'indices_adicionales', (SELECT count(*) FROM pg_index i
     JOIN pg_class t ON t.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relkind IN ('r','p')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint co
                       WHERE co.conindid = i.indexrelid AND co.contype IN ('p','u','x')));
