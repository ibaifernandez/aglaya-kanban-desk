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
    """Base: sustituye `_request` y APUNTA cada llamada que sale.

    ⚠️ Y SABE NO ENCONTRAR. Tarjeta `44bbb90b`.

    Este doble **siempre encontraba**: cualquier id de tarjeta o de columna
    devolvía un recurso. Consecuencia, que no es deuda de pruebas sino un verde
    que no muerde: **los caminos de «no existe» no se podían provocar**. Y en este
    fichero esos son justo los que deciden si una tarjeta se queda sin dueño, se
    asigna a quien no toca, o se pierde.

    Lo intentó el vigilante al revisar la PR del 403 y no pudo. Un caso del obrero
    sí lo ejercía, pero sustituyendo `_request` entero por su cuenta — o sea que la
    cobertura dependía de que cada quien se montara su propia sustitución, y
    cualquiera que escribiera un caso nuevo sobre este doble **creería haber
    probado un camino que no se ejerció**.

    Ahora `EXISTEN` declara qué hay, y **cualquier otro id devuelve `None`**, igual
    que la API real contesta 404. Pedir un recurso ausente es pasar un id que no
    esté en esa tabla: no hace falta ninguna costura nueva.
    """

    # Qué existe para el doble. Todo lo demás NO existe.
    #
    # Es una tabla y no un `if` por una razón: un caso que necesite otro recurso lo
    # añade aquí —o lo sobrescribe en su clase— y se ve de un vistazo qué mundo
    # está suponiendo. Con ids hilvanados en el cuerpo del doble, «qué existe» era
    # una pregunta que había que contestar leyendo código.
    EXISTEN = {
        "cards":   {"card-1"},
        "columns": {"col-1"},
        "boards":  {"board-1"},
    }

    def _existe(self, path):
        """¿Es este un GET de UN recurso suelto, y existe?

        Devuelve `True`/`False`, o `None` cuando la pregunta no aplica — que es el
        caso de las rutas de lista (`/columns/<id>/cards`) y de todo lo que no sea
        una colección declarada arriba. Distinguir «no aplica» de «no existe»
        importa: si no, la primera ruta de lista que alguien añada empezaría a
        devolver `None` y parecería un fallo del servidor.
        """
        partes = path.strip("/").split("/")
        if len(partes) != 2:
            return None
        coleccion, ident = partes
        conocidos = self.EXISTEN.get(coleccion)
        if conocidos is None:
            return None
        return ident in conocidos

    def setUp(self):
        self.calls: list[tuple[str, str, dict | None]] = []
        self._real_request = server._request
        server._request = self._fake_request

    def tearDown(self):
        server._request = self._real_request

    # UN SOLO CAMINO, y esto es el cambio de `34ff4d48`. Aquí había un segundo
    # doble, `_fake_pg_get`, porque el envoltorio salía a la red por dos sitios:
    # `_request` contra la API con JWT, y `_pg_get` directo a PostgREST con la
    # llave `service_role`. Esa segunda vía **se saltaba RLS entera**.
    #
    # Que el banco de pruebas necesitara dos dobles era el síntoma visible del
    # problema: dos caminos de salida son dos superficies que aislar. Ahora hay
    # uno, y por eso este doble basta. **Si alguien vuelve a añadir una vía
    # directa a la base, estas pruebas dejarán de taparla y saldrá a la red de
    # verdad** — que es mejor aviso que un comentario.

    # Respuestas por defecto: un tablero, una columna, un espacio, un usuario.
    def _fake_request(self, method, path, json=None, **_kw):
        self.calls.append((method, path, json))
        # Lo primero, y antes de cualquier respuesta: si piden UN recurso que no
        # está declarado en `EXISTEN`, no está. La API real contesta 404 y
        # `_request` devuelve `None`; esto es lo mismo sin red.
        if method == "GET" and self._existe(path) is False:
            return None
        if method == "GET" and path == "/admin/users":
            return [{"id": "user-rail", "email": "rail@aglaya.biz", "name": "Kanban Rail"}]
        # ⚠️ LA FORMA ES LA DE LA RUTA REAL, no la que le vendría bien al banco:
        # `workspace_members` anidando `user:users!user_id(id, name, email)`
        # (`server/routes/workspaces.js:401-405`). Un doble que devolviera
        # `{id, email}` plano dejaría pasar un `_resolve_user` que no sabe
        # desanidar, y el banco diría verde sobre algo que en producción no
        # resuelve a nadie. Desde `56c3a788` el riel resuelve por AQUÍ cuando
        # conoce el espacio, así que este doble es ahora el camino principal.
        if method == "GET" and path.startswith("/workspaces/") and path.endswith("/members"):
            return [{"role": "owner", "invited_at": None, "invited_by": None,
                     "user": {"id": "user-rail", "name": "Kanban Rail", "email": "rail@aglaya.biz"}}]
        if method == "GET" and path.startswith("/columns/") and path.endswith("/cards"):
            return []
        if method == "GET" and path.startswith("/boards/") and path.endswith("/cards"):
            return []
        # ⚠️ Devuelve `workspaceId` ADEMÁS del tablero, porque es lo que devuelve
        # la ruta de verdad desde `34ff4d48`: con eso, `create_card` resuelve las
        # dos preguntas en una llamada donde antes hacía dos lecturas con la llave
        # que saltaba RLS. Un doble que se quedara en `boardId` dejaría pasar un
        # servidor incapaz de comprobar el destino.
        if method == "GET" and path.startswith("/columns/"):
            return {"id": "col-1", "boardId": "board-1", "workspaceId": "ws-1"}
        if method == "GET" and path.startswith("/boards/"):
            return {"id": "board-1", "workspaceId": "ws-1"}
        # El checklist de UNA tarjeta. Antes lo leía `_pg_get` contra PostgREST;
        # ahora es `GET /api/cards/:id`, autenticado como todo lo demás.
        # ⚠️ TRAE `columnId`, porque la ruta real devuelve la tarjeta ENTERA
        # (`toCard`, `server/routes/cards.js:95`) y no solo el checklist. Desde
        # `56c3a788` eso no es adorno: `assign_card` deriva de ahí el espacio con
        # el que acota el responsable. Un doble que se quedara en
        # `{id, checklist}` dejaría pasar un servidor que en producción no puede
        # asignar a nadie — y además lo haría pareciendo un fallo del doble.
        if method == "GET" and path.startswith("/cards/"):
            return {"id": "card-1", "columnId": "col-1", "boardId": "board-1",
                    "checklist": [{"text": "primero", "done": False}]}
        if method == "POST" and path == "/cards":
            return {"id": "card-1", "title": (json or {}).get("title"), "priority": (json or {}).get("priority")}
        return {}

    @property
    def writes(self):
        """Solo lo que MODIFICA. Un `GET` de más es ruido; un `POST` de más es daño."""
        return [c for c in self.calls if c[0] in ("POST", "PUT", "PATCH", "DELETE")]


class LosDosNombresNoEscribenNada(RielTestCase):
    """Que el conflicto corte ANTES de la red, no después. Avería `6837c853`.

    `test_validation.py` fija que la función detecta el conflicto. Esto fija lo
    que de verdad importaba: que **la puerta no escriba**. Un error devuelto
    después de crear la tarjeta llegaría tarde — la tarjeta ya existiría, a
    medias, y el aviso solo serviría para explicar el destrozo.
    """

    BASE = dict(column_id="col-1", title="Tarea", workspace_id="ws-1",
                priority="medium", assignee="rail@aglaya.biz")

    def test_los_dos_con_texto_distinto_no_escribe_nada(self):
        out = server.create_card(**self.BASE,
                                 description="Un resumen corto.",
                                 description_md="## Cuerpo entero\n\nCon su criterio.")

        self.assertIn("error", out)
        self.assertEqual(self.writes, [], "rechazó, pero algo salió a la red")

    def test_y_tampoco_al_ACTUALIZAR(self):
        # La otra puerta. Aquí es peor: además de perder uno de los dos, pisa lo
        # que la tarjeta ya tenía.
        out = server.update_card("card-1",
                                 description="Un resumen corto.",
                                 description_md="## Cuerpo entero\n\nCon su criterio.")

        self.assertIn("error", out)
        self.assertEqual(self.writes, [], "rechazó, pero algo salió a la red")

    def test_la_contraprueba_con_uno_solo_SI_escribe(self):
        # Sin esto, «rechazar siempre» pasaría los dos casos de arriba y habría
        # roto la tool entera sin que nada se pusiera rojo.
        out = server.create_card(**self.BASE, description_md="## Cuerpo\n\nSolo uno.")

        self.assertNotIn("error", out)
        self.assertEqual(len(self.writes), 1, "debería haber escrito la tarjeta")


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

    # ── La ventana entre crear y asignar ──────────────────────────────────────
    # Crear era DOS escrituras: `POST /cards` sin responsable y luego
    # `PUT /cards/<id>` con él, cuyo retorno se descartaba. Si el segundo fallaba
    # —red, 500, lo que fuera— la tarjeta YA existía sin dueño y el llamante
    # recibía una excepción que no decía que ya existía: una fila que ningún
    # proceso mira y que nadie sabe que está ahí.
    #
    # No se cierra comprobando el `PUT`: se cierra quitándolo. Estas dos pruebas
    # se ponen rojas si alguien vuelve a partir la escritura en dos.

    def test_crear_es_UNA_sola_escritura(self):
        self._crear()
        self.assertEqual(
            [(c[0], c[1]) for c in self.writes], [("POST", "/cards")],
            "crear tiene que ser una sola escritura: dos abren la ventana otra vez",
        )

    def test_el_responsable_viaja_DENTRO_del_POST(self):
        self._crear()
        post = next(c for c in self.calls if c[0] == "POST" and c[1] == "/cards")
        self.assertEqual(post[2]["assigneeId"], "user-rail")

    def test_si_una_segunda_escritura_fallara_no_habria_a_quien_culpar(self):
        """La condición de cierre de la tarjeta, ejercida.

        Se hace estallar CUALQUIER escritura que no sea el `POST /cards`. Con la
        versión anterior esto reventaba dejando la tarjeta escrita y sin dueño;
        ahora no hay segunda escritura que estalle, así que la llamada termina
        bien y el acuse trae el responsable.

        Ejerce el modo de fallo que nadie había podido provocar contra el riel
        vivo — aquí sí se puede, porque la red es un doble.
        """
        real = self._fake_request

        def solo_una_escritura(method, path, json=None, **kw):
            if method in ("PUT", "PATCH", "DELETE") or (method == "POST" and path != "/cards"):
                raise RuntimeError(f"{method} {path} → 500: boom")
            return real(method, path, json, **kw)

        server._request = solo_una_escritura
        try:
            out = self._crear()
        finally:
            server._request = real

        self.assertEqual(out.get("created"), "card")
        self.assertEqual(out.get("assignee_id"), "user-rail")


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


class AnadirALaDescripcion(RielTestCase):
    """Añadir sin reenviar (tarjeta `dccc9de0`).

    Se mira lo que SALE A LA RED, no lo que devuelve la tool: el valor de retorno
    puede decir «appended» mientras el cuerpo lleva otra cosa.
    """

    def test_manda_solo_el_texto_nuevo(self):
        # LO QUE ESTA PRUEBA DEFIENDE, y es el punto entero de la tarjeta: el
        # llamante NO transmite lo que ya estaba. Si algún día esta tool
        # compusiera el texto ella misma, volvería a necesitar leerlo antes — y
        # con ello vuelve el reenvío y vuelve el riesgo de pisarlo.
        server.append_to_description(card_id="card-1", text="Un párrafo nuevo.")
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertEqual(len(puts), 1)
        self.assertEqual(puts[0][2]["appendDescription"], "Un párrafo nuevo.")
        self.assertNotIn("description", puts[0][2])

    def test_NO_se_auto_concede_el_acuse_de_sobrescritura(self):
        # Añadir supera la compuerta del 409 por construcción —el texto compuesto
        # empieza por el anterior—, así que no necesita la bandera. Mandarla
        # «para asegurar» sería abrirle un atajo: el día en que la composición se
        # rompiera, la compuerta callaría en vez de avisar, y el fallo pasaría de
        # ruidoso a silencioso.
        server.append_to_description(card_id="card-1", text="Un párrafo nuevo.")
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertNotIn("replacesDescriptionOnPurpose", puts[0][2])

    def test_texto_vacio_no_escribe_nada(self):
        # Un no-op silencioso dejaría al llamante creyendo que apuntó algo.
        out = server.append_to_description(card_id="card-1", text="   ")
        self.assertIn("error", out)
        self.assertEqual(self.writes, [])

    def test_texto_que_no_es_texto_no_escribe_nada(self):
        out = server.append_to_description(card_id="card-1", text=None)
        self.assertIn("error", out)
        self.assertEqual(self.writes, [])


class MiembrosSinCorreo(RielTestCase):
    """Tarjeta `ed8910e2`. Todo lo que devuelve el riel pasa por el modelo.

    El correo de una persona no hace falta para nada de lo que el riel hace
    —`assignee` acepta el `user_id`, que esta misma herramienta devuelve—, así
    que se deja de mandar. Lo que se fija aquí no es que el campo no exista, sino
    que **la dirección no salga por ninguna parte**: devolverla dentro de `name`,
    o en una clave nueva, sería el mismo dato con otro nombre.
    """

    # El apunte va dentro de la rama: hacerlo arriba y delegar al padre duplica
    # cada llamada en `self.calls`. Aquí no se cuenta nada, así que no mentía —
    # pero la primera aserción sobre un recuento que alguien añadiera encima
    # mediría el doble y pasaría por casualidad.
    def _fake_request(self, method, path, json=None, **_kw):
        if method == "GET" and path.endswith("/members"):
            self.calls.append((method, path, json))
            return [
                {"role": "owner",  "user": {"id": "u-1", "name": "Alguien", "email": "alguien@aglaya.biz"}},
                {"role": "member", "user": {"id": "u-2", "name": "Otra",    "email": "otra@aglaya.biz"}},
            ]
        return super()._fake_request(method, path, json, **_kw)

    def test_devuelve_id_nombre_y_papel(self):
        out = server.list_members(workspace_id="ws-1")
        self.assertEqual(out["count"], 2)
        self.assertEqual(
            sorted(out["members"][0].keys()),
            ["name", "role", "user_id"],
        )
        self.assertEqual(out["members"][0]["user_id"], "u-1")
        self.assertEqual(out["members"][0]["role"], "owner")

    def test_ninguna_direccion_sale_por_ninguna_parte(self):
        out = server.list_members(workspace_id="ws-1")
        self.assertNotIn("@", repr(out))


class UnaCuentaAisladaClavaPorCorreo(RielTestCase):
    """Tarjeta `56c3a788`. El riel resuelve el responsable por los MIEMBROS del
    espacio de destino, no por `/admin/users`.

    QUÉ SE MIDE AQUÍ Y POR QUÉ NO BASTA CON QUE FUNCIONE. El fallo no era que la
    resolución estuviera mal escrita: era que preguntaba por una puerta que solo
    abre a `admin`/`superadmin` (`server/routes/admin.js:23`). Una cuenta
    `colaborador` recibía 403 y no podía clavar trabajo por el camino que la
    propia firma de la tool documenta.

    Y la cuenta que lo recibía **no puede subir de rol**: hacerla `superadmin` le
    daría GOD MODE y borraría su aislamiento. Así que «darle permisos» no era una
    salida — era el daño.

    EL DOBLE HACE QUE `/admin/users` REVIENTE A PROPÓSITO. Eso es lo que convierte
    esto en una prueba y no en una demostración: si alguien devuelve la resolución
    a la ruta de admin, estos casos se ponen rojos con el 403 de verdad, no con un
    valor distinto.
    """

    BASE = dict(column_id="col-1", title="Tarea", board_id="board-1",
                workspace_id="ws-1", priority="medium", description_md="cuerpo")

    # ⚠️ IDS CON FORMA DE UUID, y no es decoración: `_resolve_user` devuelve tal
    # cual lo que casa con `_UUID_RE`, así que un id de juguete como `u-mon`
    # recorrería un camino que en producción no se recorre. `list_members`
    # devuelve UUIDs de verdad.
    MON  = "11111111-1111-4111-8111-111111111111"
    IBAI = "22222222-2222-4222-8222-222222222222"

    MIEMBROS = [
        {"role": "owner",  "user": {"id": MON,  "name": "Mon",  "email": "mon@example.com"}},
        {"role": "member", "user": {"id": IBAI, "name": "Ibai", "email": "ibai@example.com"}},
    ]

    # ⚠️ EL APUNTE VA DENTRO DE CADA RAMA, NO ARRIBA. Apuntar aquí y delegar
    # luego al padre —que apunta también— duplica cada llamada, y entonces
    # cualquier aserción sobre CUÁNTAS escrituras hubo mide el doble y pasa por
    # casualidad. Me pasó al escribir esto: `assertEqual(len(posts), 1)` dio 2
    # con un solo `POST` de verdad. El patrón venía de `MiembrosSinCorreo`, que
    # no cuenta nada y por eso nunca lo acusó.
    def _fake_request(self, method, path, json=None, **_kw):
        if method == "GET" and path == "/admin/users":
            self.calls.append((method, path, json))
            raise RuntimeError("GET /admin/users → 403: Sin permisos para esta acción")
        if method == "GET" and path.startswith("/workspaces/") and path.endswith("/members"):
            self.calls.append((method, path, json))
            return self.MIEMBROS
        return super()._fake_request(method, path, json, **_kw)

    # ── Condición 1 ──────────────────────────────────────────────────────────
    def test_un_colaborador_clava_por_correo_de_un_miembro(self):
        out = server.create_card(**self.BASE, assignee="mon@example.com")

        self.assertNotIn("error", out)
        self.assertEqual(out["assignee_id"], self.MON)
        # Y la tarjeta nace asignada EN LA MISMA ESCRITURA. Si el responsable
        # llegara en un `PUT` posterior volvería la ventana de `34ff4d48`.
        posts = [c for c in self.writes if c[0] == "POST"]
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0][2].get("assigneeId"), self.MON)

    def test_y_no_pregunta_por_la_puerta_de_admin(self):
        """La condición 1 podría pasar con una caída silenciosa tras el 403.

        Esto fija el MECANISMO: conociendo el espacio, la ruta de admin no se
        toca. Sin este caso, una implementación que intentara admin, se comiera
        la excepción y cayera a miembros pasaría igual — y cobraría un 403 por
        cada asignación de media casa, dependiendo de un fallo para elegir
        camino.
        """
        server.create_card(**self.BASE, assignee="mon@example.com")
        self.assertNotIn("/admin/users", [p for _, p, _ in self.calls])

    # ── Condición 2 — va JUNTA con la 1 ──────────────────────────────────────
    def test_contraprueba_un_no_miembro_falla_y_no_escribe_nada(self):
        """Si la 1 pasa y esto no, lo construido no es una corrección: es una
        fuga de alcance. Solo se puede asignar a quien verá la tarjeta — un
        responsable que no es miembro nace sin poder verla, que es la tarjeta
        invisible que `assignee` existe para impedir.
        """
        out = server.create_card(**self.BASE, assignee="extrano@example.com")

        self.assertIn("error", out)
        self.assertIn("No se ha creado nada", out["error"])
        self.assertEqual(self.writes, [])

    # ── Condición 3 — contra la salida real, no contra el código ─────────────
    def test_ninguna_respuesta_devuelve_la_direccion(self):
        """Medido antes de arreglarlo: `create_card` devolvía
        `assigned: 'mon@example.com'` y `assign_card` devolvía `notified` con el
        correo. `ed8910e2` lo quitó de `list_members` el 25-sep-2026 y dejó estos
        dos ecos vivos — peor que una fuga nueva, porque el documento ya decía
        que estaba cerrado.

        Se comprueba sobre el `repr` entero a propósito: así no hay clave nueva
        donde esconderlo.
        """
        creada = server.create_card(**self.BASE, assignee="mon@example.com")
        self.assertNotIn("@", repr(creada))

        # `assign_card` se ejerce aquí con UUID porque en ESTA clase los miembros
        # son otros —`/admin/users` revienta a propósito y la lista es la de la
        # tarjeta de destino—. El correo en `assign_card` lo cubre
        # `AsignarTambienVaPorMIEMBROS`, que es donde vive esa tool.
        asignada = server.assign_card("card-1", self.MON)
        self.assertNotIn("@", repr(asignada))

    def test_y_tampoco_el_error_repite_lo_que_le_pasaron(self):
        """El camino que más fácil se escapa: un fallo es una respuesta de tool
        como otra cualquiera, y el que había echaba de vuelta el `user` recibido.
        """
        out = server.create_card(**self.BASE, assignee="extrano@example.com")
        self.assertNotIn("@", repr(out))


class AsignarTambienVaPorMIEMBROS(RielTestCase):
    """`assign_card`, `assign_checklist_item` y `remove_member` — las otras tres
    llamadas de `_resolve_user`. Alcance concedido por el delineante el
    11-nov-2026 dentro de `56c3a788`.

    POR QUÉ ENTRAN EN LA MISMA TARJETA Y NO EN OTRA. Arreglar solo `create_card`
    dejaba `/admin/users` vivo en el riel, y el hallazgo era precisamente que esa
    puerta solo abre a admins: una cuenta `colaborador` seguiría sin poder asignar
    por tres de los cuatro caminos. Y dos resoluciones distintas en el mismo
    fichero es lo que alguien unifica dentro de seis meses eligiendo la mala.

    ESTA CLASE YA NO NECESITA QUE `/admin/users` CONTESTE, y eso es el cambio:
    antes hizo falta una clase aparte para poder pasarle un correro a `assign_card`
    —porque donde la ruta de admin revienta solo se la podía ejercer con UUID, y
    un id no lleva arroba, así que el mutante del eco **sobrevivía**—. Ahora
    resuelve por miembros como las demás y el correo se puede pasar derecho.
    """

    # La ruta de admin ya no se usa: si alguien la devuelve, revienta aquí.
    def _fake_request(self, method, path, json=None, **_kw):
        if method == "GET" and path == "/admin/users":
            self.calls.append((method, path, json))
            raise RuntimeError("GET /admin/users → 403: Sin permisos para esta acción")
        return super()._fake_request(method, path, json, **_kw)

    def test_assign_card_resuelve_el_correo_de_un_miembro(self):
        out = server.assign_card("card-1", "rail@aglaya.biz")

        self.assertEqual(out["assignee_id"], "user-rail")
        self.assertNotIn("/admin/users", [p for _, p, _ in self.calls])
        # El eco, fijado por la vía normal y no por una clase de apoyo.
        self.assertNotIn("@", repr(out))

    def test_assign_card_deriva_el_espacio_de_la_tarjeta(self):
        """El mecanismo, y su coste, dichos por una prueba.

        Son DOS peticiones más que antes: la tarjeta y su columna. `create_card`
        no las paga porque ya trae la columna en la mano. Se fija el número para
        que, si alguien mete una tercera lectura, se vea aquí y no en la factura.
        """
        server.assign_card("card-1", "rail@aglaya.biz")

        gets = [p for m, p, _ in self.calls if m == "GET"]
        self.assertEqual(gets, ["/cards/card-1", "/columns/col-1",
                                "/workspaces/ws-1/members"])

    def test_un_no_miembro_no_puede_quedarse_con_la_tarjeta(self):
        with self.assertRaises(RuntimeError) as cm:
            server.assign_card("card-1", "extrano@example.com")

        self.assertIn("not a member", str(cm.exception))
        self.assertEqual(self.writes, [])
        # Tampoco el fallo repite la dirección recibida.
        self.assertNotIn("@", str(cm.exception))

    def test_y_cambia_QUE_ERROR_SALE_PRIMERO(self):
        """Antes un responsable que no resolvía fallaba aunque la tarjeta no
        existiera. Ahora la tarjeta se lee primero, porque sin ella no hay espacio
        con el que acotar.

        Se fija a propósito: es un cambio de comportamiento observable, y el orden
        nuevo es además el correcto — resolver un responsable para una tarjeta que
        no existe es trabajo sobre nada.
        """
        def sin_tarjeta(method, path, json=None, **_kw):
            self.calls.append((method, path, json))
            if method == "GET" and path.startswith("/cards/"):
                return None
            raise AssertionError("no se debe preguntar nada más si la tarjeta no está")

        server._request = sin_tarjeta
        out = server.assign_card("card-fantasma", "extrano@example.com")

        self.assertIn("not found", out["error"])
        self.assertEqual(self.writes, [])

    def test_el_todos_del_checklist_sigue_significando_lo_mismo(self):
        """`"all"` no pasa por la resolución, así que acotar no lo toca — pero eso
        hay que medirlo, no deducirlo. Lo pidió el delineante y tiene razón: el
        riesgo no era que dejara de funcionar, era que nadie supiera si «todos»
        seguía queriendo decir todos.
        """
        out = server.assign_checklist_item("card-1", "primero", "all")

        self.assertNotIn("error", out)
        # Ni pregunta por miembros ni por admin: el servidor lo expande.
        self.assertNotIn("/workspaces/ws-1/members", [p for _, p, _ in self.calls])
        self.assertNotIn("/admin/users", [p for _, p, _ in self.calls])
        puts = [c for c in self.writes if c[0] == "PUT"]
        self.assertEqual(len(puts), 1)
        self.assertIn("__all__", str(puts[0][2]))

    def test_el_checklist_tampoco_devuelve_la_direccion(self):
        """EL TERCER ECO. Lo cazó el vigilante devolviendo la PR, y tenía razón en
        lo que más dolía: **no había ningún caso que lo sujetara**. Quitarlo dejaba
        el banco en 43/43, o sea que mis dos casos del eco mordían donde los puse
        y este sitio no tenía nada.

        Y es el peor de los tres por un motivo que conviene dejar escrito:
        `assign_checklist_item` promete en su propio docstring que `user` puede ser
        un correo. No era un eco accidental de un parámetro genérico — era el eco
        de un campo documentado como dirección.
        """
        out = server.assign_checklist_item("card-1", "primero", "rail@aglaya.biz")

        self.assertNotIn("error", out)
        self.assertEqual(out["assignee_id"], "user-rail")
        self.assertNotIn("@", repr(out))

    def test_y_en_el_camino_todos_devuelve_el_token_del_protocolo(self):
        """Qué se devuelve con `"all"` lo decidí yo, y el vigilante tenía razón en
        que `"__all__"` a secas no es evidente. Lo devuelvo igual, y por esto:

        es el token que viaja en el `PUT` de verdad, así que quien llama puede
        compararlo sin adivinar. Inventar una etiqueta más legible añade una
        superficie que habría que mantener en dos sitios diciendo lo mismo, y la
        primera vez que divergieran mentiría una de las dos.

        Lo que NO vale, y es lo que se fija aquí, es que salga el texto recibido.
        """
        out = server.assign_checklist_item("card-1", "primero", "todos")

        self.assertEqual(out["notified"], "__all__")
        self.assertEqual(out["assignee_id"], "__all__")

    def test_remove_member_no_paga_ninguna_lectura_extra(self):
        """Aquí el espacio venía ya dado, así que acotar es gratis. Y el alcance
        es el único que tiene sentido: a quien se va a quitar de un espacio es,
        por definición, miembro de ese espacio.
        """
        out = server.remove_member(workspace_id="ws-1", user="rail@aglaya.biz", confirm=True)

        self.assertEqual(out["user_id"], "user-rail")
        gets = [p for m, p, _ in self.calls if m == "GET"]
        self.assertEqual(gets, ["/workspaces/ws-1/members"])

    def test_sin_espacio_NO_se_cae_a_la_ruta_de_admin(self):
        """La quinta condición, la que añadió el delineante, por dentro.

        `grep` dice que no queda ninguna llamada viva; esto dice qué pasa si
        alguien llama a la resolución sin espacio: **falla**. Un default `None`
        que nadie omite no es compatibilidad, es la puerta por la que esto vuelve
        en verde el día que se añada una tool con prisa.
        """
        with self.assertRaises(RuntimeError) as cm:
            server._resolve_user("rail@aglaya.biz", "")

        self.assertIn("without a workspace", str(cm.exception))
        self.assertEqual(self.calls, [])

    def test_omitir_el_espacio_falla_EN_LA_LLAMADA(self):
        """Este caso existe porque un mutante sobrevivió, y cambió de forma tras
        una corrección del vigilante que era mejor que mi versión.

        Devolverle el default —`workspace_id: str = ""`— dejaba los 49 casos de
        entonces en **verde**: las dos versiones **fallan cerradas**, así que no
        hay fuga que ningún caso de comportamiento pueda distinguir. Lo único
        que cambia es DÓNDE aparece el rechazo.

        Mi primera versión aseveraba sobre `inspect.signature`. Funcionaba, pero
        medía la firma en vez de lo que la firma produce. **Esto llama con un
        solo argumento y exige `TypeError`**: muere igual si el default vuelve, y
        no afirma nada sobre el texto de una declaración.

        Lo que protege —que sin espacio no se resuelva nada— tiene su propio caso
        justo encima. Esto solo fija que el rechazo llegue **antes de entrar**, que
        es lo que impide que un quinto llamante escrito con prisa descubra el
        problema en producción en vez de en su primera llamada.
        """
        with self.assertRaises(TypeError):
            server._resolve_user("rail@aglaya.biz")


class LoQueNoEXISTEDaNada(RielTestCase):
    """Los caminos de «no existe», ejercidos con el DOBLE BASE. Tarjeta `44bbb90b`.

    LO QUE HACE QUE ESTO CUENTE: ninguno de estos casos sustituye `_request`. Se
    limitan a pasar un id que no está en `EXISTEN`, igual que haría cualquiera que
    escriba un caso nuevo. Antes de `44bbb90b` esto era imposible — el doble
    devolvía un recurso para cualquier id — y por eso estos tres cortes vivían sin
    nada que los sujetara.

    No cubren lo mismo y conviene no confundirlos: dos cortan devolviendo un dict
    de error y el tercero **revienta**. Se fija lo que cada uno hace de verdad, no
    lo que sería más bonito.
    """

    def test_el_checklist_corta_si_la_tarjeta_no_esta(self):
        """El caso exacto que el vigilante no pudo provocar al revisar #141."""
        out = server.assign_checklist_item("card-NO", "primero", "rail@aglaya.biz")

        self.assertEqual(out["error"], "card card-NO not found")
        self.assertEqual(self.writes, [])
        # Y corta ANTES de resolver al responsable: una sola lectura y para. Si
        # resolviera primero, estaría preguntando por los miembros de un espacio
        # que no sabe cuál es.
        self.assertEqual([(m, p) for m, p, _ in self.calls], [("GET", "/cards/card-NO")])

    def test_assign_card_corta_si_la_tarjeta_no_esta(self):
        out = server.assign_card("card-NO", "rail@aglaya.biz")

        self.assertEqual(out["error"], "card card-NO not found")
        self.assertEqual(self.writes, [])

    def test_una_columna_que_no_esta_REVIENTA_y_no_escribe(self):
        """⚠️ ESTE NO DEVUELVE UN ERROR: LANZA. Y se fija así a propósito.

        `_column_info` levanta `RuntimeError` cuando la columna no está, y
        `create_card` no lo captura. Escribir aquí un `assertIn("error", out)`
        —que es lo que yo esperaba antes de medirlo— habría sido una afirmación
        falsa con palomita.

        Lo que importa de verdad está en la segunda aserción: **no se escribe
        nada**. Una excepción es ruidosa y se arregla; una tarjeta a medias, no.
        """
        with self.assertRaises(RuntimeError) as cm:
            server.create_card(column_id="col-NO", title="T", workspace_id="ws-1",
                               priority="medium", assignee="rail@aglaya.biz",
                               description_md="cuerpo")

        self.assertIn("col-NO not found", str(cm.exception))
        self.assertEqual(self.writes, [])

    def test_una_coleccion_que_no_esta_declarada_SIGUE_contestando(self):
        """La segunda rama de `_existe`, que nació sin nada que la sujetara.

        Lo cazó el vigilante: mutar «colección no declarada → no existe» dejaba
        los 56 casos en **verde**. Mi propio argumento lo condenaba — escribí que
        sin la distinción «la primera ruta de lista que alguien añada parecería un
        fallo del servidor», y eso vale igual para la primera **colección** que
        alguien pida y no esté en `EXISTEN`. Hoy solo hay tres, y `server.py` ya
        toca `workspaces`.

        ⚠️ **ESTE CASO EJERCE EL DOBLE DIRECTAMENTE, y es deliberado.** Ninguna
        tool pide hoy un recurso suelto de una colección no declarada —medido:
        todas las de `workspaces` son rutas de lista—, así que no hay tool por la
        que entrar. El doble ES la unidad que esta tarjeta sella; pasar por una
        tool que no existe sería inventarse el llamante para no mirar al objeto.

        Y aquí sellar **no cierra ninguna puerta**, al revés que en `e937f22f`:
        allí un caso habría convertido un hueco aceptado en requisito. Esto no es
        un hueco — la conducta correcta es «no declarada = no opino», y afirmarla
        no impide ninguna mejora futura.
        """
        self.assertIsNone(self._existe("/workspaces/ws-1"))

        # Y lo que importa: el doble NO lo trata como ausente.
        self.assertIsNotNone(server._request("GET", "/workspaces/ws-1"))

    def test_y_una_ruta_de_LISTA_sigue_contestando(self):
        """La contraprueba del mecanismo, y la que lo salva de ser un estorbo.

        `_existe` distingue «no aplica» de «no existe» justamente para esto: si
        tratara `/columns/col-1/cards` como un recurso suelto, devolvería `None` y
        la primera ruta de lista que alguien añadiera parecería un fallo del
        servidor. Sin este caso, ese defecto esperaría al siguiente que escriba una
        lista.
        """
        out = server.list_cards(column_id="col-1")

        self.assertNotIn("error", out)
        self.assertIn(("GET", "/columns/col-1/cards"), [(m, p) for m, p, _ in self.calls])


if __name__ == "__main__":
    unittest.main(verbosity=2)
