#!/usr/bin/env bash
# aviso-despliegue.sh — decide si un despliegue merece aviso, y redacta el aviso.
#
# ─────────────────────────────────────────────────────────────────────────────
# QUÉ PROBLEMA CIERRA
#
# El 11-ago-2026 un despliegue de Railway terminó en **FAILED** y **no avisó a
# nadie**. Se supo dos semanas después, mirando el panel por otro motivo.
#
# No hubo caída —aquel cambio no tocaba servidor y el despliegue anterior siguió
# sirviendo— pero el daño no es ése. `lineas-maestras.md` dice literal: **«Hecho»
# exige vivo, no mergeado.** Quien mueve una tarjeta a «Hecho» comprueba que la
# obra esté viva, y si un despliegue falla en silencio esa comprobación se apoya
# en que alguien vaya a mirar el panel. **El día que no mire, una tarjeta pasa a
# «Hecho» sin estar viva** — el trabajo cambia de estado incorrectamente, que es
# la primera línea de la máxima de esta nave.
#
# Es el mismo patrón que dejó cuatro días sin copia: funcionaba porque alguien
# miraba, hasta que dejó de mirar.
#
# POR QUÉ NO HACE FALTA NINGUNA CREDENCIAL NUEVA, que era lo que parecía. Medido
# antes de construir: **Railway ya informa a GitHub**. El despliegue fallido está
# registrado como tal en la API del repo —`state: failure`, 13:15:27Z sobre el
# commit `abcbaf62`— y GitHub emite el evento `deployment_status`. La información
# ya llegaba; lo que faltaba era que alguien la recogiera.
#
# POR QUÉ ESTO ES UN SCRIPT Y NO SOLO UN PASO DEL WORKFLOW. Porque **su primera
# prueba real sería el primer despliegue fallido**, y eso es exactamente lo que
# costó cuatro días con el aviso de la copia: un avisador que no avisa no se
# distingue de que no haya nada que avisar. Aquí la decisión y el texto se pueden
# ejercer sin desplegar nada — `scripts/aviso-despliegue.test.sh`.
#
# QUÉ HACE, Y QUÉ NO. Decide y redacta; **no habla con GitHub**. Publicar es del
# workflow, que ya tiene el token. Así esto se puede sellar sin red y sin poder
# escribir nada por accidente.
#
# Uso:
#   bash scripts/aviso-despliegue.sh <estado> <entorno> <url-del-despliegue> <sha>
#
# Exit 0 = no hay nada que avisar (y no imprime cuerpo).
# Exit 10 = HAY que avisar; el cuerpo del aviso va por la salida estándar.
# Exit 2 = no se pudo decidir.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

ESTADO="${1:-}"
ENTORNO="${2:-}"
URL="${3:-}"
SHA="${4:-}"

if [ -z "$ESTADO" ]; then
  echo "::error::aviso-despliegue: no me han dicho el estado del despliegue." >&2
  echo "  Sin estado no hay decisión, y «no sé» NO es «todo bien»." >&2
  exit 2
fi

# Los estados que GitHub emite para un despliegue son: queued, pending,
# in_progress, success, failure, error, inactive.
#
# **Avisan `failure` y `error`, y los dos a propósito.** `error` es el fallo del
# propio sistema de despliegue —no llegó a intentarlo— y desde fuera significa lo
# mismo que `failure`: lo que se mergeó NO está vivo. Tratar solo `failure`
# dejaría un modo de fallo callado, que es el defecto que esto viene a cerrar.
case "$ESTADO" in
  failure|error) ;;
  queued|pending|in_progress|success|inactive)
    echo "Despliegue en estado «$ESTADO»: no hay nada que avisar." >&2
    exit 0
    ;;
  *)
    # Un estado que no conocemos NO se traga. Si GitHub añade uno mañana y
    # significa «se rompió», callarlo sería repetir este mismo fallo con otro
    # nombre. Se avisa y se dice que no se reconoce.
    echo "::warning::aviso-despliegue: estado «$ESTADO» no reconocido; se avisa por si acaso." >&2
    ;;
esac

printf '%s\n' \
  "El despliegue ha terminado en **\`${ESTADO}\`**." \
  "" \
  "| | |" \
  "|---|---|" \
  "| **Entorno** | ${ENTORNO:-(sin entorno)} |" \
  "| **Commit** | \`${SHA:-(desconocido)}\` |" \
  "| **Despliegue** | ${URL:-(sin enlace)} |" \
  "| **Cuándo** | $(date -u '+%Y-%m-%d %H:%M UTC') |" \
  "" \
  "## Por qué esto tiene aviso propio" \
  "" \
  "En esta casa **«Hecho» exige vivo, no mergeado**. Quien cierra una entrega" \
  "comprueba que la obra esté viva antes de mover la tarjeta — y si un despliegue" \
  "falla en silencio, esa comprobación depende de que alguien vaya a mirar el" \
  "panel de Railway. El día que no mire, **una tarjeta pasa a «Hecho» sin estarlo**." \
  "" \
  "Ya pasó una vez: el 11-ago-2026 un despliegue salió \`FAILED\` y no lo supo" \
  "nadie hasta dos semanas después." \
  "" \
  "## Qué mirar, en orden" \
  "" \
  "1. **El despliegue**, en el enlace de arriba: el registro dice si reventó el" \
  "   build o el arranque." \
  "2. **Si hay tarjetas en «✅ Hecho» que dependan de este commit**, están" \
  "   afirmando que algo está vivo. Comprueba antes de creerlas." \
  "3. **Qué sirve ahora mismo**: un despliegue fallido no tumba el anterior, así" \
  "   que producción puede estar en pie sirviendo código viejo. Eso no es una" \
  "   caída, pero tampoco es lo que dice el tablero." \
  "" \
  "Cierra esta incidencia cuando haya un despliegue correcto. Si vuelve a fallar" \
  "sin cerrarla, se añade un comentario aquí en vez de abrir otra: una racha tiene" \
  "que leerse como UNA racha, no como veinte avisos que se aprenden a ignorar."

exit 10
