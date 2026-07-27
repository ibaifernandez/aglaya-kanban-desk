"""Tests de la validación de destino del riel.

Solo biblioteca estándar: `validation.py` no importa nada de terceros a
propósito, para que estos tests corran en CI sin instalar dependencias.

Qué fijan (petición del orquestador, 2026-07-22):
  · `create_card` debe EXIGIR el espacio de destino…
  · …y VALIDARLO contra la columna donde va la card (decisión de Ibai).

Exigirlo sin validarlo sería peor que no pedirlo: daría sensación de control
sin control. Es la misma forma que el default de `workspaceName` que mandaba
cards al espacio personal devolviendo 201.

Y desde 2026-07-27, el CONTENIDO de la tarjeta:
  · el brief llega por el nombre que llegue (`description` o `description_md`)…
  · …y si aun así sale vacía, la respuesta lo dice.

Por qué importa tanto como el destino: la nave existe para que Ibai vea sus
pendientes sin escribirlos. Una tarjeta que llega al sitio correcto y vacía
aparece en el panel, o sea que «no se perdió nada» — pero quien la abra dentro
de un mes no sabrá de qué iba. Está ahí y no sirve. El daño de esta nave no es
un error: es trabajo invisible.

Uso:  python3 kanban-mcp/test_validation.py
"""
import unittest

from validation import (empty_brief_notice, missing_workspace_error, resolve_brief,
                        workspace_mismatch_error)

WS_A = "f93867a7-8cfa-40e1-883a-55eb62776253"
WS_B = "0db84606-a209-4b66-aa79-56a263736176"
COL  = "9535f5bd-13f4-4285-959a-cc52ab685d5f"


class MissingWorkspace(unittest.TestCase):
    def test_none_es_error(self):
        self.assertIsNotNone(missing_workspace_error(None))

    def test_vacio_es_error(self):
        self.assertIsNotNone(missing_workspace_error(""))

    def test_solo_espacios_es_error(self):
        self.assertIsNotNone(missing_workspace_error("   "))

    def test_valor_valido_no_es_error(self):
        self.assertIsNone(missing_workspace_error(WS_A))

    def test_el_error_nombra_el_campo(self):
        self.assertIn("workspace_id", missing_workspace_error(None)["error"])

    def test_el_error_apunta_a_la_puerta_no_a_una_ruta(self):
        # El manual es el custodio de a qué espacio va cada cosa. Aquí va el
        # puntero, no una copia: una copia se desincroniza.
        #
        # Y el puntero es la PUERTA, no la ruta. Antes este test fijaba el nombre
        # del fichero del atlas: cerraba la mitad floja del problema —que no se
        # copiara el manual— dejando abierta la que de verdad rompe, que es que
        # el capitán mueva el fichero. Un error que nombra una ruta muerta manda
        # a la nada y encima suena autorizado. Se fija la pregunta, que no caduca.
        msg = missing_workspace_error(None)["error"]
        self.assertIn("donde_pregunto", msg)
        self.assertIn("aglaya-atlas", msg)
        self.assertNotIn(".md", msg)

    def test_el_error_dice_como_averiguar_el_valor(self):
        self.assertIn("list_workspaces", missing_workspace_error(None)["error"])


class WorkspaceMismatch(unittest.TestCase):
    def test_coincide_no_es_error(self):
        self.assertIsNone(workspace_mismatch_error(WS_A, WS_A, COL))

    def test_no_coincide_es_error(self):
        self.assertIsNotNone(workspace_mismatch_error(WS_A, WS_B, COL))

    def test_tolera_espacios_alrededor(self):
        self.assertIsNone(workspace_mismatch_error(f"  {WS_A}  ", WS_A, COL))

    def test_uuid_es_insensible_a_mayusculas(self):
        self.assertIsNone(workspace_mismatch_error(WS_A.upper(), WS_A, COL))

    def test_el_error_muestra_AMBOS_ids(self):
        # Sin los dos, quien lo lea no sabe si se equivocó de columna o de espacio.
        msg = workspace_mismatch_error(WS_A, WS_B, COL)["error"]
        self.assertIn(WS_A, msg)
        self.assertIn(WS_B, msg)

    def test_el_error_nombra_la_columna(self):
        self.assertIn(COL, workspace_mismatch_error(WS_A, WS_B, COL)["error"])

    def test_no_traga_un_workspace_desconocido(self):
        # Si no se pudo derivar el espacio real, NO se da por bueno.
        self.assertIsNotNone(workspace_mismatch_error(WS_A, None, COL))


BRIEF = "Contexto: los leads captados se enfrían sin secuencia."


class ResolveBrief(unittest.TestCase):
    """El texto llega por el nombre que llegue. Cuatro cards vacías lo enseñaron."""

    def test_el_nombre_documentado_funciona(self):
        self.assertEqual(resolve_brief(None, BRIEF), BRIEF)

    def test_el_alias_del_endpoint_HTTP_funciona(self):
        # `description` es como se llama en POST /api/internal/create-card.
        # Quien venga de esa puerta pasará ese nombre, y no puede perder el texto.
        self.assertEqual(resolve_brief(BRIEF, ""), BRIEF)

    def test_sin_ninguno_de_los_dos_sale_vacio(self):
        self.assertEqual(resolve_brief(None, ""), "")

    def test_un_campo_vacio_NO_tapa_al_que_tiene_texto(self):
        # La precedencia anterior era por `is not None`, así que un
        # `description=""` explícito ganaba a un `description_md` con contenido:
        # la misma tarjeta vacía, entrando por otra puerta.
        self.assertEqual(resolve_brief("", BRIEF), BRIEF)
        self.assertEqual(resolve_brief("   ", BRIEF), BRIEF)

    def test_si_los_dos_traen_texto_gana_el_alias_explicito(self):
        self.assertEqual(resolve_brief("del alias", "del documentado"), "del alias")

    def test_conserva_el_texto_tal_cual(self):
        # Markdown incluido: el brief se guarda, no se normaliza.
        md = "## Contexto\n\n- uno\n- dos\n"
        self.assertEqual(resolve_brief(None, md), md)


class EmptyBriefNotice(unittest.TestCase):
    """Que un 201 con la tarjeta vacía deje de parecerse a un 201 bueno."""

    def test_con_contenido_no_avisa(self):
        self.assertIsNone(empty_brief_notice(BRIEF))

    def test_vacio_avisa(self):
        self.assertIsNotNone(empty_brief_notice(""))

    def test_solo_espacios_avisa(self):
        # Un brief de espacios en blanco es tan inútil como uno vacío.
        self.assertIsNotNone(empty_brief_notice("   \n  "))

    def test_el_aviso_dice_como_arreglarlo(self):
        # Quien lo lea viene de pasar el nombre equivocado. Nombrar el campo
        # bueno es la diferencia entre un aviso y un reproche.
        msg = empty_brief_notice("")
        self.assertIn("description_md", msg)

    def test_el_aviso_manda_comprobar_en_la_UI(self):
        # La lección que no caduca de las cuatro cards: la respuesta de éxito no
        # distingue una card con brief de una sin él. Se verifica en la UI.
        self.assertIn("UI", empty_brief_notice(""))

    def test_no_mira_el_nombre_del_parametro_sino_el_resultado(self):
        # No hay lista de nombres que prevenga el tercero que alguien invente
        # (`brief`, `body`, `description_markdown`…). Enumerar nombres es el
        # vicio, no el remedio. Lo que se vigila es que la card salió vacía.
        inventado = resolve_brief(None, "")   # el kwarg raro ni llegó
        self.assertIsNotNone(empty_brief_notice(inventado))


if __name__ == "__main__":
    unittest.main(verbosity=2)
