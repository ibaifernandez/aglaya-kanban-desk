#!/usr/bin/env python3
"""Funde los fragmentos de `docs/changelog.d/` dentro de `docs/CHANGELOG.md`.

═══════════════════════════════════════════════════════════════════════════════
QUÉ DEFECTO CIERRA, Y POR QUÉ NO ERA UN REBASE DE UN MINUTO

13 de los últimos 15 PR mergeados tocan `docs/CHANGELOG.md`, y todos escriben en
el mismo sitio: el bloque de arriba. Dos ramas vivas a la vez chocan ahí — no es
probable, es seguro. Y en esta casa **la aprobación pertenece al commit**: al
refrescar la rama cambia el HEAD y **caduca una medición del vigilante que ya
estaba hecha**, aunque el trabajo no se haya tocado.

Un fichero por entrada quita el choque **por construcción**: dos ramas escriben
ficheros con nombres distintos, y dos ficheros distintos no se pisan en ningún
motor de fusión.

═══════════════════════════════════════════════════════════════════════════════
POR QUÉ NO SE ELIGIÓ `.gitattributes` CON `merge=union`, QUE ERA UN RENGLÓN

**Se midió, no se opinó.** En local funciona: `git merge` resuelve solo y deja
las dos entradas en orden y sin duplicar.

**Pero el motor de fusión de GitHub NO lo aplica.** Medido el 9-ago-2026 contra
el repositorio real, con `.gitattributes` en la rama base y dos ramas divergentes
sobre ella:

    POST /repos/:owner/:repo/merges  →  409  {"message": "Merge conflict"}

Y ese `409` es exactamente el síntoma que se quería quitar: lo que obliga a
refrescar no es `git` en la máquina de nadie, es GitHub marcando el PR como
`CONFLICTING`. La opción de un renglón arregla el sitio donde no dolía.

A eso se le suma lo que la tarjeta ya advertía: `union` resuelve **en silencio**.
Un arreglo que solo puede fallar callado es sospechoso por defecto en esta casa.

═══════════════════════════════════════════════════════════════════════════════
LO QUE ESTA HERRAMIENTA NO HACE, dicho para que su verde no se lea de más

- **No corre en CI ni escribe sola.** Fundir es un acto deliberado de quien
  publica. Lo que sí corre en CI es el guardián (`scripts/changelog-guard.sh`),
  que solo mira y nunca escribe.
- **No juzga si una entrada está bien redactada.** Comprueba forma, no verdad.

Uso:
    python3 scripts/changelog-fundir.py --comprobar   # valida; no escribe
    python3 scripts/changelog-fundir.py --a-stdout    # imprime el resultado
    python3 scripts/changelog-fundir.py --aplicar     # escribe y borra fragmentos

Sobreescribibles para poder sellarlo: CHANGELOG_DIR, CHANGELOG_FILE.
Salida 0 = bien · 1 = hay algo mal · 2 = no se pudo medir.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DIR_FRAG = Path(os.environ.get("CHANGELOG_DIR", RAIZ / "docs" / "changelog.d"))
FICHERO = Path(os.environ.get("CHANGELOG_FILE", RAIZ / "docs" / "CHANGELOG.md"))

# Las de Keep a Changelog más las dos que este repo ya usa de hecho. La lista se
# declara aquí y el guardián la lee de aquí: dos listas divergen, una no puede.
CATEGORIAS = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security",
              "Governance"]

CABECERA_UNRELEASED = "## [Unreleased]"
# El puntero que vive bajo la cabecera. No se toca al fundir.
MARCA_PUNTERO = "<!-- changelog.d -->"

NOMBRE_VALIDO = re.compile(r"^[0-9a-z][0-9a-z._-]*\.md$")


class Roto(Exception):
    """No se pudo medir: el árbol no está como esta herramienta necesita."""


def fragmentos() -> list[Path]:
    if not DIR_FRAG.is_dir():
        raise Roto(f"no existe el directorio de fragmentos «{DIR_FRAG}».")
    fs = [p for p in sorted(DIR_FRAG.iterdir())
          if p.is_file() and p.suffix == ".md" and p.name != "README.md"]
    return fs


def leer(p: Path) -> tuple[str, str, list[str]]:
    """→ (categoría, cuerpo, problemas). Nunca lanza: acumula lo que esté mal."""
    problemas: list[str] = []
    if not NOMBRE_VALIDO.match(p.name):
        problemas.append(
            f"«{p.name}»: el nombre debe ser minúsculas, dígitos, punto, guion o "
            f"guion bajo, y acabar en «.md». El nombre es lo ÚNICO que impide "
            f"que dos ramas choquen: si dos eligen el mismo, vuelve el conflicto.")

    lineas = p.read_text(encoding="utf-8").split("\n")
    # Primera línea con contenido = la categoría.
    i = 0
    while i < len(lineas) and not lineas[i].strip():
        i += 1
    if i >= len(lineas):
        problemas.append(f"«{p.name}»: está vacío. Un fragmento vacío se funde sin "
                         f"dejar nada y nadie se entera de que se perdió una entrada.")
        return ("", "", problemas)

    categoria = lineas[i].strip()
    if categoria not in CATEGORIAS:
        problemas.append(
            f"«{p.name}»: primera línea «{categoria}» no es una categoría. "
            f"Válidas: {', '.join(CATEGORIAS)}.")

    cuerpo = "\n".join(lineas[i + 1:]).strip("\n")
    if not cuerpo.strip():
        problemas.append(f"«{p.name}»: tiene categoría y no tiene entrada debajo.")
    elif not cuerpo.lstrip().startswith("-"):
        problemas.append(
            f"«{p.name}»: la entrada tiene que empezar por una viñeta «- ». "
            f"Lo que no es viñeta se funde dentro de una lista y la rompe.")
    return (categoria, cuerpo, problemas)


def limites_unreleased(lineas: list[str]) -> tuple[int, int]:
    """[inicio, fin) de la sección Unreleased. Lanza si no está."""
    inicio = None
    for n, l in enumerate(lineas):
        if l.strip() == CABECERA_UNRELEASED:
            inicio = n
            break
    if inicio is None:
        raise Roto(f"«{FICHERO.name}» no tiene «{CABECERA_UNRELEASED}». Sin esa "
                   f"cabecera no hay dónde fundir, y escribir a ciegas en un "
                   f"registro es peor que no escribir.")
    for n in range(inicio + 1, len(lineas)):
        if lineas[n].startswith("## ["):
            return (inicio, n)
    return (inicio, len(lineas))


def fundir(lineas: list[str], entradas: list[tuple[str, str]]) -> list[str]:
    """Mete cada entrada bajo su categoría, dentro de Unreleased.

    Se inserta bajo la PRIMERA `### <categoría>` que haya dentro de Unreleased —
    esa sección acumula bloques de varias tandas y la de arriba es la reciente—.
    Si no existe ninguna, se crea justo bajo la cabecera, después del puntero.
    """
    salida = list(lineas)
    for categoria, cuerpo in entradas:
        inicio, fin = limites_unreleased(salida)
        destino = None
        for n in range(inicio + 1, fin):
            if salida[n].strip() == f"### {categoria}":
                destino = n + 1
                break
        if destino is None:
            # Detrás de la cabecera y de su puntero, para no separarlos.
            n = inicio + 1
            while n < fin and (not salida[n].strip() or MARCA_PUNTERO in salida[n]
                               or salida[n].startswith(">")):
                n += 1
            salida[n:n] = [f"### {categoria}", ""]
            destino = n + 1
        salida[destino:destino] = cuerpo.split("\n")
    return salida


def es_subsecuencia(pequena: list[str], grande: list[str]) -> int | None:
    """Índice de la primera línea de `pequena` que no aparece en orden. None si sí.

    Fundir solo puede AÑADIR. Si una línea del registro original deja de estar, o
    cambia de orden, se ha perdido historia — y un registro que pierde historia en
    silencio es peor que no tenerlo, porque sigue pareciendo completo.
    """
    j = 0
    for i, l in enumerate(pequena):
        while j < len(grande) and grande[j] != l:
            j += 1
        if j == len(grande):
            return i
        j += 1
    return None


def veces_que_aparece(bloque: list[str], texto: list[str]) -> int:
    if not bloque:
        return 0
    n = 0
    for i in range(len(texto) - len(bloque) + 1):
        if texto[i:i + len(bloque)] == bloque:
            n += 1
    return n


def verificar(lineas: list[str], entradas: list[tuple[str, str]]) -> list[str]:
    """Comprueba que la fusión ni pierde ni duplica. Devuelve los fallos.

    Es la condición 3 de la tarjeta: si la solución escribe sola, algo tiene que
    ponerse rojo cuando el resultado no es el esperado. Fundir no resuelve
    conflictos, pero sí escribe un fichero — y esto es lo que impide que lo haga
    mal en silencio.
    """
    fallos: list[str] = []
    resultado = fundir(lineas, entradas)

    falta = es_subsecuencia(lineas, resultado)
    if falta is not None:
        fallos.append(
            f"fundir PIERDE historia: la línea {falta + 1} del registro "
            f"(«{lineas[falta][:60]}») no sobrevive, o sobrevive fuera de orden.")

    for _, cuerpo in entradas:
        bloque = cuerpo.split("\n")
        veces = veces_que_aparece(bloque, resultado)
        if veces == 0:
            fallos.append(f"una entrada se perdió al fundir: «{bloque[0][:60]}».")
        elif veces > 1:
            fallos.append(
                f"una entrada quedó DUPLICADA {veces} veces al fundir: "
                f"«{bloque[0][:60]}». Un registro con la misma entrada dos veces "
                f"no se lee como un error, se lee como dos cosas distintas.")

    return fallos


def main() -> int:
    modo = sys.argv[1] if len(sys.argv) > 1 else "--comprobar"
    if modo not in ("--comprobar", "--verificar", "--a-stdout", "--aplicar"):
        print(f"modo desconocido: {modo}", file=sys.stderr)
        return 2

    try:
        fs = fragmentos()
        if not FICHERO.is_file():
            raise Roto(f"no existe «{FICHERO}».")
        lineas = FICHERO.read_text(encoding="utf-8").split("\n")
        limites_unreleased(lineas)          # que exista, antes de nada
    except Roto as e:
        print(f"::error::changelog-fundir: {e}")
        return 2

    entradas: list[tuple[str, str]] = []
    problemas: list[str] = []
    for p in fs:
        categoria, cuerpo, probs = leer(p)
        problemas.extend(probs)
        if not probs:
            entradas.append((categoria, cuerpo))

    if problemas:
        for m in problemas:
            print(f"::error::changelog-fundir: {m}")
        return 1

    if modo == "--comprobar":
        n = len(entradas)
        print(f"changelog-fundir: {n} fragmento(s), todos bien formados — OK.")
        return 0

    if modo == "--verificar":
        fallos = verificar(lineas, entradas)
        if fallos:
            for m in fallos:
                print(f"::error::changelog-fundir: {m}")
            return 1
        print(f"changelog-fundir: {len(entradas)} fragmento(s) bien formados y la "
              f"fusión en seco ni pierde ni duplica — OK.")
        return 0

    resultado = fundir(lineas, entradas)
    texto = "\n".join(resultado)

    if modo == "--a-stdout":
        sys.stdout.write(texto)
        return 0

    FICHERO.write_text(texto, encoding="utf-8")
    for p in fs:
        p.unlink()
    print(f"changelog-fundir: {len(entradas)} entrada(s) fundida(s) y sus "
          f"fragmentos retirados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
