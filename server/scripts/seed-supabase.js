/**
 * seed-supabase.js
 * Migra la dummy data de server/data/tasks.json a Supabase.
 * Ejecutar una sola vez: node server/scripts/seed-supabase.js
 *
 * Requiere que .env esté cargado (ejecutar desde la raíz del proyecto).
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tasks = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/tasks.json'), 'utf8')
);

// Map string IDs (board-aglaya-001) → Supabase UUIDs
const boardIdMap  = {};
const columnIdMap = {};

async function seed() {
  console.log('🌱 Iniciando seed de Supabase...\n');

  // ── 1. Verificar que las tablas están vacías ────────────────────
  const { count: boardCount } = await supabase.from('boards').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_ID);
  if (boardCount > 0) {
    console.log(`⚠️  Ya existen ${boardCount} tableros en Supabase para la org AGLAYA. Abortando seed para evitar duplicados.`);
    console.log('   Si quieres re-seedear, borra primero los datos desde el Table Editor de Supabase.');
    process.exit(0);
  }

  // ── 2. Boards ───────────────────────────────────────────────────
  console.log(`📋 Insertando ${tasks.boards.length} tableros...`);
  for (let i = 0; i < tasks.boards.length; i++) {
    const b = tasks.boards[i];
    const { data, error } = await supabase
      .from('boards')
      .insert({ title: b.title, organization_id: ORG_ID, order: i, created_at: b.createdAt })
      .select('id')
      .single();

    if (error) { console.error(`  ❌ Board "${b.title}":`, error.message); continue; }
    boardIdMap[b.id] = data.id;
    console.log(`  ✅ ${b.title} → ${data.id}`);
  }

  // ── 3. Columns ──────────────────────────────────────────────────
  console.log(`\n📊 Insertando ${tasks.columns.length} columnas...`);
  for (const col of tasks.columns) {
    const boardUuid = boardIdMap[col.boardId];
    if (!boardUuid) { console.warn(`  ⚠️  boardId ${col.boardId} no mapeado, saltando columna "${col.title}"`); continue; }

    const { data, error } = await supabase
      .from('columns')
      .insert({ board_id: boardUuid, title: col.title, order: col.order, created_at: col.createdAt })
      .select('id')
      .single();

    if (error) { console.error(`  ❌ Column "${col.title}":`, error.message); continue; }
    columnIdMap[col.id] = data.id;
    console.log(`  ✅ ${col.title}`);
  }

  // ── 4. Categories ───────────────────────────────────────────────
  if (tasks.categories?.length) {
    console.log(`\n🏷️  Insertando ${tasks.categories.length} categorías...`);
    for (const cat of tasks.categories) {
      const { error } = await supabase
        .from('categories')
        .insert({ label: cat.label, color_id: cat.colorId || 'blue', organization_id: ORG_ID });

      if (error) console.error(`  ❌ Category "${cat.label}":`, error.message);
      else console.log(`  ✅ ${cat.label}`);
    }
  }

  // ── 5. Cards ────────────────────────────────────────────────────
  console.log(`\n🃏 Insertando ${tasks.cards.length} tarjetas...`);
  for (const card of tasks.cards) {
    const columnUuid = columnIdMap[card.columnId];
    const boardUuid  = boardIdMap[card.boardId];

    if (!columnUuid || !boardUuid) {
      console.warn(`  ⚠️  IDs no mapeados para tarjeta "${card.title}", saltando`);
      continue;
    }

    const { error } = await supabase.from('cards').insert({
      column_id:       columnUuid,
      board_id:        boardUuid,
      organization_id: ORG_ID,
      title:           card.title,
      description:     card.description     || '',
      category:        card.category        || '',
      priority:        card.priority        || 'none',
      due_date:        card.dueDate         || null,
      tags:            card.tags            || [],
      checklist:       card.checklist       || [],
      checklist_title: card.checklistTitle  || '',
      order:           card.order,
      created_at:      card.createdAt,
      updated_at:      card.updatedAt || card.createdAt,
    });

    if (error) console.error(`  ❌ Card "${card.title}":`, error.message);
    else process.stdout.write('.');
  }

  console.log('\n\n✅ Seed completado.');
  console.log('\n📌 Mapeo de IDs (para referencia):');
  console.log('  Boards:', boardIdMap);
}

seed().catch(console.error);
