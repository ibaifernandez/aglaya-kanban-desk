# ADR-025 — State Management del Cliente: Mantener Acople Plano a `api`

**Estado:** Aceptada
**Fecha:** 2026-05-27
**Numeración:** ADR-001 ya está ocupado por "DB & Auth (Supabase)" en `docs/ARCHITECTURE.md`. La numeración secuencial llega hasta ADR-024, así que este ADR toma ADR-025.

---

## Contexto

El cliente React de AGLAYA Kanban Desk expone una API plana en
`client/src/api/client.js` — un objeto `api` con ~40 funciones que envuelven
`fetch()`. Auditoría con `graphify`:

- 18 archivos del cliente importan `api` directo desde `client.js`.
- 4 son hooks de datos (`useBoardData`, `useBoards`, `useCategories`, `useWorkspaces`).
- 14 son componentes/páginas que llaman `api` directo para mutaciones
  (createCard, updateBoard, deleteFile, uploadAvatar, etc.).
- No existen mutation hooks; loading/error state vive disperso en cada componente.

Se evaluaron tres caminos:

| Camino | Descripción | Esfuerzo | Beneficio |
|---|---|---|---|
| **A** | Hand-rolled domain hooks `use*Api.js` por recurso | Bajo–Medio | Centraliza acople pero reinventa TanStack Query |
| **B** | Adoptar `@tanstack/react-query` (~5KB), migrar todos los call sites | Medio | Cache, invalidación, retry, devtools estándar industria |
| **C** | No tocar. Acople plano es aceptable mientras la API sea estable y el equipo chico | Cero | Sin riesgo, deuda explícita |

---

## Decisión

**Camino C — mantener acople UI → `api` directo, sin domain hooks ni
library state management.**

Esto preserva:

- 4 query hooks existentes (`useBoardData`, `useBoards`, `useCategories`, `useWorkspaces`).
- 14 call sites directos a `api` desde componentes para mutaciones.
- Patrón de loading/error state in-component vía `useState`.

---

## Razones

1. **Tamaño actual.** AGLAYA Kanban Desk es herramienta interna, equipo
   chico (<3 devs frontend simultáneos), uso diario controlado.
2. **API estable.** El objeto `api` no cambia de shape con frecuencia; los
   refactors recientes han sido aditivos.
3. **Sin cross-cutting concerns reales.** Auth header ya vive en `request()`,
   no se duplica. Error handling es ad-hoc pero consistente (try/catch + toast).
4. **Camino A reinventaría TanStack Query a mano** — caching, invalidación,
   retry, dedupe, devtools. Esfuerzo similar al de adoptar la librería, con
   resultado inferior.
5. **Camino B es correcto pero prematuro.** Sin fricción concreta en
   producción que justifique el esfuerzo de migración + cambio de paradigma
   mental del equipo, el ROI es bajo hoy.

---

## Triggers para Revisar Esta Decisión

Revisitar este ADR si aparece **cualquiera** de las siguientes señales:

1. **Stale data en producción.** Componentes muestran datos viejos tras
   mutaciones (ej. crear card no aparece en otra pestaña abierta hasta refresh).
2. **Loading state desincronizado** entre componentes que miran el mismo
   recurso.
3. **Race conditions en mutaciones** (ej. dos updates concurrentes sobre la
   misma card que pisan resultados).
4. **Equipo frontend crece a >3 devs simultáneos** trabajando en el cliente.
5. **API se vuelve inestable** (cambios de shape semanales, breaking changes
   frecuentes).
6. **Métricas degradan**: tiempos de carga percibidos por usuario suben,
   support requests sobre "no se actualiza" aumentan.

---

## Plan de Migración Futura (si se gatilla)

**Primera opción a evaluar: TanStack Query (no hand-rolled).**

Razón: el problema que A intenta resolver (caching, dedupe, invalidación,
loading state estándar) es exactamente lo que TanStack Query resuelve out
of the box. Migrar incrementalmente:

1. Instalar `@tanstack/react-query` + devtools.
2. Envolver `<App>` en `QueryClientProvider`.
3. Migrar un recurso por sprint, empezando por el más doloroso (probable:
   cards o notifications, por su rate de mutación).
4. Mantener `api` plano como capa low-level — TanStack Query envuelve, no
   reemplaza.

**Costo estimado** (cuando llegue el momento): 1 sprint dedicado para
migración inicial + 1 PR por recurso después.

---

## Trazabilidad

- **Audit:** ver session log `2026-05-27` — grafo `graphify` reveló
  `digestRouter` (degree 29) y comunidad 0 del frontend (80 nodos,
  cohesión 0.052).
- **Refactor relacionado aplicado:** `refactor(digest): consolidate shared
  helpers + move to server/services/digest/` (commit `dad39d8`).
- **Refactor NO aplicado (este ADR):** "Domain hooks UI para reducir
  acople UI → client" — diferido hasta trigger.
