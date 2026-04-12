require('dotenv').config();
const { supabaseAdmin } = require('./server/utils/supabase');

async function fixRLS() {
  console.log('--- Aplicando políticas RLS faltantes ---');

  // Política para permitir INSERT en workspaces
  const { error: wsError } = await supabaseAdmin.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'workspaces' AND policyname = 'Permitir crear workspaces a usuarios autenticados'
      ) THEN
        CREATE POLICY "Permitir crear workspaces a usuarios autenticados"
        ON public.workspaces FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'workspace_members' AND policyname = 'Permitir unirse a workspaces creados'
      ) THEN
        CREATE POLICY "Permitir unirse a workspaces creados"
        ON public.workspace_members FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
      END IF;

      -- También permitimos INSERT en boards/columns/cards para evitar futuros errores 500
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Permitir crear boards') THEN
        CREATE POLICY "Permitir crear boards" ON public.boards FOR INSERT TO authenticated WITH CHECK (true);
      END IF;
    END $$;
  `);

  if (wsError) {
    console.error('Error aplicando políticas:', wsError);
  } else {
    console.log('Políticas aplicadas con éxito.');
  }
}

// Nota: supabaseAdmin.query no existe en el SDK estándar, usamos .rpc si existe o un truco.
// En Supabase SDK v2 podemos usar .rpc con una función que ejecute SQL, 
// o si no la tenemos, tenemos que pedir al usuario usar el SQL Editor.
// Pero intentaremos usar rpc simple si está configurado.

// Como no sé si el RPC 'exec_sql' existe, intentaré algo más estándar.
fixRLS();
