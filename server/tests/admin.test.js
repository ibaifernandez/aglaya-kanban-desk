const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
        listUsers: jest.fn(),
        // La ruta de invitación usa `inviteUserByEmail` (atómica: crea el usuario
        // de auth y manda el correo). El mock se quedó en `createUser`, de antes
        // del cambio, así que los dos tests que la ejercitaban se apagaron en vez
        // de actualizarse. Apagar un test por un mock viejo deja sin vigilancia el
        // comportamiento, no el mock.
        inviteUserByEmail: jest.fn(),
      },
      resetPasswordForEmail: jest.fn(),
    },
  },
  createAdminClient: jest.fn(),
}));

const { supabaseAdmin, createAdminClient } = require('../utils/supabase');
const app = require('../app');

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'admin-1', email: 'admin@aglaya.biz', role: 'superadmin', organizationId: 'org-1', ...overrides },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

function makeChain(resolver) {
  const state = {
    filters: {},
    payload: null,
  };

  const chain = {
    select() {
      return chain;
    },
    insert(payload) {
      state.payload = payload;
      return chain;
    },
    update(payload) {
      state.payload = payload;
      return chain;
    },
    delete() {
      return chain;
    },
    eq(column, value) {
      state.filters[column] = value;
      return chain;
    },
    order() {
      return chain;
    },
    maybeSingle() {
      return Promise.resolve(resolver(state));
    },
    single() {
      return Promise.resolve(resolver(state));
    },
    then(resolve, reject) {
      return Promise.resolve(resolver(state)).then(resolve, reject);
    },
  };

  return chain;
}

let mockState;

beforeEach(() => {
  jest.clearAllMocks();
  createAdminClient.mockReturnValue(supabaseAdmin);

  mockState = {
    usersById: {
      'admin-1': {
        id: 'admin-1',
        email: 'admin@aglaya.biz',
        name: 'Admin User',
        role: 'superadmin',
        organization_id: 'org-1',
      },
      'user-2': {
        id: 'user-2',
        email: 'target@other.biz',
        name: 'Target User',
        role: 'colaborador',
        organization_id: 'org-9',
      },
    },
    usersByEmail: {},
    authUsers: [],
    profileInsertError: null,
    workspaceOwnerships: [],
  };

  supabaseAdmin.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: 'user-2' } },
    error: null,
  });
  supabaseAdmin.auth.admin.inviteUserByEmail.mockResolvedValue({
    data: { user: { id: 'invited-1' } },
    error: null,
  });
  supabaseAdmin.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  supabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null });
  supabaseAdmin.auth.admin.listUsers.mockImplementation(async () => ({
    data: { users: mockState.authUsers, lastPage: 1 },
    error: null,
  }));

  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'users') {
      return makeChain((state) => {
        if (state.payload) {
          if (mockState.profileInsertError) {
            return { data: null, error: mockState.profileInsertError };
          }

          const row = state.payload;
          mockState.usersById[row.id] = {
            ...row,
            created_at: row.created_at ?? new Date().toISOString(),
          };
          mockState.usersByEmail[row.email] = mockState.usersById[row.id];
          return { data: row, error: null };
        }

        if (state.filters.email) {
          return { data: mockState.usersByEmail[state.filters.email] ?? null, error: null };
        }

        if (state.filters.id) {
          return { data: mockState.usersById[state.filters.id] ?? null, error: null };
        }

        return { data: Object.values(mockState.usersById), error: null };
      });
    }

    if (table === 'workspace_members') {
      return makeChain(() => ({ data: mockState.workspaceOwnerships, error: null }));
    }

    return makeChain(() => ({ data: null, error: null }));
  });
});

describe('POST /api/admin/users/invite', () => {
  it('rejects workspace-only guest role from the global admin panel', async () => {
    const res = await request(app)
      .post('/api/admin/users/invite')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ email: 'guest@aglaya.biz', name: 'Guest User', role: 'guest' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Rol no válido/i);
  });

  // Reactivado 2026-07-27. Lo que fija: un JWT viejo no puede meter a alguien en
  // la organización equivocada. La organización se resuelve contra la DB
  // (`resolveRequesterOrganizationId`), no contra el claim, que puede llevar
  // meses caducado en la sesión de quien invita.
  it('uses the organization from the database even if the JWT carries a stale organization id', async () => {
    const res = await request(app)
      .post('/api/admin/users/invite')
      .set('Authorization', `Bearer ${makeToken({ organizationId: 'stale-org' })}`)
      .send({ email: 'fresh@aglaya.biz', name: 'Fresh User', role: 'colaborador' });

    expect(res.status).toBe(201);
    expect(mockState.usersByEmail['fresh@aglaya.biz'].organization_id).toBe('org-1');
  });

  // Reactivado 2026-07-27, y REESCRITO: su premisa había dejado de ser verdad.
  //
  // El test esperaba que la ruta RECONSTRUYERA el perfil cuando existe el usuario
  // de auth pero falta la fila en `public.users`. La ruta hoy hace lo contrario:
  // devuelve 409 y manda borrarlo a mano desde el panel de Supabase.
  //
  // Y es mejor así, que es lo que hace que valga la pena fijarlo en vez de
  // «arreglar» el test hacia atrás: reconstruir en silencio un perfil sobre un
  // usuario de auth que nadie sabe de dónde salió es adoptar una cuenta huérfana
  // sin que nadie la mire. En una nave donde solo tres cuentas están autorizadas,
  // eso es exactamente lo que no puede pasar sin un humano delante.
  it('refuses to adopt an auth user that has no profile, and says how to fix it', async () => {
    mockState.authUsers = [
      { id: 'auth-only-user', email: 'partial@aglaya.biz' },
    ];

    const res = await request(app)
      .post('/api/admin/users/invite')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ email: 'partial@aglaya.biz', name: 'Partial User', role: 'colaborador' });

    expect(res.status).toBe(409);
    // El mensaje tiene que decir QUÉ hacer: quien se lo coma está mirando un
    // estado inconsistente que no creó y no puede resolver adivinando.
    expect(res.body.error).toMatch(/Supabase Auth/i);
    // Y sobre todo: no se crea nada. Ni cuenta nueva, ni perfil adoptado.
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(mockState.usersByEmail['partial@aglaya.biz']).toBeUndefined();
  });

  it('returns 409 instead of 500 when the public profile email already exists', async () => {
    mockState.usersByEmail['existing@aglaya.biz'] = {
      id: 'existing-profile',
      email: 'existing@aglaya.biz',
      name: 'Existing User',
      role: 'colaborador',
      organization_id: 'org-1',
    };

    const res = await request(app)
      .post('/api/admin/users/invite')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ email: 'existing@aglaya.biz', name: 'Existing User', role: 'colaborador' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Ya existe un perfil|Ya existe un usuario/i);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('lets superadmin delete users outside their own organization scope', async () => {
    const res = await request(app)
      .delete('/api/admin/users/user-2')
      .set('Authorization', `Bearer ${makeToken({ organizationId: null })}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
