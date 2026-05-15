/**
 * Seed lanzamiento comercial Ley 21.719
 * Crea 4 tableros + columnas + 61 cards en workspace 🇨🇱 Software Ley 21.719
 */
require('dotenv').config({ quiet: true });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const WORKSPACE_ID = '0db84606-a209-4b66-aa79-56a263736176';
const ORG_ID       = '00000000-0000-0000-0000-000000000001';

// Existing board "Sitio web" backlog column
const SITIO_WEB_BACKLOG = 'bea77225-c25e-4de5-9a27-8406205146bd';
const SITIO_WEB_BOARD   = 'd05aaf32-2df1-4bda-9459-39dee7b9edec';

const COLUMNS = [
  { title: '🗂 Backlog',     order: 1 },
  { title: '🎯 Prioridades', order: 2 },
  { title: '🔄 En curso',    order: 3 },
  { title: '⏸ Bloqueado',   order: 4 },
  { title: '✅ Hecho',       order: 5 },
];

// ── Cards por tablero ─────────────────────────────────────────────────────────

const SITIO_WEB_CARDS = [
  {
    title: 'Separar CTAs: "Escanear mi web" / "Soy agencia / consultor" / "Necesito revisión manual"',
    priority: 'urgent',
    description: 'Tres rutas de conversión diferenciadas en landing. Usuario final, canal indirecto y revisión humana no deben compartir CTA. §9.1 ítem 5',
  },
  {
    title: 'Crear sample report anonimizado para la landing',
    priority: 'urgent',
    description: 'Sin muestra del informe, el usuario compra una promesa abstracta. Anonimizar empresa, mantener estructura real de hallazgos. §9.1 ítem 4',
  },
  {
    title: 'Verificar formularios propios: aviso, finalidad, consentimiento, opt-out',
    priority: 'urgent',
    description: 'El producto debe predicar con el ejemplo. Aviso claro de tratamiento, finalidad, contacto, derechos y mecanismo opt-out en todos los formularios propios. §8.5 + §14.3',
  },
  {
    title: 'Recalcular equivalencia en pesos (UTM vigente) — no publicar ads sin esto',
    priority: 'urgent',
    description: 'La UTM cambia mensualmente. Toda cifra en pesos basada en UTM debe recalcularse antes de publicar cualquier pieza pagada. §14.6 + §21 checklist',
  },
  {
    title: 'Validar disclaimer "no asesoría legal" en toda pieza publicada',
    priority: 'urgent',
    description: 'Texto mínimo obligatorio: "Diagnóstico técnico preliminar. No constituye asesoría legal ni certificación de cumplimiento integral." §14.1 + §21 checklist',
  },
  {
    title: 'Corregir copy: "diciembre 2026 es el límite" → "1 de diciembre de 2026 entra en vigencia"',
    priority: 'high',
    description: 'Más preciso y verificable. Evita imprecisiones que restan credibilidad en mercado regulatorio. §9.1 ítem 1',
  },
  {
    title: 'Agregar bloque "Para quién es"',
    priority: 'high',
    description: 'Empresas con formularios, agencias web/performance, consultoras de compliance, estudios legales boutique, equipos TI. Segmentar explícitamente en landing. §9.1 ítem 2',
  },
  {
    title: 'Agregar bloque "Para quién no es"',
    priority: 'high',
    description: 'Empresas que buscan certificación legal automática, auditoría backend, asesoría jurídica completa o garantía integral de cumplimiento. §9.1 ítem 3',
  },
  {
    title: 'Agregar FAQ de límites técnicos',
    priority: 'high',
    description: 'Exclusiones técnicas en formato visible y simple: no certifica cumplimiento, no audita backend, no sustituye a Legal/DPO/agencia. §2.5 + §9.1 ítem 6',
  },
  {
    title: 'Reducir lenguaje punitivo — mantener urgencia, quitar dramatismo',
    priority: 'high',
    description: 'Eliminar frases alarmistas que parezcan humo regulatorio. Urgencia sí, miedo sin precisión no. §9.1 ítem 8 + §14.2',
  },
  {
    title: 'Revisar copy sancionatorio con criterio legal',
    priority: 'high',
    description: 'Cifras de multa y referencias a sanciones deben incluir matiz jurídico. Ningún hallazgo equivale automáticamente a infracción sancionable. §14.2 + §21 checklist',
  },
  {
    title: 'Agregar prueba de proceso visual',
    priority: 'medium',
    description: 'Diagrama simple: URL → validación aptitud → 5 scans deliberativos → informe PDF → priorización remediación. Reduce abstracción del producto. §9.1 ítem 7',
  },
  {
    title: 'Hacer visible facturación supeditada a éxito técnico',
    priority: 'medium',
    description: 'Si el motor no alcanza consenso técnico suficiente, no se habilita el cobro y se deriva a ruta asistida. Comunicarlo explícitamente genera confianza. §9.1 ítem 9',
  },
  {
    title: 'Bloque partner con CTA específico separado del usuario final',
    priority: 'medium',
    description: 'El bloque de alianzas no debe quedar mezclado con usuario final. CTA propio: "Solicitar código de partner" o "Explorar pack de dominios". §9.1 ítem 10',
  },
];

const CONTENIDO_CARDS = [
  {
    title: 'Crear calendario LinkedIn mayo (4 posts/semana)',
    priority: 'urgent',
    description: 'Cadencia: 4 publicaciones semanales durante mayo y junio. Definir días, formatos (carrusel, clip, post) y temas por semana antes del lunes. §8.3',
  },
  {
    title: 'Post LinkedIn #1: "Qué revisar en tu web antes de la Ley 21.719"',
    priority: 'urgent',
    description: 'Primer post de activación. Tono educativo, no punitivo. Target: gerentes marketing, legal counsel, founders B2B. §8.3 + §7.1',
  },
  {
    title: 'Post LinkedIn #2: "Tu formulario de contacto también es tratamiento de datos"',
    priority: 'high',
    description: 'Conectar ley con producto. Mensaje base segmento 1: la web pública ya trata datos sin que muchos lo sepan. §4.1 + §10.2',
  },
  {
    title: 'Post LinkedIn #3: Para agencias — discovery técnico vs. intuición',
    priority: 'high',
    description: '"Antes de proponer remediación a tu cliente, sabe exactamente qué tiene que remediar." Target: directores de agencias digitales. §4.2 + §8.3',
  },
  {
    title: 'Post LinkedIn #4: Remediación con evidencia vs. remediación por intuición',
    priority: 'high',
    description: 'Concepto narrativo central. Comparar ambos enfoques en formato visual. No exponer empresas concretas. §3.4 + §8.3',
  },
  {
    title: 'Publicar página específica para agencias y consultores',
    priority: 'high',
    description: 'Página diferenciada con oferta partner: códigos, packs, material comercial, argumento de venta. CTA: "Solicitar código de partner". §8.4 + §13 actividades clave ítem 2',
  },
  {
    title: 'Artículo SEO #1: "Qué cambia el 1 de diciembre de 2026 con la Ley 21.719"',
    priority: 'high',
    description: 'Pilar 1: captar búsquedas informativas. Keywords: "ley 21.719 Chile", "ley datos personales Chile 2026". §10.1 + §8.1',
  },
  {
    title: 'Artículo SEO #2: "Qué debe revisar una pyme chilena antes de adaptar su web"',
    priority: 'high',
    description: 'Pilar 1. Target segmento 5 (pymes/dueños). Keywords: "ley 21719 pymes", "adecuación web ley 21.719". §10.1 + §4.5',
  },
  {
    title: 'Artículo SEO #3: "Tu formulario de contacto también es tratamiento de datos"',
    priority: 'medium',
    description: 'Pilar 2: conectar ley con producto. Keywords: "formularios web datos personales Chile". §10.2 + §8.1',
  },
  {
    title: 'Artículo SEO #4: "Qué no puede detectar un scanner público de Ley 21.719"',
    priority: 'medium',
    description: 'Pilar 4: límites honestos. Genera confianza en mercado regulatorio. Keywords: "scanner ley 21719", "auditoría web ley 21.719". §10.4',
  },
  {
    title: 'Artículo SEO #5: "Cómo vender proyectos de adecuación web a Ley 21.719" (agencias)',
    priority: 'medium',
    description: 'Pilar 3: canal indirecto. Target agencias. Keywords: "agencias ley 21719", "discovery técnico ley 21.719". §10.3',
  },
  {
    title: 'Artículo SEO #6: "Diferencia entre auditoría técnica preliminar y asesoría legal"',
    priority: 'medium',
    description: 'Pilar 4: honestidad técnica. Posiciona AGLAYA sin competir con abogados. Keywords: "diagnóstico ley 21.719". §10.4',
  },
  {
    title: 'Preparar webinar #1: "Qué revisar en tu web antes de la Ley 21.719"',
    priority: 'medium',
    description: 'Webinar semanal durante mayo. Objetivo: convertir educación en escaneos y sesiones de lectura. Plataforma y fecha por definir. §8.7 + §13 actividades clave ítem 16',
  },
  {
    title: 'Artículo SEO #7: "Principios de la Ley 21.719 aplicados a formularios web"',
    priority: 'low',
    description: 'Pilar 1. Keywords: "política de privacidad ley 21.719", "consentimiento formularios web Chile". §10.1',
  },
  {
    title: 'Artículo SEO #8: "Cómo preparar una web para revisión de privacidad"',
    priority: 'low',
    description: 'Pilar 2. Keywords: "cookies rastreadores ley 21.719", "preparación web ley datos personales". §10.2',
  },
];

const OUTREACH_CARDS = [
  {
    title: 'Definir stack email y configurar dominio, warmup, opt-out',
    priority: 'urgent',
    description: 'MailerLite o equivalente. Prioridad: dominio dedicado para cold email, warmup activo, opt-out en toda comunicación. Sin esto, nada más de este tablero puede ejecutarse. §8.5 + §14.4',
  },
  {
    title: 'Crear flujo A — Scanner iniciado (3 emails)',
    priority: 'urgent',
    description: 'Email 1: qué analiza el protocolo. Email 2: qué significa apto/no apto. Email 3: cómo usar el informe con TI, Legal o agencia. Trigger: URL enviada al scanner. §8.5 Flujo A',
  },
  {
    title: 'Crear flujo B — Informe entregado (4 emails)',
    priority: 'urgent',
    description: 'Email 1: cómo leer el informe. Email 2: qué corregir primero. Email 3: convertir informe en plan de remediación. Email 4: revisión humana para casos críticos. Trigger: informe enviado. §8.5 Flujo B',
  },
  {
    title: 'Escribir secuencia cold email segmento 1 (empresas con formularios)',
    priority: 'urgent',
    description: 'Tono conversacional, no corporativo. Asunto personal, no legal. No acusar incumplimiento. CTA único: escanear URL o pedir revisión. Opt-out claro. §18.3',
  },
  {
    title: 'Crear flujo C — Sitio no apto (3 emails)',
    priority: 'high',
    description: 'Email 1: web requiere revisión asistida. Email 2: qué anomalías impiden lectura automática. Email 3: activar peritaje manual. Trigger: sitio marcado como no apto. §8.5 Flujo C',
  },
  {
    title: 'Crear flujo D — Agencia / consultor (3 emails)',
    priority: 'high',
    description: 'Email 1: usar AGLAYA como discovery para clientes. Email 2: convertir hallazgos en propuestas. Email 3: solicitar códigos para cartera. Trigger: código partner usado o campo agencia marcado. §8.5 Flujo D',
  },
  {
    title: 'Escribir secuencia cold email segmento 5 (pymes / dueños)',
    priority: 'high',
    description: 'Mismo criterio que seg. 1 pero lenguaje más simple. Entrada por gratuidad. "Descúbrelo en minutos, gratis en mayo, antes de gastar en algo que quizás no necesitas." §4.5 + §18.3',
  },
  {
    title: 'Construir lista prospección: agencias web Chile',
    priority: 'high',
    description: 'Target prioritario: multiplicadores con cartera de clientes. Apollo/Hunter o equivalente. Filtrar por agencias con presencia digital activa en Chile. §8.4 + §12.1',
  },
  {
    title: 'Outreach inicial partners: agencias web (código gratuito + propuesta)',
    priority: 'high',
    description: 'Oferta partner: código gratuito, pack de dominios, material comercial, guía para vender remediación. Canal de mayor retorno esperado según estrategia. §8.4',
  },
  {
    title: 'Preparar material comercial para partners (one-pager + guía venta remediación)',
    priority: 'high',
    description: 'One-pager con oferta partner y guía para que agencias vendan remediación usando AGLAYA como discovery. Necesario antes de cualquier outreach. §8.4 + §14 recursos clave',
  },
  {
    title: 'Construir lista prospección: consultoras compliance Chile',
    priority: 'medium',
    description: 'Segmento 3: buscan evidencia técnica para complementar diagnóstico normativo. Filtrar consultoras activas en Ley 21.719. §4.3 + §12.1',
  },
  {
    title: 'Construir lista prospección: estudios legales boutique Chile',
    priority: 'medium',
    description: 'Early adopters probables: quieren diferenciarse con insumo técnico. Estudios especializados en datos personales, privacidad o compliance digital. §11 early adopters',
  },
];

const PAID_ANALYTICS_CARDS = [
  {
    title: 'Instrumentar métricas base: URLs escaneadas, tasa aptitud, emails capturados',
    priority: 'urgent',
    description: 'Línea base Fase 1. Sin estos datos no hay forma de decidir perseverar o pivotar. Implementar antes de cualquier campaña paid. §13 métricas + §22 cierre operativo',
  },
  {
    title: 'Instrumentar métricas: informes generados y entregados',
    priority: 'urgent',
    description: 'KPI producto: cuántos informes se generan vs. cuántos llegan al usuario. Detectar cuellos de botella en entrega y tasa de fallback a revisión manual. §13.2',
  },
  {
    title: 'Definir dashboard métricas mayo (línea base Fase 1)',
    priority: 'high',
    description: 'Norte comercial: dominios analizados que generan acción posterior. Dashboard con KPIs por etapa: conciencia, activación, producto, conversión, canal. §13.1 + §13.3',
  },
  {
    title: 'Configurar Meta Ads — Creative V1 "Directo al hueso"',
    priority: 'high',
    description: 'Favorito para mobile. Validar recálculo UTM antes de publicar y añadir matiz jurídico. No afirmar que la multa aplica automáticamente a cualquier hallazgo. §18.1 V1 + §14.6',
  },
  {
    title: 'Configurar Meta Ads — Creative V2 "Conversacional / susto suave"',
    priority: 'high',
    description: 'Cambiar "te decimos si tu web tiene un problema" por "te mostramos señales públicas que conviene revisar". Reducir riesgo de promesa implícita de cumplimiento. §18.1 V2',
  },
  {
    title: 'Configurar Google Ads — campaña alta urgencia',
    priority: 'high',
    description: 'Keywords: "ley 21719 cumplimiento", "ley 21.719 empresas". Landing: scanner. Presupuesto concentrado. No usar términos amplios sin landing específica. §8.2',
  },
  {
    title: 'Configurar Google Ads — campaña técnica',
    priority: 'high',
    description: 'Keywords: "auditoría web ley 21719", "formularios ley 21719". Landing: página auditoría web. §8.2',
  },
  {
    title: 'Configurar Meta Ads — Creative V3 "Pregunta + urgencia"',
    priority: 'medium',
    description: 'Formulación recomendada: "¿Sabes qué señales públicas de tu web conviene revisar antes de la Ley 21.719?" Evitar promesa implícita de cumplimiento. §18.1 V3',
  },
  {
    title: 'Configurar Google Ads — campaña agencias',
    priority: 'medium',
    description: 'Keywords: "ley 21719 clientes agencia web". Landing: página partner/agencias. §8.2',
  },
  {
    title: 'Instrumentar métricas: PDF abiertos y acciones posteriores',
    priority: 'medium',
    description: 'Métricas de conversión: tasa PDF abierto, reuniones de lectura, revisiones manuales, packs vendidos. Medir en mayo para establecer línea base real. §13.2 + §13.3',
  },
];

const OPERACIONES_CARDS = [
  {
    title: 'Confirmar gratuidad mayo — definir condiciones exactas',
    priority: 'urgent',
    description: 'Gratuidad sin tarjeta durante mayo 2026. Precio habitual USD 12 desde junio. Comunicar internamente condiciones y límites de la campaña antes de publicar. §5.1 + §21 checklist',
  },
  {
    title: 'Definir pricing revisión manual / peritaje',
    priority: 'urgent',
    description: 'Monetización de mayor valor del modelo. Precio óptimo, coste operativo, margen y capacidad de revisión humana son datos aún insuficientes a verificar. §5.3',
  },
  {
    title: 'Definir capacidad operativa revisión manual (casos/día, SLA)',
    priority: 'urgent',
    description: '¿Cuántos casos manuales puede absorber el equipo por día? Definir SLA de respuesta y entrega. Necesario antes de prometerse en landing o outreach. §5.3 + §15',
  },
  {
    title: 'Validación legal copy de marketing',
    priority: 'urgent',
    description: 'Revisión de claims, disclaimers, frontera de no-asesoría legal y copy sancionatorio. Recomendado antes de escalar cualquier canal paid o outbound. §14 gobernanza + §21 checklist',
  },
  {
    title: 'Confirmar precio USD 12 informe individual (vigente desde junio)',
    priority: 'high',
    description: 'Verificar que el precio está correctamente comunicado en landing y que el sistema lo aplica desde junio. No mezclar con campaña mayo gratuito. §5.2 + §21 checklist',
  },
  {
    title: 'Diseñar packs agencias: 25 / 50 / 100 URLs con condiciones',
    priority: 'high',
    description: 'Packs con códigos internos, posible co-branding y soporte. Definir precio, condiciones y proceso de activación por pack antes de outreach a agencias. §5.4',
  },
  {
    title: 'Crear programa partner: códigos/cupones, oferta, comisión',
    priority: 'high',
    description: 'El scanner ya tiene campo de cupón/código. Definir estructura: código por partner, comisión por revisión manual o pack masivo, dashboard simple de seguimiento. §5.4 + §12 socios clave',
  },
  {
    title: 'Definir "sesión de lectura técnica" — agenda, precio, cal link',
    priority: 'high',
    description: '30 minutos. Agenda: revisión hallazgos, priorización, responsables (Legal/TI/agencia), decisión remediación. Puede ser gratuita para SQL o pagada según mercado. §11.4',
  },
  {
    title: 'Definir proceso lead scoring',
    priority: 'medium',
    description: 'Dominio corporativo +10, empresa chilena +15, formularios visibles +15, hallazgos medios/críticos +25, agencia/consultor +30. Implementar en CRM o hoja de seguimiento. §11.1',
  },
  {
    title: 'Definir proceso MQL → SQL → sesión de lectura',
    priority: 'medium',
    description: 'MQL: completó scanner y recibió informe. SQL: hallazgos medios/críticos, no apto o solicitud revisión manual. Siguiente paso: sesión de lectura técnica de 30 min. §11.2 + §11.3',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createBoard(title, order) {
  const { data, error } = await sb.from('boards').insert({
    workspace_id:    WORKSPACE_ID,
    organization_id: ORG_ID,
    title,
    order,
  }).select().single();
  if (error) throw new Error(`Board "${title}": ${error.message}`);
  return data.id;
}

async function createColumns(boardId) {
  const rows = COLUMNS.map(c => ({ board_id: boardId, ...c }));
  const { data, error } = await sb.from('columns').insert(rows).select('id, title, order');
  if (error) throw new Error(`Columns for ${boardId}: ${error.message}`);
  return data.find(c => c.order === 1).id; // return backlog column id
}

async function createCards(cards, columnId, boardId) {
  const rows = cards.map((c, i) => ({
    column_id:       columnId,
    board_id:        boardId,
    organization_id: ORG_ID,
    title:           c.title,
    description:     c.description,
    priority:        c.priority,
    order:           i + 1,
    tags:            [],
    checklist:       [],
    checklist_title: '',
  }));
  const { error } = await sb.from('cards').insert(rows);
  if (error) throw new Error(`Cards: ${error.message}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Creando tableros...');

  // 1. Sitio web — usar backlog existente
  console.log('  → Sitio web (existente): creando cards...');
  await createCards(SITIO_WEB_CARDS, SITIO_WEB_BACKLOG, SITIO_WEB_BOARD);
  console.log(`     ✓ ${SITIO_WEB_CARDS.length} cards`);

  // 2. Contenido
  console.log('  → Contenido: creando tablero + columnas + cards...');
  const contenidoBoardId = await createBoard('📝 Contenido', 2);
  const contenidoBacklog = await createColumns(contenidoBoardId);
  await createCards(CONTENIDO_CARDS, contenidoBacklog, contenidoBoardId);
  console.log(`     ✓ ${CONTENIDO_CARDS.length} cards`);

  // 3. Outreach
  console.log('  → Outreach: creando tablero + columnas + cards...');
  const outreachBoardId = await createBoard('📧 Outreach', 3);
  const outreachBacklog = await createColumns(outreachBoardId);
  await createCards(OUTREACH_CARDS, outreachBacklog, outreachBoardId);
  console.log(`     ✓ ${OUTREACH_CARDS.length} cards`);

  // 4. Paid & Analytics
  console.log('  → Paid & Analytics: creando tablero + columnas + cards...');
  const paidBoardId = await createBoard('📊 Paid & Analytics', 4);
  const paidBacklog = await createColumns(paidBoardId);
  await createCards(PAID_ANALYTICS_CARDS, paidBacklog, paidBoardId);
  console.log(`     ✓ ${PAID_ANALYTICS_CARDS.length} cards`);

  // 5. Operaciones
  console.log('  → Operaciones: creando tablero + columnas + cards...');
  const opsBoardId = await createBoard('⚙️ Operaciones', 5);
  const opsBacklog = await createColumns(opsBoardId);
  await createCards(OPERACIONES_CARDS, opsBacklog, opsBoardId);
  console.log(`     ✓ ${OPERACIONES_CARDS.length} cards`);

  const total = SITIO_WEB_CARDS.length + CONTENIDO_CARDS.length + OUTREACH_CARDS.length + PAID_ANALYTICS_CARDS.length + OPERACIONES_CARDS.length;
  console.log(`\n✅ Listo. ${total} cards en 5 tableros.`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
