const { createClient } = require('@supabase/supabase-js');

const SHARED_CLIENT_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    SHARED_CLIENT_OPTIONS
  );
}

function createPublicClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    SHARED_CLIENT_OPTIONS
  );
}

// Reusable clients for read-only/common flows. Avoid auth session mutations on these.
const supabaseAdmin = createAdminClient();
const supabase = createPublicClient();

module.exports = { supabase, supabaseAdmin, createAdminClient, createPublicClient };
