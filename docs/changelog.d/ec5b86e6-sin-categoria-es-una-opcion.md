Fixed

- **Abrir y guardar una tarjeta ya no le pone una categoría que nadie eligió.** El
  desplegable solo listaba las categorías existentes —sin opción vacía— y al abrir
  una tarjeta sin categoría el formulario se rellenaba con la primera de la lista.
  Resultado: en un espacio con categorías, **toda tarjeta que se abría y se
  guardaba salía clasificada**, se hubiera tocado ese campo o no, incluidas
  tarjetas viejas abiertas para cambiar otra cosa.

  Ahora el desplegable ofrece **«Sin categoría»**, una tarjeta sin categoría se
  abre así, y una tarjeta nueva nace sin ella salvo que se elija.

  **No era una regresión:** viene de `da7c283` (27-mar-2026), que cambió una
  categoría fija por «la primera que haya» sin hacer el campo opcional. En un
  espacio sin categorías no se notaba, porque no había primera. Tarjeta `ec5b86e6`.

- **Y la otra mitad, que estaba sin medir:** que un `category` vacío se guarde como
  `NULL` y no como cadena vacía. El servidor ya lo hacía, pero nadie lo
  comprobaba — un `category ?? null` «de limpieza» lo habría roto sin dar ningún
  error, dejando una categoría que no es ninguna de las que existen: invisible en
  el desplegable e imposible de filtrar, y sin síntoma en pantalla porque la
  insignia simplemente no se pinta. Ahora tiene prueba, con su contraprueba y la
  distinción entre «no mandarlo» y «mandarlo vacío».

  **Y en los dos caminos, crear y actualizar.** El primer intento midió solo el de
  actualizar, y la misma mutación en crear sobrevivía — donde vive la misma línea
  y donde la tarjeta pide precisamente que una tarjeta nueva nazca sin categoría.
  Lo devolvió el vigilante, con el mismo argumento que yo había usado para añadir
  la primera mitad.

**No se tocan datos.** Las tarjetas que ya recibieron categoría por este camino se
quedan como están: no hay forma de saber cuáles se eligieron y cuáles no, y
adivinarlo sería decidir por el Operador.
