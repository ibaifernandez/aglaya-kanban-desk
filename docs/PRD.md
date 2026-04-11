# PRD (Product Requirements Document) — AGLAYA Kanban Desk
**Phase 1 · v1.1.0.0**
**Owner:** AGLAYA · info@ibaifernandez.com
**Fecha:** 2026-04-11 (Actualizado)

---

## 1. Visión Estratégica

AGLAYA es una plataforma de gestión de proyectos y tareas diseñada para agencias de marketing, con soporte para múltiples equipos y clientes en un mismo entorno. Permite organizar el trabajo en tableros visuales tipo Kanban bajo el control total de la organización.

### El problema que resuelve
AGLAYA es capaz de gestionar simultáneamente múltiples clientes, campañas y operaciones, consolidando la información que antes estaba dispersa para evitar pérdida de contexto y visibilidad limitada.

### Propuesta de valor
1. **Zero vendor lock-in**: Todo el código y los datos residen en infraestructura soberana AGLAYA.
2. **Privacidad Micro/Macro**: Soporte nativo para multi-tenant con separación estricta de espacios de clientes y espacios internos.
3. **Optimización de Costes**: Sin licencias por asiento; acceso ilimitado para personal y clientes.

---

## 2. Stack Técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Express.js (Node) |
| Datos | Supabase (PostgreSQL) |
| Drag & Drop | @dnd-kit/core |
| Estilos | Tailwind CSS / Vanilla CSS |
| Iconos | Lucide React |

---

## 3. Estructura de Datos (Core)

### Board
`{ id, workspaceId, title, createdAt, order }`

### Column
`{ id, boardId, title, order }`

### Card
`{ id, columnId, boardId, title, description, category, priority, dueDate, tags, createdAt, updatedAt, order }`

### Roles Micro (Workspace Member)
- `owner`: Inmutable, control total y borrado.
- `admin`: Gestión de miembros y tableros.
- `colaborador`: Gestión operativa y creación de tableros.
- `cliente` (Guest): Colaboración en tarjetas; sin borrado ni gestión estructural.

---

## 4. Usuarios Objetivo

| Perfil | Caso de Uso |
|---|---|
| **Dirección** | Vista global de proyectos activos, carga del equipo y estado por cliente. |
| **Directores de Cuentas** | Gestión de clientes y campañas, seguimiento de entregas. |
| **Colaboradores** | Tareas asignadas, checklists, fechas de entrega. |
| **Clientes** | Vista de solo lectura o edición limitada de sus proyectos específicos. |

---

## 5. Modelo de Negocio (Freemium)

Una vez validado internamente, AGLAYA puede escalarse a otras agencias:
- **Free**: 3 tableros, 50 tarjetas, sin colaboradores externos.
- **Pro**: Ilimitado, acceso para clientes, soporte prioritario, hosting en infraestructura propia.

---

## 6. Funcionalidades Core

### Gestión Estructural
- Jerarquía: Organización -> Workspaces -> Boards -> Columns -> Cards.
- Drag & drop fluido de tarjetas entre columnas y tableros.
- Sidebar de navegación global y búsqueda de tableros.

### Seguridad y Privacidad
- Aislamiento perimetral: Los clientes no ven el trabajo de otros clientes ni el interno.
- Modo Dios (Superadmin): Auditoría invisible pero total.
- Hardened Permission Matrix: Roles micro protegidos por middleware context-aware.

---

## 7. Criterios de Aceptación
- Los datos persisten en Supabase y respetan la jerarquía de la organización.
- El drag & drop mantiene el orden íntegro tras recargar.
- Usuarios con rol `cliente` reciben `403 Forbidden` al intentar borrar columnas o mover tableros.
