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

  // ⚠️ LOS CASOS DE LA v1.4 (tarjeta `f428d080`). Hasta el 13-sep-2026 esta
  // política decía «Sentry (futuro)» y prometía actualizarse ANTES de activarlo.
  // Llevaba activo desde mayo. Una política que dice que un encargado no existe
  // mientras recibe datos es el mismo defecto que declarar uno que ya no está —
  // en la dirección peligrosa.
  it('Sentry figura en la tabla de encargados en activo', () => {
    const tabla = html.slice(
      html.indexOf('4. Encargados del Tratamiento'),
      html.indexOf('Encargado cesado'),
    );
    expect(tabla).toMatch(/Functional Software, Inc\. \(Sentry\)/);
    // Y declara lo que NO recibe: es la mitad que el recorte hace cierta, y la
    // que alguien leerá para saber si su cuerpo de petición sale del servidor.
    expect(tabla).toMatch(/No<\/strong> recibe el cuerpo de la petición, cabeceras, cookies/);
  });

  it('y ya no se anuncia como «futuro»', () => {
    expect(html).not.toMatch(/Sentry \(futuro\)/);
    expect(html).not.toMatch(/si se activa la observabilidad técnica con Sentry/);
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
  // El HTML se versiona aparte del markdown —aunque lo genere
  // `client/scripts/build-legal-pages.cjs`—, así que alguien puede reintroducirla
  // en uno sin tocar el otro — y versión y fecha seguirían cuadrando, porque
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

  // ⚠️ LOS CASOS DE LA v1.3 (tarjeta `0779da47`), y son la misma clase de defecto
  // que el botón que ya no existía: una promesa al titular sin mecanismo detrás.
  //
  // Hasta el 13-sep-2026 la tabla anunciaba «cards archivadas: 24 meses
  // post-archive, después hard-delete automático» y «notificaciones leídas: 90
  // días». **Ninguna de las dos ocurrió nunca**: no existe el archivado de cards,
  // no existe tarea periódica en el servidor, y ningún workflow borra nada salvo
  // las copias de seguridad. El reglamento no pide plazos: pide poder demostrar
  // que se cumplen.
  //
  // Se prohíbe DENTRO DE LA TABLA, no en el documento: el historial de la v1.3
  // cita las dos frases para desmentirlas, y tiene que poder seguir citándolas.
  it.each([
    ['el borrado automático de cards archivadas', /hard-delete autom[aá]tico/i],
    ['el plazo de 24 meses de cards archivadas', /24 meses post-archive/i],
    ['la supresión de notificaciones leídas a 90 días', /Notificaciones leídas<\/td>\s*<td>90 días/i],
  ])('la tabla de retención ya no promete %s', (_, re) => {
    expect(tablaDeRetencion(html, HTML)).not.toMatch(re);
  });

  // Y la afirmación positiva, que es la que impide «arreglarlo» borrando la fila
  // sin decir nada: el titular tiene que leer que la supresión es a petición.
  it('y dice que la supresión es a petición, no automática', () => {
    expect(tablaDeRetencion(html, HTML)).toMatch(/La supresión es a petición, no automática/);
  });

  // La única supresión automática que SÍ existe se sigue declarando: quitarla de
  // la tabla por simetría sería el error contrario.
  it('pero las copias de seguridad siguen declarando su rotación automática', () => {
    expect(tablaDeRetencion(html, HTML)).toMatch(/30 días con rotación automática/);
  });

  // La sección 12 prometía avisar por email de los cambios. La aplicación ya no
  // puede mandar correo: era la misma clase de promesa imposible.
  it('no promete avisar de los cambios por un correo que la nave no puede enviar', () => {
    expect(html).not.toMatch(/Email a usuarios con cuenta activa/);
  });
});

// ⚠️ Tarjeta `c2a41b7f`. La política publicada terminaba con una lista de
// «Acciones pendientes (operador)» ya hechas —entre ellas «publicar esta política
// como URL pública», servida en esa misma URL—. Una lista de tareas internas no
// pinta nada en el documento con el que un titular ejerce sus derechos, y esa
// además era falsa.
describe('la política publicada no lleva una lista de pendientes del operador', () => {
  it.each([['HTML', HTML], ['markdown', MD]])('el %s no tiene «Acciones pendientes»', (_, ruta) => {
    expect(leer(ruta)).not.toMatch(/Acciones pendientes/i);
  });

  it('ni remite a un checklist del operador como procedimiento', () => {
    expect(leer(HTML)).not.toMatch(/operator-checklist/);
  });
});

describe('el HTML publicado y el markdown fuente no se separan', () => {
  // El HTML lo genera `client/scripts/build-legal-pages.cjs` desde el markdown, en
  // el `prebuild` del cliente. Pero se VERSIONA, y nada impide commitear uno sin
  // regenerar el otro: la página servida sale del markdown y la versionada puede
  // quedarse atrás. Y el que la gente lee es el servido.
  //
  // Aquí decía «se genera A MANO (`docs/operator-checklist.md`)». Era falso: el
  // generador existe desde mayo, y ese documento se retiró el 13-sep-2026.
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

  // Los mismos casos de la v1.3 sobre el markdown: el HTML se regenera a mano, y
  // la divergencia entre los dos es exactamente cómo sobrevivió la frase de la v1.1.
  it('tampoco promete borrados automáticos en su tabla de retención', () => {
    const tabla = tablaDeRetencion(md, MD);
    expect(tabla).not.toMatch(/hard-delete autom[aá]tico/i);
    expect(tabla).not.toMatch(/24 meses post-archive/i);
    expect(tabla).not.toMatch(/\|\s*Notificaciones leídas\s*\|\s*90 días/i);
    expect(tabla).toMatch(/La supresión es a petición, no automática/);
  });

  it('y el historial explica la v1.3', () => {
    expect(md).toMatch(/1\.3 — 2026-09-13/);
  });

  // Tarjeta `1f1eb472`. La política decía «UI disponible en tu perfil» para la
  // portabilidad y la supresión, y esa interfaz no existía: quien viniera a
  // ejercer un derecho se iba a buscar un botón inexistente.
  //
  // DOS COSAS QUE ESTE CASO HACE MAL SI SE ESCRIBEN A LA LIGERA, y las dos las
  // cometí en la primera versión; las encontró el vigilante:
  //
  //   1 · MIRAR SOLO EL MARKDOWN. Es el defecto de `16b8063a`, explicado dos
  //       pantallas más arriba en este mismo fichero: **lo que la gente lee es
  //       el HTML**, se versiona aparte, y la promesa falsa puesta solo ahí
  //       pasaba con la batería entera en verde. Versión y fecha no lo tapan,
  //       porque lo que cambia es el texto de una celda.
  //
  //   2 · CONTAR COMENTARIOS COMO LLAMADAS. Un `// pendiente: llamar a
  //       me/export` en el cliente hacía creer al caso que el botón existe — y
  //       es exactamente lo que escribiría quien empieza el botón y lo deja a
  //       medias. Se quitan los comentarios antes de buscar, igual que
  //       `base-consultable-guard` ignora lo retractado.
  //
  // El caso NO es una lista de frases prohibidas: **deriva de las dos fuentes**.
  // Si mañana alguien construye los botones, el cliente llamará a esas rutas y
  // la política podrá prometerlas otra vez sin tocar esto.
  it('no promete —ni en el markdown ni en la página servida— una interfaz que el cliente no tiene', () => {
    const fs = require('fs');
    const path = require('path');

    const dirCliente = path.join(__dirname, '..', '..', 'client', 'src');
    const ficheros = [];
    (function recorrer(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.(js|jsx)$/.test(e.name)) ficheros.push(p);
      }
    })(dirCliente);

    const sinComentarios = (t) => t
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    const codigoCliente = sinComentarios(ficheros.map((f) => fs.readFileSync(f, 'utf8')).join('\n'));

    const clienteExporta = /me\/export/.test(codigoCliente);
    const clienteBorraCuenta = /delete\(\s*['"`]\/auth\/me|auth\/me['"`]\s*,\s*\{\s*method:\s*['"`]DELETE/.test(codigoCliente);

    // Las dos filas, en los DOS ficheros: el fuente y el que se sirve.
    //
    // Se trocea por FILAS, no por líneas: en el markdown una fila es una línea,
    // pero en el HTML son varias —una por celda—, y buscar «la línea que dice
    // Portabilidad» devolvía solo el encabezado de la fila, sin el texto que hay
    // que comprobar. Con eso, el caso se ponía rojo por el motivo equivocado.
    const filas = (texto, corte1, corte2, esHtml) => {
      const seccion = texto.slice(texto.indexOf(corte1), texto.indexOf(corte2));
      const trozos = esHtml
        ? seccion.split(/<tr[^>]*>/i).map((t) => t.replace(/\s+/g, ' '))
        : seccion.split('\n');
      return {
        portabilidad: trozos.find((t) => /Portabilidad/.test(t)) || '',
        supresion: trozos.find((t) => /Supresi[óo]n/.test(t)) || '',
      };
    };

    const fuentes = {
      'el markdown': filas(md, '## 7. Tus Derechos', '## 8.', false),
      'la página servida': filas(leer(HTML), '<h2>7. Tus Derechos', '<h2>8.', true),
    };

    // ── Lo NEGATIVO se comprueba sobre la SECCIÓN ENTERA, sin trocear ────────
    //
    // Tarjeta `19c44715`. Trocear servía para exigir que cada fila diga cómo se
    // ejerce su derecho; **para prohibir una frase, trocear abre un agujero**:
    // una fila-nota —«los dos derechos anteriores tienen UI disponible en tu
    // perfil»— no nombra ninguno de los dos, así que ningún trozo la contenía y
    // pasaba en verde. Lo encontró el vigilante después de fusionar `1f1eb472`.
    //
    // Regla que queda: **lo positivo, por fila; lo prohibido, por sección.**
    const secciones = {
      'el markdown': md.slice(md.indexOf('## 7. Tus Derechos'), md.indexOf('## 8.')),
      'la página servida': leer(HTML).slice(leer(HTML).indexOf('<h2>7. Tus Derechos'), leer(HTML).indexOf('<h2>8.')),
    };

    // Y POR DERECHO, no por los dos a la vez. Con `&&`, en cuanto existiera UNO
    // de los dos botones la sección entera dejaba de vigilarse —incluido el
    // derecho que sigue sin botón—. Lo vio el vigilante.
    for (const [donde, seccion] of Object.entries(secciones)) {
      if (!clienteExporta || !clienteBorraCuenta) {
        expect(`${donde} → ${seccion}`).not.toMatch(/UI disponible/i);
      }
    }

    // ⚠️ Y el historial NO entra en esa prohibición, a propósito: la entrada 1.6
    // CITA la frase para desmentirla, y esa cita es lo que conserva la lección.
    // Por eso la prohibición se acota a la sección 7 y no al documento entero.
    expect(md).toMatch(/Hasta la 1\.5, la sección 7\.1 decía/);

    for (const [donde, fila] of Object.entries(fuentes)) {
      // El nombre de la fuente va DENTRO del valor comprobado, no como mensaje:
      // `expect` de jest no acepta mensaje —eso es vitest—, y sin él un rojo no
      // diría en cuál de los dos ficheros está la promesa falsa, que es justo lo
      // que costó la devolución.
      const conFuente = (texto) => `${donde} → ${texto}`;

      expect(conFuente(fila.portabilidad)).not.toBe(conFuente(''));
      expect(conFuente(fila.supresion)).not.toBe(conFuente(''));

      if (!clienteExporta) {
        expect(conFuente(fila.portabilidad)).not.toMatch(/UI disponible/i);
      }
      if (!clienteBorraCuenta) {
        expect(conFuente(fila.supresion)).not.toMatch(/UI disponible/i);
      }

      // Y que siga diciendo CÓMO se ejerce, con el asunto exacto que la propia
      // política le pide escribir al titular: quitar la promesa falsa sin dejar
      // la vía real —o dejándola a medias— sería peor.
      expect(conFuente(fila.portabilidad)).toMatch(/info@aglaya\.biz/);
      expect(conFuente(fila.supresion)).toMatch(/info@aglaya\.biz/);
      expect(conFuente(fila.portabilidad)).toMatch(/\[RGPD\]\s*Portabilidad/);
      expect(conFuente(fila.supresion)).toMatch(/\[RGPD\]\s*Supresi[óo]n/);

      // ── AFIRMAR, no prohibir. Ésta es la pieza que aguanta ───────────────
      //
      // Prohibir frases es una carrera que no se gana: el vigilante reescribió
      // la fila real de supresión como «Puedes hacerlo también desde tu perfil»
      // —sin usar «UI disponible»— y la batería seguía en verde. Quien lo
      // reescriba mañana no usará nuestra jerga.
      //
      // Exigir la frase HONESTA le da la vuelta: si alguien reescribe la fila
      // para prometer interfaz, «No hay botón» desaparece y el caso cae **escriba
      // lo que escriba**. No se puede prometer un botón y decir a la vez que no
      // lo hay.
      //
      // ⚠️ Y NO se prohíbe la palabra «botón»: la fila correcta la contiene.
      if (!clienteExporta) {
        expect(conFuente(fila.portabilidad)).toMatch(/(no|tampoco) hay bot[óo]n/i);
      }
      if (!clienteBorraCuenta) {
        expect(conFuente(fila.supresion)).toMatch(/(no|tampoco) hay bot[óo]n/i);
      }
    }

    // ── Y estructural: mientras no haya botones, esos dos derechos NO pueden
    // estar en la tabla de «self-service» ────────────────────────────────────
    //
    // Es la vía que no depende de cómo se redacte: devolver la fila a 7.1 es
    // prometer interfaz por colocación, sin escribir ninguna frase concreta.
    const tabla71 = (texto, fin) => {
      const i = texto.indexOf('7.1');
      return texto.slice(i, texto.indexOf(fin, i));
    };
    if (!clienteExporta) {
      expect(`markdown 7.1 → ${tabla71(md, '7.2')}`).not.toMatch(/Portabilidad/);
      expect(`HTML 7.1 → ${tabla71(leer(HTML), '7.2')}`).not.toMatch(/Portabilidad/);
    }
    if (!clienteBorraCuenta) {
      expect(`markdown 7.1 → ${tabla71(md, '7.2')}`).not.toMatch(/Supresi[óo]n/);
      expect(`HTML 7.1 → ${tabla71(leer(HTML), '7.2')}`).not.toMatch(/Supresi[óo]n/);
    }

    expect(md).toMatch(/1\.6 — 2026-09-25/);
  });

  it('tampoco anuncia Sentry como futuro, y lo declara como encargado', () => {
    expect(md).not.toMatch(/Sentry \(futuro\)/);
    const tabla = md.slice(md.indexOf('## 4. Encargados'), md.indexOf('Encargado cesado'));
    expect(tabla).toMatch(/Functional Software, Inc\. \(Sentry\)/);
    expect(md).toMatch(/1\.4 — 2026-09-13/);
  });
});
