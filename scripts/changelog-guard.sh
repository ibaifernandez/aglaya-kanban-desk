#!/usr/bin/env bash
# changelog-guard.sh — que el registro por fragmentos no se rompa en silencio.
#
# ─────────────────────────────────────────────────────────────────────────────
# QUÉ VIGILA
#
# Desde `06d44e22` cada entrada del registro vive en su propio fichero dentro de
# `docs/changelog.d/`, y se funden en `docs/CHANGELOG.md` al publicar. Eso quita
# el choque entre ramas **por construcción** —dos ficheros distintos no se pisan
# en ningún motor de fusión— pero abre dos formas nuevas de perder una entrada, y
# las dos son silenciosas:
#
#   · **un fragmento mal formado** —sin categoría, vacío, o sin viñeta— se funde
#     dejando nada o rompiendo la lista donde cae. El PR pasa, la entrada se
#     evapora, y nadie lo nota hasta que alguien busca qué se hizo y no está.
#   · **la fusión misma**, que escribe un fichero. Si pierde una línea del
#     registro o duplica una entrada, el resultado sigue pareciendo un registro
#     completo. Ésa es la condición 3 de la tarjeta: si algo escribe solo, algo
#     tiene que ponerse rojo cuando el resultado no es el esperado.
#
# Por eso este guardián no solo valida los fragmentos: **funde en seco** y
# comprueba que el original sobrevive entero y en orden, y que ninguna entrada
# aparece dos veces. No escribe nada.
#
# LO QUE NO PUEDE HACER, para que su verde no se lea de más: comprueba FORMA, no
# verdad. Que una entrada describa bien lo que se hizo sigue siendo del vigilante.
#
# Uso:
#   bash scripts/changelog-guard.sh
#   CHANGELOG_DIR=<dir> CHANGELOG_FILE=<fichero> bash scripts/changelog-guard.sh
#
# Exit 0 = bien · 1 = hay algo mal · 2 = no se pudo medir.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNDIR="${CHANGELOG_FUNDIR:-$RAIZ/scripts/changelog-fundir.py}"

if [ ! -f "$FUNDIR" ]; then
  echo "::error::changelog-guard: no existe «$FUNDIR». Sin la herramienta no hay nada que comprobar, y eso NO es un verde."
  exit 2
fi

# `--verificar` valida los fragmentos Y funde en seco. Se le delega a propósito:
# la lista de categorías válidas y la forma de fundir viven en un solo sitio, y
# dos copias de una regla divergen — una no puede.
salida="$(python3 "$FUNDIR" --verificar 2>&1)"
codigo=$?

printf '%s\n' "$salida"

if [ "$codigo" -eq 0 ]; then
  echo "changelog-guard: el registro por fragmentos se puede publicar sin perder ni duplicar — OK."
fi

exit "$codigo"
