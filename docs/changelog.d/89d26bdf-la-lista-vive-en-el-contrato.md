Changed

- **`contract-guard` ya vigila `server/routes/cards.js`, y su lista de puertas se muda al contrato.** Tarjeta `89d26bdf`.
  - Ese fichero sirve **tres cláusulas vivas** —el `500` del historial, el `409` de sobrescritura ciega y los campos de `card_history`— y no estaba vigilado: cambiar su forma de respuesta devolvía «ninguna puerta tocada — OK».
  - **No se arregla añadiendo un fichero a la lista.** Era la segunda vez con el mismo guardián: `94e4e219` ya cambió tres rutas tecleadas por derivación de imports, y eso movió el defecto un piso arriba — dejó de envejecer la lista de ficheros y empezó a envejecer la de puntos de partida.
  - La lista vive ahora en `docs/contracts/CONTRACT.md`, en el bloque `contract-guard:puertas`. **Sigue siendo una lista**, y así se declara; lo que cambia es que la mira quien añade una cláusula, no quien venga a tocar el guardián.
  - Si el bloque falta o sale vacío, el guardián sale con `2`: «no he visto ninguna puerta tocada» y «no sé qué es una puerta» se leen igual desde fuera y significan lo contrario.
  - El cierre vigilado pasa de 5 ficheros a 6 — entra `cards.js` y nada más: cero superficie nueva de falso rojo.
  - Sello de 21 a 23 casos; cuatro mutaciones, cuatro rojas.
