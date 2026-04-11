require('dotenv').config();
const { supabaseAdmin } = require('../server/utils/supabase');

async function checkMonica() {
  const { data: user, error: uErr } = await supabaseAdmin
    .from('users')
    .select('*')
    .ilike('email', '%monica%')
    .single();

  if (uErr) {
    console.error('User search error:', uErr.message);
    return;
  }

  console.log('User:', user.email, 'Role:', user.role, 'ID:', user.id, 'Org:', user.organization_id);

  const { data: memberships, error: mErr } = await supabaseAdmin
    .from('workspace_members')
    .select('*, workspace:workspaces(name, type)')
    .eq('user_id', user.id);

  if (mErr) {
    console.error('Memberships error:', mErr.message);
    return;
  }

  console.log('Memberships:');
  memberships.forEach(m => {
    console.log(`- ${m.workspace.name} (${m.workspace.type}): Role ${m.role}`);
  });
}

checkMonica();
