#!/usr/bin/env bash
# changelog-guard.sh — que el registro por fragmentos no se rompa en silencio,
# y que no se quede sin usar en silencio, que es la otra mitad.
#
# ═════════════════════════════════════════════════════════════════════════════
# COMPROBACIÓN 1 — LA FORMA (`06d44e22`)
#
# Cada entrada del registro vive en su propio fichero dentro de
# `docs/changelog.d/`, y se funden en `docs/CHANGELOG.md` al publicar. Eso quita
# el choque entre ramas **por construcción** —dos ficheros distintos no se pisan
# en ningún motor de fusión— pero abre dos formas nuevas de perder una entrada:
#
#   · **un fragmento mal formado** —sin categoría, vacío, o sin viñeta— se funde
#     dejando nada o rompiendo la lista donde cae;
#   · **la fusión misma**, que escribe un fichero: si pierde una línea o duplica
#     una entrada, el resultado sigue pareciendo un registro completo.
#
# Por eso no solo valida: **funde en seco** y exige que el original sobreviva
# entero y en orden y que ninguna entrada aparezca dos veces.
#
# ═════════════════════════════════════════════════════════════════════════════
# COMPROBACIÓN 2 — LA ADOPCIÓN (`954b0930`)
#
# QUÉ DEFECTO CIERRA, y se midió: el día que se estrenó el mecanismo,
# `docs/changelog.d/` tenía **cero fragmentos** y **la propia tarjeta que arregló
# el choque escribió 34 líneas a mano en el fichero que choca**. No por descuido:
# porque nada le dijo lo contrario.
#
# Y el guardián decía «0 fragmento(s) — OK». **Un verde que no distinguía
# «nadie lo usa» de «todos lo usan bien»**, que es la peor clase de verde: el que
# se gana no comprobando.
#
# Mientras la adopción sea cero, lo único que evita el choque es el invariante
# «no reclama la siguiente mientras la anterior siga en ciclo de revisión» — y
# ése cuesta paralelismo, que es exactamente lo que el mecanismo venía a
# devolver.
#
# LA TRAMPA, dicha antes de que alguien la pise: **fundir al publicar TAMBIÉN
# escribe `docs/CHANGELOG.md`.** Un guardián que prohíba tocarlo sin más nace
# rojo contra el único camino legítimo. Así que se distingue por lo que
# acompaña al cambio, no por el fichero:
#
#   · **es una fusión** si el mismo cambio BORRA al menos un fragmento — es lo
#     que hace `changelog-fundir.py --aplicar`, y nada más lo hace;
#   · **es a mano y deliberado** si el mensaje de commit lleva
#     `[registro-a-mano]` — para corregir una errata de una versión ya publicada,
#     que es real y raro. Cuesta un acto explícito y queda en el historial, que
#     es como esta casa cierra lo que no puede prohibir del todo;
#   · **cualquier otra cosa es escribir donde ya no se escribe**, y se para.
#
# ═════════════════════════════════════════════════════════════════════════════
# LO QUE NO PUEDE HACER, para que su verde no se lea de más:
#
#   · Comprueba FORMA y SITIO, no verdad. Que una entrada describa bien lo que
#     se hizo sigue siendo del vigilante.
#   · **Sin lista de ficheros cambiados no puede comprobar la adopción**, y lo
#     dice en voz alta en vez de callar. Un salto silencioso aquí devolvería
#     exactamente el defecto que esta comprobación cierra.
#
# Uso:
#   bash scripts/changelog-guard.sh
#   CHANGELOG_GUARD_CAMBIADOS="$(git diff --name-status BASE HEAD)" \
#   CHANGELOG_GUARD_MOTIVO="$(git log --format=%B BASE..HEAD)" \
#     bash scripts/changelog-guard.sh
#
# Exit 0 = bien · 1 = hay algo mal · 2 = no se pudo medir.
# ═════════════════════════════════════════════════════════════════════════════

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNDIR="${CHANGELOG_FUNDIR:-$RAIZ/scripts/changelog-fundir.py}"
REGISTRO="docs/CHANGELOG.md"
DIR_FRAG="docs/changelog.d"
MARCA="[registro-a-mano]"

if [ ! -f "$FUNDIR" ]; then
  echo "::error::changelog-guard: no existe «$FUNDIR». Sin la herramienta no hay nada que comprobar, y eso NO es un verde."
  exit 2
fi

# ── 1. La forma ───────────────────────────────────────────────────────────────
salida="$(python3 "$FUNDIR" --verificar 2>&1)"
codigo=$?
printf '%s\n' "$salida"
[ "$codigo" -eq 0 ] || exit "$codigo"

# ── 2. La adopción ────────────────────────────────────────────────────────────
cambiados="${CHANGELOG_GUARD_CAMBIADOS:-}"
motivo="${CHANGELOG_GUARD_MOTIVO:-}"

if [ -z "${cambiados//[[:space:]]/}" ]; then
  echo "changelog-guard: sin lista de ficheros cambiados — la forma está comprobada, la adopción NO."
  exit 0
fi

# `git diff --name-status` → «M<TAB>ruta». Un rename llega como «R100<TAB>viejo<TAB>nuevo».
toca_registro=0
funde=0
while IFS= read -r linea; do
  [ -z "$linea" ] && continue
  estado="${linea%%	*}"
  rutas="${linea#*	}"
  while IFS= read -r ruta; do
    [ "$ruta" = "$REGISTRO" ] && toca_registro=1
    case "$ruta" in
      "$DIR_FRAG"/README.md) ;;                       # el README no es una entrada
      "$DIR_FRAG"/*.md)
        # Solo el BORRADO de un fragmento delata una fusión. Añadirlo es lo
        # normal de una rama de trabajo y no autoriza a tocar el registro.
        case "$estado" in D*) funde=1 ;; esac
        ;;
    esac
  done <<< "$(printf '%s\n' "$rutas" | tr '\t' '\n')"
done <<< "$cambiados"

if [ "$toca_registro" -eq 0 ]; then
  echo "changelog-guard: nadie escribió a mano en $REGISTRO — OK."
  exit 0
fi

if [ "$funde" -eq 1 ]; then
  echo "changelog-guard: $REGISTRO cambia y el mismo cambio retira fragmentos: es una fusión al publicar — OK."
  exit 0
fi

if printf '%s' "$motivo" | grep -qF "$MARCA"; then
  echo "changelog-guard: $REGISTRO se toca a mano y el commit lo declara con «$MARCA» — OK."
  exit 0
fi

cat >&2 <<FIN
::error file=$REGISTRO::Este cambio escribe a mano en $REGISTRO, y ahí ya no se escribe: dos ramas que lo hagan a la vez chocan siempre, y el choque tira una medición del vigilante que ya estaba hecha.

Qué hacer en su lugar — una entrada por fichero, que no choca con nada:

    docs/changelog.d/<id-de-la-tarjeta>-<slug>.md

    Added

    - **Lo que se hizo, en una frase.** Tarjeta \`<id>\`.

Categorías y formato: $DIR_FRAG/README.md
Se funden al publicar: python3 scripts/changelog-fundir.py --aplicar

Si de verdad hay que editar a mano —una errata de una versión ya publicada—, dilo
en el mensaje del commit con $MARCA. Cuesta un acto explícito a propósito, y queda
en el historial.
FIN
exit 1
