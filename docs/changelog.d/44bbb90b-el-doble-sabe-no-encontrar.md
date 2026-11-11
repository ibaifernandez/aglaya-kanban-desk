Fixed

- **El doble de red del banco del riel ya sabe no encontrar nada.** Devolvía un
  recurso para **cualquier** id de tarjeta o de columna, así que los caminos de
  «no existe» —los cortes que impiden asignar sobre una tarjeta ausente— **no se
  podían provocar**. No era deuda de pruebas: era un verde que no muerde en el
  banco que protege el riel por el que entra todo el trabajo de la flota.

  Ahora una tabla declara qué existe y cualquier otro id devuelve `None`, igual
  que la API real contesta 404. Pedir un recurso ausente es pasar un id que no
  esté en esa tabla — sin costuras y sin que cada caso se monte su propia
  sustitución, que era de lo que dependía la cobertura. Tarjeta `44bbb90b`.

- **Corregida una cifra falsa sobre el coste de `assign_card`:** el docstring de
  `_card_workspace` decía «pasa de 1 petición a 3» y son **2 → 4**. Faltaba en la
  lista `GET /workspaces/:id/members`, que es la lectura que el arreglo del 403
  añade. El delta «+2» era correcto, pero el encuadre honesto es **«el doble»**:
  «dos más» suena a margen en una tool que se llama una vez por asignación.
  Contrato **v6.0.1**, sin cambio de forma.

**Lo que no pasó, y se dice porque se esperaba:** la tarjeta avisaba de que
endurecer el doble pondría rojos casos que pasaban apoyándose en que todo existe.
Medido: **ninguno de los 52 cayó**. Ninguno dependía de eso.
