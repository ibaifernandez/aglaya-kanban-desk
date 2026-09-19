Fixed

- **La plantilla DPIA ya no dice que RLS restringe el acceso por espacio de trabajo.** Tarjeta `95221347`, devuelta por el capataz. `DPIA-template.md:54` decía «Acceso restringido por workspace_id (RLS)», la misma frase que se había corregido en `RAT.md:37`. Contradecía la línea 72 del mismo fichero. Ahora dice que el acceso por espacio lo restringe la autorización del servidor, por membresía, y que el servidor salta RLS.
  - Se escapó porque la búsqueda de la primera entrega fue la frase literal «RLS por workspace». La del capataz, más amplia (RLS a menos de 60 caracteres de «workspace/espacio», en ambos sentidos), ya no devuelve ninguna línea que lo afirme.
