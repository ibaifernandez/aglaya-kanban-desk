Fixed

- **Crear y asignar dejan de ser dos escrituras en la Puerta 1.** Si la segunda fallaba, quedaba una tarjeta escrita **sin dueño** —invisible para el sistema de trabajo— y el llamante recibía una excepción que no decía que ya existía. Tarjeta `2ae1cf5e`.
  - El `PUT` posterior existía porque **era el update quien disparaba la notificación in-app**, así que mover el campo al `POST` sin más habría perdido el aviso (`updateCard` solo notifica si el responsable **cambia**).
  - Arreglado en la causa: `POST /api/cards` **notifica al nacer asignada**, y entonces una sola escritura basta. La ventana se cierra por construcción, no compensando.
  - Cierra de paso un hueco sin tarjeta: **la UI permite elegir responsable al crear**, así que hasta hoy un humano podía asignar a otro sin que se enterase.
  - Cuatro mutaciones, cuatro rojas — dos por lado. Una de ellas reintroduce la segunda escritura y el banco del riel la caza.
