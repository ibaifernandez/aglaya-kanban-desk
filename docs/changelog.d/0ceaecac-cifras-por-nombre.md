Fixed

- **Las cifras del catálogo se leen por nombre: reordenar la consulta ya no puede publicar una cifra en la clave de otra.** Tarjeta `0ceaecac`.
  - **El defecto:** `scripts/cifras-catalogo.sql` devolvía cinco columnas sin nombre y el publicador las asignaba por posición. Intercambiar las dos primeras publicaba `tablas_rls = 32` y `policies_rls = 10` con la ejecución en verde, porque ni el sello (que entra por las costuras) ni la prueba en Postgres (que mide la SQL) miraban el mapeo.
  - **El arreglo quita el orden del medio, no lo vigila:** la SQL devuelve una fila `clave|valor` por cifra, con la clave exacta de `cifras.json`, y el publicador lee por clave. Una clave que falta, sobra o se repite, no se publica.
  - **Medido:** publicar de punta a punta contra Postgres 15 con la SQL original, con las filas 1↔2 y 3↔4 intercambiadas y en orden inverso da un `cifras.json` **idéntico**. El sello pasa por la ruta real de lectura con un `psql` falso en el PATH: 18 casos, entre ellos filas desordenadas, una clave que falta, otra repetida y otra desconocida.
