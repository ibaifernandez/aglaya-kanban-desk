Security

- **Sentry recibía el cuerpo de las peticiones, la cookie de sesión y los filtros de las consultas a la base, pese a `sendDefaultPii: false`.** Tarjeta `f428d080`.
  - **Medido provocando un error a propósito**, como pedía la decisión del Operador —«no dar por hecho que la opción hace lo que su nombre dice»—, con un receptor local en lugar de Sentry. Llegaban: el **cuerpo** entero (título y descripción de tarjetas, y cualquier campo sensible que no se llamara literalmente `password`), la **cookie** de refresco, la **query** de la petición, el **User-Agent**, y la **query de las peticiones salientes** — que en esta nave son las consultas a Supabase, con sus filtros. `sendDefaultPii: false` solo quitaba la IP y la cabecera `Authorization`.
  - **Y en las transacciones, además**, la cookie y el User-Agent viajaban como atributos de traza (`http.request.header.*`). En producción las trazas se muestrean al 10 %: **una de cada diez peticiones mandaba su cookie de sesión**. Esto no apareció en la primera medición —por el muestreo— y lo cazó la propia prueba al forzarlo al 100 %.
  - **El recorte se queda con lo mínimo** para saber qué falló y dónde —mensaje, traza, método y ruta sin query— y tira todo lo demás en los tres sitios por donde viajaba: el `request` del evento, las migas de pan y los datos de traza.
  - **Segunda vuelta, tras la revisión del vigilante: la política ya decía «no recibe IP ni User-Agent», y le llegaban por otras tres vías.** Las **líneas de log del servidor** viajaban como migas de pan —la del monitor B-03 lleva `ip=… ua=…`—; y `extra`, `tags` y `user` salían sin recortar, y el monitor B-03 mandaba `extra: { user_agent, ip }`. Ahora: migas de consola **desactivadas y filtradas** (dos capas: cada una sobrevive sola a la mutación porque la otra la cubre, y quitar las dos da rojo); `extra` y `tags` por **lista blanca**, que falla cerrada; `user` fuera; y el monitor deja de mandar IP y agente en origen. **Ocho mutaciones más**, seis rojas y las dos capas dobles declaradas.
  - **La prueba provoca el error de verdad, en un proceso de node aparte**: bajo jest, Sentry no instrumenta las peticiones salientes, y el caso de su query pasaba con el recorte quitado — medido por mutación antes de moverlo. Y con el muestreo al 100 %, porque al 10 % el recorte de transacciones pasaba sin ejercitarse. **Nueve mutaciones rojas**, estable en cinco corridas seguidas.

Fixed

- **Sentry llevaba activo desde mayo de 2026 y ningún registro legal lo declaraba; tres documentos lo negaban.** La política publicada lo anunciaba como «futuro» y prometía actualizarse **antes** de activarlo; el documento de medidas del Art. 32 y el procedimiento de brecha decían «sin Sentry, ceguera operativa».
  - **Se declara después de recortar, no antes**, como fijó la decisión: declarar primero habría obligado a declarar dos veces, y a declarar datos que no hacía falta mandar.
  - La política pasa a la **versión 1.4** y lo incluye como encargado, con **lo que recibe y lo que no**. `subprocessors.md` y `DPA-registry.md` lo registran. `TOMs.md` y `breach-notification-procedure.md` dejan de negarlo — y el procedimiento de brecha añade lo que Sentry **no** es: señal de fallo, no de acceso indebido.
  - **Residuo declarado:** el **mensaje** de una excepción lo escribe quien la lanza y podría arrastrar un fragmento de dato. Queda el saneo por patrón como segunda capa.

Known

- **El acuerdo de tratamiento (DPA) de Sentry no está archivado.** Aceptarlo o descargarlo desde el panel de la organización es un acto sobre la cuenta del Operador. Hasta que se haga, **la condición de cierre de la tarjeta no se cumple entera**, y `DPA-registry.md` lo dice en su fila.
- **La región de Sentry no se ha verificado desde el repositorio.** Se declara Estados Unidos, que es lo que registró la auditoría de mayo; la región real la fija el DSN configurado en Railway, y leerlo supondría volcar sus variables secretas.
