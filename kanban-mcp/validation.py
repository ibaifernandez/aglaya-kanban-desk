"""Validación de destino del riel — lógica PURA, sin red ni dependencias.

Está separada de `server.py` a propósito, y sin imports de terceros, para que
`test_validation.py` corra en CI con un `python3` pelado, sin instalar nada.
Una comprobación que no corre en CI es decoración.

REGLA DE ENRUTADO — el resumen va aquí, el manual NO se copia:
  El espacio de destino es el del DUEÑO DEL ARTEFACTO que hay que tocar, y una
  tarea vive en UN SOLO espacio: nunca espejada en dos.
  El custodio de la regla completa y de los IDs de destino lo tiene el capitán,
  en el repo `aglaya-orchestrator`. Aquí solo el puntero: una copia del manual
  dentro del MCP se desincronizaría del manual.

  Y el puntero es a la PUERTA, no a la ruta. Una ruta del atlas caduca en
  silencio —el capitán lo reorganiza cuando quiere y nadie aquí se entera—
  mientras que el nombre del repo y la pregunta no caducan. `donde_pregunto`
  resuelve al manual vivo y cita su fuente; una ruta tecleada solo puede
  acertar hasta que deje de hacerlo.
"""

# Cómo se llega al manual, no dónde está. Se devuelve en el texto de los errores
# de abajo, así que tiene que seguir diciendo a dónde ir incluso —sobre todo—
# cuando el capitán haya movido las cosas de sitio.
_MANUAL = 'donde_pregunto("tarea") en el MCP aglaya-atlas (repo aglaya-orchestrator)'


def cards_listing_plan(board_id, column_id):
    """A qué endpoint se le pregunta un listado de tarjetas, y a qué alcance
    responde. Lógica PURA: decide la ruta, no la recorre.

    Está aquí y no dentro de `list_cards` justamente porque `list_cards` necesita
    red y no se puede probar en CI. La decisión —«si me dan una columna, pregunto
    por la columna»— sí se puede, y es exactamente donde estaba el defecto.

    Factura que lo enseñó (6-ago-2026): `column_id` se usaba SOLO para derivar el
    tablero y luego se tiraba, así que pedir «🔍 Por revisar» y pedir «🛡 Auditado»
    —vacía— devolvía la misma respuesta byte a byte: el tablero entero. Es la
    misma forma que esta casa ya documentó en `list_workspaces`: **un alcance
    contestando por otro**, con una respuesta que parece correcta porque es un
    superconjunto. Y el protocolo de obra arranca los CUATRO papeles con «coge de
    tal columna», así que mientras eso pase el tablero no reparte nada.

    El arreglo no es filtrar en el cliente: el servidor **ya** tiene un endpoint
    que filtra por columna (`GET /columns/:id/cards`). Bastaba con preguntarle a
    él. Filtrar en cliente habría heredado además el tope de filas, que se aplica
    ANTES de filtrar: en un tablero grande, las tarjetas de la columna pedida
    pueden quedar fuera del corte y devolverse cero, en verde.

    Si vienen los dos, manda `column_id` por ser el más estrecho — y el acuse
    devuelve ambos para que se vea quién contestó.
    """
    b = str(board_id).strip() if board_id is not None else ""
    c = str(column_id).strip() if column_id is not None else ""

    if not b and not c:
        return {"error": "pass board_id or column_id"}

    if c:
        return {"path": f"/columns/{c}/cards", "scope": "column",
                "column_id": c, "board_id": b or None}

    return {"path": f"/boards/{b}/cards", "scope": "board",
            "board_id": b, "column_id": None}


def row_cap_notice(total, cap):
    """`None` si cabía todo; aviso si el listado se cortó.

    Un tope que recorta en silencio es un conteo que miente: quien lea `count`
    creerá que eso es todo lo que hay. Da igual que el tope sea razonable — lo
    que no puede es no decirse.
    """
    if total <= cap:
        return None
    return (
        f"listado recortado: hay {total} y se devuelven {cap}. El resto NO está "
        "en esta respuesta — acota por columna, o cuenta contra la base."
    )


def missing_workspace_error(workspace_id):
    """`None` si viene un destino utilizable; dict de error si falta.

    Se comprueba ANTES de tocar la red: si el llamante no dijo dónde va la
    tarjeta, no hay nada que derivar.
    """
    if workspace_id is not None and str(workspace_id).strip():
        return None
    return {
        "error": (
            "workspace_id es obligatorio: di explícitamente en qué espacio va la "
            "tarjeta. No hay default por diseño — un destino implícito acaba "
            "clavando trabajo donde no toca y devolviendo 201 como si fuera bien.\n"
            "Regla: el espacio es el del dueño del artefacto que hay que tocar, y "
            "una tarea vive en un solo espacio, nunca espejada.\n"
            f"Regla completa (se pregunta, no se cita): {_MANUAL}\n"
            "Los IDs vivos los da list_workspaces en este mismo MCP."
        )
    }


def resolve_brief(description, description_md):
    """El texto que va dentro de la tarjeta, venga por el nombre que venga.

    La tool acepta DOS nombres para el mismo campo porque el endpoint HTTP usa
    `description` y el riel documentaba `description_md`. Quien viniera del otro
    lado pasaba el nombre del otro lado.

    Factura que lo enseñó: cuatro tarjetas salieron VACÍAS devolviendo 201. El
    kwarg desconocido se descartaba en silencio y la respuesta de éxito tapaba
    el hueco. El alias se añadió después — pero vivía dentro de `create_card`,
    que necesita red, así que NADIE lo comprobaba. Un arreglo sin test es un
    arreglo que dura hasta el próximo refactor.

    Devuelve el primer valor con contenido. Antes la precedencia era por
    `is not None`, y eso dejaba que un `description=""` explícito tapara un
    `description_md` con texto de verdad: la misma tarjeta vacía, por otra
    puerta. Un campo vacío no gana a uno lleno.
    """
    for value in (description, description_md):
        if value is not None and str(value).strip():
            return str(value)
    return ""


def empty_brief_notice(brief):
    """`None` si la tarjeta lleva contenido; aviso si sale vacía.

    No es un error: una tarjeta solo-título es legítima a veces. Es que deje de
    PARECERSE a una que salió bien.

    El alias de arriba cierra los dos nombres que conocemos. No cierra el
    tercero: quien invente `brief`, `body` o `description_markdown` seguirá
    perdiendo el texto, y no hay lista de nombres que lo prevenga —enumerar
    nombres es el vicio, no el remedio. Así que esto no mira el NOMBRE que vino,
    mira el RESULTADO: la tarjeta salió sin contenido. Esa forma no caduca.
    """
    if brief and str(brief).strip():
        return None
    return (
        "brief vacío: la tarjeta se creó SIN contenido. Si esperabas texto, el "
        "nombre del parámetro no llegó — el brief va en `description_md` (o su "
        "alias `description`). Compruébalo en la UI: la respuesta de éxito no "
        "distingue una tarjeta con brief de una sin él, y por eso se avisa aquí."
    )


def workspace_mismatch_error(given, actual, column_id):
    """`None` si `given` es de verdad el espacio de `column_id`; error si no.

    Exigir el campo sin comprobarlo sería peor que no pedirlo: daría sensación
    de control sin control. Si el espacio real no se pudo derivar, tampoco se da
    por bueno — no se aprueba lo que no se ha podido leer.
    """
    g = (str(given).strip().lower() if given is not None else "")

    if not actual:
        return {
            "error": (
                f"No se pudo determinar a qué espacio pertenece la columna {column_id}, "
                f"así que no puedo confirmar que sea {given}. No clavo la tarjeta a ciegas.\n"
                "Comprueba el column_id con list_columns."
            )
        }

    if g == str(actual).strip().lower():
        return None

    return {
        "error": (
            f"Destino incoherente: dijiste workspace_id={given}, pero la columna "
            f"{column_id} pertenece al espacio {actual}. No clavo la tarjeta.\n"
            "O te equivocaste de columna, o de espacio: los dos IDs están arriba "
            "para que veas cuál.\n"
            "Regla: el espacio es el del dueño del artefacto que hay que tocar, y "
            "una tarea vive en un solo espacio, nunca espejada.\n"
            f"Regla completa (se pregunta, no se cita): {_MANUAL}"
        )
    }
