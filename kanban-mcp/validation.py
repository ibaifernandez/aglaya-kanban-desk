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
