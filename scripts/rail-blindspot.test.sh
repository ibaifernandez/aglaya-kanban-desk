#!/usr/bin/env bash
# rail-blindspot.test.sh — el sello del guardián del punto ciego.
#
# El problema de sellar ESTE guardián: pregunta a la base de datos, así que
# «probarlo» tiende a significar «tener la DB delante y confiar». Eso no es un
# test, es una demostración. Aquí se le inyectan filas de mentira por
# `RAIL_BLINDSPOT_ROWS` y se le exige el veredicto correcto, sin red.
#
# Lo que fija, y por qué cada cosa:
#   · un espacio ciego SIN justificar → rojo. Es el fallo entero.
#   · un espacio ciego CON justificación → verde. Si no, el guardián nace rojo,
#     alguien lo apaga, y a partir de ahí no vigila nada.
#   · los `personal` no llegan hasta aquí: los excluye la consulta SQL por regla.
#     Se comprueba que la regla está escrita, no que el filtro «funciona» — el
#     filtro lo aplica Postgres y probar a Postgres no es cosa nuestra.
#
# Uso: bash scripts/rail-blindspot.test.sh

set -uo pipefail

GUARD_RS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/rail-blindspot.sh"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${RAIL_BLINDSPOT:-$REPO_ROOT/scripts/rail-blindspot.sh}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

OK_UUID="e7672c25-da5d-4fa2-94be-f879d320266e"
NEW_UUID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

printf '%s  # justificado para el test\n' "$OK_UUID" >"$TMP/allowed"

# case <nombre> <filas> <red|green>
#
# Sin `${var^^}`: esa expansión es de bash 4 y el bash de macOS es el 3.2, donde
# revienta con «bad substitution». La primera versión de este harness la usaba:
# el echo entero fallaba, no se imprimía NADA, y el contador seguía sumando
# aciertos. Seis casos «verdes» sin una sola línea de salida — verde por vacío,
# que es el fallo que este harness existe para no cometer.
upper() { printf '%s' "$1" | tr 'a-z' 'A-Z'; }

case_is() {
  local name="$1" rows="$2" want="$3"
  RAIL_BLINDSPOT_ROWS="$rows" RAIL_BLINDSPOT_ALLOWED="$TMP/allowed" \
    bash "$GUARD" >"$TMP/out.txt" 2>&1
  local code=$?
  local got="green"; [ "$code" != "0" ] && got="red"
  if [ "$got" = "$want" ]; then
    echo "  ✅ $(upper "$want") (esperado) — $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $(upper "$got") (se esperaba $(upper "$want")) — $name"
    sed 's/^/       /' "$TMP/out.txt"
    FAIL=$((FAIL + 1))
  fi
}

echo
echo "rail-blindspot · un espacio inalcanzable que nadie ha justificado"

case_is "espacio ciego nuevo, sin justificar"  "${NEW_UUID}|AGLAYA Scanner|interno"  red
case_is "espacio ciego ya decidido"            "${OK_UUID}|3|interno"               green
case_is "ninguno ciego"                        ""                                    green
case_is "uno justificado y otro no"            "${OK_UUID}|3|interno
${NEW_UUID}|AGLAYA Scanner|interno"                                                   red

# El UUID es la identidad, no el nombre: renombrar un espacio no reabre una
# decisión ya tomada. Si esto se pusiera rojo, la justificación caducaría cada
# vez que alguien le cambia el emoji al workspace.
case_is "renombrado, misma decisión"           "${OK_UUID}|Món · pruebas|interno"    green
# Y al revés: un id que no está en la lista no se cuela por parecerse al que sí.
case_is "id distinto, nombre idéntico"         "${NEW_UUID}|3|interno"               red

# Varias líneas en el fichero de decisiones tienen que seguir siendo VARIAS.
# La primera versión limpiaba los espacios con `tr -d '[:space:]'`, que borra
# también los saltos de línea: los UUID se pegaban en una cadena única y dejaban
# de encontrarse. Con una sola línea el fichero «funcionaba», y por eso el fallo
# solo salió al correrlo contra la DB de verdad, con dos.
printf '%s  # uno\n%s  # dos\n' "$OK_UUID" "$NEW_UUID" >"$TMP/allowed-dos"
( RAIL_BLINDSPOT_ROWS="${OK_UUID}|3|interno
${NEW_UUID}|4|externo" RAIL_BLINDSPOT_ALLOWED="$TMP/allowed-dos" bash "$GUARD" >/dev/null 2>&1 )
if [ $? = 0 ]; then
  echo "  ✅ GREEN (esperado) — dos decisiones en dos líneas se leen las dos"
  PASS=$((PASS + 1))
else
  echo "  ❌ RED — el fichero de decisiones no se lee entero"
  FAIL=$((FAIL + 1))
fi

# Un UUID escrito dentro del «por qué» es prosa, no una decisión. Si concediera
# permiso, bastaría con nombrar un espacio al explicar otro para dejarlo pasar.
printf '# ver también %s, que es otro caso\n%s  # este sí\n' "$NEW_UUID" "$OK_UUID" >"$TMP/allowed-prosa"
( RAIL_BLINDSPOT_ROWS="${NEW_UUID}|AGLAYA Scanner|interno" \
  RAIL_BLINDSPOT_ALLOWED="$TMP/allowed-prosa" bash "$GUARD" >/dev/null 2>&1 )
if [ $? != 0 ]; then
  echo "  ✅ RED (esperado) — un uuid citado en un comentario no concede permiso"
  PASS=$((PASS + 1))
else
  echo "  ❌ GREEN — la prosa de un comentario está autorizando espacios"
  FAIL=$((FAIL + 1))
fi

echo
echo "rail-blindspot · calidad del aviso"

RAIL_BLINDSPOT_ROWS="${NEW_UUID}|AGLAYA Scanner|interno" \
RAIL_BLINDSPOT_ALLOWED="$TMP/allowed" bash "$GUARD" >"$TMP/msg.txt" 2>&1
for needle in "AGLAYA Scanner" "$NEW_UUID" "rail-blindspot.allowed" "miembro"; do
  if grep -qF "$needle" "$TMP/msg.txt"; then
    echo "  ✅ el aviso nombra «$needle»"
    PASS=$((PASS + 1))
  else
    echo "  ❌ el aviso NO nombra «$needle» — quien lo lea no sabrá qué hacer"
    FAIL=$((FAIL + 1))
  fi
done

echo
echo "rail-blindspot · sin credenciales NO se salta en verde"
# Un guardián que se omite cuando no puede mirar es el falso negativo silencioso
# que este repo persigue. Ya pasó una vez: docs-guard[PORTS] se saltaba un
# fichero por una ruta con espacios y daba VERDE sin haber comprobado nada.
( unset RAIL_BLINDSPOT_ROWS DATABASE_URL SUPABASE_URL SUPABASE_DATABASE_PASSWORD
  RAIL_BLINDSPOT_ALLOWED="$TMP/allowed" bash "$GUARD" >"$TMP/nocreds.txt" 2>&1 )
if [ $? != 0 ]; then
  echo "  ✅ ROJO (esperado) — sin DB no dice OK"
  PASS=$((PASS + 1))
else
  echo "  ❌ VERDE — se saltó la comprobación y tranquilizó a quien la leyera"
  FAIL=$((FAIL + 1))
fi

echo
echo "rail-blindspot · la regla de los personal está escrita, no listada"
# Los `personal` son intocables por decisión dura. Se excluyen en el SQL para que
# la exclusión cubra también los que se creen mañana; una lista de UUIDs solo
# cubre los de hoy y envejece en silencio.
if grep -qE "type[[:space:]]*<>[[:space:]]*'personal'" "$GUARD"; then
  echo "  ✅ la consulta excluye los personal por regla"
  PASS=$((PASS + 1))
else
  echo "  ❌ la exclusión de los personal no está en la consulta"
  FAIL=$((FAIL + 1))
fi

echo
echo "rail-blindspot · la otra dirección: el riel metido donde no debe"
# La mitad que protege lo AJENO. Sin esto, el guardián solo vigilaba que no
# faltara alcance — nunca que sobrara. Un espacio fuera del alcance con el riel
# dentro no da error: da una tarjeta en casa de otro.
case_is "fuga sin justificar"                  "${NEW_UUID}|Espacio de Món|interno|FUGA"        red
case_is "fuga ya decidida"                     "${OK_UUID}|Espacio compartido|interno|FUGA"     green
case_is "punto ciego explícito, sin justificar" "${NEW_UUID}|AGLAYA Scanner|interno|PUNTO CIEGO" red
case_is "una de cada, ninguna justificada"     "${NEW_UUID}|A|interno|PUNTO CIEGO
${NEW_UUID}|B|externo|FUGA"                                                                      red

# Una fila de tres campos es de cuando esto solo miraba una dirección. Tiene que
# seguir mordiendo como PUNTO CIEGO, no colarse por no entenderse: un guardián
# que descarta lo que no reconoce es el falso negativo que persigue.
case_is "fila vieja de tres campos, sin justificar" "${NEW_UUID}|Antiguo|interno"                red

# Y el mensaje tiene que decir CUÁL de las dos es. Los dos remedios son opuestos
# —meter al riel dentro, o sacarlo— así que un error que no distinga manda a
# quien lo lea a hacer justo lo contrario de lo que toca.
RAIL_BLINDSPOT_ROWS="${NEW_UUID}|Espacio de Món|interno|FUGA" \
RAIL_BLINDSPOT_ALLOWED="$TMP/allowed" bash "$GUARD" >"$TMP/fuga.txt" 2>&1 || true
if grep -q "FUGA" "$TMP/fuga.txt" && grep -q "quita a" "$TMP/fuga.txt"; then
  echo "  ✅ el error de fuga dice que hay que SACAR al riel"
  PASS=$((PASS + 1))
else
  echo "  ❌ el error de fuga no distingue el remedio"
  sed 's/^/       /' "$TMP/fuga.txt"
  FAIL=$((FAIL + 1))
fi

RAIL_BLINDSPOT_ROWS="${NEW_UUID}|AGLAYA Scanner|interno|PUNTO CIEGO" \
RAIL_BLINDSPOT_ALLOWED="$TMP/allowed" bash "$GUARD" >"$TMP/ciego.txt" 2>&1 || true
if grep -q "PUNTO CIEGO" "$TMP/ciego.txt" && grep -q "añade" "$TMP/ciego.txt"; then
  echo "  ✅ el error de punto ciego dice que hay que METER al riel"
  PASS=$((PASS + 1))
else
  echo "  ❌ el error de punto ciego no distingue el remedio"
  sed 's/^/       /' "$TMP/ciego.txt"
  FAIL=$((FAIL + 1))
fi

echo
echo "rail-blindspot · el alcance se define por PROPIEDAD, no por tipo"
# El criterio por tipo fue la primera propuesta y es incorrecto: haría que el
# alcance del riel dependiera de cómo tipe Món sus propios espacios. Manda
# `workspace_members.role = 'owner'`, no `workspaces.created_by`: `created_by`
# es un hecho del pasado y no se mueve, así que el día que un espacio cambie de
# dueño el detector exigiría meter al riel en casa ajena.
if grep -q "role = 'owner'" "$GUARD" && grep -q "workspace_members o" "$GUARD"; then
  echo "  ✅ el alcance sale de la propiedad viva, no de created_by"
  PASS=$((PASS + 1))
else
  echo "  ❌ el alcance no se deriva de workspace_members.role = 'owner'"
  FAIL=$((FAIL + 1))
fi

# --- `--relevante`: decidir si hay algo que mirar ---------------------------
# Este modo existe porque un `paths:` en el disparador haría que el guardián NO
# APARECIERA en el PR, y una comprobación ausente no se distingue de una que
# pasó. La decisión se movió aquí dentro; estos casos son los que impiden que se
# vuelva a estrechar sin que nadie lo note.
rel_case() {
  local que="$1" esperado="$2" diff="$3"
  local got
  got="$(RAIL_SCOPE_CAMBIADOS="$diff" bash "$GUARD_RS" --relevante 2>/dev/null)"
  if [ "$got" = "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba %s, dijo %s\n' "$que" "$esperado" "$got"
  fi
}

echo
echo "¿Sabe si tiene algo que mirar?"
rel_case "su propia lista de excepciones"  SI "$(printf 'M\tscripts/rail-blindspot.allowed')"
rel_case "el propio guardián"              SI "$(printf 'M\tscripts/rail-blindspot.sh')"
rel_case "sin diff, se corre entero"       SI ""
# Lo que de verdad vigila es la BASE, y de eso se encarga el schedule diario.
rel_case "un cambio de código cualquiera"  NO "$(printf 'M\tserver/routes/cards.js')"

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || { echo "El guardián del alcance del riel NO es de fiar."; exit 1; }
echo "El guardián muerde en las dos direcciones: falta de alcance y exceso de alcance."
