Fixed

- **Las 30 tuberías que podían mentir cuando creciera lo que les pasas, reescritas — y un guardián nuevo para que no entre la 31.** Tarjeta `77652479`.
  - Es el mismo patrón que dejó a esta nave **cuatro días sin copia de seguridad** (`71a998a3`): un lector que sale antes de tiempo (`grep -q`, `grep -m`, `head`) mata de `SIGPIPE` a quien escribe, y con `pipefail` el estado de la tubería es el del muerto. Salta solo al pasar del buffer, así que **una comprobación correcta empieza a mentir el día que crece su entrada**, sin que nadie toque una línea.
  - **Las dos direcciones estaban vivas, y no cuestan lo mismo:** seis sitios daban **falso VERDE** —compuertas de relevancia y la detección de DDL de `schema-guard`, que se habrían saltado solas sin dejar rastro—; el resto, falso rojo. Clasificadas una a una, no en bloque.
  - Reescritas con aquí-string (`grep -q PAT <<< "$v"`) y sustitución de proceso donde había cadena. Ni una tubería, así que no hay estado de tubería que leer al revés.
  - `scripts/pipefail-guard.sh` + su sello: 16 casos en las dos direcciones, y **seis mutaciones del guardián, seis cazadas**. Ignora comentarios a propósito — el aviso contra este fallo vive citando el patrón dentro de `db-backup.yml`, y sin eso el guardián nacería rojo por su propia advertencia.
  - Un guardián que no encuentra qué vigilar sale con `2`, no con verde.
