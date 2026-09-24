Security

- **Retiradas dos políticas RLS que decían sí a todo y anulaban a las restrictivas.** Tarjeta `22ecfa81`, hallazgo B-21 de la auditoría del 24-sep-2026.
  - `workspaces` y `workspace_members` tenían, cada una, una política de `INSERT` restrictiva y otra `WITH CHECK (true)` para el rol `authenticated`. **Las políticas permisivas de Postgres se combinan con OR**: la de `true` no añadía un caso, anulaba a la de al lado.
  - **Dónde dolía:** `workspace_members` es la tabla con la que el servidor decide la pertenencia a un espacio. Quien pudiera insertar una fila ahí se hacía miembro de cualquier espacio de trabajo.
  - **Medido en la base viva antes de escribir nada** (`pg_policies` de producción, no el esquema documentado): las dos existían tal cual. Y en Postgres 15 real (`docs/schema/pruebas/rls-sin-permisivas.sh`) la contraprueba reproduce el defecto: con la permisiva puesta, un usuario sin papel en el espacio se hace `admin` de él; sin ella, la base lo rechaza.
  - **Alcance honesto:** hoy nadie lo explotaba por esa vía, porque el servidor consulta con `service_role` —que se salta RLS— y el cliente web solo usa Supabase para autenticarse. Lo que se cierra es la segunda capa; la primera resultó abierta el mismo día (`6df9d529`).
