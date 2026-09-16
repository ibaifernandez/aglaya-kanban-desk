#!/usr/bin/env bash
# publicar-cifras.sh — mide las cifras públicas de esta nave y las publica en la
# rama huérfana `cifras`. Contrato `cifras-publicas` v1 (aglaya-orchestrator,
# `atlas/flota/contratos/cifras-publicas.md`). Tarjeta `c82aa8b9`.
#
# ─────────────────────────────────────────────────────────────────────────────
# PARA QUÉ
#
# El portafolio de Ibai publicaba las cifras de esta nave escritas a mano, y se
# pudrían: su portada decía `v1.3.1 · 102 tests` con el repositorio ya en 1.4.0.
# El contrato hace que la cifra la mida quien la custodia, con fecha, y que quien
# la publica la lea de aquí.
#
# QUÉ PUBLICA, y de dónde sale cada valor —SIEMPRE de esta misma ejecución—:
#
#   version       ← `package.json` del commit medido
#   tests         ← el recuento de jest del job `server-tests` de esta ejecución,
#                   que solo lo emite si la batería sale entera en verde
#   tablas_rls    ← catálogo de la base: tablas de `public` con RLS activado
#   policies_rls  ← catálogo de la base: RECUENTO de políticas en `public`.
#                   Contar políticas no demuestra que funcionen, y la `fuente`
#                   lo dice.
#   foreign_keys            ← catálogo: claves foráneas de tablas de `public`
#   fk_con_accion_al_borrar ← de esas, las que HACEN algo al borrar. No se llama
#                   `on_delete`: el catálogo no distingue un NO ACTION escrito de
#                   uno omitido, así que «cláusulas ON DELETE» no se puede medir.
#   indices_adicionales     ← índices que no sostienen PK ni UNIQUE/EXCLUDE. No se
#                   llama «de rendimiento»: esa palabra no está en el catálogo.
#
#   Las cinco cifras de la base salen de UNA consulta, `scripts/cifras-catalogo.sql`,
#   y ese mismo fichero se mide contra casos conocidos en Postgres real con
#   `docs/schema/pruebas/cifras-catalogo.sh` (tarjeta `fb44ba1a`).
#
# LO QUE NO PUBLICA, y es decisión: `tablas_backup`. Ningún proceso de CI RESTAURA
# la copia; `verificar-volcado.sh` comprueba que el volcado contiene las tablas, y
# corre en otro workflow. Publicar «restaura» sería una cifra inventada.
#
# ⚠️ EL REPOSITORIO ES PÚBLICO. La consulta a la base solo lee el catálogo —cero
# filas, cero datos— y la rama `cifras` solo contiene el JSON.
#
# ─────────────────────────────────────────────────────────────────────────────
# ⏱ QUÉ SIGNIFICA SU VERDE, Y QUÉ NO
#
# `version` y `tests` son del commit medido. **Las cinco cifras del catálogo NO:
# son de la base en el instante de la medición**, y una cifra así
# caduca sin que cambie una línea del repositorio. Por eso el JSON lleva `medido_el`, y por eso
# este script imprime al final el instante contra el que midió. El consumidor
# publica la fecha junto al valor; no es un adorno.
#
# ⏱ Y LA VENTANA DE APLICAR ANTES DE MERGEAR.
# Esta casa aplica una migración y
# DESPUÉS mergea su declaración. Entre las dos cosas, la base va por delante de
# `main`: una publicación en ese hueco cuenta tablas o políticas que el commit
# medido todavía no declara. A diferencia de un guardián, aquí no hay
# rojo con razón que avise —la cifra de la base es cierta—; la discrepancia se cierra
# mergeando, y la siguiente ejecución en verde publica ya coherente.
#
# ─────────────────────────────────────────────────────────────────────────────
# CÓMO NO DEJA LA RAMA A MEDIAS
#
# Todo se mide y se valida ANTES de tocar git. Si falta un valor o no tiene la
# forma esperada, sale sin escribir nada. Después se construye un commit completo
# en un directorio aparte y se publica con UN solo `push`: o entra entero, o no
# entra. Y el `push` NO es forzado: si otra ejecución publicó en medio, este falla
# en vez de pisarla.
#
# Entradas (entorno):
#   CIFRAS_TESTS        recuento de tests (lo pasa el job que mide)
#   CIFRAS_COMMIT       SHA completo de main que se midió
#   CIFRAS_EJECUCION    URL de la ejecución de CI
#   DATABASE_URL        para las cinco cifras del catálogo
#
# Costuras para el sello (sin red y sin base):
#   CIFRAS_TABLAS_RLS, CIFRAS_POLICIES_RLS, CIFRAS_FOREIGN_KEYS,
#   CIFRAS_FK_CON_ACCION, CIFRAS_INDICES_ADICIONALES   saltan la consulta a la base
#   CIFRAS_REMOTO                             repositorio al que se publica
#   CIFRAS_MEDIDO_EL                          fecha fija
#
# Exit 0 = publicado · 1 = una cifra falta o no es válida (no se publica) ·
#      2 = no se pudo medir (no se publica).
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTO="${CIFRAS_REMOTO:-origin}"
RAMA="cifras"

falla() { echo "::error::publicar-cifras: $2"; echo "No se publica nada: la última medición publicada sigue siendo la válida."; exit "$1"; }

# ── 1 · medir ────────────────────────────────────────────────────────────────
version="$(node -p "require('$RAIZ/package.json').version" 2>/dev/null)" \
  || falla 2 "no pude leer la versión de package.json"
tests="${CIFRAS_TESTS:-}"
commit="${CIFRAS_COMMIT:-}"
ejecucion="${CIFRAS_EJECUCION:-}"
medido_el="${CIFRAS_MEDIDO_EL:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

if [ -n "${CIFRAS_TABLAS_RLS+x}${CIFRAS_POLICIES_RLS+x}${CIFRAS_FOREIGN_KEYS+x}${CIFRAS_FK_CON_ACCION+x}${CIFRAS_INDICES_ADICIONALES+x}" ]; then
  tablas_rls="${CIFRAS_TABLAS_RLS:-}"
  policies_rls="${CIFRAS_POLICIES_RLS:-}"
  foreign_keys="${CIFRAS_FOREIGN_KEYS:-}"
  fk_con_accion="${CIFRAS_FK_CON_ACCION:-}"
  indices_adicionales="${CIFRAS_INDICES_ADICIONALES:-}"
else
  conn="${DATABASE_URL:-}"
  [ -n "$conn" ] || falla 2 "falta DATABASE_URL: sin base no hay cifras del catálogo, y no se publica un JSON incompleto"
  command -v psql >/dev/null 2>&1 || falla 2 "falta psql en el corredor"
  # Una sola consulta, solo catálogo. Es el mismo fichero que mide a mano
  # `docs/schema/pruebas/cifras-catalogo.sh` contra casos conocidos.
  fila="$(psql "$conn" -t -A -F ' ' -v ON_ERROR_STOP=1 -f "$RAIZ/scripts/cifras-catalogo.sql")" \
    || falla 2 "la consulta al catálogo falló"
  read -r tablas_rls policies_rls foreign_keys fk_con_accion indices_adicionales <<<"$fila"
fi

# ── 2 · validar, antes de tocar git ──────────────────────────────────────────
entero() { [[ "$1" =~ ^[0-9]+$ ]]; }
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]] || falla 1 "version «$version» no parece una versión"
entero "$tests"        || falla 1 "tests «$tests» no es un recuento: el job que mide no lo emitió (¿batería en rojo?)"
[ "$tests" -gt 0 ]     || falla 1 "tests es 0: una batería vacía no es una cifra publicable"
entero "$tablas_rls"   || falla 1 "tablas_rls «$tablas_rls» no es un recuento"
entero "$policies_rls" || falla 1 "policies_rls «$policies_rls» no es un recuento"
entero "${foreign_keys:-}"        || falla 1 "foreign_keys «${foreign_keys:-}» no es un recuento"
entero "${fk_con_accion:-}"       || falla 1 "fk_con_accion_al_borrar «${fk_con_accion:-}» no es un recuento"
entero "${indices_adicionales:-}" || falla 1 "indices_adicionales «${indices_adicionales:-}» no es un recuento"
[ "$fk_con_accion" -le "$foreign_keys" ] \
  || falla 1 "fk_con_accion_al_borrar ($fk_con_accion) no puede superar a foreign_keys ($foreign_keys): la consulta está mal"
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || falla 1 "commit «$commit» no es un SHA completo"
[[ "$ejecucion" =~ ^https:// ]]   || falla 1 "ejecucion «$ejecucion» no es una URL"

# ── 3 · construir el JSON ────────────────────────────────────────────────────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

VERSION="$version" TESTS="$tests" TABLAS="$tablas_rls" POLICIES="$policies_rls" \
FKS="$foreign_keys" FK_ACCION="$fk_con_accion" INDICES="$indices_adicionales" \
COMMIT="$commit" EJECUCION="$ejecucion" MEDIDO="$medido_el" \
node -e '
  const e = process.env;
  const cifras = {
    contrato: "cifras-publicas",
    version: 1,
    nave: "aglaya-kanban-desk",
    commit: e.COMMIT,
    medido_el: e.MEDIDO,
    ejecucion: e.EJECUCION,
    cifras: {
      version:      { valor: e.VERSION,          fuente: "package.json" },
      tests:        { valor: Number(e.TESTS),    unidad: "tests",    fuente: "jest server/tests (job server-tests de esta ejecución, en verde)" },
      tablas_rls:   { valor: Number(e.TABLAS),   unidad: "tablas",   fuente: "catálogo de Postgres: tablas de public con relrowsecurity" },
      policies_rls: { valor: Number(e.POLICIES), unidad: "políticas", fuente: "catálogo de Postgres: recuento de pg_policies en public (recuento, no verificación)" },
      foreign_keys: { valor: Number(e.FKS),      unidad: "claves foráneas", fuente: "catálogo de Postgres: pg_constraint con contype = f en tablas de public" },
      fk_con_accion_al_borrar: { valor: Number(e.FK_ACCION), unidad: "claves foráneas", fuente: "catálogo de Postgres: claves foráneas de public con confdeltype <> a (hacen algo al borrar: CASCADE, SET NULL, SET DEFAULT o RESTRICT; un NO ACTION escrito no se distingue de uno omitido)" },
      indices_adicionales: { valor: Number(e.INDICES), unidad: "índices", fuente: "catálogo de Postgres: índices de tablas de public que no sostienen una PK ni una restricción UNIQUE/EXCLUDE" },
    },
  };
  process.stdout.write(JSON.stringify(cifras, null, 2) + "\n");
' > "$TMP/cifras.json" || falla 2 "no pude construir cifras.json"

# ── 4 · publicar: un commit completo, un solo push, sin forzar ───────────────
PUB="$TMP/pub"
git init -q "$PUB"
git -C "$PUB" remote add destino "$(git -C "$RAIZ" remote get-url "$REMOTO" 2>/dev/null || echo "$REMOTO")"
# Hereda las credenciales de actions/checkout, si las hay.
cabecera="$(git -C "$RAIZ" config --get http.https://github.com/.extraheader 2>/dev/null || true)"
[ -n "$cabecera" ] && git -C "$PUB" config http.https://github.com/.extraheader "$cabecera"

git -C "$PUB" config user.name  "github-actions[bot]"
git -C "$PUB" config user.email "41898282+github-actions[bot]@users.noreply.github.com"

if git -C "$PUB" fetch -q destino "$RAMA" 2>/dev/null; then
  git -C "$PUB" checkout -q -b "$RAMA" FETCH_HEAD
else
  # Primera publicación: rama HUÉRFANA, sin la historia de main.
  git -C "$PUB" checkout -q --orphan "$RAMA"
fi

cp "$TMP/cifras.json" "$PUB/cifras.json"
git -C "$PUB" add cifras.json
if git -C "$PUB" diff --cached --quiet 2>/dev/null && git -C "$PUB" rev-parse -q --verify HEAD >/dev/null; then
  echo "publicar-cifras: nada cambió respecto a lo publicado — no hace falta commit."
  exit 0
fi
git -C "$PUB" commit -q -m "cifras: $version · $tests tests · medido en ${commit:0:7}" \
  || falla 2 "no pude crear el commit de cifras"
git -C "$PUB" push -q destino "$RAMA:$RAMA" \
  || falla 2 "el push a la rama $RAMA falló (¿otra ejecución publicó en medio?)"

echo "publicar-cifras: publicado en $RAMA — version $version · $tests tests · $tablas_rls tablas con RLS · $policies_rls políticas · $foreign_keys claves foráneas ($fk_con_accion con acción al borrar) · $indices_adicionales índices adicionales."
echo "[medido $medido_el contra la base real — este verde es de ese instante, no una propiedad del commit]"
