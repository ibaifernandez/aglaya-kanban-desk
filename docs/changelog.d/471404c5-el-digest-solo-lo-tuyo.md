Fixed

- **El digest deja de mandar trabajo que no es de quien lo recibe.** El del 24-ago-2026 encabezaba con «Tienes **79 tareas** urgentes» y el bloque que las traía era `🍀 LEGAL REG TECH · 📒 ARCHIVO`: ninguna suya. Tarjeta `471404c5`.
  - Eran **tres defectos independientes** que se sumaban, y hacen falta los tres arreglos: no filtraba por responsable —`assignee_id` no aparecía en el fichero, nunca lo hizo—, no excluía los tableros de archivo, e incluía vencidas de cualquier prioridad.
  - **Ser miembro de un espacio te traía el trabajo de todos.** Ahora solo entran tarjetas asignadas al destinatario.
  - Los tableros de archivo se reconocen **por regla y no por lista** (`ARCHIVE_BOARD_RE`): un archivo nuevo queda fuera sin que nadie toque el código. Medido contra los tableros vivos, la convención es exacta.
  - **El encabezado del correo deja de decir «o vencidas»**, porque ya no las trae: un texto que promete más de lo que hay manda a buscar algo que no está.
  - **Las dos consecuencias aceptadas tienen prueba propia** —una vencida de prioridad media desaparece, y el digest puede salir vacío— para que nadie las «arregle» de vuelta creyéndolas un descuido.
  - Once casos nuevos y seis mutaciones, seis rojas.
