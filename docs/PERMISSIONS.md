# Modelos de Roles y Permisos — AGLAYA Kanban Desk
**Versión:** v1.3.1 · **Fecha:** 2026-07-12

Este documento es la fuente de verdad única sobre la jerarquía, privacidad y capacidades del sistema.

---

## 🏗️ 1. Capa **macro**: roles globales (a nivel de la aplicación)

Determinan el acceso general a la infraestructura y qué tipos de recursos puede crear el usuario. Se basan en el `user_role` del perfil (`users.role`).

### 👑 Superadmin (info@ibaifernandez.com)

_Locus de control total y auditoría._

- **Visibilidad limpia**: solo ve _workspaces_ propios y aquellos donde haya sido invitado.
- **Modo Dios**: acceso universal a cualquier _workspace_ vía URL directa (en los que pasa a actuar como `owner`).
- **Omnipotencia**: puede crear cualquier tipo de workspace y cambiar los permisos de **todos** los miembros (incluyendo otros _admins_).

### 🛡️ Admins

_Autonomía operativa con límites jerárquicos._

- **Privacidad estricta**: solo ve lo propio y allí donde ha sido invitado.
- **Sin Modo Dios**.
- **Gestión protegida**: puede gestionar roles inferiores (Colaborador, Cliente) pero **no puede** tocar a otros _admins_ —ni mucho menos al _superadmin_ (en el Panel de Administración).
- **Autonomía**: creación libre de _workspaces_ de cualquier tipo (`personal`, `interno`, `externo`).

### 👤 Colaboradores

- **Sandbox personal**: solo puede crear _workspaces_ de tipo `personal` —de los que es `owner`—.
- **Sin acceso global**: no tiene acceso al Panel de Administración de la aplicación.

### 👥 Cliente

- **Lectura restringida**: solo ve los _workspaces_ a los que ha sido específicamente asignado.
- **Creación capada**: no puede crear _workspaces_ de ninguna clase.

---

## 📁 2. Capa **micro**: roles de workspace (a nivel de espacio)

Define los permisos **dentro** de un contenedor específico. Un usuario puede tener diferentes roles micro en diferentes _workspaces_, independientemente de su rol macro.

Valores internos reales:
- `owner` → Propietario
- `admin` → Admin del workspace
- `member` → Miembro
- `guest` → Invitado

| Acción                          | Propietario | Admin | Miembro | Invitado |
| :------------------------------ | :---------: | :---: | :-----: | :-------: |
| **Eliminar _workspace_**        |     ✅      |  ❌   |   ❌    |    ❌     |
| **Configurar _workspace_**      |     ✅      |  ✅   |   ❌    |    ❌     |
| **Añadir/Eliminar miembros**    |     ✅      |  ✅   |   ❌    |    ❌     |
| **Cambiar roles de miembros**   |     ✅      |  ✅   |   ❌    |    ❌     |
| **Mover tableros entre WS**     |     ✅      |  ✅   |   ❌    |    ❌     |
| **Crear/Eliminar tableros**     |     ✅      |  ✅   |   ✅    |    ❌     |
| **Crear/Eliminar columnas**     |     ✅      |  ✅   |   ✅    |    ❌     |
| **Crear tarjetas**              |     ✅      |  ✅   |   ✅    |    ✅     |
| **Gestionar tarjetas/contenido**|     ✅      |  ✅   |   ✅    |    ✅     |
| **Borrar tarjetas**             |     ✅      |  ✅   |   ✅    |    ❌     |

### 📍 La regla del propietario

- **Inmutabilidad**: le rol de `Owner` es asignado **únicamente** a la persona que crea el workspace.
- **No transferible**: ningún Admin o Superadmin puede ser **propietario** de un _workspace_ que no ha creado (salvo vía base de datos en caso extremo).
- **Control final**: solo el propietario puede eliminar el espacio de trabajo.

---

## 🛡️ 3. Reglas de seguridad **hardened**

1. **Protección Admin-to-Admin**: el sistema bloquea cualquier intento de un _admin_ de degradar o borrar a otro _admin_ de la organización.
2. **Protocolo anti-infoxicación**: el _superadmin_ no "ve" los workspaces de los demás por defecto; requiere entrada activa vía ID para no saturar su interfaz.
3. **Aislamiento perimetral**: los clientes tienen prohibido por middleware acceder a workspaces de tipo `personal` o `interno`.
4. **Modo Dios (Auditoría Invisible)**: el `superadmin` tiene un bypass en el middleware que le permite actuar como `owner` de cualquier espacio de trabajo mediante acceso directo por URL.
5. **Colaborador Sandbox**: los colaboradores solo pueden crear workspaces `personal`. Esto asegura que los entornos `interno` y `externo` sean gestionados exclusivamente por la gerencia (_admins_).
6. **Bloqueo de Panel Admin**: el acceso a la gestión global de usuarios (Panel Admin) está restringido estrictamente a `superadmin` y `admin`. Los colaboradores no pueden ver ni modificar la lista de usuarios de la organización.
7. **Independencia de capas**: un rol macro (ej. Colaborador o Cliente) puede tener un rol micro distinto dentro de un workspace sin que eso le otorgue permisos macro adicionales.

---

## 📝 Notas de Implementación

- **Backend**: Verificado por middlewares `requireAuth` (Macro), `requireRole` (Macro) y `requireWorkspaceMember` (Micro).
- **Frontend**: Ocultación dinámica de UI basada en la combinación de `user.role` y `workspace.myRole`.
