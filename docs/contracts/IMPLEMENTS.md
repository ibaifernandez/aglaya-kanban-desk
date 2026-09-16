# Contratos de flota que implementa esta nave

Este fichero es el ledger de la nave `aglaya-kanban-desk`: dice **qué contratos de
la flota cumple como productora**. Solo lleva declaraciones. Qué versión es, cuántos
tests pasa o cuántas políticas tiene la base **no se escribe aquí**: se lee de su
fuente (`package.json`, la suite, la rama `cifras`).

## Lo que implementa

- `cifras-publicas` v1 — el formato es del orquestador (`contrato("cifras-publicas")`).
  Esta nave publica `cifras.json` en la raíz de la rama huérfana `cifras`, desde el
  job `publicar-cifras` de `.github/workflows/ci.yml`: solo en push a `main`, con
  `server-tests`, `comprobaciones-baratas` y `client-build` en verde, midiendo en su
  propia ejecución y con el único permiso de escritura del workflow. Qué se publica,
  de dónde sale cada valor y por qué `tablas_backup` no se publica está en
  `scripts/publicar-cifras.sh`; lo vigila `scripts/publicar-cifras.test.sh`.

## Lo que no se declara aquí

El **riel de comandas** —la puerta por la que otras naves dejan tarjetas— tiene su
propio contrato en [`CONTRACT.md`](./CONTRACT.md), y esta nave es su **dueña**, no
una firmante. No se repite aquí: un ledger que copia el contrato que custodia
diverge de él en un campo.
