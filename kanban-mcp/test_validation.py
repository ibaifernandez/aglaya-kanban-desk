"""Tests de la validación de destino del riel.

Solo biblioteca estándar: `validation.py` no importa nada de terceros a
propósito, para que estos tests corran en CI sin instalar dependencias.

Qué fijan (petición del orquestador, 2026-07-22):
  · `create_card` debe EXIGIR el espacio de destino…
  · …y VALIDARLO contra la columna donde va la card (decisión de Ibai).

Exigirlo sin validarlo sería peor que no pedirlo: daría sensación de control
sin control. Es la misma forma que el default de `workspaceName` que mandaba
cards al espacio personal devolviendo 201.

Uso:  python3 kanban-mcp/test_validation.py
"""
import unittest

from validation import missing_workspace_error, workspace_mismatch_error

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


if __name__ == "__main__":
    unittest.main(verbosity=2)
