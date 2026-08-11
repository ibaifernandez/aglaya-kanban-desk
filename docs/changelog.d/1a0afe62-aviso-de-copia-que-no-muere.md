Fixed

- **El aviso de copia fallida moría en su primera línea, y por eso cuatro fallos seguidos no dejaron ni una incidencia.** Tarjeta `1a0afe62`.
  - Causa: las llamadas a `gh` no llevaban `--repo`, y este workflow **no hace `actions/checkout`** —no le hace falta para volcar la base—, así que `gh` intentaba deducir el repositorio del remoto de git y moría con `fatal: not a git repository`. Con `set -euo pipefail`, el paso se acababa ahí: antes del comentario y antes de crear la incidencia.
  - **No era permisos:** `GH_TOKEN` estaba puesto y `issues: write` declarado.
  - Arreglado con `--repo "$GITHUB_REPOSITORY"` en las cuatro llamadas, y no añadiendo un `checkout`: traer el árbol entero para que una herramienta adivine un dato que ya está en el entorno cuesta un minuto por no escribir una bandera, y el `checkout` lo quita mañana quien vea que no se usa.
  - Ejercido contra un fallo **real**, no simulado: se abre la incidencia la primera vez y se comenta en ella la segunda, que es lo que convierte una racha en una racha y no en veinte avisos que se aprenden a ignorar.
