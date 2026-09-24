# Hoja de ruta — Auditoría Mariana 2026-09-24

Sprints de dos semanas. P0 = CRITICAL o REGRESSED; P1 = HIGH; P2 = MEDIUM; P3 = LOW e INFO. Los esfuerzos son estimaciones de implementación, sin revisión ni despliegue.

## Antes del sprint 1: tanda de 2 horas

Tres cambios pequeños que se refuerzan entre sí:

1. **B-20:** retirar `POST /api/auth/register`, o exigir sesión de administrador e ignorar `role` y `organizationId` del cuerpo. Añadir el test que falta. Revisar en `public.users` que no haya cuentas que nadie reconozca.
2. **B-21:** `DROP POLICY` de las dos políticas `WITH CHECK (true)` (P1 por severidad, pero cuesta 30 minutos y comparte riesgo con B-20).
3. **D-19:** añadir `required_status_checks` al conjunto de reglas de `main` y activar la espera a los checks en Railway (P1, 30 minutos).

## Sprint 1 — P0 (11 hallazgos · 32 h)

| ID | Sev | h | Hallazgo | Delta |
|---|---|---|---|---|
| A-01 | CRITICAL | 3 | 29 controles de formulario visibles sin etiqueta programática (13 sin nombre alguno) | REGRESSED |
| A-03 | CRITICAL | 3 | 6 superposiciones modales sin semántica de diálogo ni trampa de foco (absorbe A-17) | REGRESSED |
| A-04 | CRITICAL | 0,5 | 2 botones de solo icono sin nombre accesible | REGRESSED |
| A-26 | CRITICAL | 8 | Sin ratón no se puede abrir una tarjeta ni editar partes de ella | NEW |
| A-27 | CRITICAL | 4 | Barra lateral: tablero no seleccionable y acciones inalcanzables sin ratón | NEW |
| A-28 | CRITICAL | 3 | Estado de alternancias y desplegables no expuesto (aria-pressed / aria-expanded) | NEW |
| B-20 | CRITICAL | 1 | Alta de cuentas pública: sin sesión, con el rol y la organización que manda el cliente, y correo dado por confirmado | NEW |
| B-34 | CRITICAL | 4 | Los adjuntos se guardan en disco efímero, sin volumen, y la copia diaria no los incluye | NEW |
| C-19 | CRITICAL | 3 | Claude (Anthropic) trata contenido de tarjetas, nombres y correos a través del MCP del riel sin estar declarado como encargado | NEW |
| A-22 | HIGH | 1,5 | Errores de 4 formularios sin anunciar ni asociar al campo | REGRESSED |
| D-17 | LOW | 1 | INCIDENTS.md no recoge los incidentes de agosto y septiembre | REGRESSED |

## Sprint 2 — P1 (12 hallazgos · 37,5 h)

| ID | Sev | h | Hallazgo | Delta |
|---|---|---|---|---|
| A-07 | HIGH | 3 | Bundle único de 724,66 kB (206,73 kB gzip), sin división de código | UNCHANGED |
| A-15 | HIGH | 3 | Contraste de texto 1,61–2,80:1 (mínimo 4,5:1) en 155 usos | UNCHANGED |
| A-21 | HIGH | 2 | Avisos y contador de campana no anunciados a lector de pantalla | UNCHANGED |
| A-25 | HIGH | 8 | Diseño fijo: a 320 px quedan 80 px de contenido y la cabecera se recorta | UNCHANGED |
| A-29 | HIGH | 1,5 | 10 controles enfocables invisibles al recibir foco | NEW |
| B-03 | HIGH | 2 | La API sigue expuesta en el dominio por defecto de Railway; el dominio propio no existe | UNCHANGED |
| B-21 | HIGH | 0,5 | Dos políticas RLS de INSERT con WITH CHECK (true) anulan las restrictivas en workspaces y workspace_members | NEW |
| B-27 | HIGH | 4 | La sesión no se puede revocar: refresh de 30 días que se renueva solo; cerrar sesión solo borra la cookie | NEW |
| C-09 | HIGH | 6 | La DPIA sigue siendo una plantilla sin rellenar | UNCHANGED |
| C-20 | HIGH | 3 | La política promete botones de exportar y eliminar cuenta que la app no tiene | NEW |
| C-21 | HIGH | 4 | Borrar la cuenta deja los espacios creados por la persona con su contenido y el avatar público; la respuesta dice lo contrario | NEW |
| D-19 | HIGH | 0,5 | Producción no espera a CI: main exige PR pero no checks en verde, y Railway despliega sin mirarlos | NEW |

## Sprints 3-4 — P2 (28 hallazgos · 70 h)

| ID | Sev | h | Hallazgo | Delta |
|---|---|---|---|---|
| A-08 | MEDIUM | 0,5 | prefers-reduced-motion ignorado en la app | UNCHANGED |
| A-10 | MEDIUM | 8 | Densidad: CardModal.jsx 957 LOC, WorkspaceDashboard.jsx 802 LOC | DEESCALATED |
| A-12 | MEDIUM | 0,5 | index.html sin description, OG, theme-color ni canonical | UNCHANGED |
| A-24 | MEDIUM | 2 | Objetivos de pulsación de 10–21 px | UNCHANGED |
| A-30 | MEDIUM | 4 | Fallos de carga y de guardado sin aviso; la vista cae a un estado vacío que miente | NEW |
| A-31 | MEDIUM | 1 | Subidas e invitación no renuevan la sesión: fallan a los 15 min, y en tarjetas sin avisar | NEW |
| B-08 | MEDIUM | 1 | Dependencias del servidor con avisos HIGH (multer) y moderados, alcanzables solo con sesión | UNCHANGED |
| B-12 | MEDIUM | 6 | RLS de tarjetas, columnas, categorías e historial filtra por organización, no por espacio | UNCHANGED |
| B-16 | MEDIUM | 16 | Rutas con lógica de negocio y acceso directo a la base, sin capa de servicio | UNCHANGED |
| B-23 | MEDIUM | 1 | Categorías: la API solo exige sesión y organización, no pertenencia al espacio del tablero | NEW |
| B-24 | MEDIUM | 1 | Las URL de adjuntos se guardan sin validar y el cliente las usa como enlace e imagen | NEW |
| B-25 | MEDIUM | 3 | Subidas: extensión del nombre del cliente, tipos de texto sin control de contenido, servido en línea desde el origen de la app y sin sesión | NEW |
| B-26 | MEDIUM | 1 | Borrar un adjunto solo exige sesión: no comprueba a quién pertenece | NEW |
| B-40 | MEDIUM | 1,5 | Dos reglas de PERMISSIONS.md que el servidor no aplica (cambio de tipo por colaborador; lista de usuarios de la organización) | NEW |
| C-11 | MEDIUM | 1 | El token de acceso lleva correo y nombre | UNCHANGED |
| C-16 | MEDIUM | 4 | No hay programa de gobernanza de privacidad LGPD | UNCHANGED |
| C-22 | MEDIUM | 2 | Exportación sin notificaciones (columna inexistente), sin tarjetas asignadas ni historial propio | NEW |
| C-23 | MEDIUM | 1 | Cloudflare figura solo como DNS y R2, pero hace de proxy de todo el tráfico y recoge informes NEL | NEW |
| D-02 | MEDIUM | 3 | Registros en texto libre, sin estructura | DEESCALATED |
| D-04 | MEDIUM | 4 | Sin linter, formateador ni tipos | DEESCALATED |
| D-07 | MEDIUM | 0,5 | Ningún monitor de disponibilidad documentado | DEESCALATED |
| D-11 | MEDIUM | 0,5 | Actualizaciones de seguridad de Dependabot desactivadas y sin dependabot.yml | UNCHANGED |
| D-13 | MEDIUM | 2 | ADR-001 a 010 sin ficha; ADR-005 dice que el repositorio es privado | UNCHANGED |
| D-16 | MEDIUM | 1 | /api/health responde ok sin comprobar nada | UNCHANGED |
| D-20 | MEDIUM | 2 | El cliente no registra errores en ningún sitio | NEW |
| D-21 | MEDIUM | 0,5 | Ante una excepción no capturada el proceso no sale y Railway no lo reinicia | NEW |
| D-23 | MEDIUM | 1 | La UI dice que el Invitado es de solo lectura; la matriz y el servidor le dejan crear, editar y mover tarjetas | NEW |
| D-24 | MEDIUM | 1 | El registro de la auditoría de mayo cerró como MITIGATED arreglos parciales | NEW |

## Backlog — P3 (24 hallazgos · 15,9 h)

| ID | Sev | h | Hallazgo | Delta |
|---|---|---|---|---|
| A-13 | LOW | 0,25 | No hay robots.txt: /robots.txt y /sitemap.xml devuelven la SPA con 200 | UNCHANGED |
| A-32 | LOW | 1 | confirm() nativo en 2 borrados, contra ADR-018 | NEW |
| A-33 | LOW | 0,25 | Salto de h1 a h3 en la vista de tablero | NEW |
| A-34 | LOW | 0,5 | El título del documento no cambia entre vistas | NEW |
| A-35 | LOW | 0,25 | El pie de la barra lateral dice «AGLAYA v1.2 · Phase 1»; la versión es 1.4.0 | NEW |
| B-28 | LOW | 0,25 | El secreto de la puerta interna se compara con !== y no en tiempo constante | NEW |
| B-29 | LOW | 2 | Puerta interna: llega a espacios personales y ilike no escapa comodines (deuda declarada) | NEW |
| B-31 | LOW | 0,25 | Entorno local del riel MCP con dos avisos (cryptography, pip) | NEW |
| B-33 | LOW | 0,5 | Credenciales de servicios retirados siguen en el entorno de producción | NEW |
| B-35 | LOW | 0,5 | cards.priority sin CHECK, y crear tarjeta no valida la prioridad | NEW |
| B-36 | LOW | 2 | Borrar un espacio encadena seis borrados sin transacción ni comprobación intermedia | NEW |
| B-37 | LOW | 3 | El riel MCP guarda service_role en la máquina del operador y opera como superadmin (ADR-026) | NEW |
| B-38 | LOW | 0,5 | CSP con unsafe-inline en script-src sin nada que lo necesite; Referrer-Policy laxa | NEW |
| B-39 | LOW | 0,5 | Cuatro respuestas devuelven detalles internos | NEW |
| B-41 | LOW | 1 | El guardián de GRANT no ve MAINTAIN (ya documentado) | NEW |
| C-10 | LOW | 0,5 | Sección de cookies inexacta: claves de localStorage que no se usan; calla la cookie aglaya_refresh | DEESCALATED |
| C-25 | LOW | 0,25 | GitHub figura como «trigger por reloj» y el volcado completo se hace en su runner | NEW |
| C-26 | LOW | 0,25 | «Las prioridades las asignan humanos»: agentes crean tarjetas con prioridad y responsable | NEW |
| C-27 | LOW | 0,5 | Los registros del servidor guardan correos | NEW |
| C-28 | LOW | 0,5 | Las TOMs describen como control el domain guard del registro y los adjuntos como auth-walled | NEW |
| D-09 | LOW | 1 | Falta el runbook de marcha atrás de un despliegue | DEESCALATED |
| D-25 | LOW | 0,1 | package.json presenta la app como multi-tenant (contra ADR-020) | NEW |
| D-26 | LOW | 0,1 | El README muestra licencia MIT y no hay fichero LICENSE | NEW |
| B-32 | INFO | 0 | Clave de Resend en el historial público, revocada el 2026-08-07 | NEW |

## Verificaciones externas (no verificables)

- **A-NV-01** (`NV_RUNTIME`): PageSpeed Insights / Lighthouse sobre / sin sesión, y DevTools → Performance con sesión.
- **B-14** (`NV_CREDENTIALS`): EXPLAIN ANALYZE de las consultas por column_id (server/routes/cards.js:141,547,549; columns.js:198) con tabla de tamaño real.
- **B-NV-01** (`NV_RUNTIME`): Registrar temporalmente req.ip y X-Forwarded-For en una petición real.
- **B-NV-02** (`NV_DASHBOARD`): Panel de Supabase → Database → Backups.
- **C-NV-01** (`NV_DASHBOARD`): Consola de Anthropic / condiciones del plan; archivar el DPA en DPA-registry.md.
- **C-NV-02** (`NV_DASHBOARD`): Panel de Railway (retención de logs) y de Supabase (región).
- **D-NV-01** (`NV_DASHBOARD`): Sentry → Alerts; Netlify → Build & deploy.

## Notas de secuencia

- **B-34, B-25 y B-26** se resuelven con el mismo cambio: adjuntos a Supabase Storage privado con URL firmada.
- **A-26 y A-27** comparten causa: la acción de abrir está en el mismo elemento que el asa de arrastre. Separarlas arregla las dos cosas y conserva A-02.
- **C-20, C-22 y C-21** se hacen mejor juntos: primero arreglar la exportación y la supresión, luego poner los botones, y al final ajustar la política.
- **A-25:** si la herramienta se declara solo de escritorio, baja a decisión documentada (0,5 h) en lugar de 8 h de maquetación.
- **D-24** es la condición para que los próximos cierres no vuelvan como `REGRESSED`: cerrar con la misma medición que abrió.
