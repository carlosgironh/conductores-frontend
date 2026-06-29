/**
 * Script que normaliza todos los inicializadores de Supabase
 * al patrón window.supabase.createClient para compatibilidad con el bundle local.
 */

const fs = require('fs');
const path = require('path');
const srcDir = path.join(__dirname, '..', 'src');

// Patrón 1: const { createClient } = supabase; const supabaseClient = createClient(...)
// → const supabaseClient = window.supabase.createClient(...)

// Patrón 2: const supabaseClient = createClient(...)  (sin destructuración previa visible)
// → const supabaseClient = window.supabase.createClient(...)

let totalFiles = 0;

const htmlFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(filename => {
  const filePath = path.join(srcDir, filename);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Eliminar líneas de destructuración: const { createClient } = supabase;
  content = content.replace(/\s*const\s*\{\s*createClient\s*\}\s*=\s*supabase\s*;\s*\n/g, '\n');

  // Reemplazar: createClient(... por window.supabase.createClient(  
  // Solo si no está ya usando window.supabase.createClient
  content = content.replace(/(?<!window\.supabase\.)createClient\s*\(/g, 'window.supabase.createClient(');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-supabase] ✅ ${filename}`);
    totalFiles++;
  }
});

console.log(`\n✅ Listo: ${totalFiles} archivos normalizados.`);
