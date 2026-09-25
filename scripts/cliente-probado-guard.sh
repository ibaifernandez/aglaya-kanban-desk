#!/usr/bin/env bash
# cliente-probado-guard.sh — las pruebas del cliente existen Y CORREN en CI.
# Tarjeta `97307036`.
#
# ─────────────────────────────────────────────────────────────────────────────
# QUÉ VIGILA, Y POR QUÉ HACE FALTA
#
# Hasta el 25-sep-2026 esta nave no tenía NINGUNA prueba de cliente: `npm test`
# era solo `jest server/tests`. Tres tarjetas pedían comprobar lo que ve el
# usuario y no se podía. Montado el entorno, el riesgo cambia de sitio: no es que
# no haya pruebas, es que **dejen de correr sin que nadie lo note**.
#
# Eso ya pasó en esta casa con otra cara —el #34: una comprobación que desaparece
# no se distingue de una que pasó—, y por eso aquí no vale con que el trabajo de
# CI exista: se comprueba que el trabajo invoque el corredor de pruebas, y que el
# corredor tenga algo que correr.
#
# LAS TRES COSAS, y las tres se derivan del árbol:
#
#   1 · Hay al menos un fichero de prueba de cliente (`client/src/**/*.test.jsx`
#       o `.test.js`). Cero es «alguien las borró», no «no hacían falta».
#   2 · `client/package.json` tiene un guion `test` que llama a `vitest`. Un
#       `test` que imprima «ok» y salga con 0 es el falso verde perfecto.
#   3 · `ci.yml` invoca ese guion en el directorio del cliente. Si el paso se
#       borra, el corredor sigue existiendo y NADIE lo ejecuta — que es
#       exactamente la avería que esto cierra.
#
# LO QUE NO PUEDE HACER, dicho para que su verde no se lea de más:
#
#   · **No sabe qué jobs son OBLIGATORIOS para fusionar.** Eso lo custodia el
#     *ruleset* de GitHub, no este repositorio, así que mover el paso a un job
#     que nadie exige —o a uno con `if: false` a nivel de job— pasaría por aquí
#     en verde. No se puede derivar del árbol y por eso se dice. Hoy el paso vive
#     en `client-build`, que sí es exigido (medido por el vigilante, 25-sep-2026).
#
#   · Tampoco ejecuta las pruebas ni sabe si son buenas. Que una prueba mida algo de verdad se comprueba
# rompiendo lo que vigila y exigiendo rojo, y eso es trabajo de quien revise.
# Esto cierra el caso en que **no corrieron**.
#
# Uso:
#   bash scripts/cliente-probado-guard.sh
#   CLIENTE_DIR=<dir> CLIENTE_CI=<fichero> bash …
#
# Exit 0 = corren. 1 = no. 2 = no se pudo medir.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR_CLIENTE="${CLIENTE_DIR:-$RAIZ/client}"
CI="${CLIENTE_CI:-$RAIZ/.github/workflows/ci.yml}"

roto() { echo "::error::cliente-probado-guard: $1"; exit 2; }

[ -d "$DIR_CLIENTE" ] || roto "no existe el directorio del cliente «$DIR_CLIENTE»."
[ -f "$CI" ]          || roto "no existe «$CI». Si el workflow se movió, este guardián no puede saber a dónde: dilo aquí."

# ── LA REGLA ESTÁ INVERTIDA, Y ES LO QUE HACE QUE ESTO VALGA ─────────────────
#
# Las tres primeras versiones de este guardián perseguían FORMAS de neutralizar
# el paso: primero `if:` y `continue-on-error:`, luego `|| true` y `|| echo`,
# luego tuberías. Cada vuelta el vigilante traía una nueva —`| tee` sale 0 porque
# en una tubería manda el último mandato; `&` sale 0 en el acto—, y esa carrera
# no se gana: depende de que alguien imagine la siguiente.
#
# Así que se dice **lo único que vale**, y todo lo demás cae solo:
#
#   · el paso ejecuta EXACTAMENTE `npm test` o `npm run test`;
#   · el guion `test` del cliente EMPIEZA por `vitest run` y no lleva `|`, `&`,
#     `;`, `>` ni `--passWithNoTests`.
#
# ⚠️ EMPIEZA significa empieza: un prefijo —`npx vitest run …`, `cross-env CI=true
# vitest run …`— se pone ROJO A PROPÓSITO, no por descuido. Son formas legítimas,
# y hoy no se usan; el día que hagan falta, ensanchar esta regla es parte de ese
# cambio y se verá en la revisión. Sin esta frase, el primero que se lo encuentre
# pensará que el guardián está roto y lo rodeará.
#
# Y en el paso, lo mismo con las banderas: `npm test --silent` queda fuera. Es el
# precio correcto — admitir banderas reabre `-- --passWithNoTests`.
#
# Idea del vigilante, y es mejor que otra lista: cierra también lo que ninguno de
# los dos ha imaginado. El precio es que una forma legítima nueva —otro corredor,
# un flag razonable— tendrá que pasar por aquí y explicarse. Es el precio
# correcto: quien lo cambie tendrá que mirar qué está cambiando.
#
# ⚠️ Y UNA QUE PAGÓ ESTA MISMA PR: los dos controles de arriba se escribieron
# como `printf '%s' "$x" | grep -qE …`, que es exactamente lo que `pipefail-guard`
# prohíbe —una tubería hacia un lector que sale antes de tiempo— y puso el CI en
# rojo. **La PR que enseña al CI a no tragarse veredictos se tragaba uno al
# construirse.** Van con `<<<`, que no tiene ese problema.
#
# ── Tragarse el veredicto: un patrón, DOS sitios ─────────────────────────────
#
# `npm test || true` en el paso, y `vitest run || echo ok` en el guion del
# cliente, hacen lo mismo: las pruebas corren, salen rojas, y el proceso sale
# con 0. El control 2 existía exactamente para esto —su comentario decía que un
# guion que imprime «ok» y sale con 0 es el falso verde perfecto— y aun así se le
# escapaba, porque miraba que el guion NOMBRARA a vitest, no que respetara su
# veredicto. Lo encontró el vigilante (E1 y E2).
#
# Se mira en los dos sitios a la vez, y con el mismo patrón: fijar solo uno deja
# el otro abierto, que es la lección de esta tarjeta repetida en pequeño.
SE_TRAGA_EL_VEREDICTO='(\|\||;|&&)[[:space:]]*(true|:|exit[[:space:]]+0|echo)'

fallo=0

# ── 1 · que haya pruebas ─────────────────────────────────────────────────────
n_pruebas="$(find "$DIR_CLIENTE/src" \( -name '*.test.jsx' -o -name '*.test.js' \) 2>/dev/null | wc -l | tr -d ' ')"
if [ "$n_pruebas" -eq 0 ]; then
  fallo=1
  echo "::error::no queda ni una prueba de cliente en «$DIR_CLIENTE/src». El entorno se montó para que tres tarjetas pudieran comprobar lo que ve el usuario (tarjeta 97307036); un corredor sin nada que correr es verde y no mide nada."
fi

# ── 2 · que el guion las corra de verdad ─────────────────────────────────────
PKG="$DIR_CLIENTE/package.json"
[ -f "$PKG" ] || roto "no existe «$PKG»."
guion_test="$(node -p "JSON.parse(require('fs').readFileSync('$PKG','utf8')).scripts?.test ?? ''" 2>/dev/null)" \
  || roto "no pude leer los guiones de «$PKG»."
if [ -z "$guion_test" ]; then
  fallo=1
  echo "::error file=$PKG::el cliente no tiene guion «test». Sin él, el paso de CI no tiene qué invocar."
elif ! grep -qE '^vitest run( |$)' <<< "$guion_test"; then
  fallo=1
  echo "::error file=$PKG::el guion «test» del cliente («$guion_test») no EMPIEZA por «vitest run». Nombrar a vitest en medio de otra cosa no basta: «vitest run … || echo ok» lo nombraba y salía con 0 con las pruebas en rojo."
elif grep -qE '[|&;>]|--passWithNoTests' <<< "$guion_test"; then
  fallo=1
  echo "::error file=$PKG::el guion «test» del cliente («$guion_test») encadena algo más (una tubería, un «&», un «;» o una redirección) o acepta no encontrar pruebas. En una tubería el código de salida es el del ÚLTIMO mandato, así que «vitest run | tee salida.log» sale 0 con las pruebas en rojo: el corredor corre y no gobierna."
fi

# ── 3 · que CI lo invoque ────────────────────────────────────────────────────
# Se busca la invocación, no el nombre del paso: renombrar un paso es cosmético,
# borrar la invocación es la avería.
# Y en el MISMO paso: buscar las dos cosas sueltas por el fichero daría verde con
# un `working-directory: ./client` de otro paso —el de `npm run build`, que ya
# existe— y un `npm test` en el del servidor. Serían dos verdades que no se tocan.
#
# Y NO BASTA CON QUE EL PASO EXISTA: tiene que poder poner el job en rojo.
# `continue-on-error: true` deja las pruebas corriendo y **sin gobernar nada**
# —salen rojas y el job sigue verde—, y es el idioma que este mismo fichero usa
# seis líneas más arriba para los guardianes: copiarlo aquí es un descuido de una
# línea. `if:` es peor todavía, porque el paso ni se ejecuta. Las dos dejan el
# rastro tranquilizador de que «la comprobación está ahí». Lo midió el vigilante:
# con las dos, este guardián daba verde.
invoca="$(awk '
  function cerrar() {
    if (enCliente && corre && !neutralizado) { print "si"; salir=1 }
    enCliente=0; corre=0; neutralizado=0
  }
  /^[[:space:]]*-[[:space:]]*name:/ { cerrar(); if (salir) exit }
  /^[[:space:]]*working-directory:[[:space:]]*\.\/client[[:space:]]*$/ { enCliente=1 }
  # EXACTAMENTE `npm test` o `npm run test`, sin nada detrás. Cualquier cosa
  # encadenada —`|| true`, `| tee`, `&`, `--passWithNoTests`— deja de casar y el
  # paso no cuenta como invocación que gobierne.
  /^[[:space:]]*run:[[:space:]]*npm( run)? test[[:space:]]*$/ { corre=1 }
  /^[[:space:]]*(if|continue-on-error):/ { neutralizado=1 }
  END { cerrar() }
' "$CI")"

if [ "$invoca" != "si" ]; then
  fallo=1
  echo "::error file=$CI::«$CI» no invoca las pruebas del cliente de forma que puedan poner el job en rojo. Hace falta un paso con «working-directory: ./client» que ejecute «npm test» y **sin `if:` ni `continue-on-error:`**. Sin el paso, el corredor existe y no lo ejecuta nadie; con el paso neutralizado, corre y no gobierna nada — y las dos dejan el rastro tranquilizador de que la comprobación está ahí."
fi

if [ "$fallo" -ne 0 ]; then
  echo
  echo "cliente-probado-guard: las pruebas del cliente no están garantizadas."
  exit 1
fi

echo "cliente-probado-guard: $n_pruebas fichero(s) de prueba de cliente, guion «$guion_test», y CI los ejecuta — OK."
