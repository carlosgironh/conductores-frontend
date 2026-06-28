/**
 * ═══════════════════════════════════════════════════════════
 * ROAD TO — Configuración Centralizada
 * 
 * Archivo único de configuración para evitar duplicar
 * credenciales y URLs en cada archivo HTML.
 * 
 * USO:
 *   <script src="config.js"></script>
 *   <script>
 *     const supabaseClient = window.RoadTo.createSupabase();
 *   </script>
 * ═══════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  const CONFIG = {
    SUPABASE_URL: "https://ugchmuhjzzyofoogprlr.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnY2htdWhqenp5b2Zvb2dwcmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODUyNDQsImV4cCI6MjA4NTY2MTI0NH0.kB4ZjPhfP29JL6apWFKrXfW-AwnsCKHfmVsBUVjPsX4",
    APP_VERSION: "2.0.0",
    APP_NAME: "Road To",
    // ID del registro de configuración global de permisos de coordinadores
    GLOBAL_CONFIG_ID: "00000000-0000-0000-0000-000000000000",
  };

  /**
   * Crea e inicializa un cliente Supabase.
   * Requiere que el SDK de Supabase esté cargado previamente:
   *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
   */
  function createSupabase() {
    if (typeof window.supabase === 'undefined' && typeof window.createClient === 'undefined') {
      console.error('[RoadTo Config] Supabase SDK no encontrado. Asegúrate de cargar el SDK antes de config.js');
      return null;
    }

    // Soportar ambos patrones existentes: window.supabase.createClient y createClient directo
    const createFn = (window.supabase && window.supabase.createClient)
      ? window.supabase.createClient
      : window.createClient;

    return createFn(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }

  // Exportar al objeto global window.RoadTo
  window.RoadTo = {
    config: CONFIG,
    createSupabase: createSupabase,

    // Atajos frecuentes
    get SUPABASE_URL() { return CONFIG.SUPABASE_URL; },
    get SUPABASE_ANON_KEY() { return CONFIG.SUPABASE_ANON_KEY; },
  };

  console.log(`[Road To v${CONFIG.APP_VERSION}] Config cargada`);
})();
