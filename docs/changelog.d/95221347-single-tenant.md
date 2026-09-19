Fixed

- **Ningún documento vigente llama ya «multi-tenant» al Kanban.** Tarjeta `95221347`. `ARCHITECTURE.md` lo afirmaba en tres sitios mientras su propio ADR-020 dice single-tenant, y de ahí lo copió el portafolio de Ibai unas 11 veces.
  - **Lo que es, medido en esquema y código:** una sola organización, por decisión (ADR-020). El aislamiento entre espacios de trabajo lo pone **el servidor** (`requireWorkspaceMember`), que usa `service_role` y se salta RLS. RLS es una segunda barrera: en espacios, membresías y tableros filtra por membresía; en tarjetas, columnas y categorías, **solo por organización**.
  - Corregido en `ARCHITECTURE.md` (§1, historial y contexto del ADR-011), `README.md`, `PRD.md`, la plantilla DPIA y el RAT, que decía «RLS por workspace_id».
  - **La política de privacidad pasa a la 1.5**: su sección 9 atribuía a RLS un «aislamiento multi-tenant». No cambia ningún tratamiento ni ninguna medida, solo cómo se describe una. Sube de versión igualmente, y su historial explica por qué.
  - Se dejan como están los registros fechados (auditorías, CHANGELOG), los nombres de fase de `ROADMAP` y `BACKLOG`, y los textos que cuentan que la nave **nació** multi-tenant, que es cierto.
