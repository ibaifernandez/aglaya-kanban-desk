#!/usr/bin/env bash
# ci-verdicto.sh — el que decide el color de un job que agrupa comprobaciones.
#
# POR QUÉ EXISTE. `ci.yml` fundió cinco jobs de cuatro segundos en uno solo
# porque **GitHub factura por job y redondea al minuto entero**: cinco jobs de
# cuatro segundos costaban cinco minutos. Para que fundirlos no tape a nadie,
# cada comprobación corre con `continue-on-error: true` y **ninguna corta a las
# siguientes** — y entonces hace falta alguien que, al final, mire todos los
# resultados y ponga el job en rojo si alguno lo está.
#
# **Ese alguien es este script, y es el único punto donde un guardián en rojo
# puede quedarse escondido dentro de un job en verde.** Es exactamente el fallo
# que el #34 pagó el 6-ago-2026 —nueve comprobaciones en vez de diez y GitHub
# dando el PR por `CLEAN`— con otra cara: allí faltaba la comprobación, aquí
# sobraría el verde. Por eso tiene sello propio.
#
# LA TRAMPA QUE MÁS IMPORTA, y no es la obvia. Lo peligroso no es que un
# `failure` se cuele como bueno: es el **resultado vacío**. Si alguien renombra
# el `id` de un paso, `${{ steps.viejo.outcome }}` no da error — da **cadena
# vacía**. Un script que solo compare contra `failure` daría verde a una
# comprobación que ya no existe. Aquí **solo `success` pasa**; cualquier otra
# cosa, incluida la nada, es roja.
#
# Uso:  bash scripts/ci-verdicto.sh "nombre|resultado" "nombre|resultado" ...
#
# Resultados que GitHub produce: success, failure, cancelled, skipped.
#   · `success`   → verde
#   · cualquier otro, y la cadena vacía → ROJO
#
# `skipped` es rojo A PROPÓSITO: en este job ningún paso tiene `if:`, así que
# saltarse uno solo puede pasar si alguien le añade una condición. Una
# comprobación que se salta sola es indistinguible de una que pasó, y ésa es la
# frase que esta casa ya pagó una vez.

set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "::error::ci-verdicto: no se le pasó ninguna comprobación que juzgar"
  echo ""
  echo "Un verdicto sin comprobaciones sería un verde vacío, y un verde vacío"
  echo "es lo que se lee como «todo bien». Si el job no tiene nada que juzgar,"
  echo "no debería existir."
  exit 2
fi

FALLOS=0
TOTAL=0

echo "Comprobaciones del job — todas corrieron, ninguna tapó a otra:"
echo ""

for par in "$@"; do
  nombre="${par%%|*}"
  resultado="${par#*|}"
  # Un par sin barra deja nombre == resultado: es un error de llamada, no un
  # resultado. Se trata como rojo, no se adivina.
  if [ "$par" = "$nombre" ]; then
    resultado="(sin resultado: falta el separador «|»)"
  fi
  TOTAL=$((TOTAL + 1))
  if [ "$resultado" = "success" ]; then
    printf '  ✅  %s\n' "$nombre"
  else
    [ -n "$resultado" ] || resultado="(vacío: ¿se renombró el id del paso?)"
    printf '  ❌  %s  → %s\n' "$nombre" "$resultado"
    FALLOS=$((FALLOS + 1))
  fi
done

echo ""
if [ "$FALLOS" -gt 0 ]; then
  echo "::error::ci-verdicto: $FALLOS de $TOTAL comprobaciones no están en verde."
  echo ""
  echo "El detalle de cada una está en su propio paso, con su nombre. Fundir"
  echo "los jobs no borró eso: solo dejó de pagar un corredor por cada uno."
  exit 1
fi

echo "Las $TOTAL en verde."
