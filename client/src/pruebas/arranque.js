// arranque.js — lo que toda prueba de cliente necesita antes de correr.
// Tarjeta `97307036`.
//
// Dos cosas, y las dos son contra falsos verdes:
//
//   · `jest-dom` añade las comprobaciones que hablan de la pantalla
//     (`toBeInTheDocument`, `toBeVisible`). Sin ellas se acaba comprobando que
//     una cadena está en el HTML, que es otra cosa: un texto puede estar en el
//     árbol y no verse.
//
//   · `cleanup` desmonta lo que montó la prueba anterior. Sin esto, la segunda
//     prueba encuentra en pantalla lo que dejó la primera y pasa por el motivo
//     equivocado — y peor: sigue pasando cuando el componente ya no pinta nada.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
