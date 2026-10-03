Fixed

- **`contract-guard` ya no deja que el contrato se contradiga a sí mismo.** Tarjeta `6b1655ae`.
  - El 2-oct el contrato llevaba `Versión: 4.0.0` y `Última modificación: 2026-09-25` en la cabecera mientras su propio historial declaraba otra cosa. **El guardián estuvo verde todo el rato, y con razón:** comprobaba que alguien **tocara** el documento al tocar una puerta, no que lo dejara coherente — su propio texto lo dice. Lo cazó el vigilante comparando dos cabezas a mano, que es justo la red que ese guardián existe para no necesitar.
  - **No es cosmético: el capitán sirve ese fichero EN VIVO.** `contrato(…)` entregaba las dos cifras a la vez, y una nave que construya contra la que no manda hace trabajo que hay que rehacer.
  - Ahora compara **versión y fecha**, y corre **siempre**, se haya tocado una puerta o no: una cabecera que miente no deja de mentir los días que nadie toca el código. La fecha importa aparte de la versión porque **el día del incidente la versión coincidía y lo que mentía era la fecha** — un mutante que compare solo la versión deja pasar el caso real, y el sello lo caza.
  - **Estrena verde:** la desalineación que había en `main` se corrige en este mismo cambio. Un guardián que nace rojo enseña a ignorarlo.
  - Sello: **28 casos**, con los cuatro nuevos en las dos direcciones —coherente calla, fecha desalineada muerde, versión desalineada muerde y enseña las dos, y muerde aunque el cambio no toque ninguna puerta— más uno que cierra la salida fácil: **borrar la cabecera no lo silencia**. Tres mutantes, tres rojos.
  - ⚠️ **Lo que sigue sin hacer, a propósito:** no juzga si la versión es la correcta ni si el cambio merecía subirla. Eso es criterio humano, y pedírselo convertiría una comprobación de dos campos en una promesa incumplible.
