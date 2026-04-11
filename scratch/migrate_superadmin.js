require('dotenv').config();
const { supabaseAdmin } = require('../server/utils/supabase');

const OLD_EMAIL = 'admin@previous-brand.com';
const NEW_EMAIL = 'info@ibaifernandez.com';
const USER_ID   = 'edff1ac7-2380-435e-86cf-520955e3d9a7';

async function migrate() {
  console.log(`🚀 Inicia migración de Superadmin: ${OLD_EMAIL} -> ${NEW_EMAIL}`);

  try {
    // 1. Actualizar en Supabase Auth (Sistema de Autenticación)
    console.log('--- Pasos 1/2: Actualizando Supabase Auth ---');
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
      USER_ID,
      { email: NEW_EMAIL, email_confirm: true } // Confirmamos el email automáticamente
    );

    if (authErr) {
      throw new Error(`Error en Auth: ${authErr.message}`);
    }
    console.log('✅ Auth actualizado correctamente.');

    // 2. Actualizar en Tabla Pública (Lógica de Negocio)
    console.log('--- Paso 2/2: Actualizando tabla public.users ---');
    const { data: dbData, error: dbErr } = await supabaseAdmin
      .from('users')
      .update({ email: NEW_EMAIL })
      .eq('id', USER_ID)
      .select()
      .single();

    if (dbErr) {
      throw new Error(`Error en DB: ${dbErr.message}`);
    }
    console.log(`✅ Registro DB actualizado: ${dbData.email}`);

    console.log('\n✨ Migración completada con éxito.');
    console.log('⚠️ IMPORTANTE: El usuario ahora debe loguearse con info@ibaifernandez.com');
    console.log('⚠️ La contraseña sigue siendo la misma.');

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO DURANTE LA MIGRACIÓN:');
    console.error(error.message);
    process.exit(1);
  }
}

migrate();
