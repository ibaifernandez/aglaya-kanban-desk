Added

- **La verificación de la copia de seguridad sale del YAML y estrena sello.** Era **el único guardián de su día sin uno**, y esa ausencia costó cuatro días sin copia: abortaba volcados buenos y no había forma de darle uno bueno y exigirle verde. Tarjeta `60b048ff`.
  - `scripts/verificar-volcado.sh` + `scripts/verificar-volcado.test.sh`. El sello corre en las comprobaciones baratas; el guardián sigue corriendo en `db-backup.yml`, sobre el volcado real.
  - **El caso que manda es el aburrido:** un volcado **bueno y grande** tiene que salir verde. Es justo el que estaba roto — un sello que solo probara volcados malos habría dado 4/4 mientras la nave se quedaba sin copia.
  - **El volcado de prueba pesa ~1 MB a propósito.** Con uno pequeño no hay `SIGPIPE` y el guardián roto pasa: un fixture cómodo habría certificado que funciona algo que no funciona.
  - Cinco mutaciones, cinco rojas — la primera reintroduce el `| grep -q` que causó el corte, y la caza el caso del volcado bueno.
  - `db-backup.yml` gana un `checkout` que no tenía: sin él, el script no existe en el corredor.
  - `stat -c%s` pasa a `wc -c`: es GNU, y este script ahora corre también fuera de CI — que es de lo que trataba la tarjeta.
