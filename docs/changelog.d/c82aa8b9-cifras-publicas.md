Added

- **Las cifras de la nave se publican solas, medidas, en la rama `cifras`.** Tarjeta `c82aa8b9`, contrato `cifras-publicas` v1.
  - **Por qué:** el portafolio citaba `v1.3.1 · 102 tests` a mano con el repositorio ya en otra versión. Ahora la cifra la mide quien la custodia, con fecha y con la ejecución que la produjo.
  - **Qué publica:** `version` (de `package.json`), `tests` (el recuento de jest del job `server-tests` de **esa** ejecución, que solo se emite si la batería sale entera en verde), `tablas_rls` y `policies_rls` (catálogo de la base; la fuente de las políticas dice «recuento», porque contarlas no demuestra que funcionen).
  - **Qué no publica, a propósito:** `tablas_backup`. Ningún proceso de CI restaura la copia; publicarlo sería una cifra inventada.
  - **Cómo no miente:** job `publicar-cifras`, solo en push a `main`, dependiente de los jobs que miden; es el único con `contents: write` (el workflow baja a `contents: read`). Valida todo antes de tocar git, publica con un commit completo y un solo `push` sin forzar. En una ejecución roja el recuento no existe y la rama no cambia.
  - **Sello:** `scripts/publicar-cifras.test.sh` (11 casos, contra un repositorio `bare` local), cableado en `comprobaciones-baratas`.
  - Declarado en el nuevo `docs/contracts/IMPLEMENTS.md`.
