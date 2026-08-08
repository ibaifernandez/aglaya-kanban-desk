#!/usr/bin/env python3
"""Deriva del ESQUEMA qué privilegios le toca a cada (rol, tabla).

POR QUÉ ESTO EXISTE COMO PIEZA APARTE. `grants-guard.sh` compara lo que hay en
la base contra lo que el esquema declara. Mientras «lo declarado» fue una sola
cadena para todos —`SELECT` para `anon`— cabía en una variable. Deja de caber en
cuanto hay **dos roles con conjuntos distintos** y, sobre todo, en cuanto hay
**excepciones por tabla**.

Y la excepción tiene que declararse **donde se declara el esquema**, no dentro
del guardián. Una lista de excepciones escrita a mano en un script es completa
el día que se escribe: es la avería que el #35 ya cerró para `contract-guard`.
Así que esto no lleva ninguna lista — **lee `docs/schema/supabase-schema.sql` y
deriva**.

QUÉ SABE LEER, y es exactamente lo que el esquema usa hoy:

  1. El bucle de la sección 9, del que saca el DEFAULT por rol:

         FOR t IN SELECT tablename FROM pg_tables
                   WHERE schemaname = 'public'
                     AND tablename <> 'una_tabla'      ← exclusiones del bucle
         LOOP
           EXECUTE format('GRANT SELECT ON public.%I TO anon;', t);
           EXECUTE format('GRANT SELECT, INSERT ON public.%I TO a, b;', t);

  2. Las líneas sueltas de fuera del bucle, que son las EXCEPCIONES por tabla:

         GRANT SELECT, INSERT ON public.card_description_history TO authenticated;

LO QUE **NO** SABE HACER, y hay que leerlo antes de fiarse:

  · **No entiende `REVOKE` fuera del bucle.** Un `REVOKE` suelto no resta de lo
    que este parser calculó: lo que manda es el `GRANT` explícito de esa tabla,
    que lo sustituye entero. El esquema declara las excepciones concediendo, no
    restando, y por eso alcanza — pero si algún día alguien declara una
    excepción restando, esto la ignoraría **en silencio**.
  · **No lee migraciones.** Solo el esquema, que es la fuente de verdad
    declarada. Si una migración se aplicó y el esquema no lo dice, eso es deriva
    y lo mira otro guardián (`schema-drift-guard.sh`).
  · **No mira `service_role`.** El guardián compara los roles que se le pidan.

Uso:  python3 scripts/grants-expectativa.py <esquema.sql> <rol> [<rol> …]
Sale: líneas `rol|tabla_o_*|PRIVS,ORDENADOS` — `*` es el default de ese rol.
"""

import re
import sys


def normaliza(privs):
    """`SELECT, INSERT` → `INSERT,SELECT`. El orden lo fija el guardián, no el que escribe."""
    return ",".join(sorted(p.strip().upper() for p in privs.split(",") if p.strip()))


def derivar(texto, roles):
    lineas = texto.split("\n")

    # ── 1. el bucle: default por rol, y qué tablas se salen de él ────────────
    defaults = {}
    excluidas = set()
    dentro = False
    for l in lineas:
        if re.search(r"FOR\s+t\s+IN\s+SELECT\s+tablename\s+FROM\s+pg_tables", l):
            dentro = True
        if dentro:
            for m in re.finditer(r"tablename\s*<>\s*'([^']+)'", l):
                excluidas.add(m.group(1))
            m = re.search(
                r"GRANT\s+([A-Z, ]+?)\s+ON\s+public\.%I\s+TO\s+([a-z_, ]+);", l, re.I
            )
            if m:
                privs, destinatarios = m.group(1), m.group(2)
                for rol in (r.strip() for r in destinatarios.split(",")):
                    if rol in roles:
                        defaults[rol] = normaliza(privs)
            if re.search(r"END\s+LOOP", l, re.I):
                dentro = False

    faltan = [r for r in roles if r not in defaults]
    if faltan:
        print(
            f"::error::grants-expectativa: el bucle de GRANTs del esquema no le "
            f"concede nada a {', '.join(faltan)} — no se puede derivar qué le toca",
            file=sys.stderr,
        )
        return None

    # ── 2. las excepciones: GRANT sueltos, fuera del bucle ───────────────────
    # `public.%I` es el del bucle; aquí interesan los que nombran una tabla real.
    excepciones = {}
    for l in lineas:
        if "%I" in l or l.lstrip().startswith("--"):
            continue
        m = re.search(
            r"GRANT\s+([A-Z, ]+?)\s+ON\s+public\.([a-z_][a-z0-9_]*)\s+TO\s+([a-z_, ]+);",
            l,
            re.I,
        )
        if not m:
            continue
        privs, tabla, destinatarios = m.group(1), m.group(2), m.group(3)
        for rol in (r.strip() for r in destinatarios.split(",")):
            if rol in roles:
                excepciones[(rol, tabla)] = normaliza(privs)

    # Una tabla excluida del bucle SIN excepción declarada es un agujero: nadie
    # dice qué le toca, así que el guardián no puede juzgarla.
    for tabla in sorted(excluidas):
        for rol in roles:
            if (rol, tabla) not in excepciones:
                print(
                    f"::error::grants-expectativa: «{tabla}» está excluida del bucle "
                    f"de GRANTs y nadie declara qué le toca a «{rol}»",
                    file=sys.stderr,
                )
                return None

    salida = [f"{rol}|*|{privs}" for rol, privs in sorted(defaults.items())]
    salida += [
        f"{rol}|{tabla}|{privs}" for (rol, tabla), privs in sorted(excepciones.items())
    ]
    return salida


def main():
    if len(sys.argv) < 3:
        print(__doc__.strip().split("Uso:")[-1].strip(), file=sys.stderr)
        raise SystemExit(2)

    ruta, roles = sys.argv[1], set(sys.argv[2:])
    try:
        texto = open(ruta, encoding="utf-8").read()
    except OSError as exc:
        print(f"::error::grants-expectativa: no se pudo leer {ruta}: {exc}", file=sys.stderr)
        raise SystemExit(2)

    salida = derivar(texto, roles)
    if salida is None:
        raise SystemExit(2)
    print("\n".join(salida))


if __name__ == "__main__":
    main()
