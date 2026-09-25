Changed

- **El riel deja de mandar las direcciones de correo al modelo.** Tarjeta `ed8910e2` (parte medible; la declaración de Anthropic como encargado sigue abierta).
  - `list_members` devolvía `user_id`, `name`, **`email`** y `role` de cada persona. Todo lo que devuelve el riel pasa por el modelo, y **la dirección no hace falta para nada de lo que el riel hace**: `assignee` acepta el `user_id`, que esa misma herramienta devuelve.
  - Medido antes de quitarlo: `_resolve_user` acepta correo, nombre o id, y el id es el único de los tres que no es un dato personal.
  - **La prueba no fija «que no exista el campo», sino que la dirección no salga por ninguna parte**: devolverla dentro de `name` sería el mismo dato con otro nombre. Dos mutaciones, dos rojas — reponer el campo, y colar el correo dentro del nombre.
  - Corregidos `CLAUDE.md` y el mensaje de `validation.py`, que mandaban a `list_members` a por direcciones.

- **Y queda escrito por qué Anthropic NO figura como encargado.** Decisión del Operador comunicada por el Delineante: estas sesiones corren bajo **suscripción personal**, así que aplican las *Consumer Terms* — no hay relación encargado-responsable con AGLAYA, ni DPA que registrar, **ni garantías contractuales de AGLAYA sobre ese tratamiento**. Con las dos fuentes citadas y leídas el 25-sep-2026.
  - El apunte dice también **qué sí pasa** por el modelo: el contenido de las tarjetas. Callarlo convertiría el razonamiento en «aquí no pasa nada», que es lo contrario de lo que dice.
  - **Dos hechos con fecha:** el ajuste de entrenamiento **estaba activado y el Operador lo desactivó el 25-sep-2026** (lo anterior ya ocurrió: no se persigue, se dice), y desde ese día el riel no manda correos.
  - **Condición de reapertura escrita junto al apunte:** si estas sesiones pasan a una suscripción de empresa, Anthropic **sí** sería encargado, con DPA y transferencia que declarar.
  - Lo vigila `server/tests/anthropic-no-es-encargado.test.js`: seis casos que exigen el porqué, las fuentes, lo que sí pasa y la condición de reapertura. Borrar la sección entera → 6 rojos; dejar la conclusión sin el porqué, sin la condición o sin lo que sí pasa → rojo cada una.
