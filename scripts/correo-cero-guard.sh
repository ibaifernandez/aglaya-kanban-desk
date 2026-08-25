#!/usr/bin/env bash
# correo-cero-guard.sh — que la nave siga sin mandar correo.
#
# ─────────────────────────────────────────────────────────────────────────────
# QUÉ CIERRA
#
# Decisión de Ibai, 25-ago-2026: **«Cero mails. De todos modos, nunca los leo»**.
# Se retiró todo: los dos digests, su reloj, sus rutas, el envoltorio de envío y
# la dependencia del SDK.
#
# Un borrado no se sostiene solo. Lo que se retira vuelve por la puerta de al
# lado —un `npm install resend` para «avisar de una cosa», un endpoint que manda
# un correo «solo para esto»— y entonces la nave vuelve a mandar correo sin que
# nadie haya decidido que vuelva. Esto pone rojo ese día, no meses después.
#
# ⚠️ ESTO NO PROHÍBE VOLVER A MANDAR CORREO. Prohíbe hacerlo **sin decidirlo**:
# quien lo reintroduzca tendrá que borrar este guardián, y eso se ve en un
# diff. Es la diferencia entre una decisión y un descuido.
#
# QUÉ MIRA. Ficheros **versionados** de código y configuración — el árbol de
# verdad, no lo que haya suelto en el disco. La documentación queda fuera a
# propósito: hablar del correo retirado es justo lo que debe hacer.
#
# Uso:  bash scripts/correo-cero-guard.sh
#       CORREO_GUARD_RAIZ=/otro/arbol bash scripts/correo-cero-guard.sh   (sello)
#
# Exit 0 = no hay ninguna vía de correo · 1 = la hay · 2 = no se pudo medir.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAIZ="${CORREO_GUARD_RAIZ:-$REPO_ROOT}"

if ! git -C "$RAIZ" rev-parse --git-dir >/dev/null 2>&1; then
  echo "::error::correo-cero-guard: «$RAIZ» no es un repositorio git; no puedo mirar el árbol versionado." >&2
  echo "  Y no mirar NO es verde." >&2
  exit 2
fi

# Se escribe a fichero y se comprueba el estado: una tubería que muere a mitad
# deja una lista corta que parece «no hay nada». Es el fallo que dejó a esta
# nave cuatro días sin copia de seguridad.
LISTA="$(mktemp)"; trap 'rm -f "$LISTA"' EXIT
if ! git -C "$RAIZ" ls-files -z > "$LISTA"; then
  echo "::error::correo-cero-guard: no pude listar los ficheros versionados de «$RAIZ»." >&2
  exit 2
fi

MIRADOS=0
HALLAZGOS=0

# Una línea que solo habla del correo retirado no es una vía de correo. Se
# distingue por la forma, no por la intención: comentarios de shell, de JS y de
# YAML. Sin esto, este guardián mordería su propio encabezado.
es_comentario() {
  [[ "$1" =~ ^[[:space:]]*(#|//|\*|--) ]]
}

acusa() {
  local ruta="$1" n="$2" texto="$3" motivo="$4"
  HALLAZGOS=$((HALLAZGOS + 1))
  echo "::error file=${ruta},line=${n}::correo-cero-guard: ${motivo}"
  echo "  ${ruta}:${n} → ${texto}"
}

while IFS= read -r -d '' rel; do
  # La prueba que comprueba que esas rutas contestan 404 TIENE que nombrarlas:
  # es la única forma de comprobar una ausencia. Es la misma excepción que se
  # hacen a sí mismos este guardián y su sello, y es **un fichero exacto**, no
  # «los tests»: eximir `server/tests/*` abriría un agujero por el que puede
  # entrar un envío de verdad.
  case "$rel" in
    docs/*|*.md|scripts/correo-cero-guard.sh|scripts/correo-cero-guard.test.sh) continue ;;
    server/tests/correo-cero.test.js) continue ;;
    server/*|client/src/*|kanban-mcp/*|.github/workflows/*|package.json|scripts/*) ;;
    *) continue ;;
  esac

  abs="$RAIZ/$rel"
  [ -f "$abs" ] || continue
  MIRADOS=$((MIRADOS + 1))

  n=0
  while IFS= read -r linea || [ -n "$linea" ]; do
    n=$((n + 1))
    es_comentario "$linea" && continue

    # 1. El SDK de correo, como dependencia o como import. Cualquiera de los
    #    habituales: el que vuelva no tiene por qué ser el que se fue.
    if [[ "$linea" =~ (\"|\')(resend|nodemailer|@sendgrid/mail|mailgun\.js|postmark)(\"|\') ]]; then
      acusa "$rel" "$n" "$linea" "vuelve un SDK de correo. Esta nave no manda correo (ADR-027)."
      continue
    fi

    # 2. La superficie que se retiró, por si vuelve con otro cuerpo detrás.
    if [[ "$linea" == */api/digest* ]] || [[ "$linea" =~ utils/mailer ]]; then
      acusa "$rel" "$n" "$linea" "vuelve la superficie de digest/correo, retirada el 25-ago-2026."
      continue
    fi

    # 3. Un envío, se llame como se llame el envoltorio.
    if [[ "$linea" =~ (sendEmail|sendMail)[[:space:]]*\( ]]; then
      acusa "$rel" "$n" "$linea" "alguien manda un correo desde la nave."
    fi
  done < "$abs"
done < "$LISTA"

# No haber mirado nada no es «está limpio». Es no saberlo.
if [ "$MIRADOS" -eq 0 ]; then
  echo "::error::correo-cero-guard: no miré ni un fichero. Eso no es verde, es no haber medido." >&2
  exit 2
fi

if [ "$HALLAZGOS" -gt 0 ]; then
  echo
  echo "correo-cero-guard: $HALLAZGOS vía(s) de correo en un sistema que decidió no tener ninguna."
  echo "Si volver a mandar correo es la decisión nueva, dilo en un ADR y retira este"
  echo "guardián en el mismo cambio. Lo que no puede pasar es que vuelva sin que nadie lo decida."
  exit 1
fi

echo "correo-cero-guard: $MIRADOS fichero(s) versionados mirados, ninguna vía de correo — OK."
exit 0
