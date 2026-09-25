Security

- **La copia diaria deja de necesitar una llave con poder de administrador sobre todos los buckets.** Tarjeta `612d2b83`, hallazgo del vigilante.
  - `db-backup.yml` subía por la **API REST de Cloudflare**, que **rechaza las llaves acotadas** (403, medido por el CRM). Por eso la llave puesta era **Admin Read & Write sobre todos los buckets** — incluido el de adjuntos, y Admin **permite borrar buckets enteros**. Una copia de seguridad no necesita ese poder.
  - Subir, listar y borrar pasan a la **API S3 de R2**, que sí acepta `Object Read & Write` acotado a un bucket. El paginado lo hace la propia herramienta y la comparación de fechas la hace el servidor, en vez de a mano.
  - **Y se comprueba que el objeto está arriba preguntándoselo al almacén**, en vez de dar por bueno que el mandato anterior salió con 0.
  - El paso de `pg_dump` llevaba las tres credenciales del almacén **sin usarlas**: se quitan. Un secreto en un paso que no lo necesita es superficie regalada.
  - **Corregido el runbook de rotación**, que decía que las credenciales S3 de R2 «requieren coordinación con Cloudflare support». **Era falso** —se crean en otro sitio del panel, y se pueden acotar a un bucket—, y esa frase es la que mantuvo a la casa en el camino caro.
  - **Pendiente del Operador, y en este orden:** crear la llave acotada, ponerla en los dos ajustes del repositorio, correr la copia a mano hasta que borre las viejas, y **solo entonces** revocar la llave con Admin. Mientras tanto la copia sigue funcionando con la vieja, y eso manda.
