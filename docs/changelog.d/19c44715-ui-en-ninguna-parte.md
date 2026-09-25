Fixed

- **La prueba de la política ya no deja colar «UI disponible» en una fila que no nombre el derecho.** Tarjeta `19c44715`, hallazgo del vigilante al revisar `1f1eb472`.
  - El caso troceaba la sección 7 por filas y miraba las de portabilidad y supresión. **Una fila-nota** —«los dos derechos anteriores tienen UI disponible en tu perfil»— **pasaba en verde**, porque ese trozo no nombra ninguno de los dos.
  - **Regla que queda escrita: lo positivo, por fila; lo prohibido, por sección.** Exigir que cada fila diga cómo se ejerce su derecho necesita trocear; prohibir una frase, no — y trocear para prohibir es lo que abrió el agujero.
  - **La prohibición se acota a la sección 7 a propósito:** la entrada 1.6 del historial **cita** la frase para desmentirla, y esa cita es lo que conserva la lección. Aplicarla al documento entero se la comería — mutación comprobada, roja.
  - Medido: la fila-nota en el HTML → rojo; la línea equivalente en el markdown → rojo. Antes, las dos pasaban 35/35.
  - **Nada estaba mal hoy:** la política publicada sirve la 1.6 y la frase solo aparece en el historial. Esto cierra la vía, no un defecto vivo. Se abre porque esta familia ya ha mordido tres veces en el documento público.
