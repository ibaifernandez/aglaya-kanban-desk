Security

- **`email-guard` seguía autorizando el gmail personal del Operador, que ya no aparecía en ningún fichero.** Tarjeta `dc93d7f3`.
  - La declaración decía «en `docs/INCIDENTS.md`… suya y publicada por él». Esa aparición se redactó en `9dbfbd0d`, así que la declaración **se había quedado huérfana**: no protegía nada, y **dejaba pasar esa dirección en verde** si alguien la volvía a escribir. Su motivo contradecía además la decisión del Operador del 12-sep.
  - **Retirada.** Medido: esa dirección en un fichero nuevo del índice pone `email-guard` en **exit 1**; con la declaración repuesta, **exit 0**.
  - **Y una prueba que impide que se repita, sin nombrar la huella de nadie:** cada declaración `sha256` tiene que tener al menos una dirección en el árbol que la use. Fijar «esta huella concreta no puede volver» habría obligado a copiar la huella del correo personal del Operador a un fichero nuevo de un repositorio público. Medido antes de escribirla: era **la única huérfana**, así que la prueba nace en verde. **Dos mutaciones rojas.** No cubre las declaraciones por dominio, y lo dice.
