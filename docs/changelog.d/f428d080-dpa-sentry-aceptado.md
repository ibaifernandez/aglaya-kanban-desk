Fixed

- **El DPA de Sentry pasa a aceptado en el registro de acuerdos: versión 5.1.0, 13-sep-2026.** Tarjeta `f428d080`.
  - **Aceptación electrónica en el panel** de la organización, por el Operador. Se comprueba en *Settings → Legal & Compliance → Data Processing Amendment* («Version 5.1.0 signed Sep 13, 2026»).
  - **No se archiva ningún PDF, y es deliberado:** la página del acuerdo no ofrece descarga, y la prueba de la firma la custodia Sentry en la cuenta. Imprimir la página pública solo guardaría un texto ya publicado, sin prueba de firma. Y, a diferencia de los DPA de Railway y Supabase, **no hay ningún fichero firmado con datos personales** que haya que sacar del repositorio.
  - **La región queda verificada:** Estados Unidos, leído en el panel (*Data Storage Region*). Hasta hoy `subprocessors.md` y el registro la daban como no verificada desde el repositorio.
