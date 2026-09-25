// anthropic-no-es-encargado.test.js — el apunte razonado no se puede borrar en
// silencio, y no se puede convertir en una declaración a medias. Tarjeta `ed8910e2`.
//
// POR QUÉ ESTO ES UNA PRUEBA Y NO UNA NOTA. Lo que sostiene que Anthropic no
// figure como encargado es **un razonamiento con fecha y fuente**, no un hecho
// del código. Si alguien lo borra —o si lo deja a medias, declarando que no es
// encargado sin decir por qué ni bajo qué condiciones cambia—, el registro pasa
// a tener un hueco que parece una omisión. Esta familia ya mordió con Sentry
// (`f428d080`): un tratamiento real que ningún registro recogía.
//
// LO QUE NO PUEDE HACER: comprobar que el razonamiento sea correcto, ni que la
// suscripción siga siendo personal. Eso lo sabe el Operador, y por eso la
// condición de reapertura está escrita junto al apunte.
'use strict';

const fs = require('fs');
const path = require('path');

const SUBPROCESADORES = path.join(__dirname, '..', '..', 'docs', 'legal', 'subprocessors.md');
const texto = fs.readFileSync(SUBPROCESADORES, 'utf8');
// En UNA línea: el markdown parte las frases donde cabe, y un patrón que mire
// renglón a renglón deja pasar justo la frase que le importa. Ya me pasó con el
// guardián de «se le puede preguntar a la base»; esta vez viene de fábrica.
const seccion = texto.slice(texto.indexOf('## Anthropic')).replace(/\s+/g, ' ');

describe('el registro explica por qué Anthropic no figura como encargado', () => {
  it('la sección existe y dice que NO figura', () => {
    expect(texto).toMatch(/## Anthropic: por qué NO figura como encargado/);
  });

  it('dice bajo qué condiciones lo dice: suscripción personal, no contrato de AGLAYA', () => {
    expect(seccion).toMatch(/suscripci[óo]n personal del Operador/i);
    expect(seccion).toMatch(/Consumer Terms/);
  });

  it('cita las dos fuentes, para que otro pueda comprobarlo sin fiarse', () => {
    expect(seccion).toMatch(/anthropic\.com\/legal\/commercial-terms/);
    expect(seccion).toMatch(/anthropic\.com\/legal\/consumer-terms/);
  });

  // Sin esto, el apunte se leería como «aquí no pasa nada», que es lo contrario
  // de lo que dice: pasa contenido de tarjetas, y sin garantías contractuales.
  it('dice qué SÍ pasa por el modelo, no solo lo que no se declara', () => {
    expect(seccion).toMatch(/contenido de las tarjetas/i);
    expect(seccion).toMatch(/tampoco hay garant[íi]as contractuales/i);
  });

  it('y lleva los dos hechos con fecha: el entrenamiento y los correos', () => {
    expect(seccion).toMatch(/desactiv[óo] el\s*\n?\s*25-sep-2026/);
    expect(seccion).toMatch(/no manda direcciones de correo/i);
  });

  // La parte que convierte una decisión en algo revisable.
  it('y la condición de reapertura, que es lo que impide que envejezca', () => {
    expect(seccion).toMatch(/Condici[óo]n de reapertura/i);
    expect(seccion).toMatch(/suscripci[óo]n de empresa/i);
    expect(seccion).toMatch(/DPA-registry\.md/);
  });
});
