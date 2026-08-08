#!/usr/bin/env python3
"""Banco de pruebas del ENVOLTORIO del riel — `server.py`.

Tarjeta: «El envoltorio del riel corre sin banco de pruebas».

QUÉ CUBRÍA ESTO ANTES: nada. `validation.py` —la lógica pura— estaba sellada y
corría en CI; las 666 líneas que la rodean se verificaban ejecutándolas contra la
base, a mano. Y *lo que no corre en CI es decoración*, que es una frase de este
mismo repo escrita por otros guardianes suyos.

Ahí viven justo los fallos que se han pagado hoy: el acuse sin resolver, la
prioridad corregida en silencio, la ambigüedad que no falla, y el responsable que
se resolvía DESPUÉS de crear la tarjeta.

POR QUÉ NO HACÍA FALTA INSTALAR NADA, que era la razón por la que no existía.
`server.py` importa `httpx` y `mcp`, y CI corre con un `python3` pelado **a
propósito** — sin `pip install`. La salida no es aflojar eso: es **sustituir esos
dos módulos por dobles antes de importar**. `mcp.tool()` pasa a ser un decorador
que devuelve la función tal cual, así que las tools quedan invocables como
funciones normales, y `httpx` nunca se usa porque `_request` se sustituye entero.

Resultado: el envoltorio se prueba con `python3 test_server.py`, sin red y sin
dependencias.

QUÉ SE PRUEBA Y QUÉ NO. Solo comportamiento **correcto**. Los defectos conocidos
—la ventana entre crear y asignar, el `description_md` que `update_card` tira—
tienen su propia tarjeta y NO se fijan aquí: un test que afirma en verde un
defecto es una afirmación falsa con palomita, y este repo ya pagó una hoy.

La aserción que hace esto valer la pena, y no es el recuento: **cuando algo se
rechaza, no se ha tocado la red**. Eso no se puede ver mirando el valor devuelto
—un dict de error se parece mucho a otro— y es justo la diferencia entre «no se
creó nada» y «se creó a medias y me lo callé».
"""
from __future__ import annotations

import sys
import types
import unittest

# ── Dobles de las dependencias, ANTES de importar el envoltorio ───────────────
# `httpx` no llega a usarse: `_request` se sustituye en cada prueba. Está aquí
# solo para que el `import` no reviente.
_httpx = types.ModuleType("httpx")
_httpx.Client = object          # type: ignore[attr-defined]
_httpx.Response = object        # type: ignore[attr-defined]
sys.modules.setdefault("httpx", _httpx)

# `mcp.tool()` devuelve la función sin tocarla: las tools quedan llamables.
_mcp_pkg = types.ModuleType("mcp")
_mcp_server = types.ModuleType("mcp.server")
_mcp_fastmcp = types.ModuleType("mcp.server.fastmcp")


class _FakeFastMCP:
    def __init__(self, *_a, **_k):
        pass

    def tool(self, *_a, **_k):
        return lambda fn: fn

    def run(self, *_a, **_k):
        raise AssertionError("el banco de pruebas no arranca el servidor")


_mcp_fastmcp.FastMCP = _FakeFastMCP          # type: ignore[attr-defined]
_mcp_server.fastmcp = _mcp_fastmcp           # type: ignore[attr-defined]
_mcp_pkg.server = _mcp_server                # type: ignore[attr-defined]
sys.modules.setdefault("mcp", _mcp_pkg)
sys.modules.setdefault("mcp.server", _mcp_server)
sys.modules.setdefault("mcp.server.fastmcp", _mcp_fastmcp)

import server  # noqa: E402


class RielTestCase(unittest.TestCase):
    """Base: sustituye `_request` y APUNTA cada llamada que sale."""

    def setUp(self):
        self.calls: list[tuple[str, str, dict | None]] = []
        self._real_request = server._request
        self._real_pg_get = server._pg_get
        server._request = self._fake_request
        server._pg_get = self._fake_pg_get

    def tearDown(self):
        server._request = self._real_request
        server._pg_get = self._real_pg_get

    # El envoltorio sale a la red por DOS caminos, no uno: `_request` habla con la
    # API con JWT, y `_pg_get` va directo a PostgREST. Taparlos por separado no es
    # detalle del doble — lo descubrió este banco de pruebas al escribirse, y es
    # exactamente la clase de cosa que no se ve leyendo el fichero de arriba abajo.
    def _fake_pg_get(self, table, query):
        self.calls.append(("PG", f"{table}?{query}", None))
        if table == "columns":
            return [{"board_id": "board-1"}]
        if table == "boards":
            return [{"workspace_id": "ws-1"}]
        return []

    # Respuestas por defecto: un tablero, una columna, un espacio, un usuario.
    def _fake_request(self, method, path, json=None, **_kw):
        self.calls.append((method, path, json))
        if method == "GET" and path == "/admin/users":
            return [{"id": "user-rail", "email": "rail@aglaya.biz", "name": "Kanban Rail"}]
        if method == "GET" and path.startswith("/columns/") and path.endswith("/cards"):
            return []
        if method == "GET" and path.startswith("/boards/") and path.endswith("/cards"):
            return []
        if method == "GET" and path.startswith("/columns/"):
            return {"id": "col-1", "boardId": "board-1"}
        if method == "GET" and path.startswith("/boards/"):
            return {"id": "board-1", "workspaceId": "ws-1"}
        if method == "POST" and path == "/cards":
            return {"id": "card-1", "title": (json or {}).get("title"), "priority": (json or {}).get("priority")}
        return {}

    @property
    def writes(self):
        """Solo lo que MODIFICA. Un `GET` de más es ruido; un `POST` de más es daño."""
        return [c for c in self.calls if c[0] in ("POST", "PUT", "PATCH", "DELETE")]


class CrearTarjeta(RielTestCase):
    BASE = dict(column_id="col-1", title="Tarea", board_id="board-1",
                workspace_id="ws-1", priority="medium", assignee="rail@aglaya.biz")

    def _crear(self, **over):
        return server.create_card(**{**self.BASE, **over})

    def test_sin_prioridad_no_escribe_nada(self):
        out = self._crear(priority=None)
        self.assertIn("error", out)
        self.assertIn("priority", out["error"])
        self.assertEqual(self.writes, [], "rechazó, pero algo salió a la red")

    def test_sin_responsable_no_escribe_nada(self):
        out = self._crear(assignee=None)
        self.assertIn("error", out)
        self.assertIn("assignee", out["error"])
        self.assertEqual(self.writes, [])

    def test_sin_espacio_no_escribe_nada(self):
        out = self._crear(workspace_id=None)
        self.assertIn("error", out)
        self.assertEqual(self.writes, [])

    def test_espacio_que_no_es_el_de_la_columna_no_escribe_nada(self):
        out = self._crear(workspace_id="ws-OTRO")
        self.assertIn("error", out)
        self.assertEqual(self.writes, [])

    def test_responsable_que_no_resuelve_NO_deja_la_tarjeta_escrita(self):
        """La prueba que esta tarjeta existía para poder escribir.

        El responsable se resolvía DESPUÉS de crear: un `assignee` que no
        resolvía dejaba la tarjeta ya escrita y sin dueño — la tarjeta invisible
        fabricada por su propio guardián. Se arregló, y hasta ahora no había
        forma de comprobarlo sin la base delante.

        No basta con mirar el error devuelto: hay que mirar que **no salió
        ningún POST**.
        """
        out = self._crear(assignee="fulano@que-no-existe.biz")
        self.assertIn("error", out)
        self.assertIn("no resuelve", out["error"])
        self.assertEqual(
            [c for c in self.writes if c[1] == "/cards"], [],
            "se creó la tarjeta pese a que el responsable no resolvía",
        )

    def test_camino_bueno_manda_el_cuerpo_que_toca(self):
        out = self._crear(description_md="# Brief")
        self.assertEqual(out.get("created"), "card")
        post = next(c for c in self.calls if c[0] == "POST" and c[1] == "/cards")
        body = post[2]
        self.assertEqual(body["columnId"], "col-1")
        self.assertEqual(body["boardId"], "board-1")
        self.assertEqual(body["title"], "Tarea")
        self.assertEqual(body["priority"], "medium")
        self.assertEqual(body["description"], "# Brief")

    def test_una_comanda_vacia_lo_dice(self):
        out = self._crear(description_md="")
        self.assertIn("warning", out, "una tarjeta sin contenido debe dejar de parecerse a una que salió bien")


class Enrutado(RielTestCase):
    def test_si_dan_columna_pregunta_por_la_columna(self):
        server.list_cards(column_id="col-1")
        gets = [c[1] for c in self.calls if c[0] == "GET"]
        self.assertIn("/columns/col-1/cards", gets)
        self.assertNotIn("/boards/board-1/cards", gets)

    def test_si_dan_tablero_pregunta_por_el_tablero(self):
        server.list_cards(board_id="board-1")
        gets = [c[1] for c in self.calls if c[0] == "GET"]
        self.assertIn("/boards/board-1/cards", gets)

    def test_sin_ninguno_de_los_dos_da_error_y_no_pregunta(self):
        out = server.list_cards()
        self.assertIn("error", out)
        self.assertEqual(self.calls, [])


class CompuertasDestructivas(RielTestCase):
    """Las `delete_*` exigen `confirm=true`. Nunca lo había comprobado nadie.

    Lo que se fija no es el texto del aviso: es que **sin confirmar no sale una
    sola escritura**. Una compuerta que avisa y borra igual es peor que ninguna.
    """

    def test_delete_card(self):
        out = server.delete_card(card_id="card-1")
        self.assertTrue(out.get("requires_confirmation"))
        self.assertEqual(self.writes, [])

    def test_delete_board(self):
        out = server.delete_board(board_id="board-1")
        self.assertTrue(out.get("requires_confirmation"))
        self.assertEqual(self.writes, [])

    def test_delete_workspace(self):
        out = server.delete_workspace(workspace_id="ws-1")
        self.assertTrue(out.get("requires_confirmation"))
        self.assertEqual(self.writes, [])

    def test_clear_workspace(self):
        out = server.clear_workspace(workspace_id="ws-1")
        self.assertTrue(out.get("requires_confirmation"))
        self.assertEqual(self.writes, [])


class ActualizarTarjeta(RielTestCase):
    def test_prioridad_invalida_no_escribe(self):
        out = server.update_card(card_id="card-1", priority="altísima")
        self.assertIn("error", out)
        self.assertEqual(self.writes, [])

    def test_sin_ningun_campo_no_escribe(self):
        out = server.update_card(card_id="card-1")
        self.assertIn("error", out)
        self.assertEqual(self.writes, [])

    def test_prioridad_valida_si_escribe(self):
        server.update_card(card_id="card-1", priority="urgent")
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertEqual(len(puts), 1)
        self.assertEqual(puts[0][2]["priority"], "urgent")

    # El brief por su nombre DOCUMENTADO. Antes se descartaba en silencio: la
    # tool solo aceptaba el alias. Se mira lo que SALE A LA RED, no lo que
    # devuelve — un valor de retorno contento no dice si el texto viajó.
    def test_el_brief_llega_por_su_nombre_documentado(self):
        server.update_card(card_id="card-1", description_md="# Brief nuevo")
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertEqual(len(puts), 1)
        self.assertEqual(puts[0][2]["description"], "# Brief nuevo")

    def test_el_brief_llega_por_el_alias(self):
        server.update_card(card_id="card-1", description="por el alias")
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertEqual(puts[0][2]["description"], "por el alias")

    # LA prueba del caso que se pagó: con un `title` acompañando, el título se
    # actualizaba, el brief se tiraba, y la respuesta decía que todo fue bien.
    # Sin un `title` delante, el fallo era ruidoso —«nothing to update»— y por eso
    # se descubrió por suerte.
    def test_con_titulo_al_lado_el_brief_ya_NO_se_pierde(self):
        server.update_card(card_id="card-1", title="Otro título",
                           description_md="# Brief que antes se perdía")
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertEqual(len(puts), 1)
        self.assertEqual(puts[0][2]["title"], "Otro título")
        self.assertEqual(puts[0][2]["description"], "# Brief que antes se perdía")

    # Actualizar solo el título NO puede tocar la descripción. Si el resolutor
    # devolviera "" en vez de «no lo toques», cada retitulado borraría el brief —
    # el mismo daño que esta puerta ya hizo por otro camino.
    def test_actualizar_solo_el_titulo_no_manda_descripcion(self):
        server.update_card(card_id="card-1", title="Solo el título")
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertNotIn("description", puts[0][2])

    # Y vaciar sigue siendo posible: es una orden distinta de «no lo toques».
    def test_vaciar_la_descripcion_sigue_siendo_posible(self):
        server.update_card(card_id="card-1", description="")
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertEqual(puts[0][2]["description"], "")

    # ── El acuse de sobrescritura (tarjeta f19dda2d) ─────────────────────────
    #
    # El servidor rechaza con 409 una escritura que sustituya texto existente sin
    # acuse. Esta puerta es la del llamante CIEGO —el que arma la cadena en otro
    # sitio—, así que su valor por omisión tiene que ser el seguro. Se mira lo que
    # SALE A LA RED: que la bandera no viaje sola es la mitad de la protección.

    def test_por_defecto_NO_manda_el_acuse_de_sobrescritura(self):
        # Si esto se rompiera, el riel pasaría la compuerta siempre y sin que
        # nadie lo pidiera — la compuerta seguiría existiendo y no protegería.
        server.update_card(card_id="card-1", description_md="# Reescrito")
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertNotIn("replacesDescriptionOnPurpose", puts[0][2])

    def test_con_replacing_on_purpose_el_acuse_viaja(self):
        server.update_card(card_id="card-1", description_md="# Reescrito",
                           replacing_on_purpose=True)
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertIs(puts[0][2]["replacesDescriptionOnPurpose"], True)

    def test_el_acuse_no_se_manda_si_no_se_toca_la_descripcion(self):
        # Afirmar «sustituyo a propósito» en una llamada que no manda descripción
        # sería afirmar algo que no se está haciendo.
        server.update_card(card_id="card-1", priority="high",
                           replacing_on_purpose=True)
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertNotIn("description", puts[0][2])


if __name__ == "__main__":
    unittest.main(verbosity=2)
