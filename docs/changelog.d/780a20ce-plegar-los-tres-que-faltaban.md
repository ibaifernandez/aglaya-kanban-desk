Changed

- **`docs-guard`, `schema-guard` y el alcance del riel se pliegan dentro de `comprobaciones-baratas`.** Eran tres workflows sueltos que pagaban su propio corredor, su propio arranque y su propio `checkout` por unos segundos de trabajo — lo mismo que este repo ya había dejado de hacer con los otros cinco. Tarjeta `780a20ce`.
  - `docs-guard.yml` y `schema-guard.yml` **dejan de existir como ficheros**. `rail-scope.yml` sobrevive **solo con su reloj**: un espacio creado un martes sin que nadie toque el repo queda invisible para toda la flota hasta el siguiente commit, y eso `ci.yml` no lo puede hacer.
  - **La compuerta de relevancia baja del YAML al propio paso**, y no es estilo: como `if:` dejaba el paso en `skipped`, y en este job `skipped` es rojo a propósito. Ahora el paso corre siempre y decide dentro, así que el invariante «una comprobación que se salta sola es indistinguible de una que pasó» sigue en pie sin excepciones.
  - **Los sellos pierden su compuerta**: cuestan menos de un segundo y un guardián destripado no puede depender de que ese día hubiera algo que mirar. La única que conserva compuerta es la mutación de `docs-guard`, por sus 23 s medidos.
  - Las tres compuertas apuntaban al workflow donde vivían para preguntarse «¿cambió mi propio guardián?». Ahora apuntan a `ci.yml`: un patrón que no puede casar nunca es lógica muerta que además tranquiliza.
  - Cada comprobación conserva su nombre, su orden sello→guardián y su propia línea en el verdicto: **25 pasos pueden fallar y el verdicto juzga exactamente esos 25**.
