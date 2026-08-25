'use strict';

async function getSyncedUserProfile(adminClient, userId) {
  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('id, email, name, role, organization_id, avatar_url')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return { profile: null, error: profileError || new Error('Perfil no encontrado') };
  }

  let authEmail = null;

  try {
    const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(userId);
    if (!authError) {
      authEmail = authData?.user?.email ?? null;
    }
  } catch {
    authEmail = null;
  }

  if (authEmail && authEmail !== profile.email) {
    const { error: syncError } = await adminClient
      .from('users')
      .update({ email: authEmail })
      .eq('id', userId);

    if (!syncError) {
      profile.email = authEmail;
    } else {
      console.warn(`[userProfile] No se pudo sincronizar email para ${userId}: ${syncError.message}`);
    }
  }

  return { profile, error: null };
}

module.exports = { getSyncedUserProfile };
