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

# Las PUERTAS: los ficheros cuya FORMA gobierna ese contrato. No es «todo el
# código del riel» — es donde viven los campos, la obligatoriedad, los códigos
# de error y las compuertas que el documento promete.
#
#   server/routes/internalRoute.js  → Puerta 2 entera (payload, códigos, acuse).
#   kanban-mcp/server.py            → las tools de la Puerta 1 y sus compuertas.
#   kanban-mcp/validation.py        → la validación que el contrato describe:
#                                     destino obligatorio, alias del brief, aviso
#                                     de tarjeta vacía, prioridad y responsable.
#
# `client/` no entra: la UI consume las mismas rutas pero no define la forma de
# ninguna puerta, y meterla convertiría cada cambio de pantalla en un falso rojo.
PUERTAS='^(server/routes/internalRoute\.js|kanban-mcp/(server|validation)\.py)$'

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

puertas_tocadas="$(printf '%s\n' "$cambiados" | grep -E "$PUERTAS" || true)"

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
