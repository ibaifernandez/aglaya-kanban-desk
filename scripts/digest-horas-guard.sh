#!/usr/bin/env bash
# digest-horas-guard.sh — el reloj del digest y las horas admisibles, la misma lista.
#
# ─────────────────────────────────────────────────────────────────────────────
# QUÉ PROBLEMA CIERRA
#
# El digest tiene DOS consumidores de la misma lista de horas:
#
#   · **el reloj** — el `cron` de `.github/workflows/digest-cron.yml`, que decide
#     a qué horas hay pasada;
#   · **el servidor** — `server/constants/digest-hours.js`, que decide qué hora
#     puede guardar un usuario.
#
# Mientras el servidor aceptara horas que el reloj no visita, existía una **hora
# huérfana**: elegible aquí, nunca visitada allí. A quien la tuviera **no le
# llegaba nada, y sin error que leer**. No rompe: desaparece.
#
# El arreglo fue hacer que sean la misma lista. Este guardián es lo que impide
# que vuelvan a separarse — porque **el YAML no puede importar el fichero JS**,
# así que «la misma lista» no se sostiene sola: se sostiene aquí.
#
# LO QUE ESTO SIGNIFICA, SIN LEERLO DE MÁS. No es «imposible por construcción»:
# es **imposible que diverjan sin que CI lo diga**. Alguien puede editar el `cron`
# y empujar; lo que no puede es que pase desapercibido.
#
# POR QUÉ EL SERVIDOR ES EL CANÓNICO Y EL RELOJ EL DERIVADO. Porque el servidor
# es quien puede FALLAR VISIBLEMENTE ante una hora mala; el reloj solo puede no
# despertarse, que es la forma callada. La lista vive donde puede protestar.
#
# LO QUE NO PUEDE HACER, para que su verde no se lea de más:
#   · **No mira la base de datos.** Una fila con una hora huérfana escrita ANTES
#     de esta lista sigue ahí; eso lo cierra el servidor al reactivar, no esto.
#   · **Solo entiende `cron: '<minuto> <horas> * * *'`** con horas separadas por
#     comas. Un `cron` con rangos (`8-12`) o pasos (`*/2`) lo dice y sale con 2:
#     no adivina, y no medir NO es verde.
#
# Uso:
#   bash scripts/digest-horas-guard.sh
#   DIGEST_GUARD_WORKFLOW=<f> DIGEST_GUARD_CONSTANTES=<f> bash scripts/digest-horas-guard.sh
#
# Exit 0 = dicen lo mismo · 1 = divergen · 2 = no se pudo medir.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="${DIGEST_GUARD_WORKFLOW:-$RAIZ/.github/workflows/digest-cron.yml}"
CONSTANTES="${DIGEST_GUARD_CONSTANTES:-$RAIZ/server/constants/digest-hours.js}"

for f in "$WORKFLOW" "$CONSTANTES"; do
  if [ ! -f "$f" ]; then
    echo "::error::digest-horas-guard: no existe «$f»."
    echo "  Si se movió, este guardián deja de vigilar algo y hay que decirlo, no seguir en verde."
    exit 2
  fi
done

# ── el reloj ─────────────────────────────────────────────────────────────────
DEL_RELOJ="$(python3 - "$WORKFLOW" <<'PY'
import re, sys
lineas = open(sys.argv[1], encoding="utf-8").read().split("\n")
horas, vistos = [], 0
for l in lineas:
    if l.lstrip().startswith("#"):
        continue
    m = re.search(r"-\s*cron:\s*['\"]([^'\"]+)['\"]", l)
    if not m:
        continue
    vistos += 1
    campos = m.group(1).split()
    if len(campos) != 5:
        print("ERROR|no son cinco campos: " + m.group(1)); raise SystemExit(0)
    campo_horas = campos[1]
    if not re.fullmatch(r"\d+(,\d+)*", campo_horas):
        print("ERROR|no sé leer el campo de horas «%s» (¿rango o paso?)" % campo_horas)
        raise SystemExit(0)
    horas += [int(x) for x in campo_horas.split(",")]
if vistos == 0:
    print("ERROR|no encontré ni un `cron:` en el workflow"); raise SystemExit(0)
print("OK|" + ",".join(str(h) for h in sorted(set(horas))))
PY
)"

if [ "${DEL_RELOJ%%|*}" = "ERROR" ]; then
  echo "::error::digest-horas-guard: ${DEL_RELOJ#*|}"
  echo "  No adivino: un `cron` que no sé leer se declara ilegible, no se da por bueno."
  exit 2
fi
HORAS_RELOJ="${DEL_RELOJ#*|}"

# ── la lista canónica ────────────────────────────────────────────────────────
# Se lee EJECUTANDO el módulo, no con un regex sobre su texto: así lo que se
# compara es lo que el servidor usa de verdad, no lo que parece decir el fichero.
HORAS_LISTA="$(node -e '
  const { DIGEST_HOURS } = require(process.argv[1]);
  if (!Array.isArray(DIGEST_HOURS) || DIGEST_HOURS.length === 0) {
    console.error("vacía o no es una lista"); process.exit(3);
  }
  console.log([...new Set(DIGEST_HOURS)].sort((a, b) => a - b).join(","));
' "$CONSTANTES" 2>&1)"
CODIGO=$?

if [ "$CODIGO" -ne 0 ]; then
  echo "::error::digest-horas-guard: no pude leer DIGEST_HOURS de «$CONSTANTES»."
  echo "  $HORAS_LISTA"
  echo "  Sin la lista canónica no hay contra qué comparar, y eso NO es verde."
  exit 2
fi

# ── el veredicto ─────────────────────────────────────────────────────────────
echo "reloj  (digest-cron.yml):        $HORAS_RELOJ"
echo "lista  (digest-hours.js):        $HORAS_LISTA"

if [ "$HORAS_RELOJ" != "$HORAS_LISTA" ]; then
  echo
  echo "::error::digest-horas-guard: el reloj y las horas admisibles NO dicen lo mismo."
  echo
  echo "Una hora que el servidor acepta y el reloj no visita deja a quien la elija"
  echo "SIN DIGEST y sin error que leer. Y una hora que el reloj visita y el"
  echo "servidor no acepta es una pasada que no puede servir a nadie."
  echo
  echo "La lista canónica es server/constants/digest-hours.js. El `cron` se ajusta"
  echo "a ella, no al revés: el servidor es el único de los dos que puede protestar."
  exit 1
fi

echo
echo "digest-horas-guard: el reloj visita exactamente las horas que el servidor admite — OK."
