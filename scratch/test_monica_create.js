require('dotenv').config();
const { supabaseAdmin } = require('../server/utils/supabase');

async function testMonicaEmpowerment() {
  const email = 'monica.montufar@lafabricaimaginaria.com';
  const { data: user } = await supabaseAdmin.from('users').select('*').ilike('email', email).single();
  
  if (!user) { console.error('User not found'); return; }

  console.log(`--- Testing Empowerment for ${user.name} (${user.role}) ---`);

  // 1. Test Workspace Creation (Personal)
  console.log('Testing Workspace Creation (Personal)...');
  const wsName = 'Monica Personal WS';
  const { data: ws, error: wsErr } = await supabaseAdmin
    .from('workspaces')
    .insert({
      name:            wsName,
      emoji:           '🌸',
      description:     'Test personal workspace',
      type:            'personal',
      organization_id: user.organization_id,
      created_by:      user.id
    })
    .select()
    .single();

  if (wsErr) {
    console.error('Workspace creation failed:', wsErr.message);
  } else {
    console.log('Workspace created successfully:', ws.id);
    
    // Add her as owner
    await supabaseAdmin.from('workspace_members').insert({
      workspace_id: ws.id,
      user_id:      user.id,
      role:         'owner',
      invited_by:   user.id
    });
    console.log('Monica added as owner of the workspace');

    // 2. Test Board Creation in that new Workspace
    console.log('Testing Board Creation in new workspace...');
    const { data: board, error: bErr } = await supabaseAdmin
      .from('boards')
      .insert({
        title:           'Monica First Board',
        organization_id: user.organization_id,
        workspace_id:    ws.id,
        owner_id:        user.id,
        order:           1
      })
      .select()
      .single();

    if (bErr) {
      console.error('Board creation failed:', bErr.message);
    } else {
      console.log('Board created successfully:', board.id);

      // Cleanup
      console.log('Cleaning up...');
      await supabaseAdmin.from('boards').delete().eq('id', board.id);
      await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', ws.id);
      await supabaseAdmin.from('workspaces').delete().eq('id', ws.id);
      console.log('Cleanup done');
    }
  }
}

testMonicaEmpowerment();
