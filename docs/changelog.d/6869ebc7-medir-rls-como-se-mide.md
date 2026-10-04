Fixed

- **La equivalencia de las políticas RLS estaba comprobada con la RLS apagada.** Lateral de `6869ebc7`, levantado por el vigilante sobre su propia acta y confirmado por mí sobre la mía.
  - Al fundir dos políticas permisivas se publicó «264 columnas por un camino, 264 por el otro, sobre las filas reales». **Esa comparación se corrió con `service_role`, que salta RLS**: compara los dos predicados entre sí —y esa parte se sostiene, cero filas de diferencia con `EXCEPT` en las dos direcciones— pero **el número no es el que ve nadie**.
  - Corriendo de verdad como cada usuario (`SET LOCAL ROLE authenticated` + `request.jwt.claims`): **186, 226 y 254**, no 264 para los tres. El motivo es instructivo: la política de `columns` consulta `boards`, y **la RLS de `boards` también aplica dentro de la política** — la emulación contaba tableros que el usuario no ve.
  - **La conclusión de la fusión no cambia.** Lo que cambia es la frase que la acompañaba, y se corrige con su porqué: *un predicado copiado a mano y corrido como superusuario no es una medición de RLS*.
