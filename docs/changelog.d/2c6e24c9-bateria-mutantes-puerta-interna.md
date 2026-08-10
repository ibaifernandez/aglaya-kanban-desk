Added

- **Batería de mutantes de la puerta interna** (`scripts/puerta-interna.mutation.sh`): destripa `server/routes/internalRoute.js` con las **siete** mutaciones que pasaron en verde contra los PR #13/#14/#15 y exige que la batería de tests se ponga roja en cada una. Tarjeta `2c6e24c9`.
  - Cierra el defecto raíz de aquella medición: un doble de `supabaseAdmin` que no aplica `select`, `eq` ni `neq` convierte cualquier aserción sobre la forma en una tautología sobre sí mismo. Los dobles se arreglaron; nada impedía que volvieran a aflojarse.
  - Corre dentro del job `server-tests` que ya existe — ~10 s y ningún job nuevo, porque GitHub factura por job redondeando al minuto.
  - Verificada por mutación del propio instrumento: aflojando solo la proyección de un doble, la mutación 1 sobrevive y la batería la nombra.
  - Mutación a mano y no herramienta genérica, con la medición al lado: de las siete, un mutador genérico genera una útil, una redundante y no genera cinco.
