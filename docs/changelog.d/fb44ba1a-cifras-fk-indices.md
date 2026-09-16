Added

- **`cifras.json` publica también claves foráneas e índices, con nombres que se pueden medir.** Tarjeta `fb44ba1a`, sobre el publicador de `c82aa8b9`.
  - **Tres claves nuevas**, del catálogo y en la misma consulta de solo lectura que RLS: `foreign_keys`, `fk_con_accion_al_borrar` e `indices_adicionales`. Las cuatro de antes no cambian de nombre.
  - **Por qué esos nombres:** el portafolio decía «cláusulas ON DELETE» e «índices de rendimiento», y ninguna de las dos cosas está en el catálogo. Un `ON DELETE NO ACTION` escrito se guarda igual que uno omitido, así que lo medible es cuántas claves **hacen algo** al borrar. Y lo medible de los índices es cuáles **no** salen solos de una PK o una restricción UNIQUE/EXCLUDE.
  - **Una sola consulta en un fichero** (`scripts/cifras-catalogo.sql`), leída por el publicador en CI y por `docs/schema/pruebas/cifras-catalogo.sh`, que la mide en Postgres 15 real contra casos conocidos. Por ejemplo: una FK sin `ON DELETE`, otra con `NO ACTION` escrito, índices de PK/UNIQUE/EXCLUDE, una FK que apunta a un índice UNIQUE suelto y ruido en otro esquema.
  - El publicador rechaza recuentos no numéricos y más claves con acción al borrar que claves foráneas. Sello: 14 casos.
