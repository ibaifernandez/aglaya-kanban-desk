#!/usr/bin/env bash
# verificar-volcado.sh — que lo que se sube a R2 sea una copia y no un fichero.
#
# ─────────────────────────────────────────────────────────────────────────────
# POR QUÉ ESTO ES UN SCRIPT Y NO UN PASO DENTRO DEL WORKFLOW
#
# Vivía dentro de `.github/workflows/db-backup.yml`, y por eso **no se podía
# ejercitar ni mutar**: para saber si mordía había que empujar y mirar. Era el
# único guardián de su día sin sello, y la factura llegó: **abortó cuatro copias
# buenas seguidas** —7, 8, 9 y 10-ago-2026— y nadie pudo verlo antes porque no
# había forma de darle un volcado bueno y exigirle verde.
#
# Un sello es exactamente el instrumento que lo habría cazado. Ahora existe:
# `scripts/verificar-volcado.test.sh`.
#
# QUÉ COMPRUEBA, en orden y con motivo:
#   1. **Suelo de tamaño** — `pg_dump` puede terminar en 0 y escribir casi nada.
#   2. **Integridad del gzip** (`gunzip -t`, que lee el archivo entero y no usa
#      tubería). Va antes del contenido porque, sin esto, un fichero roto se
#      disfrazaría de «faltan tablas» y mandaría a mirar la base en vez del
#      fichero.
#   3. **Que dentro estén las tablas de ESTA base.** El tamaño dice que hay
#      bytes; esto dice que son los bytes que tocan.
#
# ⚠️ EL CONTENIDO NO SE COMPRUEBA CON `gunzip -c … | grep -q …`, Y ESTE
# COMENTARIO ES EL MOTIVO. Así estaba, y es lo que abortó las cuatro copias:
# `grep -q` sale en cuanto encuentra, eso cierra la tubería, `gunzip` muere de
# `SIGPIPE` —estado 141— y con `pipefail` el estado de la tubería es el del
# muerto. Con el `!` delante, «lo encontré enseguida» se leía igual que «no
# está».
#
# Y no saltó antes porque **depende del tamaño**: con un volcado pequeño `gunzip`
# termina de escribir antes de que `grep` salga. El 6-ago la copia pesaba 195 KB
# y pasó; el 10-ago pesaba 980 KB y no. **La bomba se arma sola cuando crece la
# base.** Medido en las cuatro combinaciones bash/zsh × con/sin `pipefail`: la
# variable es `pipefail`, no el shell ni la implementación de `gzip`.
#
# Por eso `grep -oE` —que LEE TODO— y un bucle sin tubería, con `<<<`.
# `scripts/pipefail-guard.sh` vigila que nadie reintroduzca el patrón.
#
# EL TAMAÑO SE MIDE CON `wc -c`, no con `stat`: `stat -c%s` es GNU y `stat -f%z`
# es BSD. Este script corre en el corredor de CI **y** en la máquina de quien lo
# sella, así que una de las dos formas se rompería justo donde hace falta poder
# probarlo.
#
# Uso:
#   bash scripts/verificar-volcado.sh <fichero.sql.gz>
#   VOLCADO_MINIMO=<bytes> bash scripts/verificar-volcado.sh <fichero>
#
# Exit 0 = es una copia · 1 = no lo es, NO subir · 2 = no se pudo medir.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

VOLCADO="${1:-}"

if [ -z "$VOLCADO" ]; then
  echo "::error::verificar-volcado: hace falta la ruta del volcado."
  echo "  Uso: bash scripts/verificar-volcado.sh <fichero.sql.gz>"
  exit 2
fi

if [ ! -f "$VOLCADO" ]; then
  echo "::error::verificar-volcado: no existe «$VOLCADO». No hay nada que verificar,"
  echo "  y eso NO es lo mismo que una copia correcta."
  exit 2
fi

# Suelo de tamaño. Medido: el volcado del 6-ago-2026 pesaba 195 KB, así que 20 KB
# es un orden de magnitud por debajo — no salta por variación normal, y sí salta
# con un volcado vacío o truncado.
MINIMO="${VOLCADO_MINIMO:-20480}"
TAM="$(wc -c < "$VOLCADO" | tr -d ' ')"
echo "Tamaño del volcado: ${TAM} bytes (mínimo exigido: ${MINIMO})"

if [ "$TAM" -lt "$MINIMO" ]; then
  echo "::error::El volcado pesa ${TAM} bytes, por debajo del mínimo de ${MINIMO}. NO se sube: subirlo dejaría en R2 un fichero con nombre correcto y sin copia dentro."
  exit 1
fi

if ! gunzip -t "$VOLCADO"; then
  echo "::error::El volcado no es un gzip íntegro. NO se sube."
  exit 1
fi

TABLAS="cards columns boards workspaces users"
ENCONTRADAS="$(gunzip -c "$VOLCADO" | grep -oE 'CREATE TABLE public\.[A-Za-z0-9_]+' | sort -u)" || ENCONTRADAS=""

FALTAN=""
for TABLA in ${TABLAS}; do
  grep -qxF "CREATE TABLE public.${TABLA}" <<< "${ENCONTRADAS}" || FALTAN="${FALTAN} ${TABLA}"
done

if [ -n "${FALTAN}" ]; then
  echo "::error::El volcado no contiene la(s) tabla(s):${FALTAN}. No es una copia de esta base."
  echo "Tablas encontradas en el volcado:"
  echo "${ENCONTRADAS}"
  exit 1
fi

echo "Volcado verificado: es un gzip íntegro, pesa lo suyo y contiene las tablas esperadas."
