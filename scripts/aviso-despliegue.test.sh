#!/usr/bin/env bash
# aviso-despliegue.test.sh — el sello del avisador de despliegues.
#
# POR QUÉ ESTE SELLO NO ES OPCIONAL. La primera prueba real de un avisador es
# **el primer fallo**, y esta casa ya pagó esa lectura: el aviso de la copia de
# seguridad se construyó sin sello, no avisó nunca, y se descubrió **cuatro
# fallos después**. Un avisador que no avisa es indistinguible de que no haya
# nada que avisar.
#
# Aquí la decisión y el texto se ejercen sin desplegar nada y sin red.
#
# Uso: bash scripts/aviso-despliegue.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${AVISO_DESPLIEGUE:-$REPO_ROOT/scripts/aviso-despliegue.sh}"

PASS=0
FAIL=0

# caso <qué> <exit esperado> <estado> [trozo que el cuerpo DEBE traer]
caso() {
  local que="$1" esperado="$2" estado="$3" espera_msg="${4:-}"
  local salida code
  salida="$(bash "$GUARD" "$estado" "produccion" "https://railway.app/d/abc" "abcbaf62" 2>/dev/null)"
  code=$?

  if [ -n "$espera_msg" ] && ! grep -qF "$espera_msg" <<< "$salida"; then
    FAIL=$((FAIL + 1))
    printf '  FALLO %s — el cuerpo no dice «%s»\n' "$que" "$espera_msg"
    return
  fi
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
  fi
}

echo "Sello del avisador de despliegues ($GUARD)"
echo
echo "Tiene que AVISAR (exit 10):"

caso "un despliegue FAILED — el caso del 11-ago" 10 failure "ha terminado en"

# `error` es el fallo del propio sistema de despliegue. Desde fuera significa lo
# mismo: lo que se mergeó NO está vivo. Tratarlo distinto dejaría un modo de
# fallo callado.
caso "un despliegue en ERROR, que es fallo igual" 10 error "ha terminado en"

# Un estado nuevo que GitHub añada mañana no se traga: se avisa y se dice.
caso "un estado desconocido se avisa, no se calla" 10 se_rompio_raro "ha terminado en"

# Y avisar no basta: hay que distinguir «sé que esto es un fallo» de «no conozco
# este estado y aviso por si acaso». Sin esta pareja, quitar `error` de los
# estados conocidos NO cambia nada —cae en el comodín y avisa igual— y la
# distinción se pierde en silencio. Medido: esa mutación sobrevivía.
sin_reconocer() {
  local que="$1" estado="$2" debe_avisar_como_desconocido="$3"
  local aviso
  aviso="$(bash "$GUARD" "$estado" e u s 2>&1 >/dev/null)"
  if grep -qF "no reconocido" <<< "$aviso"; then
    if [ "$debe_avisar_como_desconocido" = "si" ]; then
      PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
    else
      FAIL=$((FAIL + 1)); printf '  FALLO %s — lo trata como desconocido y NO lo es\n' "$que"
    fi
  else
    if [ "$debe_avisar_como_desconocido" = "no" ]; then
      PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
    else
      FAIL=$((FAIL + 1)); printf '  FALLO %s — es desconocido y no lo dice\n' "$que"
    fi
  fi
}

sin_reconocer "«failure» es un fallo CONOCIDO, no una adivinanza" failure no
sin_reconocer "«error» también: está en la lista a propósito"     error   no
sin_reconocer "y uno inventado sí se declara desconocido"          fantasma si

echo
echo "Tiene que CALLAR (exit 0, y sin cuerpo):"

for e in success in_progress queued pending inactive; do
  caso "estado «$e»" 0 "$e"
done

# Callar es callar: si imprimiera cuerpo, el workflow abriría una incidencia por
# cada despliegue correcto y en dos días nadie las miraría.
salida_ok="$(bash "$GUARD" success produccion url sha 2>/dev/null)"
if [ -z "$salida_ok" ]; then
  PASS=$((PASS + 1)); printf '  ok    y no imprime NADA cuando calla\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO imprimió cuerpo con un despliegue correcto\n'
fi

echo
echo "El aviso tiene que servir para actuar, no solo para molestar:"

cuerpo="$(bash "$GUARD" failure produccion "https://railway.app/d/abc" "abcbaf62" 2>/dev/null)"

comprueba() {
  local que="$1" aguja="$2"
  if grep -qF "$aguja" <<< "$cuerpo"; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — falta «%s»\n' "$que" "$aguja"
  fi
}

comprueba "trae el enlace al despliegue"            "https://railway.app/d/abc"
comprueba "trae el commit"                          "abcbaf62"
comprueba "trae el entorno"                         "produccion"
# Sin esto es un aviso que dice «algo pasó». La regla que se está protegiendo
# tiene que estar dentro, o quien lo lea no sabrá por qué le importa.
comprueba "dice POR QUÉ importa: «Hecho» exige vivo" '«Hecho» exige vivo'
comprueba "avisa de que puede haber tarjetas en «Hecho» afirmando de más" 'dependan de este commit'
# El matiz que evita el pánico: un despliegue fallido no tumba el anterior.
comprueba "y acota: producción puede estar sirviendo código viejo" "sirviendo código viejo"
comprueba "dice qué hacer para cerrar la incidencia"  "Cierra esta incidencia"

echo
echo "Y no puede decidir sin datos:"

salida="$(bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    sin estado → exit 2, que no es «todo bien»\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO sin estado — esperaba exit 2, dio %s\n' "$code"
fi

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || exit 1
echo "Avisa cuando el despliegue falla, calla cuando no, y el aviso sirve para actuar."
