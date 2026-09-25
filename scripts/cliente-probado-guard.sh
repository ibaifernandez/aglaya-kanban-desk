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
# LO QUE NO PUEDE HACER, dicho para que su verde no se lea de más: no ejecuta las
# pruebas ni sabe si son buenas. Que una prueba mida algo de verdad se comprueba
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
case "$guion_test" in
  *vitest*) ;;
  '')  fallo=1; echo "::error file=$PKG::el cliente no tiene guion «test». Sin él, el paso de CI no tiene qué invocar." ;;
  *)   fallo=1; echo "::error file=$PKG::el guion «test» del cliente («$guion_test») no llama a vitest. Un guion que sale con 0 sin correr nada es un verde que no mide." ;;
esac

# ── 3 · que CI lo invoque ────────────────────────────────────────────────────
# Se busca la invocación, no el nombre del paso: renombrar un paso es cosmético,
# borrar la invocación es la avería.
# Y en el MISMO paso: buscar las dos cosas sueltas por el fichero daría verde con
# un `working-directory: ./client` de otro paso —el de `npm run build`, que ya
# existe— y un `npm test` en el del servidor. Serían dos verdades que no se tocan.
invoca="$(awk '
  /^[[:space:]]*-[[:space:]]*name:/ { enCliente=0 }            # empieza otro paso
  /^[[:space:]]*working-directory:[[:space:]]*\.\/client[[:space:]]*$/ { enCliente=1 }
  enCliente && /^[[:space:]]*run:[[:space:]]*npm( run)? test/ { print "si"; exit }
' "$CI")"

if [ "$invoca" != "si" ]; then
  fallo=1
  echo "::error file=$CI::«$CI» no invoca las pruebas del cliente (un paso con «working-directory: ./client» que ejecute «npm test»). El corredor existiría y no lo ejecutaría nadie: una comprobación ausente no se distingue de una que pasó."
fi

if [ "$fallo" -ne 0 ]; then
  echo
  echo "cliente-probado-guard: las pruebas del cliente no están garantizadas."
  exit 1
fi

echo "cliente-probado-guard: $n_pruebas fichero(s) de prueba de cliente, guion «$guion_test», y CI los ejecuta — OK."
