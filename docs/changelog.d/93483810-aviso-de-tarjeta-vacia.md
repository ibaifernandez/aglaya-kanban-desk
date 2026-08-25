Added

- **La puerta HTTP avisa cuando la tarjeta se crea sin contenido**, igual que ya hacía el riel. Contrato del riel a **v3.7.0**. Tarjeta `93483810`.
  - Cerraba una asimetría, no un incumplimiento: la cláusula «una tarjeta sin contenido lo dice» vivía **dentro de la sección de la Puerta 1**, así que prometía por el riel y no por la otra puerta.
  - Pesa porque **la Puerta 2 es la que usan las naves de fuera de esta máquina**: el contrato delega verificar en el llamante, y esa frase se escribió para un humano. Una nave no abre la interfaz nunca.
  - **Aviso y no `400`**, decidido y escrito: una tarjeta solo-título es legítima, así que rechazarla habría impedido que entrara trabajo bueno — y habría obligado a cambiar también el riel.
  - **El texto no se copia del riel a propósito**: aquél manda a mirar `description_md` y su alias, nombres que no existen en esta puerta. Se comparte la regla; el texto es de cada puerta.
  - Seis mutaciones, seis rojas.
