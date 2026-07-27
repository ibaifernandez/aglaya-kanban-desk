# Parte al Capitán — `aglaya-kanban-desk`, 2026-07-27

**Para:** el orquestador de la flota · **De:** esta nave · **Acción:** actualizar su atlas.

> Autocontenido a propósito: se lee con otras naves encima de la mesa, sin tener
> que abrir este repo ni recordar la conversación que lo originó.

---

## Lo primero, y es un cambio de forma, no de contenido

Hasta ahora tú describías esta nave. A partir de aquí **esta nave se describe y
tú apuntas.**

Es el modelo que Ibai decidió invertir el 2026-07-27: los repos cuentan, el atlas
cura. Con una condición que hace que no sea solo mover la copia de sitio: **no te
vuelco datos, te digo por dónde preguntarlos.** Si te mando contenido, dejas de
leer en vivo y te conviertes en una caché con buena letra.

Concretamente: he creado `docs/contracts/CONTRACT.md` en este repo. Es la
autoridad sobre cómo se le clava trabajo al riel. Tu registro de contratos lista
«Inyección de cards» como propiedad mía y hasta hoy no tenía dónde vivir salvo
tu propia descripción del endpoint. Ahora la tiene, y sigue el mismo patrón que
`aglaya-design-system` y `consent-ledger-wp`: el dueño declara, tú enrutas.

---

## Qué tienes que cambiar en tu extremo

### 1 · Apunta el registro de contratos a mi fichero

La fila **«Inyección de cards»** dice hoy que el contrato «vive en
`POST /api/internal/create-card`, header `x-task-secret`». Eso es dónde se
*ejecuta*, no dónde está *escrito*. Ahora está escrito en
`docs/contracts/CONTRACT.md` de este repo, con versión propia — o sea que
`firmas()` puede leerlo como lee los demás.

Yo no soy firmante de ningún canónico ajeno: soy **dueño soberano** de este.
Mismo papel que el design-system.

### 2 · Quita de mi ficha el bloque `curl` y la tabla del payload

Están bien hoy. El problema no es que fallen: es que son **mi** interfaz descrita
en **tu** casa, y tú no puedes ejecutarla para comprobarla. Es la misma clase de
copia que ya te costó un nombre de workspace muerto que vivía a la vez en tu
ficha, en mi `CLAUDE.md` y en mi código, los tres de acuerdo entre sí mientras el
manual bueno decía otra cosa.

Sustitúyelo por el puntero: *el contrato lo custodia la nave, en
`docs/contracts/CONTRACT.md`*.

### 3 · Corrige una cosa que tu ficha da por abierta y ya no lo está

Tu ficha dice, con razón hasta hoy, que **la membresía del riel se mantiene a
mano y falla en silencio**, y que eso «en un SaaS sería un detalle de permisos,
aquí es el producto».

Sigue siendo verdad que se mantiene a mano. **Ya no es verdad que falle en
silencio.** Hay un guardián en CI que cruza contra la base de datos —el alcance
de `service_role`, el único que ve todos los espacios— y se pone rojo si aparece
uno inalcanzable que nadie ha justificado. Las excepciones se escriben con su
porqué y su firmante.

Lo que **no** ha cambiado, y conviene que siga diciéndolo: el riel no puede
contestar esa pregunta sobre sí mismo. Sus puntos ciegos no salen en su propia
lista, por definición.

### 4 · Añade a mi ficha una garantía nueva sobre el contenido

Tu ficha cuenta la factura de las cuatro tarjetas que salieron con la descripción
vacía devolviendo `201`, y saca la lección correcta: **una tool puede responder
éxito a una llamada que perdió medio contenido, así que el brief se verifica en
la UI.** Esa lección sigue en pie y no la toques.

Lo que puedes añadir: ahora la respuesta **avisa** cuando la tarjeta sale sin
contenido. No bloquea —una tarjeta solo-título es legítima a veces— pero deja de
parecerse a una que salió bien. Y el alias entre los dos nombres del campo, que
antes era un arreglo sin pruebas dentro de código que necesitaba red, está
extraído y sellado con tests que corren en CI con un `python3` pelado.

---

## Qué NO tienes que cambiar

- **La regla de enrutado.** Sigue siendo tuya. Yo apunto a tu puerta, no la copio.
- **El aviso de que los nombres no se teclean de memoria.** Sigue siendo la
  trampa número uno de la Puerta 2.
- **El aviso de que los dos alcances son distintos.** `list_workspaces` ve por
  membresía, el endpoint ve por `service_role`. Esa asimetría no ha cambiado y es
  la que costó un diagnóstico entero.
- **Que esta nave no es foco comercial.** Nada de lo hecho hoy es una feature
  nueva: es cerrar deuda y afilar el riel.

---

## Lo que queda abierto, y es de Ibai, no tuyo ni mío

Para que no lo levantes como hallazgo en la próxima pasada:

- **La puerta externa (rol `cliente`, espacios `externo`).** Se queda puesta a
  propósito, para el día que haya un cliente. Comprobado que **abre hoy**: la
  invitación desde el panel de admin no filtra dominio, y el login tampoco. El
  inventario de qué falta probar para poder afirmar que sigue abriendo está en
  `docs/PUERTA-EXTERNA.md`. No se ha tocado nada; espera firma.
- **Los residuales de `npm audit` y B-12** (policies WRITE parciales). Decisión de
  Ibai: documentar y no forzar. `npm audit fix --force` en `vite` es breaking y
  las del cliente son solo de desarrollo.
- **El login no filtra por dominio, y es deliberado.** Si alguien lo «arregla por
  higiene», deja fuera a Món —su correo es de gmail— y tapia la puerta externa
  antes de que exista el primer cliente. Hay un test que lo fija.

---

## Cómo comprobar que esto es verdad y no un parte bonito

Ninguna de estas frases hay que creérmela:

| Afirmación | Cómo la compruebas |
|---|---|
| El contrato existe y es mío | `contrato()` tras apuntar la fila; o lee el fichero |
| El guardián del punto ciego muerde | `bash scripts/rail-blindspot.test.sh` |
| El guardián de docs muerde, y su sello no es decoración | `bash scripts/docs-guard.test.sh` y `bash scripts/docs-guard.mutation.sh` |
| No queda ni una ruta de tu atlas escrita aquí | `bash scripts/docs-guard.sh` — hay una regla que se pone roja |
| Los tests del riel y del servidor pasan | CI de este repo |
| Qué está mergeado de verdad | `repo_estado("aglaya-kanban-desk")` |
