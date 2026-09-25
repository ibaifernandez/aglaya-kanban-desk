// Board.guardar-no-miente.test.jsx — un fallo al guardar, mover o borrar deja el
// trabajo a la vista y lo dice. Tarjeta `507ba75b`.
//
// LO QUE HABÍA, medido antes de tocar nada y más matizado que la tarjeta:
//
//   · al MOVER, `useBoardData.moveCard` se tragaba el error (`catch { load() }`),
//     así que `handleSave` seguía adelante y **cerraba el modal**: lo escrito
//     desaparecía de la pantalla sin haber llegado al servidor;
//   · al ACTUALIZAR, la promesa se rompía y nadie la escuchaba: el modal se
//     quedaba abierto **sin una palabra**, con un rechazo suelto en la consola.
//
// Las dos formas son la misma avería para quien trabaja: no te enteras.
//
// Estas pruebas montan el Board de verdad y hablan con él como el usuario:
// abrir la tarjeta, cambiar el texto, guardar. Lo que se comprueba es lo que se
// ve en pantalla, no qué función se llamó.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Board } from './Board.jsx';

vi.mock('../../api/client.js', () => ({
  api: {
    getColumns: vi.fn(async () => []),
    getBoards: vi.fn(async () => [{ id: 'b-1', title: 'Operaciones' }]),
    getWorkspaces: vi.fn(async () => [{ id: 'ws-1', name: 'Operaciones' }]),
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

const COLUMNAS = [
  { id: 'col-1', title: 'En curso', boardId: 'b-1', order: 1 },
  { id: 'col-2', title: 'Por revisar', boardId: 'b-1', order: 2 },
];
const TARJETA = {
  id: 'card-1', title: 'Arreglar el riel', description: '', columnId: 'col-1',
  boardId: 'b-1', priority: 'medium', order: 1, checklist: [], attachments: [], tags: [],
};

function pintar(props = {}) {
  const base = {
    boardId: 'b-1',
    //  no tiene valor por defecto en el componente: sin él, revienta al
    // pintar. Lo descubrió esta prueba; no es de esta tarjeta, pero queda dicho.
    filters: {},
    boards: [{ id: 'b-1', title: 'Operaciones' }],
    columns: COLUMNAS,
    cards: [TARJETA],
    workspaceMembers: [],
    onCreateCard: vi.fn(),
    onUpdateCard: vi.fn(async () => TARJETA),
    onMoveCard: vi.fn(async () => {}),
    onDeleteCard: vi.fn(async () => {}),
    onCreateColumn: vi.fn(),
    onRenameColumn: vi.fn(),
    onUpdateColumn: vi.fn(),
    onDeleteColumn: vi.fn(async () => {}),
    onReorderColumns: vi.fn(),
  };
  const todas = { ...base, ...props };
  render(<Board {...todas} />);
  return todas;
}

async function abrirYGuardar(usuario, textoNuevo = ' y que se vea') {
  await usuario.click(await screen.findByText('Arreglar el riel'));
  const titulo = await screen.findByDisplayValue('Arreglar el riel');
  await usuario.type(titulo, textoNuevo);
  await usuario.click(screen.getByRole('button', { name: /guardar/i }));
  return titulo;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('guardar una tarjeta cuando el servidor dice que no', () => {
  it('no cierra el modal, deja lo escrito y lo dice', async () => {
    const usuario = userEvent.setup();
    pintar({ onUpdateCard: vi.fn(async () => { throw new Error('403 sin permiso'); }) });

    await abrirYGuardar(usuario);

    // Lo escrito sigue en pantalla: el modal no se ha cerrado.
    expect(screen.getByDisplayValue('Arreglar el riel y que se vea')).toBeVisible();
    // Y se dice, con el motivo del servidor dentro.
    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/no se pudo guardar/i);
    expect(aviso).toHaveTextContent(/403 sin permiso/);
  });

  // El camino que la tarjeta describe: el fallo al MOVER se tragaba abajo y el
  // modal se cerraba igual.
  it('tampoco lo cierra cuando lo que falla es el movimiento', async () => {
    const usuario = userEvent.setup();
    pintar({ onMoveCard: vi.fn(async () => { throw new Error('409 conflicto'); }) });

    await usuario.click(await screen.findByText('Arreglar el riel'));
    await usuario.selectOptions(await screen.findByLabelText(/columna/i), 'col-2');
    await usuario.click(screen.getByRole('button', { name: /guardar/i }));

    expect(screen.getByDisplayValue('Arreglar el riel')).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent(/409 conflicto/);
  });

  it('y cuando va bien, se cierra y no hay aviso', async () => {
    const usuario = userEvent.setup();
    pintar();

    await abrirYGuardar(usuario);

    expect(screen.queryByDisplayValue('Arreglar el riel y que se vea')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('borrar una columna que el servidor no deja borrar', () => {
  it('enseña el 409 en vez de prometer un borrado que no ocurre', async () => {
    const usuario = userEvent.setup();
    pintar({ onDeleteColumn: vi.fn(async () => { throw new Error('409: la columna tiene tarjetas'); }) });

    // Menú contextual de la columna → Eliminar → confirmar.
    await usuario.pointer({ keys: '[MouseRight]', target: screen.getByText('En curso') });
    await usuario.click(await screen.findByText(/eliminar columna/i));
    const dialogo = await screen.findByText(/¿eliminar columna\?/i);
    await usuario.click(within(dialogo.closest('div').parentElement).getByRole('button', { name: /^eliminar$/i }));

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/no se pudo eliminar/i);
    expect(aviso).toHaveTextContent(/tiene tarjetas/i);
  });
});
