#!/usr/bin/env bash
# email-guard.sh — que no entre una dirección de correo personal nueva en el
# árbol versionado de un repositorio PÚBLICO.
#
# QUÉ FALLO CIERRA. Este repositorio es público —`gh repo view` devuelve
# `visibility=PUBLIC`— y llegó a tener dentro la dirección personal de alguien
# que no había decidido publicarla. Llegó ahí **escribiéndola, sin más**: hasta
# hoy no había nada que lo impidiera. Un robot que rastrea GitHub la recoge, y
# eso no se deshace pidiendo perdón.
#
# POR QUÉ NO ES UN REGEX DE CORREO. El árbol está lleno de direcciones que
# tienen que estar: plantillas (`usuario@example.com`), fixtures de test, y
# direcciones corporativas de proveedores. Un guardián que se ponga rojo ante
# cualquier `@` nace rojo, y en esta casa ya está escrito cómo acaba eso: se
# normaliza el rojo hasta que deja de mirarse. Por eso lo que decide no es la
# forma de la dirección, sino si está DECLARADA — y declararla cuesta un acto
# deliberado con su motivo escrito, en `scripts/email-guard.allowed`.
#
# DOS FORMAS DE DECLARAR, y la diferencia importa:
#
#   · `dominio <dominio>` — todo el dominio pasa. Solo para dominios donde
#     cualquier dirección futura ya sería aceptable: los de ejemplo, los de la
#     casa, y los dominios propios de quien publicó el repositorio.
#   · `sha256 <hash>` — UNA dirección exacta. Para los dominios donde el resto
#     del mundo también tiene buzón: `gmail.com` no se abre entero porque
#     entonces la siguiente dirección personal entraría en silencio, que es
#     justo el fallo que esto cierra.
#
# POR QUÉ HASH Y NO LA DIRECCIÓN EN CLARO. El fichero de declaraciones vive en
# el mismo repositorio público. Declarar escribiendo la dirección lo convertiría
# en un sitio nuevo donde la dirección está publicada — repetir el problema con
# la excusa de vigilarlo. Se declara el `sha256` de la dirección en minúsculas,
# y al lado, en el comentario, la forma enmascarada para que se pueda auditar
# quién está declarado sin volver a publicarlo.
#
# LO QUE **NO** COMPRUEBA. Va aquí y no en un cajón porque la limitación no
# escrita es la que se cobra después, y porque un verde de esto se leerá como
# «no hay correos expuestos» si nadie dice hasta dónde llega:
#
#   · **No mira la historia de git.** Solo el árbol de hoy. Lo ya publicado en
#     los commits antiguos sigue publicado y no lo arregla este guardián: eso
#     es otro trabajo, y está abierto.
#   · **No mira los ficheros que git no versiona**, ni los binarios (los salta
#     al no poder decodificarlos como texto).
#   · **No mira los ficheros de bloqueo de dependencias** —`package-lock.json`,
#     `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`—. Sus direcciones son
#     metadatos de terceros que se regeneran solos al instalar, y nadie decide
#     publicarlas: exigirlas declaradas sería un rojo recurrente por algo que no
#     se escribe a mano. Es una REGLA por nombre de fichero, no una lista, para
#     que cubra también los que aparezcan mañana. Y es un hueco: una dirección
#     escondida ahí a propósito pasaría.
#   · **No detecta direcciones ofuscadas** —`nombre (arroba) dominio`, partidas
#     en dos líneas, o dentro de un binario—. Lo que no case con el patrón de
#     dirección no existe para esto.
#   · **No juzga si una dirección declarada DEBERÍA estar.** Solo que alguien lo
#     decidió a sabiendas y dejó escrito por qué. Un dominio declarado a la
#     ligera abre todo ese dominio para siempre.
#
# Uso:  bash scripts/email-guard.sh
#       EMAIL_GUARD_RAIZ=/otro/arbol EMAIL_GUARD_ALLOWED=/otras/decls \
#         bash scripts/email-guard.sh      (para el sello)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAIZ="${EMAIL_GUARD_RAIZ:-$REPO_ROOT}"
ALLOWED="${EMAIL_GUARD_ALLOWED:-$REPO_ROOT/scripts/email-guard.allowed}"

if [ ! -f "$ALLOWED" ]; then
  echo "::error::email-guard: no existe el fichero de declaraciones $ALLOWED"
  echo ""
  echo "Sin él no se puede distinguir una plantilla de la dirección de una"
  echo "persona, y saltar en verde sería peor que no existir."
  exit 2
fi

if ! git -C "$RAIZ" rev-parse --git-dir >/dev/null 2>&1; then
  echo "::error::email-guard: $RAIZ no es un repositorio git"
  echo ""
  echo "Este guardián mira lo VERSIONADO. Sin índice de git no sabe qué mira."
  exit 2
fi

python3 - "$RAIZ" "$ALLOWED" <<'PY'
import hashlib, os, re, subprocess, sys

raiz, ruta_allowed = sys.argv[1], sys.argv[2]

# Ficheros de bloqueo: excluidos por REGLA de nombre, no por lista. Ver cabecera.
LOCKFILES = {"package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"}

PATRON = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

def enmascarar(dir_):
    local, _, dominio = dir_.partition("@")
    return f"{local[:2]}***@{dominio}"

# ---- las declaraciones -------------------------------------------------------
dominios, hashes, motivos = set(), set(), {}
try:
    with open(ruta_allowed, encoding="utf-8") as fh:
        for n, linea in enumerate(fh, 1):
            sin_comentario = linea.split("#", 1)[0].strip()
            if not sin_comentario:
                continue
            campos = sin_comentario.split()
            if len(campos) != 2:
                print(f"::error file={ruta_allowed},line={n}::email-guard: "
                      f"línea mal formada; se espera «dominio <dominio>» o «sha256 <hash>»")
                raise SystemExit(2)
            clase, valor = campos[0], campos[1].lower()
            if clase == "dominio":
                dominios.add(valor)
            elif clase == "sha256":
                if not re.fullmatch(r"[0-9a-f]{64}", valor):
                    print(f"::error file={ruta_allowed},line={n}::email-guard: "
                          f"«{valor}» no es un sha256 de 64 hex")
                    raise SystemExit(2)
                hashes.add(valor)
            else:
                print(f"::error file={ruta_allowed},line={n}::email-guard: "
                      f"clase desconocida «{clase}»")
                raise SystemExit(2)
            motivos[valor] = linea.split("#", 1)[1].strip() if "#" in linea else ""
except OSError as exc:
    print(f"::error::email-guard: no se pudo leer {ruta_allowed}: {exc}")
    raise SystemExit(2)

# ---- el barrido --------------------------------------------------------------
hallazgos = []
mirados = 0

# `git ls-files` y no `find`: lo que este guardián vigila es lo VERSIONADO. Un
# fichero que git no sigue no se publica al empujar, y uno ignorado tampoco.
listado = subprocess.run(
    ["git", "-C", raiz, "ls-files", "-z"],
    capture_output=True, check=True,
).stdout.decode("utf-8", "surrogateescape")

for ruta in listado.split("\0"):
    if not ruta:
        continue
    if os.path.basename(ruta) in LOCKFILES:
        continue
    completa = os.path.join(raiz, ruta)
    try:
        with open(completa, encoding="utf-8") as fh:
            lineas = fh.readlines()
    except (OSError, UnicodeDecodeError):
        # Binario, enlace roto o ilegible. Declarado en la cabecera como hueco.
        continue
    mirados += 1
    for n, linea in enumerate(lineas, 1):
        for bruto in PATRON.findall(linea):
            dir_ = bruto.lower()
            dominio = dir_.partition("@")[2]
            if dominio in dominios:
                continue
            if hashlib.sha256(dir_.encode("utf-8")).hexdigest() in hashes:
                continue
            hallazgos.append((ruta, n, dir_))

if not hallazgos:
    print(f"email-guard: {mirados} ficheros versionados mirados, "
          f"ninguna dirección sin declarar — OK.")
    raise SystemExit(0)

vistas = {}
for ruta, n, dir_ in hallazgos:
    vistas.setdefault(dir_, []).append((ruta, n))

for ruta, n, dir_ in hallazgos:
    print(f"::error file={ruta},line={n}::email-guard: dirección sin declarar "
          f"«{enmascarar(dir_)}» en {ruta}:{n}")

print("")
print("Este repositorio es PÚBLICO. Una dirección de correo aquí dentro la")
print("recoge cualquier robot, y eso no se deshace borrándola después.")
print("")
print(f"{len(vistas)} dirección(es) distinta(s) sin declarar:")
for dir_, sitios in vistas.items():
    donde = ", ".join(f"{r}:{n}" for r, n in sitios[:5])
    if len(sitios) > 5:
        donde += f" (+{len(sitios) - 5} más)"
    print(f"  · {enmascarar(dir_)} — {donde}")
print("")
print("Si es de una persona que no decidió publicarla: SÁCALA del árbol.")
print("Si tiene que estar, decláralo a sabiendas en")
print(f"  {ruta_allowed}")
print("con el motivo escrito al lado. La dirección NO se escribe en claro ahí:")
print("se declara su sha256, que se calcula así (en minúsculas):")
print("")
print("  printf '%s' '<la dirección>' | tr 'A-Z' 'a-z' | shasum -a 256")
print("")
print("Un dominio entero solo se declara si CUALQUIER dirección futura de ese")
print("dominio también sería aceptable. Para gmail.com y compañía, nunca.")
raise SystemExit(1)
PY

code=$?
case "$code" in
  0) exit 0 ;;
  1) exit 1 ;;
  *) echo "::error::email-guard: comprobación fallida con código $code"; exit "$code" ;;
esac
