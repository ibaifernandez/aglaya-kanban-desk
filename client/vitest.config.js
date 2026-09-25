// vitest.config.js — el corredor de pruebas del CLIENTE. Tarjeta `97307036`.
//
// Va APARTE de `vite.config.js` a propósito: aquel configura el servidor de
// desarrollo y el `build` que se despliega, y una prueba no tiene por qué poder
// tocar eso. Si un día el corredor necesita algo raro, que no sea el mismo
// fichero que decide cómo se construye producción.
//
// Lo mínimo para que una prueba de cliente sea creíble, y nada más:
//   · `jsdom`, que es lo que le da una pantalla a React fuera del navegador;
//   · `globals`, para escribir `describe`/`it` como en la batería del servidor
//     y que quien salte de una a otra no cambie de idioma;
//   · un fichero de arranque que trae las comprobaciones de `jest-dom` y limpia
//     el DOM entre pruebas, para que una prueba no herede la pantalla de la
//     anterior — ese es el falso verde clásico de las pruebas de interfaz.
//
// ⚠️ NO cubre el servidor: su batería sigue siendo `npm test` en la raíz, con
// jest y `testEnvironment: node`. Son dos corredores y es deliberado.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/pruebas/arranque.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // Sin `watch` en CI, y sin cobertura: la tarjeta dice que no se pide
    // cobertura de nada. Un número de cobertura invita a perseguirlo.
    watch: false,
  },
});
