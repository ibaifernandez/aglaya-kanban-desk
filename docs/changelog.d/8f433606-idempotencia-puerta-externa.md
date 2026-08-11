Added

- **Clave de idempotencia en la puerta externa** (`POST /api/internal/create-card`): mandar `idempotencyKey` (UUID) hace que un reintento devuelva **`200` con la tarjeta que ya existe** en vez de crear otra. Contrato del riel a **v3.6.0**. Tarjeta `8f433606`.
  - Sin el campo, el comportamiento no cambia: dos `POST` idénticos siguen creando dos tarjetas, y hay prueba que se pone roja si eso deja de ser cierto.
  - **La garantía es el índice único**, no la ruta (`docs/schema/migration-idempotency-key.sql`): mirar antes de insertar deja una ventana que dos reintentos simultáneos cruzan los dos, así que el `23505` se contesta como repetición y no como error.
  - El acuse de la repetición se reconstruye **desde la fila guardada**: si el tablero se renombró entre medias, dice dónde ESTÁ la tarjeta y no falla con un 404 por un nombre que ya no casa.
  - Espacio de nombres global y dicho en el contrato: no se acota por llamante porque el llamante se autodeclara, y una separación que la puerta no puede verificar sería de adorno.
  - Ocho mutaciones, ocho rojas — incluida la trampa que la tarjeta dejó escrita: con un doble que devuelve el mismo id en toda inserción, esta prueba sería una tautología.
