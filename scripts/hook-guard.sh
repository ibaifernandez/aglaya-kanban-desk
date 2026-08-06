#!/usr/bin/env bash
# hook-guard.sh — que el enganche de permisos no pueda desaparecer callado.
#
# QUÉ FALLO CIERRA, y pasó de verdad el 6-ago-2026, medido en carne propia:
# el enganche se instaló en `.claude/settings.json`, se verificó que denegaba
# subir a la rama principal, y **al cambiar de rama volvió a `{}`** — porque el
# cambio vivía en una rama y la principal no lo tenía todavía. Comprobado en el
# momento: la misma subida en seco que antes se denegaba pasó con «Everything
# up-to-date».
#
# O sea que la protección existía en todas partes menos justo donde había
# ocurrido el incidente que la motivó. Y no dio ningún aviso: un fichero de
# configuración que se queda vacío no se queja.
#
# Este guardián comprueba una sola cosa, y es la que faltaba: **que ese fichero
# siga declarando un enganche `PreToolUse` que apunte al script de permisos.**
# Si alguien lo vacía, lo simplifica «temporalmente» o cambia el comando por
# otro, CI se pone rojo.
#
# LO QUE **NO** COMPRUEBA, y hay que decirlo porque es la mitad más incómoda:
#
#   · **Que el script exista.** Vive en el repo del capitán, y CI solo tiene
#     este. Si allí lo mueven o lo renombran, el enganche deja de aplicar y esto
#     sigue en verde. Es el punto 1 de la tarjeta `56c215cf`, y cerrarlo exige
#     una decisión que no es de esta nave — está razonada en el PR.
#   · **Que el enganche esté CARGADO en la sesión.** Un fichero correcto que
#     nadie ha leído no protege. Eso solo se comprueba intentando una operación
#     denegada, y no se puede hacer desde CI.
#
# Un verde aquí significa «el fichero declara el enganche», no «el enganche está
# vivo». Es menos de lo que suena y más de lo que había.
#
# Uso:  bash scripts/hook-guard.sh
#       HOOK_GUARD_SETTINGS=/otra/ruta bash scripts/hook-guard.sh   (para el sello)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETTINGS="${HOOK_GUARD_SETTINGS:-$REPO_ROOT/.claude/settings.json}"
# El nombre del script de permisos. No la ruta: la ruta es justo lo que puede
# cambiar, y exigirla aquí sería copiar en dos sitios el dato que discutimos.
SCRIPT_ESPERADO="${HOOK_GUARD_SCRIPT:-permiso.py}"

fallo() {
  echo "::error file=.claude/settings.json::hook-guard: $1"
  echo ""
  echo "El enganche de permisos es lo único que hay entre un agente y una subida"
  echo "directa a la rama principal — que en este repo despliega a producción."
  echo "El 6-ago-2026 entraron dos commits así, sin PR y sin segundo par de ojos,"
  echo "y git no protestó."
  echo ""
  echo "Se espera que $SETTINGS declare un enganche PreToolUse cuyo comando"
  echo "invoque «$SCRIPT_ESPERADO»."
  exit 1
}

[ -f "$SETTINGS" ] || fallo "no existe $SETTINGS"

python3 - "$SETTINGS" "$SCRIPT_ESPERADO" <<'PY'
import json, sys

ruta, esperado = sys.argv[1], sys.argv[2]

try:
    with open(ruta, encoding="utf-8") as fh:
        cfg = json.load(fh)
except Exception as exc:
    print(f"NO_JSON:{exc}")
    raise SystemExit(2)

if not isinstance(cfg, dict):
    print("NO_JSON:la raíz no es un objeto")
    raise SystemExit(2)

pre = (cfg.get("hooks") or {}).get("PreToolUse") or []
if not pre:
    # El caso exacto del 6-ago: el fichero existe, es JSON válido, y está vacío.
    print("SIN_HOOK")
    raise SystemExit(3)

comandos = [
    h.get("command", "")
    for entrada in pre
    for h in (entrada.get("hooks") or [])
]

if not any(esperado in (c or "") for c in comandos):
    print("OTRO_COMANDO:" + " | ".join(c for c in comandos if c))
    raise SystemExit(4)

print("OK")
PY

code=$?
case "$code" in
  0) echo "hook-guard: el enganche de permisos sigue declarado — OK."; exit 0 ;;
  2) fallo "$SETTINGS no es JSON válido, así que el enganche no se puede cargar" ;;
  3) fallo "$SETTINGS NO declara ningún enganche PreToolUse. Es el caso exacto del 6-ago-2026: fichero presente, válido, y vacío de protección." ;;
  4) fallo "hay enganche PreToolUse pero su comando no invoca «$SCRIPT_ESPERADO»" ;;
  *) fallo "comprobación fallida con código $code" ;;
esac
