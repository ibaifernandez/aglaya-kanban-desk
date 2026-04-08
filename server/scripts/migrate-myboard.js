/**
 * migrate-myboard.js
 * Migra los datos de MyBoard (tasks.json) a AGLAYA Kanban Desk (Supabase).
 *
 * ANTES DE EJECUTAR:
 *   1. Crea un workspace de tipo 'personal' en AGLAYA desde la UI.
 *   2. Anota su UUID (puedes verlo en Supabase → Table Editor → workspaces).
 *   3. Ejecuta: WORKSPACE_ID=<uuid> node server/scripts/migrate-myboard.js
 *
 * SEGURIDAD:
 *   - Solo inserta — nunca borra ni modifica datos existentes.
 *   - Si detecta boards ya migrados, aborta.
 *   - Ejecutar desde la raíz del proyecto.
 *
 * Uso:
 *   WORKSPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx node server/scripts/migrate-myboard.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

// ── Configuración ─────────────────────────────────────────────────────────────

const WORKSPACE_ID = process.env.WORKSPACE_ID;
const MYBOARD_PATH = path.join(__dirname, '../../../MyBoard/server/data/tasks.json');
const ORG_ID       = '00000000-0000-0000-0000-000000000001';

if (!WORKSPACE_ID) {
  console.error('❌ Falta WORKSPACE_ID. Uso: WORKSPACE_ID=<uuid> node server/scripts/migrate-myboard.js');
  process.exit(1);
}

if (!fs.existsSync(MYBOARD_PATH)) {
  console.error(`❌ No se encuentra tasks.json en: ${MYBOARD_PATH}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Carga de datos ────────────────────────────────────────────────────────────

const tasks = JSON.parse(fs.readFileSync(MYBOARD_PATH, 'utf8'));

console.log(`\n📂 MyBoard tasks.json cargado:`);
console.log(`   Boards:     ${tasks.boards.length}`);
console.log(`   Columnas:   ${tasks.columns.length}`);
console.log(`   Cards:      ${tasks.cards.length}`);
console.log(`   Categorías: ${tasks.categories?.length ?? 0}`);
console.log(`\n🎯 Workspace destino: ${WORKSPACE_ID}\n`);

// Mapas de IDs viejos (string) → UUIDs de Supabase
const boardIdMap    = {};
const columnIdMap   = {};
const categoryIdMap = {};

// ── Migración ─────────────────────────────────────────────────────────────────

async function migrate() {

  // 0. Verificar que el workspace existe y es de tipo personal
  const { data: ws, error: wsErr } = await supabase
    .from('workspaces')
    .select('id, name, type')
    .eq('id', WORKSPACE_ID)
    .single();

  if (wsErr || !ws) {
    console.error('❌ Workspace no encontrado en Supabase. ¿Está bien el UUID?');
    process.exit(1);
  }

  console.log(`✅ Workspace verificado: "${ws.name}" (${ws.type})`);

  if (ws.type !== 'personal') {
    console.warn(`⚠️  El workspace es de tipo "${ws.type}", no "personal". ¿Seguro que es el correcto?`);
    console.warn('   Continuando de todas formas (Ctrl+C para abortar)...\n');
    await new Promise(r => setTimeout(r, 3000));
  }

  // 1. Verificar que no hay boards ya migrados (evitar duplicados)
  const { count: existing } = await supabase
    .from('boards')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', WORKSPACE_ID);

  if (existing > 0) {
    console.error(`❌ Ya existen ${existing} tableros en este workspace. Abortar para evitar duplicados.`);
    console.error('   Borra los datos desde Supabase → Table Editor antes de re-migrar.');
    process.exit(1);
  }

  // 2. Categorías ──────────────────────────────────────────────────────────────
  console.log(`\n🏷️  Migrando ${tasks.categories.length} categorías...`);

  for (const cat of tasks.categories) {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        organization_id: ORG_ID,
        label:           cat.label,
        color_id:        cat.colorId || 'blue',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  ❌ Categoría "${cat.label}": ${error.message}`);
      continue;
    }

    categoryIdMap[cat.id] = data.id;
    console.log(`  ✅ ${cat.label} → ${data.id}`);
  }

  // 3. Boards ──────────────────────────────────────────────────────────────────
  console.log(`\n📋 Migrando ${tasks.boards.length} tableros...`);

  for (let i = 0; i < tasks.boards.length; i++) {
    const b = tasks.boards[i];
    const { data, error } = await supabase
      .from('boards')
      .insert({
        title:           b.title,
        organization_id: ORG_ID,
        workspace_id:    WORKSPACE_ID,
        order:           i + 1,
        created_at:      b.createdAt,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  ❌ Board "${b.title}": ${error.message}`);
      continue;
    }

    boardIdMap[b.id] = data.id;
    console.log(`  ✅ ${b.title} → ${data.id}`);
  }

  // 4. Columnas ────────────────────────────────────────────────────────────────
  console.log(`\n📊 Migrando ${tasks.columns.length} columnas...`);

  for (const col of tasks.columns) {
    const boardUuid = boardIdMap[col.boardId];
    if (!boardUuid) {
      console.warn(`  ⚠️  boardId "${col.boardId}" no mapeado — saltando columna "${col.title}"`);
      continue;
    }

    const { data, error } = await supabase
      .from('columns')
      .insert({
        board_id:   boardUuid,
        title:      col.title,
        order:      col.order,
        created_at: col.createdAt,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  ❌ Columna "${col.title}": ${error.message}`);
      continue;
    }

    columnIdMap[col.id] = data.id;
    process.stdout.write('.');
  }
  console.log(' hecho');

  // 5. Cards ───────────────────────────────────────────────────────────────────
  console.log(`\n🃏 Migrando ${tasks.cards.length} tarjetas...`);

  let cardOk = 0;
  let cardErr = 0;

  for (const card of tasks.cards) {
    const columnUuid   = columnIdMap[card.columnId];
    const boardUuid    = boardIdMap[card.boardId];
    const categoryUuid = categoryIdMap[card.category] ?? null;

    if (!columnUuid || !boardUuid) {
      console.warn(`  ⚠️  IDs no mapeados para tarjeta "${card.title}" — saltando`);
      cardErr++;
      continue;
    }

    const { error } = await supabase.from('cards').insert({
      column_id:       columnUuid,
      board_id:        boardUuid,
      organization_id: ORG_ID,
      title:           card.title,
      description:     card.description     || '',
      category:        categoryUuid,          // UUID de Supabase, no el slug original
      priority:        card.priority         || 'none',
      due_date:        card.dueDate          || null,
      tags:            card.tags             || [],
      checklist:       card.checklist        || [],
      checklist_title: card.checklistTitle   || '',
      order:           card.order,
      created_at:      card.createdAt,
      updated_at:      card.updatedAt || card.createdAt,
    });

    if (error) {
      console.error(`  ❌ Card "${card.title}": ${error.message}`);
      cardErr++;
    } else {
      cardOk++;
      process.stdout.write('.');
    }
  }

  // 6. Resumen ─────────────────────────────────────────────────────────────────
  console.log(`\n\n${'─'.repeat(50)}`);
  console.log(`✅ Migración completada`);
  console.log(`   Boards migrados:     ${Object.keys(boardIdMap).length} / ${tasks.boards.length}`);
  console.log(`   Columnas migradas:   ${Object.keys(columnIdMap).length} / ${tasks.columns.length}`);
  console.log(`   Categorías migradas: ${Object.keys(categoryIdMap).length} / ${tasks.categories.length}`);
  console.log(`   Cards migradas:      ${cardOk} / ${tasks.cards.length} (${cardErr} errores)`);

  if (cardErr > 0) {
    console.warn(`\n⚠️  ${cardErr} tarjetas no migradas — revisa los warnings arriba`);
  }

  console.log(`\n📌 Mapeo de IDs boards:`);
  Object.entries(boardIdMap).forEach(([old, uuid]) => {
    const board = tasks.boards.find(b => b.id === old);
    console.log(`   ${board?.title ?? old} → ${uuid}`);
  });
}

migrate().catch(err => {
  console.error('\n💥 Error inesperado:', err.message);
  process.exit(1);
});
