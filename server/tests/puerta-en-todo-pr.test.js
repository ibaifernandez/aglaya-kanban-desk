/**
 * Un PR dispara comprobaciones sea cual sea su rama base. Tarjeta `ff703591`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ DEFECTO CIERRA
 *
 * `ci.yml` declaraba `pull_request: branches: [main]`, y **es el único workflow
 * que reacciona a un PR** —los otros seis son de reloj o de `deployment_status`—.
 * Así que **un PR cuya base no fuera `main` llegaba con cero comprobaciones**.
 *
 * Y eso no es un hueco de cobertura cualquiera: `lineas-maestras.md` prohíbe
 * mergear sin que «las comprobaciones que la configuración de la nave manda
 * correr para ese PR» estén en verde. Si la configuración no manda ninguna, **la
 * frase se cumple en vacío**, y quien la aplica cree haber comprobado. Pasó con
 * el PR #86, apilado sobre una rama de agente; lo cazó una persona contando
 * checks a mano.
 *
 * ⚠️ POR QUÉ ESTO NO TIENE SU PROPIO PARSER DE YAML
 *
 * Quien contesta «¿qué debería correrle a este PR?» en esta casa es
 * `scripts/corridas-guard.sh`, derivándolo del árbol. Escribir aquí un segundo
 * lector de `.github/workflows/` daría dos respuestas que pueden separarse — y
 * la que se usa al mergear es la suya, no la mía. Así que **se le pregunta a él**,
 * por su puerta de sello (sin red y sin `gh`).
 *
 * Consecuencia aceptada: si su derivación se rompe, estos casos se ponen rojos
 * aunque `ci.yml` esté bien. Es correcto — el que decide sigue siendo él.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const GUARDIAN = path.join(RAIZ, 'scripts', 'corridas-guard.sh');

// Una base que NO es `main` y que nadie ha escrito en ninguna lista: es el caso
// del PR apilado. Si mañana alguien acota los disparadores por prefijo de rama,
// este nombre no estará en su lista y el caso se pondrá rojo — que es el aviso.
const BASE_APILADA = 'agente/una-rama-que-nadie-ha-listado';

const preguntar = (corrieron, base = BASE_APILADA) => {
  try {
    const salida = execFileSync('bash', [GUARDIAN, '--pr', '1'], {
      cwd: RAIZ,
      encoding: 'utf8',
      env: {
        ...process.env,
        CORRIDAS_GUARD_PRS: `1|sha-de-prueba|${base}`,
        CORRIDAS_GUARD_CORRIERON: corrieron,
      },
    });
    return { code: 0, salida };
  } catch (e) {
    return { code: e.status, salida: `${e.stdout || ''}${e.stderr || ''}` };
  }
};

describe('un PR apilado sobre una rama de agente no se queda sin puerta', () => {
  // ⚠️ EL CASO DE LA TARJETA. Con el filtro `branches: [main]` puesto, la
  // derivación no encuentra NI UN workflow para esta base y el guardián sale por
  // su rama de ceguera: «un guardián que no espera nada nunca echa nada de
  // menos». Sin filtro, espera `CI` — y aquí `CI` corrió.
  it('se espera al menos un workflow para una base que no es `main`', () => {
    const { code, salida } = preguntar('CI');

    expect(salida).not.toMatch(/no derivé NI UN workflow/);
    expect(code).toBe(0);
  });

  // La contraparte, y es la que impide que el caso de arriba pase por casualidad:
  // si NO corrió nada, el mismo PR tiene que salir rojo. Sin esto, un guardián
  // que devolviera 0 siempre dejaría el primer caso en verde.
  it('y si no corrió ninguna, ese mismo PR sale rojo', () => {
    const { code, salida } = preguntar('');

    expect(code).not.toBe(0);
    expect(salida).toMatch(/NO tiene NINGUNA corrida/);
  });

  // Y que la base `main` siga funcionando: el arreglo quita un filtro, y quitar
  // un filtro también puede romper lo que ya estaba bien.
  it('un PR contra `main` sigue esperando lo mismo', () => {
    const { code, salida } = preguntar('CI', 'main');

    expect(salida).not.toMatch(/no derivé NI UN workflow/);
    expect(code).toBe(0);
  });
});
