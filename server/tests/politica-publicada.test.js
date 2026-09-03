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

// ── El recorte de la tabla de retención, y por qué existe ─────────────────────
//
// La frase «No queda copia» aparece HOY, legítimamente, en el historial de
// versiones de los dos documentos: la v1.2 **cita a la v1.1 para desmentirla**.
// Una prohibición sobre el fichero entero mordería esa retractación y obligaría
// a borrarla para pasar — o sea, a perder la constancia de que la frase existió.
//
// Lo que se prohíbe es la AFIRMACIÓN, y una afirmación vive en la tabla que
// responde a «¿cuánto conserváis mis datos?». Por eso se recorta esa tabla.
function tablaDeRetencion(texto, ruta) {
  const esHtml = ruta.endsWith('.html');
  const inicio = esHtml ? texto.indexOf('6. Plazos de Conservación') : texto.indexOf('| Categoría | Plazo |');
  const fin = esHtml ? texto.indexOf('7. Tus Derechos') : texto.indexOf('## 7.');

  // Si el documento se reorganiza y estas anclas dejan de existir, esto NO puede
  // devolver cadena vacía y pasar por «no hay frase falsa»: no medir no es verde.
  if (inicio < 0 || fin < 0 || fin <= inicio) {
    throw new Error(
      `politica-publicada: no encuentro la tabla de retención en ${path.basename(ruta)}. ` +
      'Si la sección se renombró, hay que actualizar este recorte — no dar por bueno el silencio.',
    );
  }
  return texto.slice(inicio, fin);
}


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
    expect(html).toMatch(/Suprimidos de la base el 25-ago-2026/);
  });

  // ⚠️ EL CASO DE LA v1.2, y es el más caro de los de este fichero.
  //
  // La v1.1 escribió «No queda copia» en la fila de la supresión, y **el propio
  // documento la desmentía dos filas más abajo**: las copias diarias vuelcan la
  // base ENTERA y se guardan 30 días. A quien ejerce el Art. 17 se le estaba
  // diciendo que su dato no existe en ninguna parte, cuando existía con fecha de
  // caducidad conocida — la afirmación que lleva a alguien a dejar de preguntar.
  //
  // Se exige la forma HONESTA —hasta cuándo persiste—, no la ausencia de la
  // palabra: las copias son una excepción legítima y lo correcto es declararlas.
  it('la fila de los datos suprimidos dice hasta cuándo persisten en copias', () => {
    // ⚠️ La celda EXACTA, no «los 400 caracteres siguientes». Comprobado por
    // mutación: con una ventana ancha, quitar la fecha de la celda seguía en
    // verde porque «rotación» aparecía en la fila de backups, dos más abajo — la
    // prueba estaba leyendo el desmentido como si fuera la corrección.
    const inicio = html.indexOf('Suprimidos de la base');
    const celda = html.slice(inicio, html.indexOf('</td>', inicio));

    expect(celda).toMatch(/Persisten en las copias de seguridad operacionales/);

    // Y el hasta-cuándo tiene que ir DESPUÉS de «Persisten», no en cualquier
    // parte de la celda. Segunda mutación superviviente del mismo caso: quitar
    // «hasta su rotación (~24-sep-2026)» seguía verde porque la celda conserva
    // la fecha de la SUPRESIÓN, que es otra cosa. Una fecha cerca no es la
    // fecha que se pide.
    const persistencia = celda.slice(celda.indexOf('Persisten'));
    expect(persistencia).toMatch(/\d{1,2}-[a-z]{3}-\d{4}|\d+\s*días/);
  });

  // ⚠️ ESTE es el caso que faltaba, y su ausencia era el defecto de la tarjeta
  // `16b8063a`: la prohibición de la frase falsa vivía SOLO sobre el markdown.
  //
  // El HTML se genera A MANO, así que alguien puede reintroducirla al regenerar
  // la página sin tocar el `.md` — y versión y fecha seguirían cuadrando, porque
  // eso sí se comparaba. **El guardián sabía cuál era el fichero que la gente
  // lee, lo decía en su propio comentario, y vigilaba el otro.**
  it('no afirma en la tabla de retención que no quede copia', () => {
    expect(tablaDeRetencion(html, HTML)).not.toMatch(/No queda copia/);
  });

  // Y la contraparte, que es la que impide «arreglarlo» borrando historia: la
  // retractación de la v1.2 CITA la frase, y tiene que poder seguir citándola.
  it('pero el historial sí puede citar la frase para desmentirla', () => {
    // ⚠️ Tolerante al salto de línea. El HTML se REGENERA a mano desde el
    // markdown, y una regeneración reajusta dónde parten las líneas: el
    // 03-sep-2026 la cita quedó como «No\nqueda copia» y esto se puso rojo con
    // el contenido intacto. Un guardián que muerde el reajuste de un párrafo
    // enseña a ignorarlo — y el que lo vea rojo pensará que perdió la cita.
    expect(html).toMatch(/«No\s+queda\s+copia»/);
  });

  // Y el mismo aviso donde de verdad lo va a buscar alguien: en su derecho.
  it('el derecho de supresión avisa de que no alcanza a las copias ya creadas', () => {
    const fila = html.slice(html.indexOf('DELETE /api/auth/me'), html.indexOf('DELETE /api/auth/me') + 500);
    expect(fila).toMatch(/no alcanza retroactivamente a las copias/);
    expect(fila).toMatch(/30 días/);
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
    // La 1.2 corrige a la 1.1. Que la entrada siga aquí es la constancia de que
    // aquella frase existió y de por qué era falsa: borrarla dejaría el
    // documento correcto y la lección perdida.
    expect(md).toMatch(/1\.2 — 2026-08-26/);
  });

  it('tampoco afirma en la tabla de retención que no quede copia', () => {
    expect(tablaDeRetencion(md, MD)).not.toMatch(/No queda copia/);
  });
});
