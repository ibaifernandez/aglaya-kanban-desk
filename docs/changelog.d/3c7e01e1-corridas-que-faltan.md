Added

- **Un guardián que compara qué workflows DEBERÍAN correr contra cuáles CORRIERON**, en vez de buscar fallos entre los presentes (`scripts/corridas-guard.sh` + `.github/workflows/pr-corridas.yml`). Tarjeta `3c7e01e1`.
  - Cierra el caso que se lee como éxito: **un PR con conflicto de fusión no genera ninguna corrida de Actions**, y «¿hay comprobaciones fallidas?» contesta «ninguna». Es cierto — no falló ninguna **porque no corrió ninguna**.
  - Los dos lados se derivan del árbol y de la API, no se teclean: los disparadores de `.github/workflows/` por un lado, las corridas del SHA de cabeza por otro.
  - **Vive fuera del CI del PR que juzga, y no es preferencia:** si el PR está en conflicto, dentro tampoco correría él. Por reloj diario y a mano. Su **sello sí** corre en cada PR, que es donde se destripa un guardián.
  - Sello de 14 casos y **ocho mutaciones, ocho cazadas**. Una de ellas destapó un defecto real del propio guardián: la derivación podía romperse a mitad y lo ya impreso se tomaba por la lista completa — una expectativa más corta hace que eche de menos menos cosas.
