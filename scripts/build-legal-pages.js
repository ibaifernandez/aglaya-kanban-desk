#!/usr/bin/env node
/**
 * build-legal-pages.js — convierte docs/legal/*.md publicables a HTML
 * estático en client/public/ para que Netlify los sirva directo (SEO + cache).
 *
 * Source-of-truth: markdown en docs/legal/. Edita ahí + corre `npm run build:legal`.
 *
 * Páginas generadas:
 *   docs/legal/privacy-policy-kanban.md  →  client/public/privacidad.html
 *
 * Hallazgo audit Mariana C-01 (RGPD Art. 13/14). Mantenibilidad:
 * un solo source per página, regeneración idempotente.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');

// Mapa de páginas legales públicas: { source markdown → output HTML }
const PAGES = [
  {
    source: 'docs/legal/privacy-policy-kanban.md',
    output: 'client/public/privacidad.html',
    title: 'Política de Privacidad — AGLAYA Kanban Desk',
    description: 'Cómo AGLAYA Kanban Desk procesa los datos personales de sus usuarios. RGPD + Ley 21.719 + LGPD.',
    lang: 'es',
  },
];

// HTML wrapper template — dark theme, mobile-first, sin JS, SEO ready
function wrap({ html, title, description, lang }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://kanban.aglaya.biz/privacidad">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://kanban.aglaya.biz/privacidad">
  <meta property="og:locale" content="es_ES">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <link rel="icon" type="image/svg+xml" href="/assets/aglaya-favicon-rojo-CibUNsY8.svg">
  <style>
    *,*::before,*::after { box-sizing: border-box; }
    html { font-size: 16px; -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      background: #0f1117;
      color: #c9cdd8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.65;
      font-size: 15px;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      padding: 48px 24px 96px;
    }
    a.skip-link {
      position: absolute; left: -9999px;
      background: #6366f1; color: #fff; padding: 8px 14px;
      border-radius: 6px; text-decoration: none;
    }
    a.skip-link:focus { left: 16px; top: 16px; z-index: 100; }
    header.brand {
      display: flex; align-items: center; gap: 12px;
      padding-bottom: 24px; margin-bottom: 32px;
      border-bottom: 1px solid #2a2d3a;
    }
    header.brand img { height: 28px; width: auto; }
    header.brand a { color: #8b92a5; text-decoration: none; font-size: 13px; }
    header.brand a:hover { color: #e8eaf0; }
    article h1 {
      color: #e8eaf0; font-size: 28px; font-weight: 800; line-height: 1.2;
      letter-spacing: -0.5px; margin: 0 0 8px;
    }
    article h2 {
      color: #e8eaf0; font-size: 18px; font-weight: 700; margin-top: 40px; margin-bottom: 12px;
    }
    article h3 {
      color: #e8eaf0; font-size: 15px; font-weight: 600; margin-top: 28px; margin-bottom: 10px;
    }
    article h4 {
      color: #c9cdd8; font-size: 14px; font-weight: 600; margin-top: 20px; margin-bottom: 8px;
    }
    article p { margin: 12px 0; }
    article a { color: #818cf8; text-decoration: underline; text-underline-offset: 2px; }
    article a:hover { color: #a5b4fc; }
    article strong { color: #e8eaf0; font-weight: 600; }
    article ul, article ol { padding-left: 24px; margin: 12px 0; }
    article li { margin: 4px 0; }
    article code {
      background: #1e2028; padding: 2px 6px; border-radius: 4px;
      font-family: 'SF Mono', Menlo, Monaco, monospace; font-size: 13px; color: #c4b5fd;
    }
    article pre {
      background: #1e2028; padding: 14px 16px; border-radius: 8px;
      overflow-x: auto; border: 1px solid #2a2d3a; margin: 16px 0;
    }
    article pre code { background: none; padding: 0; }
    article blockquote {
      border-left: 3px solid #6366f1; padding: 8px 16px; margin: 16px 0;
      background: #1a1d26; color: #8b92a5; border-radius: 0 6px 6px 0;
    }
    article hr { border: 0; border-top: 1px solid #2a2d3a; margin: 32px 0; }
    article table {
      width: 100%; border-collapse: collapse; margin: 16px 0;
      font-size: 13px;
    }
    article table th, article table td {
      border: 1px solid #2a2d3a; padding: 8px 12px; text-align: left;
    }
    article table th { background: #1a1d26; color: #e8eaf0; font-weight: 600; }
    article table tr:nth-child(even) { background: #14171f; }
    footer.foot {
      margin-top: 64px; padding-top: 24px; border-top: 1px solid #2a2d3a;
      font-size: 12px; color: #555b70; text-align: center;
    }
    footer.foot a { color: #818cf8; text-decoration: none; }
    footer.foot a:hover { color: #a5b4fc; }
    @media (max-width: 640px) {
      .container { padding: 24px 16px 64px; }
      article h1 { font-size: 22px; }
      article h2 { font-size: 16px; }
      article table { font-size: 12px; }
    }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Saltar al contenido principal</a>
  <div class="container">
    <header class="brand">
      <a href="https://kanban.aglaya.biz/" aria-label="Volver a AGLAYA Kanban Desk">← Volver a la aplicación</a>
    </header>
    <article id="main-content">
${html}
    </article>
    <footer class="foot">
      AGLAYA Kanban Desk · ©  2026 Antonio Ibai Fernández (AGLAYA) · <a href="https://aglaya.biz">aglaya.biz</a>
    </footer>
  </div>
</body>
</html>
`;
}

function buildPage({ source, output, title, description, lang }) {
  const srcPath = path.join(ROOT, source);
  const outPath = path.join(ROOT, output);

  if (!fs.existsSync(srcPath)) {
    console.error(`[build-legal-pages] source missing: ${source}`);
    process.exit(1);
  }

  const md = fs.readFileSync(srcPath, 'utf8');

  // Configuración marked: GFM (tablas) + headings + breaks suaves
  marked.use({
    gfm: true,
    breaks: false,
    headerIds: true,
    mangle: false,
  });

  const html = marked.parse(md);
  const wrapped = wrap({ html, title, description, lang });

  // Asegurar dir output exists
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, wrapped);
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`[build-legal-pages] ${source} → ${output} (${sizeKB} KB)`);
}

console.log('[build-legal-pages] generating static legal pages...');
PAGES.forEach(buildPage);
console.log(`[build-legal-pages] done. ${PAGES.length} page(s) generated.`);
