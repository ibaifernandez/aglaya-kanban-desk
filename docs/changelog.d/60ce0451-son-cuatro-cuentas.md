Changed

- **`CLAUDE.md` decía que hay tres cuentas autorizadas y desde el 02-nov-2026 son cuatro.** Tarjeta `60ce0451`.
  - El documento **no describe: manda**. Una sesión futura que leyera «solo estas tres» y mirara la tabla `users` encontraría una cuenta que el documento no reconoce — y lo que el propio documento le dice que haga es **reconciliar**. Desde ahí, lo razonable es tratarla como un alta no autorizada e ir a quitarla, rompiendo el acceso de la sesión personal sin que nadie entienda por qué.
  - Entra la decisión, no el inventario: existe una **cuarta cuenta de servicio**, autorizada por Ibai, para que una sesión aparte lleve su espacio personal.
  - **Y lo que de verdad hay que proteger: su rol es `colaborador` a propósito.** Verificado en la base: una sola membresía, el espacio personal, cero corporativas. Queda escrito que **subirle el rol borra el aislamiento sin dar ningún error** —un `superadmin` se salta entera la comprobación de membresía—, así que si esa cuenta recibe un `403`, **el `403` es el producto y no el fallo**. Sin esa línea, el siguiente que quiera «arreglar» un 403 le sube el rol y no se entera nadie.
  - **No entra ninguna dirección nueva en el árbol**, que es regla ya establecida ahí para las personas: el repositorio es público. El correo exacto lo custodia la tabla `users`, igual que el de los otros tres.
  - La referencia al middleware va **por marcador (`GOD MODE`) además de por número de línea**: un número caduca solo en cuanto alguien edita más arriba, y una cita rota en la frase que impide un error de seguridad es peor que no citar.
