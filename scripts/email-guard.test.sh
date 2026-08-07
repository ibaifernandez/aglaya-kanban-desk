#!/usr/bin/env bash
# email-guard.test.sh — el sello del guardián de direcciones de correo.
#
# Le pone delante cada forma en que una dirección puede entrar o escaparse y
# exige el color correcto en las DOS direcciones: rojo ante una dirección
# personal sin declarar, y verde ante una de ejemplo o una ya declarada. Un
# guardián que solo se comprueba por un lado no se distingue de uno que dice
# siempre lo mismo.
#
# NINGUNA DIRECCIÓN DE PRUEBA SE ESCRIBE ENTERA EN ESTE FICHERO, y no es un
# adorno: este fichero está versionado en el mismo repositorio público que
# vigila el guardián, así que una dirección literal aquí dentro pondría rojo al
# guardián sobre el árbol real. Se construyen concatenando —«pieza» "@" «resto»—,
# de modo que en el texto fuente el carácter anterior a la arroba no es parte de
# una dirección y el patrón no casa. Si alguien las «simplifica» juntándolas, el
# guardián se pondrá rojo sobre este mismo fichero y dirá dónde.
#
# Uso: bash scripts/email-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${EMAIL_GUARD:-$REPO_ROOT/scripts/email-guard.sh}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# Las direcciones de prueba, montadas por piezas. Ver la nota de la cabecera.
PERSONAL="victima""@""gmail.com"          # la que NUNCA debe pasar sin declarar
OTRA_GMAIL="otra.persona""@""gmail.com"   # misma casa, otra persona
EJEMPLO="usuario""@""example.com"         # plantilla: tiene que pasar
DESCONOCIDO="alguien""@""dominio-que-nadie-declaro.net"

# sha256 en minúsculas, calculado aquí para no tener que escribirlo a mano.
hash_de() { printf '%s' "$1" | tr 'A-Z' 'a-z' | python3 -c \
  'import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())'; }

# Monta un árbol versionado de mentira.
#   $1 = nombre del caso (se usa como carpeta)
# Después de llamarlo, `$ARBOL` apunta al árbol y se le añaden ficheros con
# `pon <ruta> <contenido>`; `sella` los mete en el índice de git.
monta() {
  ARBOL="$TMP/$1"
  rm -rf "$ARBOL"; mkdir -p "$ARBOL"
  git -C "$ARBOL" init -q
}
pon() {
  mkdir -p "$(dirname "$ARBOL/$1")"
  printf '%s\n' "$2" > "$ARBOL/$1"
}
sella() { git -C "$ARBOL" add -A; }

# $1 = qué se prueba · $2 = exit esperado · $3 = fichero de declaraciones
# $4 = (opcional) trozo que el mensaje DEBE contener.
#
# El cuarto argumento no es adorno, y aquí menos que en ningún otro sello: los
# códigos 2 salen por cuatro caminos distintos (fichero ausente, línea mal
# formada, hash inválido, raíz sin git) y un guardián que acierta el color y
# falla el motivo manda a arreglar otra cosa.
corre() {
  local que="$1" esperado="$2" allowed="$3" espera_msg="${4:-}"
  local salida code
  salida="$(EMAIL_GUARD_RAIZ="$ARBOL" EMAIL_GUARD_ALLOWED="$allowed" bash "$GUARD" 2>&1)"
  code=$?
  if [ -n "$espera_msg" ] && ! printf '%s' "$salida" | grep -q "$espera_msg"; then
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

# --- ficheros de declaraciones de mentira ------------------------------------
DECL_EJEMPLOS="$TMP/solo-ejemplos.allowed"
printf 'dominio  example.com   # plantillas\n' > "$DECL_EJEMPLOS"

DECL_CON_HASH="$TMP/con-hash.allowed"
{
  printf 'dominio  example.com   # plantillas\n'
  printf 'sha256   %s  # vi***@gmail.com — declarada a sabiendas para el sello\n' "$(hash_de "$PERSONAL")"
} > "$DECL_CON_HASH"

DECL_VACIA="$TMP/vacia.allowed"
printf '# sin ninguna declaración\n' > "$DECL_VACIA"

DECL_ROTA="$TMP/rota.allowed"
printf 'dominio\n' > "$DECL_ROTA"

DECL_HASH_MALO="$TMP/hash-malo.allowed"
printf 'sha256   nosoyunhash  # ...\n' > "$DECL_HASH_MALO"

DECL_CLASE_RARA="$TMP/clase-rara.allowed"
printf 'correo  algo  # clase que no existe\n' > "$DECL_CLASE_RARA"

echo "Sello del guardián de direcciones de correo ($GUARD)"
echo
echo "Tiene que MORDER:"

# EL caso. Una dirección personal nueva en un fichero versionado.
monta muerde-personal
pon "docs/NOTAS.md" "Escribir a $PERSONAL para lo del jueves."
sella
corre "dirección personal nueva en un fichero versionado" 1 "$DECL_EJEMPLOS" "sin declarar"

# Y el mensaje tiene que decir QUÉ FICHERO. Un rojo que no señala se ignora.
#
# Se exige la anotación `::error file=…,line=…` y no la ruta suelta: comprobado
# por mutación, quitar el fichero y la línea del error seguía pasando en verde
# porque el resumen del final los repite. El sello medía el resumen creyendo que
# medía la anotación, que es la que GitHub convierte en marca sobre el código.
monta muerde-nombra-fichero
pon "docs/NOTAS.md" "Escribir a $PERSONAL para lo del jueves."
sella
corre "la anotación de CI señala fichero y línea"  1 "$DECL_EJEMPLOS" "::error file=docs/NOTAS.md,line=1"

# Un dominio que nadie declaró no pasa por parecer inofensivo.
monta muerde-dominio-desconocido
pon "README.md" "Contacto: $DESCONOCIDO"
sella
corre "dominio sin declarar"                       1 "$DECL_EJEMPLOS" "sin declarar"

# LA prueba de que declarar UNA dirección no abre su dominio. Si esto se pusiera
# verde, declarar la de Ibai en gmail.com dejaría entrar la de cualquiera.
monta muerde-otra-del-mismo-dominio
pon "docs/NOTAS.md" "También está $OTRA_GMAIL"
sella
corre "otra dirección del dominio de una ya declarada" 1 "$DECL_CON_HASH" "sin declarar"

# La exclusión de los lockfiles es por RUTA, no por dirección: la misma
# dirección fuera de un lockfile sigue mordiendo.
monta muerde-fuera-del-lockfile
pon "package-lock.json" "\"deprecated\": \"contactar $PERSONAL\""
pon "server/config.js"  "// avisar a $PERSONAL"
sella
corre "misma dirección dentro y fuera de un lockfile"  1 "$DECL_EJEMPLOS" "server/config.js"

# Sin declaraciones, cualquier dirección muerde — incluida una plantilla.
monta muerde-sin-declaraciones
pon "docs/NOTAS.md" "Plantilla: $EJEMPLO"
sella
corre "declaraciones vacías: ni las plantillas pasan"  1 "$DECL_VACIA" "sin declarar"

echo
echo "Tiene que ROMPERSE, no saltar en verde:"

monta config-rota
pon "README.md" "nada"
sella
corre "fichero de declaraciones ausente"           2 "$TMP/no-existe.allowed" "no existe"
corre "línea de declaración mal formada"           2 "$DECL_ROTA"            "mal formada"
corre "sha256 que no es un sha256"                 2 "$DECL_HASH_MALO"       "no es un sha256"
corre "clase de declaración desconocida"           2 "$DECL_CLASE_RARA"      "clase desconocida"

ARBOL="$TMP/sin-git"; rm -rf "$ARBOL"; mkdir -p "$ARBOL"
corre "raíz que no es un repositorio git"          2 "$DECL_EJEMPLOS"        "no es un repositorio git"

echo
echo "Tiene que CALLAR:"

# Un dominio de ejemplo declarado no puede dar falso positivo. Si esto fallara,
# el guardián nacería rojo y acabaría dejando de mirarse.
monta calla-ejemplo
pon "docs/NOTAS.md" "Plantilla de invitación: $EJEMPLO"
sella
corre "dirección de un dominio de ejemplo declarado" 0 "$DECL_EJEMPLOS"

monta calla-declarada
pon "docs/NOTAS.md" "Verificación del 2026-04-28 recibida en $PERSONAL"
sella
corre "dirección declarada exactamente por sha256"   0 "$DECL_CON_HASH"

# La declaración es en minúsculas: la misma dirección en mayúsculas es la misma.
monta calla-mayusculas
pon "docs/NOTAS.md" "Recibida en $(printf '%s' "$PERSONAL" | tr 'a-z' 'A-Z')"
sella
corre "la misma dirección declarada, en mayúsculas"  0 "$DECL_CON_HASH"

monta calla-lockfile
pon "package-lock.json" "\"deprecated\": \"contactar $PERSONAL\""
sella
corre "dirección solo dentro de un lockfile"         0 "$DECL_EJEMPLOS"

# Lo NO versionado no lo mira, y está declarado como hueco en su cabecera. Si
# esto cambiara sin querer, el guardián se pondría rojo por ficheros locales.
monta calla-no-versionado
pon "README.md" "nada"
sella
pon "borrador.md" "pendiente: escribir a $PERSONAL"
corre "fichero presente pero no versionado"          0 "$DECL_EJEMPLOS"

monta calla-sin-direcciones
pon "README.md" "Aquí no hay ninguna."
sella
corre "árbol sin ninguna dirección"                  0 "$DECL_EJEMPLOS"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián muerde donde debe y calla donde debe."
