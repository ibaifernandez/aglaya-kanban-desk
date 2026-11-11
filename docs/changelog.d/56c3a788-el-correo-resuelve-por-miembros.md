Fixed

- **Una cuenta `colaborador` ya puede clavar tarjetas pasando un correo.** El riel
  resolvía el responsable contra `GET /admin/users`, que solo abre a
  `admin`/`superadmin`, así que la cuenta aislada recibía un `403` por el camino
  que la propia herramienta documenta. Ahora se resuelve contra los **miembros
  del espacio de destino**, que es la ruta que ya admitía a cualquier miembro.
  Y el alcance de paso es el correcto: un responsable que no es miembro no podría
  ver su propia tarjeta. Tarjeta `56c3a788`, contrato **v6.0.0**.

- **Dos respuestas del riel dejaban escapar el correo.** `create_card` devolvía
  `assigned` con la dirección que le pasaran, y `assign_card` lo mismo en
  `notified`. Se quitó de `list_members` el 25-sep-2026 y estos dos ecos
  quedaron vivos. Medido contra la salida real. El fallo tampoco repite ya lo
  que le pasaron.

**Lo que no entra, y por qué:** `assign_card` y `assign_checklist_item` no
reciben espacio y siguen resolviendo por la ruta de admin; el `404` de la puerta
interna sigue repitiendo el `assignee` recibido. Tienen tarjeta propia — no se
arreglan de paso para no cambiar lo que su tarjeta no nombra.
