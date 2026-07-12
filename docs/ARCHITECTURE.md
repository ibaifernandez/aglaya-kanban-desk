# ARCHITECTURE.md — Arquitectura Técnica AGLAYA Kanban Desk

**Última actualización:** 2026-07-12 (v1.3.1 — esquema reconciliado con la DB real)

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
  type            text CHECK (type IN ('personal','interno','externo')), -- ⚠️ default real en DB: 'general' (ver docs/INCIDENTS.md)
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

> **Nota:** este bloque es ilustrativo (modelo Core). El esquema completo, verídico y verificado contra la DB real de producción — columnas reales (`title`/`order`, no `name`/`position`), tablas `notifications` y `digest_logs`, GRANTs, RLS e inconsistencias conocidas — vive en [`docs/schema/supabase-schema.sql`](./schema/supabase-schema.sql).

---

## 🚀 5. Flujo de Despliegue

- **Client**: Se compila mediante `npm run build` y se despliega en Netlify. El archivo `netlify.toml` gestiona el proxy para redirigir las llamadas `/api/*` al servidor Railway.
- **Server**: Ejecutado en Railway bajo demanda. Se conecta a Supabase mediante `SUPABASE_KEY` y `SUPABASE_URL` de nivel service_role para operaciones administrativas seguras.

---

## 📝 6. Referencias
- Ver [SECURITY.md](./SECURITY.md) para la auditoría de superficie de ataque y gestión de secretos.
- Ver [PERMISSIONS.md](./PERMISSIONS.md) para la matriz detallada de acciones por rol.
- Ver [RUNBOOK.md](./RUNBOOK.md) para comandos de mantenimiento y despliegue.
- Ver [INCIDENTS.md](./INCIDENTS.md) para el histórico de fallos reales, causas raíz y correctivos aplicados.

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

### ADR-018: Contrato Único para Overlays, Confirmaciones y Navegación Compacta
**Fecha:** 2026-04-13
**Estado:** Aceptado
**Contexto:** La capa de interfaz había crecido con patrones desiguales: algunas acciones destructivas se ejecutaban sin confirmación, varios overlays no respondían a `Escape` y la toolbar interior del workspace sacrificaba la navegación en resoluciones pequeñas.
**Decisión:** Unificar el comportamiento de overlays y acciones destructivas con tres reglas: toda eliminación estructural requiere confirmación explícita, los overlays principales deben cerrarse con `Escape`, y la navegación contextual tiene prioridad sobre filtros secundarios cuando el ancho disponible es limitado.
**Consecuencias:** Se reduce el riesgo de borrados accidentales, la interfaz se vuelve más predecible para teclado y ratón, y la experiencia de workspace conserva legibilidad en pantallas estrechas sin comprometer la lógica de negocio.

### ADR-024: Separación de app.js e index.js
**Fecha:** 2026-04-29
**Estado:** Aceptado
**Contexto:** `server/index.js` contenía tanto la configuración completa de Express como el arranque del servidor TCP (`app.listen`). Al importar `index.js` en los tests, cualquier efecto secundario del módulo (inicialización de clientes, validaciones de startup) se ejecutaba en el contexto del test runner, lo que dificultaba el aislamiento y requería `--forceExit` como medida paliativa.
**Decisión:** Separar en dos ficheros con responsabilidades únicas: `server/app.js` exporta la aplicación Express completamente configurada (middlewares, rutas, error handlers) sin llamar nunca a `listen()`; `server/index.js` es el punto de entrada que importa `app.js`, valida la configuración de arranque y llama a `listen()`. Los tests importan `../app` directamente. El flag `--forceExit` se mantiene en los scripts npm como salvaguarda ante handles externos (conexiones de red de supertest).
**Consecuencias:** Separación de responsabilidades clara entre configuración de aplicación y arranque de proceso. Los tests importan únicamente la lógica que necesitan sin efectos secundarios de inicialización. Patrón estándar en proyectos Express de producción.

### ADR-023: Global Error Handler y 404 JSON en Express
**Fecha:** 2026-04-28
**Estado:** Aceptado
**Contexto:** Sin middleware de error global, cualquier excepción no capturada en una ruta hacía que Express devolviera su página de error HTML por defecto. El cliente React no sabe procesar HTML donde espera JSON, lo que producía errores opacos difíciles de diagnosticar. Además, las rutas no registradas tampoco devolvían JSON consistente.
**Decisión:** Añadir dos middlewares al final de `server/index.js`, después de todas las rutas: (1) un handler 404 que devuelve `{ error: 'Ruta no encontrada' }` en JSON, y (2) un error handler de cuatro parámetros `(err, req, res, next)` que captura cualquier `throw` no manejado, lo loguea con `[unhandled error]` y responde con JSON — mensaje genérico en producción, mensaje real en desarrollo. El campo `err.status` permite que los middlewares propaguen códigos HTTP específicos.
**Consecuencias:** El cliente siempre recibe JSON, independientemente de qué falle en el servidor. Los errores inesperados quedan registrados en los logs de Railway con contexto suficiente para diagnosticarlos. El comportamiento en producción no expone stack traces ni mensajes internos.

### ADR-022: Índices de Rendimiento en Columnas de Alta Frecuencia
**Fecha:** 2026-04-28
**Estado:** Aceptado
**Contexto:** El schema inicial no tenía índices explícitos. Con volumen creciente, las queries más frecuentes (carga de tablero, poll de notificaciones, evaluación de RLS) realizaban sequential scans completos sobre tablas que filtran siempre por las mismas columnas.
**Decisión:** Añadir 7 índices sobre las columnas de mayor frecuencia de consulta: `workspace_members(user_id)` — evaluado en cada request autenticado via funciones RLS; `notifications(user_id)` y `notifications(user_id, read) WHERE read = false` — consultados cada 45s por usuario; `cards(board_id)`, `columns(board_id)` y `boards(workspace_id)` — consultados en cada carga de tablero; `users(organization_id)` — consultado en operaciones admin y disponibilidad de miembros.
**Consecuencias:** Las queries críticas pasan de O(n) a O(log n). Sin impacto en el comportamiento funcional. Los índices parciales (`WHERE read = false`) son especialmente eficientes porque la proporción de notificaciones no leídas es siempre pequeña respecto al total.

### ADR-021: Migración de cards.category_id de TEXT a UUID FK
**Fecha:** 2026-04-28
**Estado:** Aceptado
**Contexto:** La columna `cards.category_id` estaba definida como `TEXT` sin referencia a `public.categories`. Esto permitía que las tarjetas mantuvieran IDs de categorías ya eliminadas sin que la BD lo detectara, resultando en referencias huérfanas silenciosas que la UI mostraba como categoría vacía.
**Decisión:** Migrar la columna a `UUID REFERENCES public.categories(id) ON DELETE SET NULL`. La migración limpia previamente cualquier valor huérfano, castea el tipo y añade el FK. A partir de este punto, borrar una categoría pone automáticamente a `NULL` el campo en todas las tarjetas que la usaban.
**Consecuencias:** Integridad referencial garantizada a nivel de BD. No requiere cambios en el backend ni en el frontend — el comportamiento observable es idéntico, pero ahora con garantías de datos consistentes.

### ADR-020: Modelo Single-Tenant Intencional — Multi-Organización Diferido
**Fecha:** 2026-04-28
**Estado:** Aceptado
**Contexto:** El schema de base de datos soporta múltiples organizaciones: las tablas `users`, `workspaces`, `boards`, `cards` y `categories` incluyen `organization_id` con referencias a `public.organizations`, y las políticas RLS aíslan los datos por organización. Sin embargo, la aplicación opera sobre una única organización (`AGLAYA`, id fijo `00000000-0000-0000-0000-000000000001` definido en el seed SQL). No existen endpoints CRUD para organizaciones ni GUI de gestión multi-org. El panel de admin asigna automáticamente cualquier usuario invitado a la organización del invitador.
**Decisión:** Mantener el modelo single-tenant de forma explícita e intencional. La fontanería multi-org existe en la BD pero no se activa. El sistema opera correctamente con una sola organización; activar el soporte multi-org en el futuro requerirá: (1) endpoints `POST/GET/PATCH/DELETE /api/organizations`, (2) lógica de asignación de org al registrar o invitar usuarios, (3) GUI de superadmin para gestión de organizaciones y asignación de usuarios, y opcionalmente (4) un flujo de registro por slug de organización (al estilo Notion/Linear).
**Consecuencias:** El sistema es más simple de mantener y depurar. No existe ambigüedad sobre la organización de pertenencia de ningún usuario o recurso. La arquitectura de BD no necesita modificarse para activar multi-org; solo se requiere extender el backend y el frontend. Esta decisión debe revisarse si AGLAYA Kanban Desk evoluciona hacia un SaaS con múltiples clientes independientes.

### ADR-019: Digest Contextual por Workspace y Email Derivado de Auth
**Fecha:** 2026-04-13
**Estado:** Aceptado
**Contexto:** El icono de correo dentro de un workspace seguía disparando el admin digest global, lo que rompía la expectativa de contexto del usuario y además podía mostrar correos obsoletos cuando `public.users.email` divergía de Supabase Auth.
**Decisión:** Reinterpretar el botón de la toolbar como acción contextual del workspace: ahora envía el digest personal filtrado por `workspaceId`, exige confirmación explícita en GUI y resuelve el email efectivo desde Supabase Auth, sincronizando `public.users` cuando detecta drift.
**Consecuencias:** El comportamiento del botón queda alineado con la pantalla donde vive, el feedback muestra el destinatario correcto y se elimina una fuente recurrente de inconsistencias entre identidad autenticada y perfil público.
