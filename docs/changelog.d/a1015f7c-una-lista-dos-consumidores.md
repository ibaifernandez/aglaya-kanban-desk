Changed

- **El reloj del digest pasa de 24 pasadas diarias a una**, y la hora que un usuario puede guardar se valida contra **esa misma lista**. Tarjeta `a1015f7c`.
  - El dato que faltaba —y que llevaba la pregunta abierta desde que se escribió el workflow— lo ejecutó Ibai y está dentro de la tarjeta: **un solo usuario con digest activo, hora 11 UTC**. 23 de las 24 pasadas no tenían a quién escribir.
  - **No es solo el ahorro, y esa mitad no era opcional:** mientras el servidor aceptara las 24 horas y el reloj visitara una, existía una **hora huérfana** — elegible por el usuario, nunca visitada por el reloj. A quien la tuviera no le llegaba nada **y sin error que leer**.
  - Una lista canónica (`server/constants/digest-hours.js`) con dos consumidores: el `cron` y la validación del servidor. `scripts/digest-horas-guard.sh` se pone rojo si divergen — el YAML no puede importar el JS, así que «la misma lista» no se sostiene sola.
  - **Y el segundo camino, cerrado también:** reactivar el digest con una hora vieja huérfana se rechaza. Validar lo que entra no bastaba, porque hay filas anteriores a la lista.
  - **El precio, dicho:** cambiar tu hora de digest deja de ser un ajuste de interfaz y pasa a ser un cambio en el fichero de constantes, con su commit.
  - Once mutaciones, once rojas — siete del guardián y cuatro de la ruta.
