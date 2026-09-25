// useBoardData.mover-avisa.test.jsx — mover deshace Y AVISA. Tarjeta `507ba75b`.
//
// POR QUÉ ESTE FICHERO EXISTE APARTE. La prueba del Board le pasa `onMoveCard`
// como prop, así que **no ejecuta este hook**: con ella, devolver el `catch` que
// se tragaba el error seguía en verde. Lo encontró una mutación, no una lectura.
//
// Lo que se fija: al fallar el movimiento, el estado optimista se deshace —eso ya
// se hacía— **y el fallo se vuelve a lanzar**, para que quien llame pueda
// decírselo al usuario. Deshacer sin avisar es la mitad del trabajo: la tarjeta
// vuelve sola a su sitio y nadie explica por qué.
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBoardData } from './useBoardData.js';

vi.mock('../api/client.js', () => ({
  api: {
    getColumns: vi.fn(async () => [{ id: 'col-1', title: 'En curso', boardId: 'b-1' }]),
    getCardsByBoard: vi.fn(async () => [{ id: 'card-1', columnId: 'col-1', order: 1 }]),
    getCards: vi.fn(async () => [{ id: 'card-1', columnId: 'col-1', order: 1 }]),
    moveCard: vi.fn(),
  },
}));

const { api } = await import('../api/client.js');

beforeEach(() => {
  vi.clearAllMocks();
  api.getColumns.mockResolvedValue([{ id: 'col-1', title: 'En curso', boardId: 'b-1' }]);
  api.getCardsByBoard?.mockResolvedValue?.([{ id: 'card-1', columnId: 'col-1', order: 1 }]);
  api.getCards?.mockResolvedValue?.([{ id: 'card-1', columnId: 'col-1', order: 1 }]);
});

async function montar() {
  const { result } = renderHook(() => useBoardData('b-1'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

describe('mover una tarjeta cuando el servidor dice que no', () => {
  // ⚠️ La promesa se guarda FUERA y se comprueba fuera. Envolverla en
  // `expect(act(async () => await …)).rejects` **no mide nada**: `act` se come
  // el rechazo, y con el hook tragándose el error el caso seguía en verde. Lo
  // cazó una mutación —devolver el `catch` viejo— y no una lectura.
  it('vuelve a lanzar el fallo, para que alguien pueda decirlo', async () => {
    api.moveCard.mockRejectedValue(new Error('409 conflicto'));
    const result = await montar();

    let promesa;
    await act(async () => {
      promesa = result.current.moveCard('card-1', 'col-2', 1);
      await promesa.catch(() => {});
    });

    await expect(promesa).rejects.toThrow('409 conflicto');
  });

  it('y aun así deshace el movimiento: relee del servidor', async () => {
    api.moveCard.mockRejectedValue(new Error('409 conflicto'));
    const result = await montar();
    const lecturasAntes = api.getColumns.mock.calls.length;

    await act(async () => {
      await result.current.moveCard('card-1', 'col-2', 1).catch(() => {});
    });

    // Deshacer sin avisar era el defecto; avisar sin deshacer sería otro.
    await waitFor(() => expect(api.getColumns.mock.calls.length).toBeGreaterThan(lecturasAntes));
  });

  it('cuando va bien, no lanza nada', async () => {
    api.moveCard.mockResolvedValue({ id: 'card-1', columnId: 'col-2', order: 1, boardId: 'b-1' });
    const result = await montar();

    let promesa;
    await act(async () => {
      promesa = result.current.moveCard('card-1', 'col-2', 1);
      await promesa;
    });

    await expect(promesa).resolves.toBeUndefined();
  });
});
