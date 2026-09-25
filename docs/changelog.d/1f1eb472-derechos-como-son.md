Fixed

- **La política publicada prometía dos botones que no existen.** Tarjeta `1f1eb472`, hallazgo C-20 de la auditoría del 24-sep-2026. **Política 1.5 → 1.6.**
  - Decía que la portabilidad (Art. 20) y la supresión de la cuenta (Art. 17) tenían «UI disponible en tu perfil». **No la hay:** no existe ninguna llamada a `GET /api/auth/me/export` ni a `DELETE /api/auth/me` en todo el cliente. Las dos rutas del servidor sí existen; lo falso era **cómo se llega a ellas**, que es exactamente lo que necesita saber quien viene a ejercer un derecho.
  - Las dos pasan a «derechos vía contacto directo», con la dirección y el asunto exactos, y diciendo que el botón no existe. **No se recorta ningún derecho:** se ejercen por escrito y se atienden con las mismas rutas.
  - **Se corrige el texto en vez de construir los botones**, y es una elección con motivo: la promesa falsa está publicada hoy, y el entorno para probar interfaz todavía está en revisión (`97307036`). Construir a ciegas una pantalla que ejerce derechos sería peor que decir la verdad ya.
  - **Lo vigila una prueba que deriva de las dos fuentes**, no una lista de frases: si el cliente no llama a esas rutas, la política no puede decir «UI disponible»; y tiene que seguir diciendo cómo se ejerce. Si algún día existen los botones, la promesa podrá volver sin tocar la prueba. Tres mutaciones, tres rojas.
