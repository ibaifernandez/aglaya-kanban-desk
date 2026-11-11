Added

- **El orden de las preguntas cuando Supabase avisa del *Disk IO Budget*, escrito
  en [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md).** Han sido tres avisos
  —01-oct, 07-oct y 10-nov-2026—, las tres veces el diagnóstico empezó por las
  tablas y las tres veces las tablas dieron cero. El conocimiento existía y vivía
  en transcripciones de sesión, así que cada alarma lo pagaba entero.

  Cinco pasos, cada uno con **el instrumento nombrado** (`Disk throughput` del
  panel, `heap_blks_read`, `pg_stat_database`, *Memory commitment*, las
  conexiones), y **el camino equivocado dicho por su nombre**: empezar por las
  tablas. Un documento que solo lista lo correcto no evita que alguien repita el
  error.

  Las cifras van **fechadas como referencia, no como estado**, y queda dicho que
  medir esto genera lo que mide: una sesión que consulta el catálogo para
  diagnosticarlo produce ella misma los ficheros temporales que está contando.

  **No lleva guardián ni automatización, a propósito:** es una receta para alguien
  con el panel delante. Tarjeta `9e5215f0`.

Governance

- **Corregido un aviso falso que llevaba la tarjeta:** decía que `docs-guard`
  vigila `docs/ARCHITECTURE.md` y muerde las cifras escritas a mano. **No lo
  vigila**, y está excluido a propósito con el motivo escrito dentro del propio
  guardián —es un registro de decisiones, donde la versión *es* el contenido—.
  El aviso no era inofensivo: el primer borrador de esta sección escribió las
  magnitudes en palabras para esquivar un mordisco que no podía ocurrir, y eso
  dejaba el documento peor que con los números dentro.
