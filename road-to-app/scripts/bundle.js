/**
 * Script de bundling para Road To App
 * Empaqueta Supabase y copia Leaflet para uso offline en Android WebView
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const JS_OUT = path.join(__dirname, '..', 'src', 'JS');
const LEAFLET_OUT = path.join(JS_OUT, 'leaflet');

// 1. Crear directorios si no existen
if (!fs.existsSync(LEAFLET_OUT)) {
  fs.mkdirSync(LEAFLET_OUT, { recursive: true });
}

// 2. Bundlear Supabase con esbuild
async function bundleSupabase() {
  console.log('[bundle] Generando supabase-bundle.js...');
  await esbuild.build({
    entryPoints: ['node_modules/@supabase/supabase-js/dist/index.mjs'],
    bundle: true,
    minify: true,
    globalName: 'supabase',
    format: 'iife',
    outfile: path.join(JS_OUT, 'supabase-bundle.js'),
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'window',
    },
  });
  console.log('[bundle] supabase-bundle.js generado OK');
}

// 3. Copiar Leaflet CSS y JS
function copyLeaflet() {
  console.log('[bundle] Copiando Leaflet...');
  const leafletDist = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist');
  
  const files = ['leaflet.js', 'leaflet.css'];
  files.forEach(f => {
    const src = path.join(leafletDist, f);
    const dest = path.join(LEAFLET_OUT, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`[bundle] Copiado: JS/leaflet/${f}`);
    } else {
      console.warn(`[bundle] ADVERTENCIA: No se encontró ${src}`);
    }
  });

  // Copiar carpeta images (iconos del mapa)
  const imagesDir = path.join(leafletDist, 'images');
  const imagesOut = path.join(LEAFLET_OUT, 'images');
  if (fs.existsSync(imagesDir)) {
    if (!fs.existsSync(imagesOut)) fs.mkdirSync(imagesOut, { recursive: true });
    fs.readdirSync(imagesDir).forEach(f => {
      fs.copyFileSync(path.join(imagesDir, f), path.join(imagesOut, f));
    });
    console.log('[bundle] Iconos de Leaflet copiados');
  }
}

// Ejecutar
(async () => {
  try {
    await bundleSupabase();
    copyLeaflet();
    console.log('\n✅ Bundling completado. Archivos en src/JS/');
  } catch (err) {
    console.error('[bundle] ERROR:', err.message);
    process.exit(1);
  }
})();
