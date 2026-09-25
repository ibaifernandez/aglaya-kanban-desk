Fixed

- **El sello de `salida-limpia` no fijaba lo único delicado que tenía: que el aviso llegue antes de morir.** Tarjeta `ee4993fb`, lateral del capataz al auditar `3e2f6a84`.
  - **El código estaba bien; la prueba no lo sostenía.** El `flush` del doble apuntaba su paso **en cuanto lo llamaban** y resolvía en el acto, así que el orden `captura → envío → salir` se cumplía por accidente: **quitar el `await` dejaba los siete casos en verde**, y eso en producción es un proceso que se muere antes de que el aviso salga — el error no llega a Sentry.
  - Ahora el envío del doble **termina más tarde**, y el caso exige que la salida ocurra **después**. Con el mutante del capataz, rojo.
  - **Y el cableado del arranque entra, porque sin él lo demás no vale:** había dos mutantes vivos —quitar la llamada de `index.js`, y pasarle `sentry: null` siempre— que permitían **desenchufar el módulo entero** sin que nada se pusiera rojo. Un manejador perfecto que nadie registra no salva ningún proceso. Un caso lo fija, mirando el fuente a propósito: importar `index.js` levantaría el servidor de verdad, y lo que se vigila es el cableado, no el arranque.
  - Los tres mutantes que sobrevivían caen. Ocho casos.
