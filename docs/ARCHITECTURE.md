# ARCHITECTURE.md — Arquitectura Técnica AGLAYA Kanban Desk

**Última actualización:** 2026-04-13 (v1.1.5)

---

## 📌 Resumen de Decisiones (ADR)

Para el historial completo de la evolución del sistema, consulte el **Registro de Decisiones** al final de este documento.

---

## 🏗️ 1. Descripción General

AGLAYA es una plataforma SaaS de gestión de tareas tipo Kanban con aislamiento multi-tenant. La arquitectura está diseñada para soportar múltiples equipos y clientes dentro de una misma organización, garantizando que los datos sean privados y seguros.

### Stack Tecnológico
- **Frontend**: React 18 + Vite (SPA)
- **Backend**: Express.js (Node.js) — *Decisión: Flexibilidad y rapidez de iteración.*
- **Base de Datos**: Supabase (PostgreSQL + RLS) — *Decisión: Auth integrado y escalabilidad segura (ADR-001/002).*
- **Infraestructura**: Railway (API) + Netlify (Client) — *Decisión: CI/CD inmediato y gestión de dominios simplificada (ADR-010).*

---

## 📁 2. Jerarquía de Datos

El sistema se organiza en cinco niveles de profundidad:

1. **Organización (Macro)**: Contenedor global (ej. AGLAYA Corp). Posee usuarios y configuraciones globales.
2. **Workspace (Micro)**: Espacios aislados por departamentos, clientes o proyectos específicos (ej. "Banco Internacional", "Operaciones Internas").
3. **Board**: Tableros Kanban específicos dentro de un Workspace.
4. **Column**: Estados del flujo de trabajo (Backlog, En Curso, Hecho).
5. **Card**: La unidad mínima de trabajo.

---

## 🔐 3. Seguridad y Multi-tenancy

### Aislamiento por Middleware
El sistema utiliza una capa de seguridad concéntrica:
- `requireAuth`: Verifica la identidad del usuario mediante JWT de Supabase.
- `requireRole`: Valida el rol **Macro** (Superadmin, Admin, Colaborador) para acceso a infraestructura global.
- `requireWorkspaceMember`: El "muro de fuego" **Micro**. Verifica si el usuario pertenece al espacio de trabajo. Es un middleware *context-aware* capaz de derivar el `workspaceId` desde un `boardId`, `columnId` o `cardId`.

### Modo Dios (Superadmin)
El Superadmin (`info@ibaifernandez.com`) posee un bypass en el middleware que le permite auditar cualquier workspace mediante acceso directo por URL, actuando como Propietario virtual sin necesidad de estar invitado explícitamente.

### Roles Micro
Definidos en la tabla `workspace_members`:
- `owner`: Solo uno por workspace. Control total.
- `admin`: Gestión de miembros y tableros.
- `member`: Gestión operativa.
- `guest`: Solo lectura/colaboración en tarjetas (sin estructural).

---

## 💾 4. Esquema de Base de Datos (Core)

```sql
-- Gestión de Espacios
CREATE TABLE public.workspaces (
  id              uuid PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  name            text NOT NULL,
  type            text DEFAULT 'personal', -- 'personal' | 'interno' | 'externo'
  emoji           text DEFAULT '📋',
  created_at      timestamptz DEFAULT now()
);

-- Membresías y Roles
CREATE TABLE public.workspace_members (
  workspace_id uuid REFERENCES public.workspaces(id),
  user_id      uuid REFERENCES public.users(id),
  role         text NOT NULL, -- 'owner', 'admin', 'member', 'guest'
  PRIMARY KEY (workspace_id, user_id)
);

-- Estructura Kanban
ALTER TABLE public.boards ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
```

---

## 🚀 5. Flujo de Despliegue

- **Client**: Se compila mediante `npm run build` y se despliega en Netlify. El archivo `netlify.toml` gestiona el proxy para redirigir las llamadas `/api/*` al servidor Railway.
- **Server**: Ejecutado en Railway bajo demanda. Se conecta a Supabase mediante `SUPABASE_KEY` y `SUPABASE_URL` de nivel service_role para operaciones administrativas seguras.

---

## 📝 6. Referencias
- Ver [SECURITY.md](./SECURITY.md) para la auditoría de superficie de ataque y gestión de secretos.
- Ver [PERMISSIONS.md](./PERMISSIONS.md) para la matriz detallada de acciones por rol.
- Ver [RUNBOOK.md](./RUNBOOK.md) para comandos de mantenimiento y despliegue.

---

## 📖 7. Registro de Decisiones Arquitectónicas (ADR)

Cada una de estas decisiones ha moldeado el estado actual de AGLAYA para garantizar su robustez y escalabilidad corporativa.

### Historial de Decisiones Clave:
1. **DB & Auth (Supabase)**: Elegido por su integración nativa de autenticación y PostgreSQL estándar, evitando el *vendor lock-in* total y permitiendo una futura migración a infraestructura autogestionada (ADR-001/002).
2. **Infraestructura Soberana (AGLAYA)**: La visión final es el control total en servidores propios de AGLAYA. Se utiliza Railway de forma provisional para agilizar demos sin sacrificar la modularidad del backend (ADR-003/010).
3. **Control de Plan (Freemium)**: Gestor mediante campo `plan` en base de datos para simplificar la Phase 1 sin depender de pasarelas de pago externas como Stripe en la fase beta (ADR-004).
4. **Propiedad Intelectual**: El repositorio fuente es privado de AGLAYA. Los desploys se realizan mediante artefactos compilados para proteger el código fuente durante la fase de negociación inicial (ADR-005).
5. **Aislamiento Multi-tenant (Workspaces)**: Implementado mediante una tabla dedicada de membresías y funciones SQL `SECURITY DEFINER` para evitar recursión en las políticas RLS de Supabase (ADR-012/009).
6. **Hardening de Cascada**: Cambio de `ON DELETE CASCADE` a `SET NULL` en campos de autoría para asegurar que el contenido sobreviva a la rotación de personal (ADR-013).
7. **Identidad Visual**: Consolidación de **AGLAYA Kanban Desk** como plataforma independiente y profesional (ADR-011).

## ADR (Architecture Decision Records)

### ADR-011: Consolidación de Marca e Identidad
**Fecha:** 2026-04-11
**Estado:** Aceptado
**Contexto:** La plataforma ha evolucionado hacia un modelo multi-tenant independiente bajo la marca AGLAYA.
**Decisión:** Eliminar toda referencia a marcas anteriores y dominios de terceros. Estandarizar mocks de prueba en `aglaya.biz`.
**Consecuencias:** Coherencia total en la experiencia de usuario y propiedad intelectual protegida.

### ADR-012: Estabilización del Entorno de Tests (Jest Downgrade)
**Fecha:** 2026-04-11
**Estado:** Aceptado
**Contexto:** La versión de desarrollo `jest@30.2.0-alpha` presentaba bloqueos sistemáticos y procesos huérfanos.
**Decisión:** Downgrade a `jest@29.7.0` (versión estable).
**Consecuencias:** Recuperación de la capacidad de diagnóstico y eliminación de procesos zombis en el terminal.

### ADR-014: Alineación Estricta de Permisos GUI/API y Sesión Efímera
**Fecha:** 2026-04-13
**Estado:** Aceptado
**Contexto:** La UI exponía acciones que el backend rechazaba después por rol micro o por mezcla entre roles macro y micro. Además, la invitación de miembros del workspace dependía indebidamente del panel global de administración, y la sesión sensible seguía persistiendo en `localStorage`, en contra de la política del proyecto.
**Decisión:** Convertir el backend en fuente de verdad explícita para estos flujos: validación de organización y tipo en invitaciones de workspace, inmutabilidad del `owner`, bloqueo de creación de workspaces para `cliente`, `reorder` de tableros con `workspaceId` obligatorio y control micro, y endpoint dedicado `GET /api/workspaces/:workspaceId/available-users` para invitar miembros sin depender del panel global. En frontend, ocultar acciones no autorizadas por `workspace.myRole`, separar roles macro de los roles de workspace y migrar la sesión autenticada a `sessionStorage` con migración suave desde `localStorage`.
**Consecuencias:** Se reduce drásticamente el número de falsos conflictos entre GUI y API, se elimina una fuente recurrente de errores de validación, y la sesión queda alineada con la política de seguridad de AGLAYA. El sistema pasa a ser más predecible tanto en local como en producción.

### ADR-015: Invitación Admin Resiliente ante Sesiones y Estados Parciales
**Fecha:** 2026-04-13
**Estado:** Aceptado
**Contexto:** El flujo `POST /api/admin/users/invite` podía terminar en `500` genérico cuando el `organizationId` del JWT estaba desfasado respecto al perfil real del usuario, o cuando existía un estado parcial entre `auth.users` y `public.users`. Esto hacía muy difícil diagnosticar incidencias en Railway y provocaba fallos intermitentes percibidos como “la invitación no funciona”.
**Decisión:** Resolver siempre la organización efectiva del invitador desde `public.users` antes de crear el perfil, y añadir reconciliación explícita del estado de invitación: detección previa de perfiles existentes, recuperación de usuarios presentes en Auth pero sin perfil público, y degradación de conflictos de unicidad a `409` semántico en lugar de `500`.
**Consecuencias:** Las invitaciones admin dejan de depender de sesiones potencialmente obsoletas, se reducen los errores opacos en producción y el backend gana capacidad de autocuración ante altas parciales sin romper el contrato de la GUI.

### ADR-016: Aislamiento Estricto de Clientes Supabase en Backend
**Fecha:** 2026-04-13
**Estado:** Aceptado
**Contexto:** El backend reutilizaba un singleton global de Supabase tanto para operaciones `service_role` como para autenticación interactiva (`signInWithPassword`). En producción esto podía contaminar el estado interno del cliente tras un login y provocar que rutas administrativas posteriores ejecutaran inserciones bajo identidad autenticada, disparando errores RLS inesperados como el observado en `POST /api/admin/users/invite`.
**Decisión:** Introducir factorías `createAdminClient()` y `createPublicClient()` con sesiones no persistentes, y usar clientes frescos por request en `auth` y `admin` para separar estrictamente login interactivo, operaciones de Auth Admin y escrituras privilegiadas sobre `public.*`.
**Consecuencias:** Se elimina una clase completa de errores intermitentes asociados al estado compartido del cliente de Supabase, especialmente en Railway bajo tráfico real. El backend pasa a comportarse de forma determinista independientemente del orden de login y operaciones administrativas.

### ADR-017: Contexto de Workspace Explícito para Operaciones de Tarjeta
**Fecha:** 2026-04-13
**Estado:** Aceptado
**Contexto:** El borrado de tarjetas dependía de que el middleware reconstruyera el `workspaceId` a partir de joins implícitos (`cards -> boards(workspace_id)`), lo que en producción podía fallar y devolver `400 Contexto de workspace no encontrado` aunque la tarjeta fuera válida y visible en GUI.
**Decisión:** Hacer el contrato explícito en dos capas: el frontend envía `boardId` en `DELETE /api/cards/:id`, y el middleware resuelve el `workspaceId` en dos pasos deterministas (`card -> board -> workspace`) en lugar de confiar en relaciones anidadas de PostgREST.
**Consecuencias:** Las operaciones destructivas sobre tarjetas dejan de depender de inferencias frágiles del backend y el sistema se vuelve más estable ante cambios de relaciones, naming o serialización entre Supabase y Express.
