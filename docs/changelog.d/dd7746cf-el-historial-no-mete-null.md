Fixed

- **Guardar una tarjeta volvía a fallar si la edición tocaba la descripción y otro
  campo a la vez.** El `PUT` manda un solo lote de filas de historial, y solo la de
  `description` llevaba `es_sufijo`. En un `insert` de varias filas PostgREST **une
  las claves y rellena con NULL las que falten, no con el DEFAULT**, así que la
  columna `NOT NULL` tumbaba el lote entero y con él la edición. Pasaba desde la UI
  y desde el riel.

  La compuerta hizo bien su trabajo —no sobrescribir sin guardar antes la versión
  anterior—, así que no se perdió ninguna tarjeta: se perdieron las ediciones.
  Tarjeta `dd7746cf`, contrato **v6.0.2**.

  **Lo que impide que vuelva** no es rellenar esa columna, sino que las dos clases
  de fila lleven **las mismas claves**: así no hay hueco que rellenar con NULL,
  tampoco el día que se añada otra columna `NOT NULL` a esa tabla. Tiene caso
  propio, y salió de un mutante que sobrevivía.

Governance

- **Una prueba que ya existía fijaba el defecto en su sitio.** Exigía que
  `es_sufijo` estuviera **ausente** en las filas que no son de descripción — que es
  exactamente la ausencia que PostgREST convierte en NULL. Su intención era
  correcta y sigue estando: un campo que no es la descripción no se encadena nunca.
  Lo que estaba mal era medirla por **la ausencia de la clave**, un detalle de
  implementación, en vez de por su valor. Ahora exige `es_sufijo === false`.

  Queda apuntado porque es la clase de caso que no se detecta sola: estaba en
  verde, afirmaba algo cierto, y ataba la única forma de decirlo que no funciona.
