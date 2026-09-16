-- cifras-catalogo.sql — las cifras de la base que publica `scripts/publicar-cifras.sh`.
-- Tarjetas `c82aa8b9` (RLS) y `fb44ba1a` (claves foráneas e índices).
--
-- SOLO CATÁLOGO: cero filas de datos. El repositorio es público y la salida
-- también. Lo leen el publicador (en CI) y su prueba en Postgres real
-- (`docs/schema/pruebas/cifras-catalogo.sh`): un solo fichero para que lo
-- medido a mano sea lo mismo que se publica.
--
-- Devuelve UNA fila, cinco columnas, en este orden:
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
SELECT
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relrowsecurity),
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'),
  (SELECT count(*) FROM pg_constraint co
     JOIN pg_class c ON c.oid = co.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND co.contype = 'f'),
  (SELECT count(*) FROM pg_constraint co
     JOIN pg_class c ON c.oid = co.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND co.contype = 'f' AND co.confdeltype <> 'a'),
  (SELECT count(*) FROM pg_index i
     JOIN pg_class t ON t.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relkind IN ('r','p')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint co
                       WHERE co.conindid = i.indexrelid AND co.contype IN ('p','u','x')));
