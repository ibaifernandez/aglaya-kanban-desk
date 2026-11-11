Governance

- **El tercer límite de la regla de conteos de `docs-guard` queda declarado donde
  se lee.** Un conteo cuyo número cae entre 1900 y 2099 seguido de una palabra
  genérica —«2048 tablas con RLS»— **no muerde**, y hasta ahora eso no estaba
  escrito en ninguna parte. Sus otros dos límites conocidos sí lo estaban, bajo
  una frase que dice para qué: *«dicho para que nadie lo descubra creyendo que
  falla»*.

  **No está roto: está decidido.** No tiene solución por forma —entre `2026
  tablas` y `2026 dos` no hay señal estructural que los separe— y distinguirlos
  exigiría un catálogo de sustantivos, que la cabecera de esa misma regla rechaza
  con su motivo. Queda escrito también qué **sí** sigue cazándose: la forma
  explícita (`2000 tests en verde`) y los conteos fuera del rango (`412 tablas`).

  Solo comentario: no se toca ninguna regla ni ningún sello. Tarjeta `e937f22f`.

  **Lo que nada sostiene:** las tres afirmaciones de ese comentario están medidas
  el 11-nov-2026, pero **ningún sello las vigila** — es un comentario, y si la
  regla cambia podrá quedarse diciendo lo que ya no es cierto. Pedir que lo
  vigilara un caso significaría fijar en prueba el propio hueco, que es lo
  contrario de lo que esta casa quiere.
