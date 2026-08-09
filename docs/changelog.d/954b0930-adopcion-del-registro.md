Added

- **Escribir a mano en `docs/CHANGELOG.md` desde una rama de trabajo se pone
  rojo.** Tarjeta `954b0930`.
  - **El defecto era un verde que no comprobaba nada.** El día que se estrenó el
    registro por fragmentos, `docs/changelog.d/` tenía **cero fragmentos** y la
    propia tarjeta que arregló el choque escribió **34 líneas a mano** en el
    fichero que choca. El guardián decía «0 fragmento(s) — OK»: **no distinguía
    «nadie lo usa» de «todos lo usan bien»**.
  - **Y el coste seguía pagándose por otra ventanilla:** mientras la adopción
    fuera cero, lo único que evitaba el choque era el invariante «no reclama la
    siguiente mientras la anterior siga en ciclo de revisión», que cuesta
    paralelismo — exactamente lo que el mecanismo venía a devolver.
  - **La trampa, resuelta:** fundir al publicar **también** escribe ese fichero,
    así que prohibirlo sin más nacería rojo contra el único camino legítimo. Se
    distingue por lo que acompaña al cambio: es una fusión si el mismo cambio
    **borra** un fragmento —lo único que hace `changelog-fundir.py --aplicar`— y
    es a mano deliberado si el commit lo declara con `[registro-a-mano]`, que
    cuesta un acto explícito y queda en el historial.
  - **El mensaje dice qué hacer en su lugar**, con la ruta del fragmento y su
    formato, no solo que está mal.
  - **Límite declarado:** sin lista de ficheros cambiados la adopción no se puede
    comprobar, y el guardián **lo dice en voz alta** en vez de saltárselo callando
    — un salto silencioso ahí devolvería el mismo defecto que cierra.
