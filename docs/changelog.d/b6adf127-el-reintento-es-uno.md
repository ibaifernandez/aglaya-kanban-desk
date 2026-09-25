Fixed

- **Nada fijaba que el reintento tras renovar el token fuera UNO.** Tarjeta `b6adf127`, lateral del capataz al auditar `48946335`.
  - El código estaba bien; el candado no. Quitar `!isRetry` de `fetchWithAuth` dejaba **las 25 pruebas del cliente en verde**, y lo que eso permite no es un fallo visible: con el refresco funcionando y el servidor contestando 401 igual —cuenta desactivada, token rechazado por otro motivo—, la aplicación renueva y reintenta **sin fin**, machacando `/auth/refresh`, y **sin ningún error que el usuario pueda ver**. Solo que nada avanza.
  - **Lo que ya había no miraba ese caso.** Estaba fijado que un refresco *fallido* no reintenta, y que el reintento va con el token nuevo. Faltaba el de en medio: refresco que **funciona** y ruta que sigue dando 401.
  - **Y se cuentan las peticiones**, que es el fondo: «terminó con error» no distingue rendirse de entrar en bucle. Con el recuento cae también el mutante que reintenta **dos** veces, que es el que habría pasado por bueno.
  - El caso lleva **tope**: con el mutante puesto, el rojo llega en medio segundo diciendo `BUCLE: 13 peticiones`, en vez de dejar la batería colgada. Un fallo que nadie sabe leer no es un fallo.
