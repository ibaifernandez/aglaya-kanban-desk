# Modelos de Roles y Permisos — MyBoardLFi

Este documento detalla la estructura de permisos implementada en el sistema para asegurar la integridad de los datos y la correcta jerarquía de acceso.

---

## 🏗️ 1. Roles globales (nivel organización)

Estos roles están definidos en la tabla `memberships` (Supabase) y se incrustan en el JWT del usuario al hacer login. Determinan el acceso general a la infraestructura de la organización.

| Rol             | Descripción                                | Capacidades Clave                                                                                                                                  |
| :-------------- | :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **superadmin**  | Dueño de la plataforma (Ibai).             | info@ibaifernandez.com. Acceso total a todas las organizaciones, usuarios y configuraciones.                                                     |
| **admin**       | Gerencia u Operaciones (ej. Mónica, Mavi). | Gestión de usuarios, auditoría de tableros y control total de su organización.                                                                     |
| **colaborador** | Equipo técnico/creativo (ej. Bani, Álex).  | **Autonomía total** para crear sus propios workspaces y gestionar sus workspaces y aquellos a los que son invitados.                               |
| **cliente**     | Stakeholders externos.                     | Solo lectura de los workspaces que le son asignados específicamente. No ven otros clientes, no ven workspaces internos —y mucho menos, personales. |
| **guest**       | Invitados temporales.                      | Acceso puntual a tableros específicos.                                                                                                             |

---

## 📁 2. Roles de Workspace (Nivel Espacio)

Estos roles se definen en la tabla `workspace_members`. Un usuario puede tener diferentes roles en diferentes espacios de trabajo.

### Matriz de Permisos por Espacio

| Acción                            | Owner | Admin | Member | Guest |
| :-------------------------------- | :---: | :---: | :----: | :---: |
| **Eliminar Workspace**            |  ✅   |  ❌   |   ❌   |  ❌   |
| **Configurar Emoji/Nombre/Fondo** |  ✅   |  ✅   |   ❌   |  ❌   |
| **Añadir/Eliminar Miembros**      |  ✅   |  ✅   |   ❌   |  ❌   |
| **Cambiar Roles de Miembros**     |  ✅   |  ✅   |   ❌   |  ❌   |
| **Crear Tableros**                |  ✅   |  ✅   |   ✅   |  ❌   |
| **Eliminar Tableros**             |  ✅   |  ✅   |   ✅   |  ❌   |
| **Reordenar Tableros**            |  ✅   |  ✅   |   ✅   |  ❌   |
| **Mover Tableros entre WS**       |  ✅   |  ✅   |   ❌   |  ❌   |
| **Crear Columnas/Categorías**     |  ✅   |  ✅   |   ✅   |  ✅   |
| **Crear/Editar/Mover Tarjetas**   |  ✅   |  ✅   |   ✅   |  ✅   |
| **Eliminar Tarjetas**             |  ✅   |  ✅   |   ✅   |  ❌   |

---

## 🛡️ 3. Reglas de Seguridad Especiales

Para evitar desastres de datos, hemos implementado las siguientes protecciones "hardened":

1. **Protección de _owners_**: no se puede eliminar a un usuario que sea el _único_ dueño de un workspace activo. El sistema bloquea la acción hasta que se transfiera la propiedad.
2. **Cascading Softened**: El borrado de un usuario NO borra sus recursos (workspaces, tableros). Los recursos se mantienen con `owner_id = NULL` o se reasignan, evitando la pérdida masiva de datos que ocurrió anteriormente.
3. **Aislamiento de Clientes**: Los clientes tienen prohibido por middleware acceder a workspaces de tipo `personal` o `interno`, incluso si conocen el ID.
4. **Auto-Administración**: Un usuario (incluyendo admins) no puede eliminarse a sí mismo ni cambiar su propio rol para evitar quedar bloqueado fuera del sistema.

---

## 📝 Notas de Implementación

- **Backend**: Los permisos se verifican mediante los middleware `requireAuth` (global) y `requireWorkspaceMember/requireWorkspaceRole` (espacio).
- **Frontend**: La visibilidad de botones (Nuevo Workspace, Ajustes, etc.) se oculta dinámicamente según estos mismos roles para mejorar la UX.
- **Auditoría**: Todas las acciones críticas (creación de tableros, cambios de rol) quedan registradas con el `id` del usuario responsable.
