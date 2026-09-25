// WorkspaceDashboard.carga-que-falla.test.jsx — «no se pudo mirar» no es «no hay
// nada». Tarjeta `507ba75b`.
//
// Es la mitad de la tarjeta que se quedó sin prueba en la primera entrega, y lo
// cazó el vigilante mutando: devolver el panel al estado vacío cuando la carga
// falla dejaba la batería en 11/11. Un cambio de producción que nada mira.
//
// POR QUÉ IMPORTA MÁS DE LO QUE PARECE. Un fallo de red pintaba **el mismo
// estado vacío** que una cuenta recién creada: el usuario concluía que no tiene
// espacios de trabajo. Es el defecto que esta casa ya cerró en la búsqueda del
// servidor (`1753729e`), reaparecido en la pantalla.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkspaceDashboard from './WorkspaceDashboard.jsx';

vi.mock('../api/client.js', () => ({
  api: {
    getWorkspaces: vi.fn(),
    getNotifications: vi.fn(async () => []),
    getUnreadCount: vi.fn(async () => 0),
  },
}));

const { api } = await import('../api/client.js');

const USUARIO = { id: 'u-1', name: 'Ibai', email: 'x@aglaya.biz', role: 'superadmin' };

function pintar() {
  render(
    <WorkspaceDashboard
      user={USUARIO}
      onEnterWorkspace={vi.fn()}
      onLogout={vi.fn()}
      onOpenAdmin={vi.fn()}
      onAvatarChange={vi.fn()}
      onNotificationNavigate={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cuando no se pueden cargar los espacios de trabajo', () => {
  it('lo dice, con el motivo, y NO pinta el estado vacío', async () => {
    api.getWorkspaces.mockRejectedValue(new Error('Network Error'));

    pintar();

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/no se pudieron cargar/i);
    expect(aviso).toHaveTextContent(/network error/i);

    // Lo que separa este caso de un adorno: que NO se vea lo otro.
    expect(screen.queryByText(/no tienes espacios de trabajo todav[íi]a/i)).toBeNull();
  });

  it('y ofrece reintentar, que es lo único que puede hacer quien lo lee', async () => {
    const usuario = userEvent.setup();
    api.getWorkspaces.mockRejectedValueOnce(new Error('Network Error'));
    api.getWorkspaces.mockResolvedValueOnce([{ id: 'ws-1', name: 'Operaciones', emoji: '🛠', type: 'interno', role: 'owner' }]);

    pintar();
    await usuario.click(await screen.findByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Operaciones')).toBeVisible();
    // Y el aviso de la vez anterior se va: si no, el usuario vería sus espacios
    // y un error al mismo tiempo. Eso lo sostiene `setError(null)` en el hook.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('con la carga en orden y sin espacios, sigue diciendo «no tienes espacios»', async () => {
    api.getWorkspaces.mockResolvedValue([]);

    pintar();

    expect(await screen.findByText(/no tienes espacios de trabajo todav[íi]a/i)).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
