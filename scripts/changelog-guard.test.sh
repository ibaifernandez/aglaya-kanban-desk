#!/usr/bin/env bash
# changelog-guard.test.sh — el sello.
#
# Un guardián que da verde estando destripado es peor que no tenerlo, así que
# éste le fabrica fragmentos rotos y, sobre todo, **una herramienta de fusión
# saboteada**: el caso que de verdad importa no es un fragmento mal escrito —eso
# se ve leyendo— sino que fundir pierda una línea o duplique una entrada y el
# resultado siga pareciendo un registro completo.
#
# Uso: bash scripts/changelog-guard.test.sh

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$RAIZ/scripts/changelog-guard.sh"
FUNDIR_REAL="$RAIZ/scripts/changelog-fundir.py"
TMP="$(mktemp -d)"

PASS=0
FAIL=0

REGISTRO="$TMP/CHANGELOG.md"
crear_registro() {
  cat > "$REGISTRO" <<'MD'
# CHANGELOG

## [Unreleased]

### Added
- **Una entrada que ya estaba.** No se puede perder.

### Fixed
- **Otra que ya estaba.**

## [1.0.0] - 2026-01-01

### Added
- **La primera.**
MD
}

DIR="$TMP/changelog.d"

reset() { rm -rf "$DIR"; mkdir -p "$DIR"; crear_registro; }

frag() { printf '%s\n' "$2" > "$DIR/$1"; }

# $1 etiqueta · $2 exit esperado · $3 trozo esperado en la salida ("" = no mirar)
# $4 herramienta de fusión (vacío = la real)
corre() {
  local que="$1" esperado="$2" espera_msg="$3" tool="${4:-$FUNDIR_REAL}"
  local salida code
  salida="$(CHANGELOG_DIR="$DIR" CHANGELOG_FILE="$REGISTRO" CHANGELOG_FUNDIR="$tool" \
            bash "$GUARD" 2>&1)"
  code=$?
  if [ -n "$espera_msg" ] && ! printf '%s' "$salida" | grep -qF "$espera_msg"; then
    FAIL=$((FAIL + 1))
    printf '  FALLO %s — el mensaje no dice «%s»\n' "$que" "$espera_msg"
    printf '%s\n' "$salida" | sed 's/^/          /'
    return
  fi
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    printf '%s\n' "$salida" | sed 's/^/          /'
  fi
}

# Copia de la herramienta con un sabotaje aplicado por sustitución literal.
saboteada() {  # $1 = nombre · $2 = literal viejo · $3 = literal nuevo
  local destino="$TMP/fundir-$1.py"
  python3 - "$FUNDIR_REAL" "$destino" "$2" "$3" <<'PY'
import sys
origen, destino, viejo, nuevo = sys.argv[1:5]
s = open(origen).read()
assert viejo in s, f"SABOTAJE NO APLICADO: no está «{viejo[:40]}»"
open(destino, "w").write(s.replace(viejo, nuevo, 1))
PY
  printf '%s' "$destino"
}

echo "Sello del guardián del registro por fragmentos ($GUARD)"
echo
echo "Tiene que CALLAR:"
reset
corre "sin fragmentos, no hay nada que romper" 0 "OK"
reset; frag "06d44e22-bien.md" "Added

- **Una entrada bien formada.**"
corre "un fragmento bien formado"              0 "OK"
reset
frag "aaa-uno.md" "Added

- **Entrada de la rama uno.**"
frag "bbb-dos.md" "Fixed

- **Entrada de la rama dos.**"
corre "dos fragmentos de dos ramas distintas"  0 "OK"

echo
echo "Tiene que MORDER con un fragmento mal formado:"
reset; frag "sin-categoria.md" "- **Viñeta sin categoría encima.**"
corre "primera línea no es categoría"     1 "no es una categoría"
reset; frag "categoria-rara.md" "Añadido

- **En castellano, que no está en la lista.**"
corre "categoría que no existe"           1 "no es una categoría"
reset; frag "vacio.md" ""
corre "fragmento vacío"                   1 "está vacío"
reset; frag "solo-categoria.md" "Added"
corre "categoría sin entrada debajo"      1 "no tiene entrada debajo"
reset; frag "sin-vinieta.md" "Added

Esto es un párrafo suelto, no una viñeta."
corre "la entrada no empieza por viñeta"  1 "empezar por una viñeta"
reset; frag "MAYUS Y ESPACIO.md" "Added

- **Nombre que puede chocar.**"
corre "nombre de fichero fuera de forma"  1 "el nombre debe ser"

echo
echo "Tiene que MORDER cuando la FUSIÓN se rompe — el caso que no se ve leyendo:"
reset; frag "aaa-uno.md" "Added

- **Entrada que tiene que sobrevivir.**"
T_PIERDE="$(saboteada pierde \
  '        salida[destino:destino] = cuerpo.split("\n")' \
  '        salida[destino:destino] = cuerpo.split("\n")
        del salida[0]')"
corre "fundir PIERDE una línea del registro" 1 "PIERDE historia" "$T_PIERDE"

reset; frag "aaa-uno.md" "Added

- **Entrada que no puede salir dos veces.**"
T_DUPLICA="$(saboteada duplica \
  '        salida[destino:destino] = cuerpo.split("\n")' \
  '        salida[destino:destino] = cuerpo.split("\n") * 2')"
corre "fundir DUPLICA una entrada"           1 "DUPLICADA" "$T_DUPLICA"

reset; frag "aaa-uno.md" "Added

- **Entrada que no puede evaporarse.**"
T_TIRA="$(saboteada tira \
  '        salida[destino:destino] = cuerpo.split("\n")' \
  '        pass')"
corre "fundir se COME la entrada entera"     1 "se perdió al fundir" "$T_TIRA"

echo
echo "Tiene que ROMPERSE, no saltar en verde:"
reset; rm -rf "$DIR"
corre "no existe el directorio de fragmentos" 2 "no existe el directorio"
reset; printf '# CHANGELOG sin sección\n' > "$REGISTRO"
corre "el registro no tiene [Unreleased]"     2 "no tiene"
reset
corre "no existe la herramienta de fusión"    2 "no existe" "$TMP/no-existe.py"

echo
echo "ADOPCIÓN — que el mecanismo no se quede sin usar en silencio (954b0930):"

# $1 etiqueta · $2 exit esperado · $3 trozo esperado · $4 name-status · $5 mensajes de commit
adopcion() {
  local que="$1" esperado="$2" espera_msg="$3" cambiados="$4" motivo="${5:-}"
  local salida code
  reset; frag "aaa-uno.md" "Added

- **Una entrada cualquiera, para que la forma esté bien.**"
  salida="$(CHANGELOG_DIR="$DIR" CHANGELOG_FILE="$REGISTRO" CHANGELOG_FUNDIR="$FUNDIR_REAL" \
            CHANGELOG_GUARD_CAMBIADOS="$cambiados" CHANGELOG_GUARD_MOTIVO="$motivo" \
            bash "$GUARD" 2>&1)"
  code=$?
  if [ -n "$espera_msg" ] && ! printf '%s' "$salida" | grep -qF "$espera_msg"; then
    FAIL=$((FAIL + 1)); printf '  FALLO %s — el mensaje no dice «%s»\n' "$que" "$espera_msg"
    printf '%s\n' "$salida" | sed 's/^/          /'; return
  fi
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    printf '%s\n' "$salida" | sed 's/^/          /'
  fi
}

TAB="$(printf '\t')"

adopcion "escribir a mano en el registro se para" 1 "ahí ya no se escribe" \
  "M${TAB}docs/CHANGELOG.md"
adopcion "…y el mensaje dice qué hacer en su lugar" 1 "docs/changelog.d/<id-de-la-tarjeta>" \
  "M${TAB}docs/CHANGELOG.md"
adopcion "a mano JUNTO a otros ficheros también se para" 1 "ahí ya no se escribe" \
  "M${TAB}server/routes/cards.js
M${TAB}docs/CHANGELOG.md"

# El camino legítimo NO se puede romper: fundir escribe ese fichero a propósito.
adopcion "fundir al publicar pasa: retira fragmentos" 0 "es una fusión al publicar" \
  "M${TAB}docs/CHANGELOG.md
D${TAB}docs/changelog.d/06d44e22-algo.md"
adopcion "añadir un fragmento NO autoriza a tocar el registro" 1 "ahí ya no se escribe" \
  "M${TAB}docs/CHANGELOG.md
A${TAB}docs/changelog.d/06d44e22-algo.md"
adopcion "borrar el README no cuenta como fusión" 1 "ahí ya no se escribe" \
  "M${TAB}docs/CHANGELOG.md
D${TAB}docs/changelog.d/README.md"

adopcion "con la marca en el commit, pasa" 0 "lo declara con" \
  "M${TAB}docs/CHANGELOG.md" "fix: errata de la 1.4.0

[registro-a-mano] es una versión ya publicada."
adopcion "sin tocar el registro, ni se mira" 0 "nadie escribió a mano" \
  "A${TAB}docs/changelog.d/06d44e22-algo.md
M${TAB}server/app.js"

adopcion "sin lista, lo DICE en vez de callar" 0 "la adopción NO" ""

echo
echo "Y sobre el árbol de VERDAD:"
salida="$(bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 0 ]; then
  PASS=$((PASS + 1)); printf '  ok    el repo real está en verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO el repo real no cuadra (exit %s)\n' "$code"
  printf '%s\n' "$salida" | sed 's/^/          /'
fi

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián muerde el fragmento roto, la fusión rota, y calla donde debe."
