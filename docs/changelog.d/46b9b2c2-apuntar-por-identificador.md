Added

- **La puerta externa acepta `workspaceId` y `boardId`**, y apuntar por identificador pasa a ser el camino recomendado. Contrato del riel a **v3.8.0**. Tarjeta `46b9b2c2`.
  - El nombre es comodidad humana; el identificador es lo único que **no cambia cuando alguien renombra** desde la interfaz. Y el emparejamiento por nombre es parcial: medido contra la base real, **7 de 13 espacios casaban con `%AGLAYA%`**.
  - Cerraba **media conversación**: la puerta ya sabía DEVOLVER identificadores —`list-workspaces` y `list-boards`— y quien leía el id correcto no tenía dónde metérselo.
  - **Los nombres siguen funcionando igual.** Si vienen los dos, gana el id: de las dos lecturas, la que no depende de un renombrado es la buena.
  - **Modo de fallo nuevo:** un `boardId` de otro espacio devuelve `400` y no escribe nada. Sin esa guarda, el arreglo habría estrenado un camino nuevo para aterrizar donde no era. Y un identificador mal formado es `400`, no una vuelta silenciosa al nombre.
  - Absorbe la **ambigüedad de tablero** —por este camino no hay ambigüedad que resolver— y deja sin objeto el aviso de que «AGLAYA Kanban Desk» no es un destino válido, que existía solo porque los nombres eran la forma de apuntar.
  - Seis mutaciones, seis rojas.
