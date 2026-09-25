// ColumnPickerModal.test.jsx — la prueba PILOTO del entorno de cliente.
// Tarjeta `97307036`.
//
// Para qué está aquí: la tarjeta pide que la infraestructura se demuestre con
// una prueba de verdad, «que exista una que muerda». Ésta mira lo que el usuario
// ve y lo que pasa cuando toca algo, no la forma del código.
//
// Se eligió este componente por ser pequeño y tener las tres cosas que hacen
// dudosa una prueba de interfaz: pinta según un estado que llega por red, tiene
// un botón que dispara algo, y escucha el teclado.
//
// ⚠️ LO QUE ESTA PRUEBA NO FIJA, Y ES DELIBERADO. El componente hace
// `.catch(() => setCols([]))`: si la carga FALLA, pinta «Sin columnas», o sea,
// **un error se ve igual que un tablero vacío**. Es el mismo defecto de la
// tarjeta `507ba75b` («los errores de carga pintan el estado vacío»), y por eso
// aquí no hay ningún caso que lo dé por bueno: un caso así lo convertiría en
// comportamiento fijado, y mañana arreglarlo saldría rojo.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnPickerModal } from './ColumnPickerModal.jsx';

vi.mock('../../api/client.js', () => ({
  api: { getColumns: vi.fn() },
}));

const { api } = await import('../../api/client.js');

const TABLERO = { id: 'b-1', title: 'Operaciones' };
const COLUMNAS = [
  { id: 'c-1', title: 'En curso' },
  { id: 'c-2', title: 'Por revisar' },
];

beforeEach(() => {
  api.getColumns.mockReset();
});

describe('ColumnPickerModal', () => {
  it('enseña las columnas del tablero que le dan', async () => {
    api.getColumns.mockResolvedValue(COLUMNAS);

    render(<ColumnPickerModal board={TABLERO} onSelect={() => {}} onClose={() => {}} />);

    expect(await screen.findByRole('button', { name: 'En curso' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Por revisar' })).toBeVisible();
    expect(screen.getByText('Operaciones')).toBeVisible();
  });

  it('al pulsar una columna avisa CON CUÁL, no solo que se pulsó', async () => {
    api.getColumns.mockResolvedValue(COLUMNAS);
    const elegida = vi.fn();

    render(<ColumnPickerModal board={TABLERO} onSelect={elegida} onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Por revisar' }));

    expect(elegida).toHaveBeenCalledTimes(1);
    expect(elegida).toHaveBeenCalledWith(COLUMNAS[1]);
  });

  it('se cierra con Escape', async () => {
    api.getColumns.mockResolvedValue(COLUMNAS);
    const cerrar = vi.fn();

    render(<ColumnPickerModal board={TABLERO} onSelect={() => {}} onClose={cerrar} />);
    await screen.findByRole('button', { name: 'En curso' });
    await userEvent.keyboard('{Escape}');

    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('mientras carga dice que está cargando, y no «sin columnas»', async () => {
    api.getColumns.mockReturnValue(new Promise(() => {})); // nunca resuelve

    render(<ColumnPickerModal board={TABLERO} onSelect={() => {}} onClose={() => {}} />);

    expect(screen.getByText('Cargando…')).toBeVisible();
    expect(screen.queryByText('Sin columnas')).toBeNull();
  });
});
