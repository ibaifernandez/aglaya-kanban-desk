#!/usr/bin/env bash
# pipefail-guard.sh — una tubería cuyo lector sale antes de tiempo miente cuando crece.
#
# ─────────────────────────────────────────────────────────────────────────────
# QUÉ PROBLEMA CIERRA, CON SU FACTURA
#
# Esta nave estuvo **cuatro días sin copia de seguridad** —7, 8, 9 y 10-ago-2026—
# y ninguna corrida rechazó un volcado malo: las rechazó **su propia
# comprobación**, escrita así:
#
#     gunzip -c "$DUMP" | grep -q "CREATE TABLE public.$TABLA"
#
# `grep -q` **sale en cuanto encuentra**. Eso cierra la tubería, quien escribe
# muere de `SIGPIPE` (estado **141**), y con `set -o pipefail` **el estado de la
# tubería es el del que murió, no el del que encontró**. Con un `!` delante,
# «lo encontré enseguida» se lee igual que «no está».
#
# LO QUE LO HACE PELIGROSO NO ES EL FALLO: ES CUÁNDO APARECE. Solo salta cuando
# lo que entra supera el buffer de la tubería (~64 KB). Es decir: **una
# comprobación correcta empieza a mentir el día que crece lo que le pasas, sin
# que nadie toque una línea.** El volcado pasó de 195 KB a 980 KB y el guardián
# se volvió en contra. La bomba se arma sola.
#
# MEDIDO, no supuesto (bash y zsh, en la misma máquina):
#
#     printf 200 KB | grep -q "objetivo"  → estado 141 · FALSO NEGATIVO
#     printf   1 KB | grep -q "objetivo"  → estado 0   · OK
#
# **La variable es `pipefail`**, no el shell ni la implementación de `gzip`.
#
# Y LAS DOS DIRECCIONES DEL ERROR IMPORTAN, porque no cuestan lo mismo:
#   · donde encontrar significa «esto está bien» → falso ROJO: ruidoso, visible;
#   · donde encontrar significa «hay que mirar esto» → **falso VERDE**: la
#     comprobación se salta sola y no deja rastro. En este repo había SEIS de
#     ésos, todos en compuertas de relevancia («¿tengo algo que mirar?»).
#
# QUÉ VIGILA. Que ningún fichero de `scripts/` ni de `.github/workflows/` meta
# datos por una tubería a un lector que puede salir antes de leerlo todo:
# `grep -q…`, `grep -m…` o `head`. La alternativa no cuesta nada y no tiene este
# fallo: `grep -q PAT <<< "$var"`, o `< <(...)` si hay que encadenar.
#
# NO distingue si el fichero declara `pipefail` hoy, **a propósito**: `set -euo
# pipefail` es el estilo de esta casa, y un fichero que hoy no lo tiene lo tendrá
# mañana. Vigilar solo los que ya lo declaran dejaría la bomba puesta esperando
# a que alguien añada una línea perfectamente razonable.
#
# LO QUE NO PUEDE HACER, para que su verde no se lea de más:
#   · **No se vigila a sí mismo ni a su sello.** Los dos llevan el patrón escrito
#     como texto para poder buscarlo y para poder probarlo. Es un punto ciego
#     real y por eso se dice aquí en vez de dejarlo implícito.
#   · **Solo mira lo que hay escrito.** Un lector que salga antes de tiempo
#     invocado por variable (`$CMD`) o construido en tiempo de ejecución se le
#     escapa.
#   · **No juzga la DIRECCIÓN del error.** Dice que el patrón está; si su fallo
#     sería falso rojo o falso verde lo decide quien lo lea.
#
# Uso:
#   bash scripts/pipefail-guard.sh
#   PIPEFAIL_GUARD_RAIZ=<dir> bash scripts/pipefail-guard.sh   (el sello)
#
# Exit 0 = limpio · 1 = hay tuberías que pueden mentir · 2 = no se pudo medir.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RAIZ="${PIPEFAIL_GUARD_RAIZ:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [ ! -d "$RAIZ" ]; then
  echo "::error::pipefail-guard: no existe «$RAIZ». No puedo vigilar lo que no encuentro."
  exit 2
fi

# Los dos ficheros que se excluyen, por nombre y con su motivo escrito arriba.
EXCLUIDOS="${PIPEFAIL_GUARD_EXCLUIDOS:-scripts/pipefail-guard.sh
scripts/pipefail-guard.test.sh}"

# Lectores que pueden cerrar el grifo antes de que el otro termine de escribir.
# `grep -q` en cualquier combinación de banderas (`-qF`, `-qxE`, `-Fq`), `grep -m`
# con su tope, y `head`.
LECTOR='grep[[:space:]]+-[A-Za-z]*q[A-Za-z]*|grep[[:space:]]+-[A-Za-z]*m[A-Za-z]*[[:space:]]*[0-9]|head([[:space:]]|$)'

vigilados=()
while IFS= read -r f; do
  [ -n "$f" ] || continue
  saltar=""
  while IFS= read -r ex; do
    [ -n "$ex" ] || continue
    [ "$f" = "$ex" ] && saltar="si"
  done <<< "$EXCLUIDOS"
  [ -n "$saltar" ] && continue
  vigilados+=("$f")
done <<< "$(cd "$RAIZ" && { ls -1 scripts/*.sh 2>/dev/null; ls -1 .github/workflows/*.yml 2>/dev/null; })"

if [ "${#vigilados[@]}" -eq 0 ]; then
  echo "::error::pipefail-guard: no encontré ni un fichero que vigilar bajo «$RAIZ». Un guardián que no mira nada da verde y además tranquiliza."
  exit 2
fi

FALLOS=0

for f in "${vigilados[@]}"; do
  ruta="$RAIZ/$f"
  [ -f "$ruta" ] || continue

  # Los comentarios NO cuentan, y no es cortesía: el aviso que este guardián
  # existe para que nadie desoiga está escrito COMO COMENTARIO dentro de
  # `db-backup.yml`, citando el patrón. Sin esto, el guardián mordería la
  # advertencia contra la que avisa y nacería rojo por su propia culpa.
  n=0
  while IFS= read -r linea; do
    n=$((n + 1))
    sin_sangria="${linea#"${linea%%[![:space:]]*}"}"
    case "$sin_sangria" in '#'*) continue ;; esac

    if [[ "$linea" =~ \|[[:space:]]*($LECTOR) ]]; then
      echo "::error file=$f,line=$n::pipefail-guard: tubería hacia un lector que puede salir antes de tiempo. Con «pipefail» esto devuelve 141 en cuanto lo que entra pase del buffer, y el resultado se lee al revés."
      echo "  $f:$n"
      echo "  $sin_sangria"
      FALLOS=$((FALLOS + 1))
    fi
  done < "$ruta"
done

if [ "$FALLOS" -gt 0 ]; then
  echo
  echo "pipefail-guard: $FALLOS tubería(s) que pueden mentir cuando crezca lo que les pasas."
  echo
  echo "Cómo se escribe sin el fallo, y no cuesta más:"
  echo "  antes:  printf '%s' \"\$x\" | grep -q PAT"
  echo "  ahora:  grep -q PAT <<< \"\$x\""
  echo "  con cadena:  grep -q PAT < <(awk '…' <<< \"\$x\")"
  echo
  echo "El aquí-string y la sustitución de proceso no son tuberías, así que no hay"
  echo "estado de tubería que se pueda leer al revés."
  exit 1
fi

echo "pipefail-guard: ${#vigilados[@]} fichero(s) mirados, ninguna tubería hacia un lector que salga antes de tiempo — OK."
