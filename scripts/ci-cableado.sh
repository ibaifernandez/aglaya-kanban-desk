#!/usr/bin/env bash
# ci-cableado.sh — que el verdicto reciba TODO lo que tiene que juzgar.
#
# QUÉ FALLO CIERRA, y lo creó el commit anterior de esta misma tarjeta.
#
# `ci-verdicto.sh` decide el color del job agrupado, y lo hace bien: tiene su
# sello y aguanta la mutación. Pero **juzga lo que se le pasa**, y hasta hoy
# nada comprobaba que se le pasara todo lo que hay que juzgar.
#
# Antes de fundir los jobs, una comprobación que desaparecía **se veía**: se caía
# de la lista de checks de GitHub. Así se cazó el #34 el 6-ago-2026 —nueve checks
# donde había que ver diez, y el PR dado por `CLEAN`—. Al fundirlos, esa garantía
# estructural se cambió por **una lista de argumentos escrita a mano**: borra una
# línea de la llamada al verdicto y ese guardián se queda en rojo dentro de un
# job en verde, para siempre y sin rastro. Es el #34 con otra cara.
#
# Este guardián devuelve la garantía. Compara **dos conjuntos** leídos del propio
# `ci.yml`:
#
#   A · los `id` de los pasos con `continue-on-error: true` — los que pueden
#       fallar sin tumbar el job, o sea los que ALGUIEN tiene que juzgar;
#   B · los `id` citados como `steps.<id>.outcome` en la llamada al verdicto.
#
# **Si A ≠ B, rojo, y diciendo qué `id`.** En las dos direcciones:
#
#   · `id` en A y no en B → un paso puede fallar y nadie lo mira. **El fallo.**
#   · `id` en B y no en A → la llamada cita un paso que ya no existe; GitHub
#     resolvería `${{ steps.fantasma.outcome }}` a cadena vacía. El verdicto lo
#     pondría rojo (para eso está), pero por un motivo que no es el real y que
#     manda a arreglar otra cosa.
#
# UN PASO CON `continue-on-error` Y SIN `id` TAMBIÉN ES ROJO: no se puede citar,
# así que no se puede juzgar. Es el mismo agujero, sin nombre que ponerle.
#
# POR QUÉ NO USA UN PARSER DE YAML. Haría falta una dependencia —PyYAML no está
# en esta máquina— y este guardián existe para correr sin instalar nada, igual
# que la validación del riel. Lee la estructura por indentación, que en este
# fichero es fija. **Eso es una limitación real** y está abajo, en su sitio.
#
# LO QUE **NO** COMPRUEBA:
#
#   · **Que el conjunto sea el CORRECTO**, solo que los dos coincidan. Si alguien
#     borra un guardián entero —su paso y su entrada en el verdicto—, esto sigue
#     verde. Lo que impide eso es que el guardián borrado deja de correr y su
#     sello deja de existir, no este fichero.
#   · **Solo mira un job** (`comprobaciones-baratas` por defecto). Si mañana se
#     funde otro grupo con el mismo patrón, hay que apuntarlo aquí — y este
#     comentario es la deuda de que eso es una lista, no una regla.
#   · **Lee por indentación.** Reindentar `ci.yml`, meter los pasos con un ancla
#     YAML o partirlos en otro fichero lo deja ciego. No falla: deja de ver, que
#     es peor. Si el job desapareciera del fichero, eso sí es rojo.
#
# Uso:  bash scripts/ci-cableado.sh
#       CI_CABLEADO_WORKFLOW=/otro/ci.yml bash scripts/ci-cableado.sh   (el sello)
#       CI_CABLEADO_JOB=otro-job          bash scripts/ci-cableado.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="${CI_CABLEADO_WORKFLOW:-$REPO_ROOT/.github/workflows/ci.yml}"
JOB="${CI_CABLEADO_JOB:-comprobaciones-baratas}"

if [ ! -f "$WORKFLOW" ]; then
  echo "::error::ci-cableado: no existe $WORKFLOW"
  exit 2
fi

python3 - "$WORKFLOW" "$JOB" <<'PY'
import re, sys

ruta, job = sys.argv[1], sys.argv[2]
lineas = open(ruta, encoding="utf-8").read().split("\n")

# ── localizar el job y su lista de pasos ─────────────────────────────────────
i = 0
while i < len(lineas) and lineas[i] != f"  {job}:":
    i += 1
if i == len(lineas):
    print(f"::error file={ruta}::ci-cableado: el job «{job}» no está en {ruta}")
    print("")
    print("O se renombró, o se borró. En los dos casos esto deja de vigilar algo")
    print("y hay que decirlo, no seguir en verde.")
    raise SystemExit(2)

j = i + 1
while j < len(lineas) and lineas[j].strip() != "steps:":
    # otro job empieza: el nuestro no tenía pasos
    if lineas[j][:3] == "  " + lineas[j][2:3] and re.match(r"^  \S", lineas[j]):
        break
    j += 1
if j == len(lineas) or lineas[j].strip() != "steps:":
    print(f"::error file={ruta},line={i+1}::ci-cableado: el job «{job}» no declara «steps:»")
    raise SystemExit(2)

# ── recorrer los pasos ───────────────────────────────────────────────────────
# Un paso empieza en «      - » (6 espacios). Sus claves van a 8.
pasos = []          # [{"linea": n, "id": str|None, "coe": bool, "raw": [str]}]
actual = None
k = j + 1
while k < len(lineas):
    l = lineas[k]
    if l.strip() and not l.startswith("      "):
        break                                   # se acabó el job
    if l.startswith("      - "):
        actual = {"linea": k + 1, "id": None, "coe": False, "raw": []}
        pasos.append(actual)
        cuerpo = "- " + l[8:]
    else:
        cuerpo = l
    if actual is not None:
        actual["raw"].append(l)
        m = re.match(r"^\s*-?\s*id:\s*(\S+)\s*$", cuerpo)
        if m:
            actual["id"] = m.group(1)
        if re.match(r"^\s*-?\s*continue-on-error:\s*true\s*$", cuerpo):
            actual["coe"] = True
    k += 1

# ── conjunto A: pasos que pueden fallar sin tumbar el job ────────────────────
A, sin_id = set(), []
for p in pasos:
    if not p["coe"]:
        continue
    if p["id"]:
        A.add(p["id"])
    else:
        sin_id.append(p["linea"])

# ── conjunto B: lo que la llamada al verdicto dice juzgar ────────────────────
paso_verdicto = None
for p in pasos:
    if any("ci-verdicto.sh" in l for l in p["raw"]):
        paso_verdicto = p
        break
if paso_verdicto is None:
    print(f"::error file={ruta}::ci-cableado: el job «{job}» no llama a ci-verdicto.sh")
    print("")
    print("Sus pasos con `continue-on-error: true` fallarían sin que nadie ponga")
    print("el job en rojo. Es exactamente el agujero que esto vigila, del tamaño")
    print("del job entero.")
    raise SystemExit(1)

B = set(re.findall(r"steps\.([A-Za-z0-9_-]+)\.outcome", "\n".join(paso_verdicto["raw"])))

# ── el veredicto ─────────────────────────────────────────────────────────────
sin_juzgar = sorted(A - B)
fantasmas  = sorted(B - A)
fallo = False

if sin_id:
    fallo = True
    for n in sin_id:
        print(f"::error file={ruta},line={n}::ci-cableado: paso con "
              f"`continue-on-error: true` y SIN `id` — no se puede citar, así que "
              f"no se puede juzgar")

for x in sin_juzgar:
    fallo = True
    print(f"::error file={ruta},line={paso_verdicto['linea']}::ci-cableado: el paso "
          f"«{x}» puede fallar sin tumbar el job y NADIE lo juzga — falta "
          f"\"steps.{x}.outcome\" en la llamada al verdicto")

for x in fantasmas:
    fallo = True
    print(f"::error file={ruta},line={paso_verdicto['linea']}::ci-cableado: el verdicto "
          f"cita «steps.{x}.outcome» y no hay ningún paso con `id: {x}` y "
          f"`continue-on-error: true`")

if fallo:
    print("")
    print("Antes de fundir los jobs, una comprobación que desaparecía se caía de")
    print("la lista de checks de GitHub y se veía. Así se cazó el #34. Ahora eso")
    print("depende de que la llamada al verdicto esté completa, y por eso existe")
    print("este guardián: para que siga sin depender de que alguien se acuerde.")
    raise SystemExit(1)

print(f"ci-cableado: {len(A)} paso(s) pueden fallar sin tumbar «{job}», "
      f"y el verdicto juzga exactamente esos {len(B)} — OK.")
PY

code=$?
case "$code" in
  0|1|2) exit "$code" ;;
  *) echo "::error::ci-cableado: comprobación fallida con código $code"; exit "$code" ;;
esac
