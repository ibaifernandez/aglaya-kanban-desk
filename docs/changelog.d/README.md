# `docs/changelog.d/` — una entrada de registro por fichero

**Aquí escribe su entrada quien cierra una tarjeta. No en `docs/CHANGELOG.md`.**

## Por qué

13 de los últimos 15 PR mergeados tocaban `docs/CHANGELOG.md`, y todos escribían
en el mismo sitio: el bloque de arriba. **Dos ramas vivas a la vez chocaban ahí —
no era probable, era seguro.**

Y el choque no costaba un rebase: en esta casa **la aprobación pertenece al
commit**, así que refrescar la rama cambia el HEAD y **caduca una medición del
vigilante que ya estaba hecha**, aunque el trabajo no se haya tocado. Ocurrió el
9-ago-2026 y costó una vuelta entera de dos papeles.

**Un fichero por entrada quita el choque por construcción:** dos ramas escriben
ficheros con nombres distintos, y dos ficheros distintos no se pisan en ningún
motor de fusión.

## Cómo se escribe una

Un fichero por tarjeta, llamado con el **identificador de la tarjeta** por
delante. El nombre es lo único que impide el choque: si dos ramas eligen el
mismo, vuelve el conflicto.

```
docs/changelog.d/06d44e22-registro-sin-choques.md
```

Dentro: **la categoría en la primera línea**, y debajo la entrada en viñetas.

```markdown
Added

- **Lo que se hizo, en una frase que se entienda sin abrir nada.** Tarjeta `06d44e22`.
  - Un detalle, si hace falta.
```

Categorías válidas: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
`Security`, `Governance`. **La lista la declara
[`scripts/changelog-fundir.py`](../../scripts/changelog-fundir.py)** — no se
copia aquí porque una copia de una lista envejece sola; esto la nombra para que
se pueda leer, y el guardián casa contra la de allí.

## Cómo se publican

```bash
python3 scripts/changelog-fundir.py --aplicar
```

Funde todos los fragmentos dentro de `## [Unreleased]` de
[`../CHANGELOG.md`](../CHANGELOG.md) y los retira. **No corre en CI y no se
dispara solo:** publicar es un acto deliberado de quien publica.

Para ver el resultado sin escribir nada: `--a-stdout`. Para validar: `--comprobar`.

## Qué se pone rojo

[`scripts/changelog-guard.sh`](../../scripts/changelog-guard.sh) corre en CI, no
escribe, y muerde si un fragmento está mal formado —sin categoría, vacío, o sin
viñeta— **o si fundir perdería una línea del registro o duplicaría una entrada**.
Lo segundo importa más de lo que parece: un registro al que le falta una entrada,
o que la trae dos veces, **sigue pareciendo un registro completo**.

## El precio, dicho

Mientras haya fragmentos sin fundir, **«qué cambió» se lee en dos sitios**:
`CHANGELOG.md` para lo publicado y este directorio para lo que aún no. Es un
salto, no una copia — y `CHANGELOG.md` lo dice en su cabecera. Se cierra
fundiendo.
