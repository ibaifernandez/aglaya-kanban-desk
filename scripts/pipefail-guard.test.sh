#!/usr/bin/env bash
# pipefail-guard.test.sh — el sello del guardián de las tuberías que mienten.
#
# Le pone delante cada forma del patrón y exige rojo, **y cada forma legítima y
# exige verde**. Las dos direcciones, porque un guardián que solo muerde acaba
# desactivado, y uno que solo calla no protege.
#
# El caso del COMENTARIO no es hipotético ni cortesía: el aviso escrito para que
# nadie repita el fallo vive dentro de `db-backup.yml` **citando el patrón**. Un
# guardián que mordiera su propia advertencia nacería rojo por su culpa, y un
# guardián que estrena rojo se normaliza.
#
# Uso: bash scripts/pipefail-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${PIPEFAIL_GUARD:-$REPO_ROOT/scripts/pipefail-guard.sh}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# caso <qué> <exit esperado> <ruta relativa> <contenido> [trozo que el mensaje debe traer]
#
# El quinto argumento no es adorno: varios casos caen en rojo por caminos
# distintos —no hay nada que vigilar, la raíz no existe— y un sello que solo
# comprueba el COLOR daría por buena una mordida por el motivo equivocado.
caso() {
  local que="$1" esperado="$2" ruta="$3" contenido="$4" espera_msg="${5:-}"
  local raiz="$TMP/caso"
  rm -rf "$raiz"; mkdir -p "$raiz/$(dirname "$ruta")"
  printf '%s\n' "$contenido" > "$raiz/$ruta"

  local salida code
  salida="$(PIPEFAIL_GUARD_RAIZ="$raiz" bash "$GUARD" 2>&1)"
  code=$?

  if [ -n "$espera_msg" ] && ! grep -qF "$espera_msg" <<< "$salida"; then
    FAIL=$((FAIL + 1))
    printf '  FALLO %s — el mensaje no dice «%s»\n' "$que" "$espera_msg"
    sed 's/^/          /' <<< "$salida"
    return
  fi
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    sed 's/^/          /' <<< "$salida"
  fi
}

echo "Sello del guardián de las tuberías que mienten ($GUARD)"
echo
echo "Tiene que MORDER:"

caso "el patrón exacto que dejó a esta nave sin copia" 1 'scripts/x.sh' \
  'gunzip -c "$D" | grep -q "CREATE TABLE"' 'scripts/x.sh:1'

caso "banderas combinadas (-qF)" 1 'scripts/x.sh' \
  'printf "%s" "$v" | grep -qF "$p"' 'pipefail-guard'

caso "banderas combinadas y en otro orden (-Fq)" 1 'scripts/x.sh' \
  'printf "%s" "$v" | grep -Fq "$p"' 'pipefail-guard'

caso "sin espacio antes de la barra" 1 'scripts/x.sh' \
  'printf "%s" "$v"|grep -qxF "$p"' 'pipefail-guard'

caso "grep -m1, que también sale antes de tiempo" 1 'scripts/x.sh' \
  'cat "$f" | grep -m1 "$p"' 'pipefail-guard'

caso "head, la misma familia con otra cara" 1 'scripts/x.sh' \
  'printf "%s\n" "$v" | head -1' 'pipefail-guard'

caso "también dentro de un workflow, no solo en scripts/" 1 '.github/workflows/y.yml' \
  '          run: gunzip -c "$D" | grep -q TABLA' '.github/workflows/y.yml'

caso "al final de una cadena larga" 1 'scripts/x.sh' \
  'git log | awk "{print}" | sort | grep -q algo' 'pipefail-guard'

echo
echo "Tiene que CALLAR:"

# EL caso. El aviso contra este fallo vive como comentario citando el patrón.
caso "el patrón citado dentro de un comentario" 0 'scripts/x.sh' \
  '# ⚠️ NO se escribe como `gunzip -c … | grep -q …`, ver la copia de seguridad' 'OK'

caso "comentario sangrado, como en un workflow" 0 '.github/workflows/y.yml' \
  '          # nunca: cat f | grep -q x' 'OK'

caso "la forma correcta con aquí-string" 0 'scripts/x.sh' \
  'grep -q "$p" <<< "$v"' 'OK'

caso "la forma correcta encadenando con sustitución de proceso" 0 'scripts/x.sh' \
  'grep -qxF "$e" < <(awk "{print \$NF}" <<< "$cambios")' 'OK'

caso "un grep normal en tubería, que LEE TODO y no miente" 0 'scripts/x.sh' \
  'printf "%s" "$v" | grep -c "$p"' 'OK'

caso "una tubería sin lector que salga antes de tiempo" 0 'scripts/x.sh' \
  'printf "%s" "$v" | sort | uniq' 'OK'

echo
echo "Y no puede dar verde por no haber mirado nada:"

# Un guardián que no encuentra qué vigilar NO puede decir OK: es el verde vacío
# que este repo ya persigue en el verdicto de CI.
vacia="$TMP/vacia"; rm -rf "$vacia"; mkdir -p "$vacia"
salida="$(PIPEFAIL_GUARD_RAIZ="$vacia" bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    raíz sin ficheros que vigilar → exit 2, no verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO raíz sin ficheros — esperaba exit 2, dio %s\n' "$code"
  sed 's/^/          /' <<< "$salida"
fi

salida="$(PIPEFAIL_GUARD_RAIZ="$TMP/no-existe-ni-de-lejos" bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    raíz inexistente → exit 2, no verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO raíz inexistente — esperaba exit 2, dio %s\n' "$code"
fi

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || exit 1
echo "El guardián muerde el patrón y calla ante la forma buena. Y no da verde sin haber mirado."
