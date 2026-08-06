#!/usr/bin/env bash
# contract-guard.sh — cambiar la forma de una puerta sin tocar su contrato pone CI en rojo.
#
# QUÉ PROBLEMA CIERRA, con su factura. El 6-ago-2026 un obrero automático cambió
# códigos de error y forma de respuesta de la puerta HTTP en tres PR (#13, #14,
# #15) y los tres pasaron CI en verde SIN tocar una línea de
# `docs/contracts/CONTRACT.md`: ni el documento, ni el bump, ni aviso al capitán.
# El contrato lo prohíbe por escrito en su última sección —«lo que NO se hace es
# cambiarlo en el código y confiar en que alguien lo note»— y aun así no había
# nada que lo impidiera. Lo detectó una revisión humana leyendo diffs, que es
# justo la red que ese contrato existe para no necesitar.
#
# POR QUÉ PESA MÁS QUE UN DOC DESACTUALIZADO. El capitán SIRVE ese archivo en
# vivo: `contrato("riel")` lo lee del disco y lo cita como autoridad ante
# cualquier nave de la flota que pregunte cómo clavar trabajo aquí. Un contrato
# desalineado no envejece en un rincón: **se reparte**.
#
# MEDIDO ANTES DE ADOPTARLO, contra los PR reales de este repo:
#   #13 #14 #15 → ROJO. Son exactamente los tres del incidente.
#   #16 … #21   → verde. Seis PR seguidos sin un solo falso positivo.
# Un guardián que hubiera cazado el fallo y no ha ladrado desde entonces.
#
# Y VUELTO A MEDIR al pasar de lista tecleada a lista derivada (#13 … #33):
# ningún PR cambia de veredicto. El único que toca los dos ficheros que la
# derivación añade es el #22 —el que creó `priorities.js`— y ya salía rojo con
# la lista de antes, porque tocaba `internalRoute.js`. Cero rojos nuevos.
#
# LO QUE ESTE GUARDIÁN NO PUEDE HACER, y conviene no creérselo:
# comprueba que alguien TOCÓ el contrato, no que fuera honesto al tocarlo. Un
# espacio en blanco lo satisface. No es un descuido: verificar que el texto
# describe el código es el trabajo del vigilante, y ninguna comprobación
# automática lo sustituye. Lo que esto cierra es el caso en que **nadie miró**,
# que es el que pasó tres veces seguidas.
#
# POR QUÉ NO EXIGE ADEMÁS UN BUMP DE VERSIÓN. Se consideró y se descarta: un
# refactor interno de una puerta no cambia el contrato y no debe subir SemVer,
# así que exigirlo enseñaría a inflar versiones para pasar el guardián — que es
# peor que no tenerlo. La versión la decide quien conoce el cambio; el aviso, no.
#
# Uso:
#   bash scripts/contract-guard.sh fichero1 fichero2 …
#   CONTRACT_GUARD_CHANGED=$'a\nb' bash scripts/contract-guard.sh
#
# Exit 0 = no hay nada que reclamar. Exit 1 = puerta tocada sin contrato.

set -uo pipefail

CONTRATO="docs/contracts/CONTRACT.md"

RAIZ="${CONTRACT_GUARD_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Las PUERTAS son dos, y son las que el contrato nombra:
#
#   server/routes/internalRoute.js  → Puerta 2 entera (payload, códigos, acuse).
#   kanban-mcp/server.py            → las tools de la Puerta 1 y sus compuertas.
#
# Lo que se vigila NO es esa lista: es su CIERRE de imports locales. Ver abajo.
PUERTAS_RAIZ="${CONTRACT_GUARD_PUERTAS:-server/routes/internalRoute.js
kanban-mcp/server.py}"

# ---------------------------------------------------------------------------
# Qué se vigila, y por qué no es una lista escrita a mano
#
# Aquí había tres rutas tecleadas. **Envejeció el día que se escribió**: ese
# mismo 6-ago-2026, otro cambio sacó las prioridades válidas a
# `server/constants/priorities.js` — el único sitio donde vive hoy el conjunto
# que decide el 400 y el texto del error que el contrato declara— y el guardián
# no lo miraba. Quitar `urgent` de ahí cambiaba la forma de la Puerta 2 en
# verde. Ninguno de los dos cambios estaba mal por su cuenta: se encontraron mal.
#
# Así que la lista se DERIVA. Se parte de las dos puertas y se sigue lo que
# importan, y lo que importan ellas, hasta agotar. Si mañana alguien saca otro
# trozo de la forma de una puerta a un fichero nuevo, el guardián lo hereda solo
# — que es la única manera de que no vuelva a envejecer el día que se escribe.
#
# Medido hoy: el cierre son cinco ficheros. Los tres de antes, más
# `server/constants/priorities.js` (el hueco de la tarjeta) y
# `server/utils/supabase.js`. Este último NO es sobre-inclusión: el contrato
# declara que la Puerta 2 usa `service_role` y salta RLS, y ese fichero es donde
# se elige la llave. Cambiar ahí `SERVICE_ROLE_KEY` por `ANON_KEY` cambiaría el
# alcance que el contrato promete, en verde. Y cuesta cero falsos rojos: dos
# commits en toda su vida.
#
# `client/` no entra, y ahora no hace falta excluirlo a mano: no lo importa
# ninguna puerta. La UI consume las mismas rutas, no las define.
#
# LO QUE EL CIERRE NO VE, dicho en voz alta: sigue imports ESTÁTICOS y literales.
# Un `require(variable)`, un import dentro de una función, un `importlib`, o una
# forma que venga de un JSON o de una variable de entorno se le escapan. No es
# un parser: es grep con resolución de rutas. Cubre la forma en que este repo
# escribe hoy sus puertas, y avisa aquí de la forma en que no.
# ---------------------------------------------------------------------------

# Junta los segmentos de una ruta resolviendo `.` y `..`, sin tocar el disco.
_normaliza_ruta() {
  local partes=() seg
  local IFS='/'
  for seg in $1; do
    case "$seg" in
      ''|'.') ;;
      '..') [ "${#partes[@]}" -gt 0 ] && partes=("${partes[@]:0:${#partes[@]}-1}") ;;
      *)     partes+=("$seg") ;;
    esac
  done
  printf '%s' "${partes[*]}"
}

# Los ficheros del repo que importa DIRECTAMENTE el que se le pasa.
_imports_locales() {
  local fichero="$1" dir candidato modulo
  dir="$(dirname "$fichero")"

  case "$fichero" in
    *.js)
      # require('./x') y require("../y/z") — solo los relativos: un paquete de
      # node_modules no es forma de puerta, es dependencia.
      grep -oE "require\([\"'][^\"']+[\"']\)" "$RAIZ/$fichero" 2>/dev/null \
        | sed -E "s/require\([\"']//; s/[\"']\)//" \
        | while read -r ruta; do
            case "$ruta" in .*) ;; *) continue ;; esac
            candidato="$(_normaliza_ruta "$dir/$ruta")"
            for prueba in "$candidato" "$candidato.js" "$candidato/index.js"; do
              [ -f "$RAIZ/$prueba" ] && { printf '%s\n' "$prueba"; break; }
            done
          done
      ;;
    *.py)
      # `from X import …` / `import X`, y solo si X es un fichero de este repo
      # al lado del que lo importa. El riel corre con el directorio en el path.
      grep -oE "^[[:space:]]*(from[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]+import|import[[:space:]]+[A-Za-z_][A-Za-z0-9_]*)" "$RAIZ/$fichero" 2>/dev/null \
        | sed -E "s/^[[:space:]]*from[[:space:]]+//; s/^[[:space:]]*import[[:space:]]+//; s/[[:space:]]+import$//" \
        | while read -r modulo; do
            candidato="$(_normaliza_ruta "$dir/$modulo.py")"
            [ -f "$RAIZ/$candidato" ] && printf '%s\n' "$candidato"
          done
      ;;
  esac
}

# El cierre transitivo: las puertas más todo lo que alcanzan.
_cierre_de_puertas() {
  local pendientes vistos="" actual nuevo
  pendientes="$(printf '%s\n' "$PUERTAS_RAIZ" | grep -v '^[[:space:]]*$')"

  while [ -n "$pendientes" ]; do
    actual="$(printf '%s\n' "$pendientes" | head -1)"
    pendientes="$(printf '%s\n' "$pendientes" | tail -n +2)"

    case $'\n'"$vistos"$'\n' in *$'\n'"$actual"$'\n'*) continue ;; esac
    [ -f "$RAIZ/$actual" ] || continue
    vistos="${vistos}${actual}"$'\n'

    nuevo="$(_imports_locales "$actual")"
    [ -n "$nuevo" ] && pendientes="$(printf '%s\n%s' "$pendientes" "$nuevo" | grep -v '^[[:space:]]*$')"
  done

  printf '%s' "$vistos" | grep -v '^[[:space:]]*$' | sort -u
}

# Una puerta que ya no está donde dice se caería del cierre en SILENCIO, y el
# guardián seguiría dando verde vigilando lo que queda. Es la avería que este
# fichero existe para no ser, así que se comprueba antes que nada.
faltan="$(printf '%s\n' "$PUERTAS_RAIZ" | grep -v '^[[:space:]]*$' | while read -r p; do
  [ -f "$RAIZ/$p" ] || printf '%s\n' "$p"
done)"
if [ -n "$faltan" ]; then
  echo "::error::contract-guard: una puerta declarada NO existe. No puedo vigilar lo que no encuentro."
  printf '  falta: %s\n' $faltan
  echo "Si la puerta se movió, actualiza PUERTAS_RAIZ. Si desapareció, dilo en el contrato."
  exit 1
fi

VIGILADOS="$(_cierre_de_puertas)"

cambiados="${CONTRACT_GUARD_CHANGED:-}"
if [ -z "$cambiados" ] && [ "$#" -gt 0 ]; then
  cambiados="$(printf '%s\n' "$@")"
fi

# Sin lista de ficheros no inventamos un veredicto. Callar es correcto aquí:
# un guardián que se pone rojo porque no le dieron datos se desactiva el mismo
# día, y con él se va la regla que sí importaba.
if [ -z "$cambiados" ]; then
  echo "contract-guard: sin lista de ficheros cambiados — nada que comprobar."
  exit 0
fi

puertas_tocadas="$(printf '%s\n' "$cambiados" | grep -xF -f <(printf '%s\n' "$VIGILADOS") || true)"

if [ -z "$puertas_tocadas" ]; then
  echo "contract-guard: ninguna puerta tocada — OK."
  exit 0
fi

if printf '%s\n' "$cambiados" | grep -qxF "$CONTRATO"; then
  echo "contract-guard: puerta tocada y contrato tocado — OK."
  exit 0
fi

echo "::error file=$CONTRATO::contract-guard: se cambió la forma de una puerta sin tocar su contrato."
echo ""
echo "Puertas tocadas en este cambio:"
printf '  %s\n' $puertas_tocadas
echo ""
echo "Falta: $CONTRATO"
echo ""
echo "Ese documento es la autoridad sobre cómo se le clava trabajo a esta nave, y"
echo "el capitán lo SIRVE EN VIVO a toda la flota. Un contrato desalineado no se"
echo "queda quieto: se reparte."
echo ""
echo "Qué hacer, según el caso:"
echo "  · Cambió la forma (campos, obligatoriedad, códigos de error, compuertas):"
echo "    descríbelo en el contrato y sube la versión — mayor si rompe, menor si añade."
echo "  · NO cambió la forma: dilo igualmente en su historial de versiones. Esa línea"
echo "    ES el aviso al capitán que el contrato pide, y cuesta un renglón."
echo ""
echo "Lo que no vale es cambiarlo en el código y confiar en que alguien lo note."
echo "Ya pasó tres veces seguidas (PR #13, #14, #15) y lo cazó una persona leyendo"
echo "diffs a mano."
exit 1
