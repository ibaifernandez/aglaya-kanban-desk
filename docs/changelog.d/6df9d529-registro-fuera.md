Security

- **Retirada `POST /api/auth/register`: cualquiera desde internet podía crearse una cuenta `superadmin`.** Tarjeta `6df9d529`, hallazgo B-20 de la auditoría del 24-sep-2026. **Estaba viva en producción.**
  - **Qué permitía:** la ruta iba montada sin sesión, tomaba `role` y `organizationId` del cuerpo, creaba el usuario con `email_confirm: true` —sin comprobar que el correo fuera de quien llamaba— y devolvía los tokens ya firmados. Un `superadmin` así salta el aislamiento por espacio de trabajo y alcanza cualquier tarjeta del riel.
  - **El único freno era una lista de dominios permitidos, y no frenaba:** no hay que recibir correo en `@aglaya.biz`, basta escribirlo.
  - **No se parchea, se retira.** Las altas ya iban por `POST /api/admin/users/invite`, que exige sesión y papel de admin; esta nave solo autoriza tres cuentas, así que no hay caso de uso de un alta pública. Ni el cliente ni el riel llamaban a la ruta.
  - **Lo vigila `server/tests/registro-cerrado.test.js`**, y no solo por el nombre: fija que en `/api/auth` las únicas rutas sin sesión sean entrar, renovar y salir, y que ninguna cree cuentas. Devolviendo la ruta a mano, 3 de sus 5 casos se ponen rojos.
  - Se retiran también los tres casos que fijaban la ruta —uno daba por bueno el `201` de un alta pública— y se corrigen `SECURITY.md`, `TOMs.md` y `BACKLOG.md`, que declaraban el filtro de dominios como medida de seguridad.
