Fixed

- **Una cuenta `colaborador` ya puede clavar tarjetas pasando un correo.** El riel
  resolvía el responsable contra `GET /admin/users`, que solo abre a
  `admin`/`superadmin`, así que la cuenta aislada recibía un `403` por el camino
  que la propia herramienta documenta. Ahora se resuelve contra los **miembros
  del espacio de destino**, que es la ruta que ya admitía a cualquier miembro.
  Y el alcance de paso es el correcto: un responsable que no es miembro no podría
  ver su propia tarjeta. Tarjeta `56c3a788`, contrato **v6.0.0**.

- **Tres respuestas del riel dejaban escapar el correo.** `create_card` devolvía
  `assigned` con la dirección que le pasaran; `assign_card` y
  `assign_checklist_item`, lo mismo en `notified`. Se quitó de `list_members` el
  25-sep-2026 y estos tres ecos quedaron vivos. Medido contra la salida real.
  El fallo tampoco repite ya lo que le pasaron.

  **El tercero lo encontró el vigilante devolviendo la PR**, y es el que más
  pesa: `assign_checklist_item` promete en su firma que `user` puede ser un
  correo, así que no era un eco accidental sino el de un campo documentado como
  dirección. Mis dos casos mordían donde los puse; ese sitio no tenía ninguno.

Aplica a **las cuatro** tools que resuelven una persona —`create_card`,
`assign_card`, `assign_checklist_item` y `remove_member`—, y **ya no queda
ninguna llamada viva a `/admin/users` en el riel**. Arreglar solo una dejaba
viva la puerta del defecto.

**Dos efectos observables, dichos porque rompen:** `assign_card` lee la tarjeta
antes de resolver, así que una tarjeta inexistente falla **antes** que un
responsable inválido; y cuesta dos peticiones más por asignación. `create_card` y
`remove_member` no las pagan.

**Lo que no entra, y por qué:** el `404` de la puerta interna sigue repitiendo el
`assignee` recibido, que puede ser un correo, y un UUID se acepta sin comprobar
membresía. Tienen tarjeta propia — no se arreglan de paso para no cambiar lo que
su tarjeta no nombra.
