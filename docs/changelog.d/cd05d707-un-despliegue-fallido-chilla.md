Added

- **Un despliegue fallido abre una incidencia.** Hasta hoy terminaba en `FAILED` y no lo sabía nadie: el del 11-ago-2026 se descubrió dos semanas después, mirando el panel por otro motivo. Tarjeta `cd05d707`.
  - **Importa porque «Hecho» exige vivo, no mergeado.** Quien cierra una entrega comprueba que la obra esté viva, y si el despliegue falla en silencio esa comprobación depende de que alguien mire el panel. El día que no mire, una tarjeta pasa a «Hecho» sin estarlo.
  - **Cero credenciales nuevas, medido antes de construir:** Railway ya informa a GitHub — el fallo de aquel día está en la API del repo como `state: failure` — y GitHub emite `deployment_status`. La información ya llegaba; faltaba recogerla. El aviso sale cuando pasa, no al día siguiente.
  - **La decisión vive en un script con sello** (`scripts/aviso-despliegue.sh`), no en el YAML: la primera prueba real de un avisador es el primer fallo, y esta casa ya pagó esa lectura con el aviso de la copia.
  - `error` avisa igual que `failure`, y un estado que GitHub añada mañana **se avisa diciendo que no se reconoce** en vez de tragarse.
  - Veinte casos en el sello y seis mutaciones, seis rojas.
