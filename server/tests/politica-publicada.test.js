/**
 * La política publicada no promete lo que no existe.
 *
 * Tarjeta `ff792a8b`. Hallazgo del capataz auditando `6d2801b5`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ DEFECTO CIERRA, Y POR QUÉ NO ES UN DOCUMENTO CUALQUIERA
 *
 * `https://kanban.aglaya.biz/privacidad` es **pública** y es el documento con el
 * que un interesado ejerce sus derechos. El 25-ago-2026 declaraba:
 *
 *   · un `toggle` de preferencias para dejar de recibir resúmenes — **un botón
 *     que ya no existe**;
 *   · «retirar consentimiento: toggle directo, efecto inmediato» — **un
 *     mecanismo de retirada que ya no existe**;
 *   · `digest_logs` como dato tratado con 12 meses de retención — **una tabla
 *     suprimida**;
 *   · **Resend Inc.** como encargado con transferencia a EE. UU. — **un flujo de
 *     datos que ya no ocurre**.
 *
 * La dirección del error era la benigna —declaraba de más, no de menos— pero
 * declarar de más en un registro de encargados es **afirmar un flujo de datos
 * que no existe**, y prometer un botón que no se puede pulsar es peor: alguien
 * puede ir a buscarlo.
 *
 * ⚠️ POR QUÉ NO SE PROHÍBE LA PALABRA «digest» NI «Resend». Los tratamientos
 * cesados **se declaran, no se borran**: hubo datos tratados de verdad entre
 * mayo y agosto de 2026, y un registro que borra su pasado no puede responder
 * qué se hizo con los datos de alguien entonces. Un guardián que mordiera la
 * palabra obligaría a borrar esa constancia para pasar.
 *
 * Lo que se prohíbe es **la promesa en presente**: las frases exactas que
 * ofrecían un control o declaraban un encargado vivo.
 *
 * LO QUE ESTO NO COMPRUEBA: que lo publicado en producción sea este fichero. Eso
 * lo decide el despliegue de Netlify, y se mira pidiendo la página.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const HTML = path.join(RAIZ, 'client', 'public', 'privacidad.html');
const MD = path.join(RAIZ, 'docs', 'legal', 'privacy-policy-kanban.md');

const leer = (p) => fs.readFileSync(p, 'utf8');

// Las promesas retiradas, en las dos formas en que estaban escritas. Cada una
// ofrecía algo que hoy no se puede cumplir.
const PROMESAS_MUERTAS = [
  { que: 'el toggle para deshabilitar los resúmenes', re: /Toggle\s*(<code>)?`?digest_enabled`?/i },
  { que: 'la retirada de consentimiento por toggle', re: /toggle directo en preferencias/i },
  { que: 'preferencias de digest como dato recogido', re: /Preferencias de digest/i },
  { que: 'digest_logs como dato tratado hoy', re: /Logs de envío de email/i },
];

describe('la política publicada (HTML) no ofrece lo que no existe', () => {
  const html = leer(HTML);

  it.each(PROMESAS_MUERTAS)('ya no promete $que', ({ re }) => {
    expect(html).not.toMatch(re);
  });

  // Resend puede aparecer — como CESADO. Lo que no puede es seguir en la tabla
  // de encargados vivos, que es la que se lee para saber por dónde pasan los
  // datos hoy.
  it('Resend no figura como encargado en activo', () => {
    const tabla = html.slice(
      html.indexOf('4. Encargados del Tratamiento'),
      html.indexOf('Encargado cesado'),
    );
    expect(tabla).not.toMatch(/Resend/);
  });

  it('pero SÍ queda declarado como cesado, con su fecha', () => {
    expect(html).toMatch(/Encargado cesado — Resend Inc\./);
    expect(html).toMatch(/25-ago-2026/);
  });

  // La retención anunciada era de 12 meses y los datos se destruyeron antes. Si
  // esto desapareciera, la política dejaría una promesa de conservación sin
  // cerrar sobre datos que ya no existen.
  it('dice qué pasó con los datos que anunciaba conservar 12 meses', () => {
    expect(html).toMatch(/Suprimidos el 25-ago-2026/);
  });

  // La sección 12 prometía avisar por email de los cambios. La aplicación ya no
  // puede mandar correo: era la misma clase de promesa imposible.
  it('no promete avisar de los cambios por un correo que la nave no puede enviar', () => {
    expect(html).not.toMatch(/Email a usuarios con cuenta activa/);
  });
});

describe('el HTML publicado y el markdown fuente no se separan', () => {
  // El HTML se genera A MANO (`docs/operator-checklist.md`), así que nada impide
  // que uno se actualice y el otro no. Y el que la gente lee es el HTML.
  const version = (t) => (t.match(/Versión:?<\/strong>\s*([0-9]+\.[0-9]+)/) || t.match(/\*\*Versión:\*\*\s*([0-9]+\.[0-9]+)/) || [])[1];
  const fecha = (t) => (t.match(/Última actualización:<\/strong>\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/) || t.match(/\*\*Última actualización:\*\*\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/) || [])[1];

  it('declaran la MISMA versión', () => {
    const v = version(leer(HTML));
    expect(v).toBeDefined();
    expect(v).toBe(version(leer(MD)));
  });

  it('declaran la MISMA fecha', () => {
    const d = fecha(leer(HTML));
    expect(d).toBeDefined();
    expect(d).toBe(fecha(leer(MD)));
  });

  // La propia política fija su procedimiento: un cambio sustancial se refleja
  // subiendo versión y fecha. Quedarse en 1.0 después de retirar un tratamiento
  // entero es incumplir el procedimiento que el propio documento declara.
  it('el documento ya no se declara en la versión que describía el correo', () => {
    expect(version(leer(HTML))).not.toBe('1.0');
  });
});

describe('el markdown fuente dice lo mismo que el HTML', () => {
  const md = leer(MD);

  it.each(PROMESAS_MUERTAS)('tampoco promete $que', ({ re }) => {
    expect(md).not.toMatch(re);
  });

  it('y explica el cambio en su historial de versiones', () => {
    expect(md).toMatch(/## Historial de versiones/);
    expect(md).toMatch(/1\.1 — 2026-08-25/);
  });
});
