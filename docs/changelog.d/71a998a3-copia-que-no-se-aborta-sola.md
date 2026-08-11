Fixed

- **La copia de seguridad diaria dejaba de hacerse porque su propia comprobación abortaba volcados buenos.** Cuatro corridas seguidas en rojo (7, 8, 9 y 10-ago-2026) y ninguna copia desde el 6-ago, mientras la retención de 30 días seguía borrando por el otro extremo. Tarjeta `71a998a3`.
  - Causa: `gunzip -c … | grep -q …` bajo `set -o pipefail`. `grep -q` sale al encontrar el patrón, `gunzip` muere con `SIGPIPE` (estado 141) y el estado de la tubería es el suyo — así que **«lo encontré enseguida» se leía igual que «no está»**.
  - **Depende del tamaño**, y por eso se armó sola: con un volcado pequeño no hay `SIGPIPE`. El 6-ago pesaba 195 KB y pasó; el 10-ago pesaba 980 KB y no. No lo rompió nadie: la base creció.
  - Arreglado por construcción, no por cuidado: `grep -oE` lee el flujo entero —una sola descompresión donde había cinco— y el bucle compara contra una cadena en memoria con `<<<`, sin tubería que nadie pueda cerrar antes de tiempo.
  - Se añade `gunzip -t`: el archivo se comprueba entero, y así un gzip corrupto se rechaza por lo que es en vez de disfrazarse de «faltan tablas».
  - Medido en las cuatro combinaciones bash/zsh × con/sin `pipefail`: **la variable es `pipefail`**, no el shell ni el `gzip`.
