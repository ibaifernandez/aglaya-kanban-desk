Changed

- **El riel deja de mandar las direcciones de correo al modelo.** Tarjeta `ed8910e2` (parte medible; la declaración de Anthropic como encargado sigue abierta).
  - `list_members` devolvía `user_id`, `name`, **`email`** y `role` de cada persona. Todo lo que devuelve el riel pasa por el modelo, y **la dirección no hace falta para nada de lo que el riel hace**: `assignee` acepta el `user_id`, que esa misma herramienta devuelve.
  - Medido antes de quitarlo: `_resolve_user` acepta correo, nombre o id, y el id es el único de los tres que no es un dato personal.
  - **La prueba no fija «que no exista el campo», sino que la dirección no salga por ninguna parte**: devolverla dentro de `name` sería el mismo dato con otro nombre. Dos mutaciones, dos rojas — reponer el campo, y colar el correo dentro del nombre.
  - Corregidos `CLAUDE.md` y el mensaje de `validation.py`, que mandaban a `list_members` a por direcciones.
