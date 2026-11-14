// CardModal.sin-categoria.test.jsx — abrir y guardar una tarjeta NO le pone una
// categoría que nadie eligió. Tarjeta `ec5b86e6`.
//
// QUÉ DEFECTO VIGILA. El `<select>` de categoría solo listaba las categorías
// existentes: **no había opción vacía**. Y al abrir una tarjeta sin categoría el
// formulario se rellenaba con `categories[0]?.id`. Resultado: en un espacio con
// al menos una categoría, **toda tarjeta que se abría y se guardaba salía con la
// primera de la lista**, tocara o no ese campo — incluidas tarjetas viejas
// abiertas para cambiar otra cosa.
//
// En un espacio SIN categorías no se notaba, porque `categories[0]` no existe.
// Por eso apareció al tocar un espacio que sí las tiene.
//
// No es una regresión: viene de `da7c283` (27-mar-2026), que cambió una categoría
// fija por «la primera que haya» sin hacer el campo opcional.
//
// ⚠️ QUÉ MIDE ESTO Y QUÉ NO. La tarjeta pide medirlo «en la fila, no en la
// pantalla». Desde el cliente lo más cerca que se puede llegar es **lo que sale
// hacia el servidor**, y eso es lo que se afirma aquí. La otra mitad —que un
// `category` vacío se guarde como NULL— la pone el servidor en
// `server/routes/cards.js:548` (`update.category = category || null`), y está
// COMPROBADA leyéndola, no supuesta. Decirlo así es más honesto que afirmar que
// esta prueba mira la base, porque no la mira.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Board } from '../Board/Board.jsx';
import { CategoriesContext } from '../../context/CategoriesContext.jsx';

vi.mock('../../api/client.js', () => ({
  api: {
    getColumns:    vi.fn(async () => []),
    getBoards:     vi.fn(async () => [{ id: 'b-1', title: 'Operaciones' }]),
    getWorkspaces: vi.fn(async () => [{ id: 'ws-1', name: 'Operaciones' }]),
    uploadFile:    vi.fn(),
    deleteFile:    vi.fn(),
  },
}));

// Dos, y en este orden, para que «la primera de la lista» sea una elección
// reconocible: si el defecto vuelve, el valor que se escape será `cat-1`.
const CATEGORIAS = [
  { id: 'cat-1', label: 'Primera',  color: 'bg-blue-500' },
  { id: 'cat-2', label: 'Segunda',  color: 'bg-green-500' },
];

const COLUMNAS = [{ id: 'col-1', title: 'En curso', boardId: 'b-1', order: 1 }];

/** Una tarjeta SIN categoría — el caso que el defecto estropeaba. */
const SIN_CATEGORIA = {
  id: 'card-1', title: 'Arreglar el riel', description: '', columnId: 'col-1',
  boardId: 'b-1', priority: 'medium', order: 1,
  checklist: [], attachments: [], tags: [],
  category: null,
};

function pintar(props = {}, cards = [SIN_CATEGORIA]) {
  const base = {
    boardId: 'b-1', filters: {}, columns: COLUMNAS, cards,
    boards: [{ id: 'b-1', title: 'Operaciones' }], workspaceMembers: [],
    onCreateCard: vi.fn(async () => cards[0]),
    onUpdateCard: vi.fn(async () => cards[0]),
    onMoveCard: vi.fn(async () => {}), onDeleteCard: vi.fn(async () => {}),
    onCreateColumn: vi.fn(), onRenameColumn: vi.fn(), onUpdateColumn: vi.fn(),
    onDeleteColumn: vi.fn(async () => {}), onReorderColumns: vi.fn(),
  };
  const todas = { ...base, ...props };
  render(
    <CategoriesContext.Provider value={{
      categories: CATEGORIAS,
      createCategory: async () => {}, updateCategory: async () => {}, deleteCategory: async () => {},
    }}>
      <Board {...todas} />
    </CategoriesContext.Provider>,
  );
  return todas;
}

const guardar = (usuario) => usuario.click(screen.getByRole('button', { name: /guardar/i }));

beforeEach(() => { vi.clearAllMocks(); });

describe('abrir y guardar no inventa una categoría', () => {
  // ── Condición 1 ───────────────────────────────────────────────────────────
  it('cambiar SOLO el título deja la categoría sin poner', async () => {
    const usuario = userEvent.setup();
    const props = pintar();

    await usuario.click(await screen.findByText('Arreglar el riel'));
    await usuario.type(await screen.findByDisplayValue('Arreglar el riel'), ' y que se vea');
    await guardar(usuario);

    expect(props.onUpdateCard).toHaveBeenCalledTimes(1);
    const [, payload] = props.onUpdateCard.mock.calls[0];

    // Lo que rompía: aquí salía `cat-1` sin que nadie lo hubiera elegido.
    expect(payload.category ?? '').toBe('');
    // Y el título sí viaja: la prueba no pasa por no haber guardado nada.
    expect(payload.title).toBe('Arreglar el riel y que se vea');
  });

  it('el desplegable OFRECE «Sin categoría», y es lo que está puesto', async () => {
    const usuario = userEvent.setup();
    pintar();

    await usuario.click(await screen.findByText('Arreglar el riel'));
    const select = await screen.findByLabelText(/categoría/i);

    // Sin una opción vacía no hay forma de volver a «ninguna», así que el
    // relleno sería irreversible desde la interfaz.
    expect(select).toHaveValue('');
    expect([...select.options].map((o) => o.value)).toContain('');
  });

  // ── Condición 2: la contraprueba ──────────────────────────────────────────
  it('CONTRAPRUEBA · elegir una categoría SÍ la guarda', async () => {
    const usuario = userEvent.setup();
    const props = pintar();

    await usuario.click(await screen.findByText('Arreglar el riel'));
    await usuario.selectOptions(await screen.findByLabelText(/categoría/i), 'cat-2');
    await guardar(usuario);

    const [, payload] = props.onUpdateCard.mock.calls[0];
    expect(payload.category).toBe('cat-2');
  });

  // ── Condición 3 ───────────────────────────────────────────────────────────
  it('quitar la categoría de una tarjeta que la tenía la deja sin poner', async () => {
    const usuario = userEvent.setup();
    const props = pintar({}, [{ ...SIN_CATEGORIA, category: 'cat-2' }]);

    await usuario.click(await screen.findByText('Arreglar el riel'));
    await usuario.selectOptions(await screen.findByLabelText(/categoría/i), '');
    await guardar(usuario);

    const [, payload] = props.onUpdateCard.mock.calls[0];
    expect(payload.category ?? '').toBe('');
  });

  // ── Una tarjeta NUEVA nace sin categoría ─────────────────────────────────
  it('una tarjeta NUEVA nace sin categoría salvo que se elija', async () => {
    // ⚠️ ESTE CASO EXISTE PORQUE UN MUTANTE SOBREVIVÍA. Devolver el relleno en
    // la rama de tarjeta nueva —`{ ...EMPTY, category: categories[0]?.id }`—
    // dejaba los 33 casos en verde: todos los demás abren una tarjeta que YA
    // existe, y esa rama es otra. Lo que se pide en la tarjeta son tres cosas,
    // y yo tenía cubiertas dos.
    const usuario = userEvent.setup();
    const props = pintar();

    // La tarjeta nueva con formulario se abre por el menú contextual de la
    // columna; el «+» del pie crea con solo el título y no pasa por aquí.
    await usuario.pointer({ target: await screen.findByText('En curso'), keys: '[MouseRight]' });
    await usuario.click(await screen.findByText('Añadir tarjeta'));

    await usuario.type(await screen.findByLabelText(/título/i), 'Recién nacida');
    // El botón dice «Crear tarea», no «Guardar cambios»: el modal cambia el
    // texto según `isNew`. Comprobado en el componente, no adivinado.
    await usuario.click(screen.getByRole('button', { name: /crear tarea/i }));

    expect(props.onCreateCard).toHaveBeenCalledTimes(1);
    const [payload] = props.onCreateCard.mock.calls[0];
    expect(payload.category ?? '').toBe('');
    expect(payload.title).toBe('Recién nacida');
  });

  // ── Condición 5: con y sin categoría, ordenado por categoría ─────────────
  it('una columna con tarjetas CON y SIN categoría se pinta ordenada por categoría', async () => {
    const usuario = userEvent.setup();
    pintar({}, [
      SIN_CATEGORIA,
      { ...SIN_CATEGORIA, id: 'card-2', title: 'Con categoría', category: 'cat-1' },
    ]);

    // El orden por categoría compara etiquetas resueltas; una tarjeta sin
    // categoría cae a cadena vacía. Lo que se mide es que las dos se pintan.
    //
    // Se busca por `title` y no por etiqueta porque ese `<select>` **no tiene
    // etiqueta**: mi primera versión lo pedía por `findByLabelText(/ordenar/i)`
    // y fallaba por mi arnés, no por el defecto. Queda dicho porque es un rojo
    // que no probaba nada de lo que yo afirmaba.
    await usuario.selectOptions(
      await screen.findByTitle('Ordenar columna'), 'category');

    expect(screen.getByText('Arreglar el riel')).toBeVisible();
    expect(screen.getByText('Con categoría')).toBeVisible();
  });
});
