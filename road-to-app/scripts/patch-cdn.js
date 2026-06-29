/**
 * Script que reemplaza referencias CDN de Supabase y Leaflet por versiones locales
 * en todos los archivos HTML del proyecto.
 */

const fs = require('fs');
const path = require('path');
const srcDir = path.join(__dirname, '..', 'src');

// ── Patrones a reemplazar ──────────────────────────────────────────────────
const REPLACEMENTS = [
  // Supabase CDN → local bundle
  {
    pattern: /<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2(?:[^"]*)"[^>]*><\/script>/g,
    replacement: '<script src="JS/supabase-bundle.js"></script>'
  },
  // Leaflet JS CDN → local
  {
    pattern: /<script\s+src="https:\/\/unpkg\.com\/leaflet@[^"]*"[^>]*><\/script>/g,
    replacement: '<script src="JS/leaflet/leaflet.js"></script>'
  },
  // Leaflet CSS CDN → local (con o sin integrity/crossorigin)
  {
    pattern: /<link\s+rel="stylesheet"\s+href="https:\/\/unpkg\.com\/leaflet@[^"]*"[^>]*\/?>/g,
    replacement: '<link rel="stylesheet" href="JS/leaflet/leaflet.css">'
  },
  // QR Code CDN → keep (no tiene alternativa local aún, es rara vez usada)
];

let totalFiles = 0;
let totalChanges = 0;

const htmlFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(filename => {
  const filePath = path.join(srcDir, filename);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  let fileChanges = 0;

  REPLACEMENTS.forEach(({ pattern, replacement }) => {
    const before = content;
    content = content.replace(pattern, replacement);
    if (content !== before) fileChanges++;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch] ✅ ${filename} (${fileChanges} reemplazos)`);
    totalFiles++;
    totalChanges += fileChanges;
  }
});

console.log(`\n✅ Listo: ${totalFiles} archivos actualizados, ${totalChanges} reemplazos en total.`);
