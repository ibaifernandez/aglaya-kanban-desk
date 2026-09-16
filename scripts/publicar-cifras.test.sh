#!/usr/bin/env bash
# publicar-cifras.test.sh — sello de scripts/publicar-cifras.sh.
#
# Publica contra un repositorio `bare` local, sin red y sin base. Comprueba lo
# que el contrato exige y lo que la tarjeta `c82aa8b9` pide comprobar:
#
#   · con cifras válidas publica un `cifras.json` con la FORMA del contrato, en
#     una rama HUÉRFANA (sin la historia de main);
#   · si falta una cifra o no es válida, NO publica y la rama no cambia — que es
#     la contraprueba de «en una ejecución roja, la rama no cambia»: el job que
#     mide no emite el recuento cuando la batería sale en rojo;
#   · sin forma de medir la base, sale con 2 y no publica;
#   · una segunda publicación va ENCIMA de la anterior, sin forzar.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$RAIZ/scripts/publicar-cifras.sh"
PASS=0; FAIL=0
ok()  { echo "  ok    $1"; PASS=$((PASS + 1)); }
mal() { echo "  FALLA $1"; FAIL=$((FAIL + 1)); }

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
git init -q --bare "$T/remoto.git"

SHA="0123456789abcdef0123456789abcdef01234567"
publicar() {
  env -i PATH="$PATH" HOME="$T" \
    CIFRAS_REMOTO="$T/remoto.git" CIFRAS_MEDIDO_EL="2026-09-16T10:00:00Z" \
    CIFRAS_EJECUCION="https://github.com/x/y/actions/runs/1" CIFRAS_COMMIT="$SHA" \
    CIFRAS_TESTS="484" CIFRAS_TABLAS_RLS="11" CIFRAS_POLICIES_RLS="32" \
    "$@" bash "$SCRIPT" >"$T/salida" 2>&1
}
cabeza() { git --git-dir="$T/remoto.git" rev-parse -q --verify refs/heads/cifras 2>/dev/null || echo "(no existe)"; }

echo "Tiene que NO publicar:"
publicar CIFRAS_TESTS=""; r=$?
[ "$r" = 1 ] && [ "$(cabeza)" = "(no existe)" ] && ok "sin recuento de tests (batería en rojo) → exit 1 y sin rama" || mal "sin recuento de tests: exit $r, rama $(cabeza)"

publicar CIFRAS_TESTS="0"; r=$?
[ "$r" = 1 ] && [ "$(cabeza)" = "(no existe)" ] && ok "tests = 0 → exit 1" || mal "tests = 0: exit $r"

publicar CIFRAS_COMMIT="main"; r=$?
[ "$r" = 1 ] && [ "$(cabeza)" = "(no existe)" ] && ok "commit que no es un SHA → exit 1" || mal "commit no SHA: exit $r"

publicar CIFRAS_POLICIES_RLS="treinta"; r=$?
[ "$r" = 1 ] && [ "$(cabeza)" = "(no existe)" ] && ok "recuento de políticas no numérico → exit 1" || mal "políticas no numéricas: exit $r"

# Sin costuras de RLS y sin DATABASE_URL: no hay forma de medir la base.
env -i PATH="$PATH" HOME="$T" CIFRAS_REMOTO="$T/remoto.git" CIFRAS_COMMIT="$SHA" \
  CIFRAS_EJECUCION="https://github.com/x/y/actions/runs/1" CIFRAS_TESTS="484" \
  bash "$SCRIPT" >"$T/salida" 2>&1; r=$?
[ "$r" = 2 ] && [ "$(cabeza)" = "(no existe)" ] && ok "sin base que consultar → exit 2 y sin rama" || mal "sin base: exit $r"

echo
echo "Tiene que publicar, con la forma del contrato:"
publicar; r=$?
primera="$(cabeza)"
if [ "$r" = 0 ] && [ "$primera" != "(no existe)" ]; then ok "cifras válidas → exit 0 y rama creada"; else mal "cifras válidas: exit $r — $(cat "$T/salida")"; fi

json="$(git --git-dir="$T/remoto.git" show cifras:cifras.json 2>/dev/null)"
forma="$(printf '%s' "$json" | node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    try {
      const j = JSON.parse(s);
      const c = j.cifras || {};
      const bien = j.contrato === "cifras-publicas" && j.version === 1 && j.nave === "aglaya-kanban-desk"
        && /^[0-9a-f]{40}$/.test(j.commit) && /Z$/.test(j.medido_el) && /^https:/.test(j.ejecucion)
        && ["version","tests","tablas_rls","policies_rls"].every(k => c[k] && "valor" in c[k] && c[k].fuente)
        && !("tablas_backup" in c)
        && c.tests.valor === 484 && c.tablas_rls.valor === 11 && c.policies_rls.valor === 32
        && /recuento/.test(c.policies_rls.fuente);
      console.log(bien ? "OK" : "MAL " + s);
    } catch (e) { console.log("MAL JSON ilegible"); }
  });')"
[ "$forma" = "OK" ] && ok "JSON con la forma del contrato, sin tablas_backup, y policies_rls dice «recuento»" || mal "forma: $forma"

[ "$(git --git-dir="$T/remoto.git" rev-list --count cifras)" = 1 ] && ok "rama huérfana: un solo commit, sin historia de main" || mal "la rama no es huérfana"
[ "$(git --git-dir="$T/remoto.git" ls-tree --name-only cifras)" = "cifras.json" ] && ok "la rama solo contiene cifras.json" || mal "la rama contiene más que cifras.json"

echo
echo "Una publicación inválida DESPUÉS de una válida no toca lo publicado:"
publicar CIFRAS_TESTS=""; r=$?
[ "$r" = 1 ] && [ "$(cabeza)" = "$primera" ] && ok "la rama sigue en el commit anterior" || mal "la rama cambió: exit $r"

echo
echo "Una segunda publicación válida va encima, sin forzar:"
publicar CIFRAS_TESTS="485" CIFRAS_MEDIDO_EL="2026-09-17T10:00:00Z"; r=$?
[ "$r" = 0 ] && [ "$(git --git-dir="$T/remoto.git" rev-list --count cifras)" = 2 ] \
  && git --git-dir="$T/remoto.git" merge-base --is-ancestor "$primera" cifras \
  && ok "dos commits, el primero es antecesor del segundo" || mal "segunda publicación: exit $r"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = 0 ] && echo "El publicador publica lo válido y nada más." && exit 0
exit 1
