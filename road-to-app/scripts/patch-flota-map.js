const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'panel-admin.html');
const coordPath = path.join(__dirname, '..', 'src', 'panel-coordinador.html');

let adminContent = fs.readFileSync(adminPath, 'utf8');
let coordContent = fs.readFileSync(coordPath, 'utf8');

// ==========================================
// 1. MODIFICAR PANEL ADMIN
// ==========================================

// 1.1 Añadir Tab de Flota en Admin
if (!adminContent.includes("switchSection('flota', this)")) {
  adminContent = adminContent.replace(
    `<button class="section-tab" onclick="switchSection('zonas', this)">📍 Zonas</button>`,
    `<button class="section-tab" onclick="switchSection('zonas', this)">📍 Zonas</button>\n        <button class="section-tab" onclick="switchSection('flota', this)">📊 Estado de Flota</button>`
  );
}

// 1.2 Añadir Sección de Flota en Admin
const flotaAdminHtml = `
    <!-- ESTADO DE FLOTA SECTION -->
    <div id="flotaSection" class="section-content" style="display: none;">
      <div class="stats-grid">
        <div class="stat-card active"><div class="stat-value" id="flotaActivos">0</div><div class="stat-label">🟢 Activos</div></div>
        <div class="stat-card inactive"><div class="stat-value" id="flotaInactivos">0</div><div class="stat-label">🔴 Inactivos</div></div>
        <div class="stat-card paid"><div class="stat-value" id="flotaEnMovimiento">0</div><div class="stat-label">🚗 En Movimiento</div></div>
        <div class="stat-card available"><div class="stat-value" id="flotaFueraZona">0</div><div class="stat-label">⚠️ Fuera de Zona</div></div>
      </div>
      
      <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">
        <!-- Mapa de Flota -->
        <div style="flex: 1 1 500px;">
          <div id="mapFlota" style="height: 450px; width: 100%; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); z-index: 1;"></div>
        </div>
        
        <!-- Lista de Conductores de Flota -->
        <div style="flex: 1 1 300px; display: flex; flex-direction: column;">
          <input type="text" id="searchFlota" class="search-input" placeholder="🔍 Buscar conductor..." oninput="renderFlotaList()" style="margin-bottom: 15px;">
          <div id="flotaList" style="flex: 1; overflow-y: auto; max-height: 400px; display: flex; flex-direction: column; gap: 10px; padding-right: 5px;">
            <div style="text-align: center; padding: 40px; color: #64748b;">Cargando flota...</div>
          </div>
        </div>
      </div>
    </div>
`;
if (!adminContent.includes('id="flotaSection"')) {
  adminContent = adminContent.replace(
    `<!-- Botones Principales -->`,
    `${flotaAdminHtml}\n    <!-- Botones Principales -->`
  );
}

// ==========================================
// 2. MODIFICAR PANEL COORDINADOR
// ==========================================

// 2.1 Añadir Leaflet a Coordinador
if (!coordContent.includes('leaflet.css')) {
  coordContent = coordContent.replace(
    `<!-- Supabase y QRCode -->`,
    `<!-- Leaflet CSS + JS -->\n<link rel="stylesheet" href="JS/leaflet/leaflet.css">\n<script src="JS/leaflet/leaflet.js"></script>\n\n<!-- Supabase y QRCode -->`
  );
}

// 2.2 Reemplazar la Sección Flota existente en Coordinador por la nueva (dividida con mapa)
const oldFlotaRegexCoord = /<!-- ESTADO DE FLOTA SECTION -->[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/;
const flotaCoordHtml = `
    <!-- ESTADO DE FLOTA SECTION -->
    <div id="flotaSection" class="section-content" style="display: none;">
      <div class="stats-grid">
        <div class="stat-card active"><div class="stat-value" id="flotaActivos">0</div><div class="stat-label">🟢 Activos</div></div>
        <div class="stat-card inactive"><div class="stat-value" id="flotaInactivos">0</div><div class="stat-label">🔴 Inactivos</div></div>
        <div class="stat-card paid"><div class="stat-value" id="flotaEnMovimiento">0</div><div class="stat-label">🚗 En Movimiento</div></div>
        <div class="stat-card available"><div class="stat-value" id="flotaFueraZona">0</div><div class="stat-label">⚠️ Fuera de Zona</div></div>
      </div>
      
      <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">
        <!-- Mapa de Flota -->
        <div style="flex: 1 1 500px;">
          <div id="mapFlota" style="height: 450px; width: 100%; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); z-index: 1;"></div>
        </div>
        
        <!-- Lista de Conductores de Flota -->
        <div style="flex: 1 1 300px; display: flex; flex-direction: column;">
          <input type="text" id="searchFlota" class="search-box" placeholder="🔍 Buscar conductor..." oninput="renderFlotaList()" style="margin-bottom: 15px;">
          <div id="flotaList" style="flex: 1; overflow-y: auto; max-height: 400px; display: flex; flex-direction: column; gap: 10px; padding-right: 5px;">
            <div style="text-align: center; padding: 40px; color: #64748b;">Cargando flota...</div>
          </div>
        </div>
      </div>
    </div>
`;
if (coordContent.match(oldFlotaRegexCoord)) {
  coordContent = coordContent.replace(oldFlotaRegexCoord, flotaCoordHtml);
}

// ==========================================
// 3. JAVASCRIPT COMPARTIDO (FLOTA LOGIC)
// ==========================================
const jsLogic = `
  // ═══ LÓGICA DE TORRE DE CONTROL (FLOTA) ═══
  let mapFlotaInstance = null;
  let flotaMarkers = {};
  let flotaData = {}; 
  let zonasGeofenceData = [];
  let realtimeFlotaChannel = null;

  async function initFlotaMap() {
    if (mapFlotaInstance) return;
    mapFlotaInstance = L.map('mapFlota').setView([9.0, -79.5], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(mapFlotaInstance);

    // Cargar zonas para dibujarlas y usarlas en cálculos
    const { data: zonas } = await supabaseClient.from('zonas_geofence').select('*').eq('activa', true);
    if (zonas) {
      zonasGeofenceData = zonas;
      zonas.forEach(z => {
        L.circle([z.latitud, z.longitud], {
          color: '#8ac725', fillColor: '#8ac725', fillOpacity: 0.1, radius: z.radio_metros, weight: 2
        }).addTo(mapFlotaInstance);
      });
    }

    // Cargar última ubicación de todos los activos
    const { data: locs } = await supabaseClient.from('driver_locations').select('*').order('timestamp', { ascending: false });
    // Agrupar por driver (solo la más reciente)
    const latestLocs = {};
    if (locs) {
      locs.forEach(l => {
        if (!latestLocs[l.driver_id]) latestLocs[l.driver_id] = l;
      });
      Object.values(latestLocs).forEach(loc => updateDriverMarker(loc));
    }

    renderFlotaList();

    // Suscribirse en tiempo real
    if (!realtimeFlotaChannel) {
      realtimeFlotaChannel = supabaseClient.channel('flota-tracking')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations' }, (payload) => {
          updateDriverMarker(payload.new);
          renderFlotaList();
        })
        .subscribe();
    }
  }

  function updateDriverMarker(loc) {
    flotaData[loc.driver_id] = loc;
    
    // Calcular si está en zona permitida
    let inZone = false;
    for (let z of zonasGeofenceData) {
      if (haversineDistance(loc.latitude, loc.longitude, z.latitud, z.longitud) <= z.radio_metros) {
        inZone = true; break;
      }
    }
    loc.inZone = inZone;

    const isMoving = (loc.speed || 0) > 1; // Más de 1 m/s (~3.6 km/h)
    
    // Color según estado: Rojo (Fuera Zona), Verde (En Zona + Movimiento), Naranja (En Zona + Estacionado)
    let markerColor = inZone ? (isMoving ? '#22c55e' : '#f59e0b') : '#ef4444';
    
    // Obtener datos del conductor de allConductores
    const cInfo = allConductores.find(c => c.id === loc.driver_id) || {};
    const cupos = cInfo.capacidad_disponible ?? 4;
    
    const iconHtml = \`<div style="width: 30px; height: 30px; background: \${markerColor}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; font-weight: bold;">\${cupos}</div>\`;

    if (flotaMarkers[loc.driver_id]) {
      flotaMarkers[loc.driver_id].setLatLng([loc.latitude, loc.longitude]);
      flotaMarkers[loc.driver_id].setIcon(L.divIcon({ html: iconHtml, className: '' }));
      flotaMarkers[loc.driver_id].setPopupContent(\`
        <b>\${cInfo.nombres || 'Conductor'} \${cInfo.apellidos || ''}</b><br>
        🚗 Vel: \${Math.round((loc.speed||0)*3.6)} km/h<br>
        🚙 Cupos: \${cupos}/4<br>
        📍 \${inZone ? 'En Zona Permitida' : '¡FUERA DE ZONA!'}
      \`);
    } else {
      flotaMarkers[loc.driver_id] = L.marker([loc.latitude, loc.longitude], {
        icon: L.divIcon({ html: iconHtml, className: '' })
      }).addTo(mapFlotaInstance).bindPopup(\`
        <b>\${cInfo.nombres || 'Conductor'} \${cInfo.apellidos || ''}</b><br>
        🚗 Vel: \${Math.round((loc.speed||0)*3.6)} km/h<br>
        🚙 Cupos: \${cupos}/4<br>
        📍 \${inZone ? 'En Zona Permitida' : '¡FUERA DE ZONA!'}
      \`);
    }
  }

  function renderFlotaList() {
    const listContainer = document.getElementById('flotaList');
    const search = (document.getElementById('searchFlota')?.value || '').toLowerCase();
    
    let activos = 0, inactivos = 0, enMovimiento = 0, fueraZona = 0;

    let html = '';
    
    allConductores.forEach(c => {
      const loc = flotaData[c.id];
      const isOnline = loc && (new Date() - new Date(loc.timestamp) < 5 * 60 * 1000); // 5 mins activo
      
      if (c.estado === true || c.estado === 'activo') activos++;
      else inactivos++;

      if (isOnline && loc) {
        if ((loc.speed || 0) > 1) enMovimiento++;
        if (!loc.inZone) fueraZona++;
      }

      if (search) {
        const full = (c.nombres + ' ' + c.apellidos).toLowerCase();
        if (!full.includes(search)) return;
      }

      // Estilos de la tarjeta en la lista
      const bgColor = isOnline ? (loc.inZone ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)') : 'rgba(255,255,255,0.05)';
      const statusText = isOnline ? (loc.inZone ? ( (loc.speed||0)>1?'🟢 En Movimiento':'🟡 Estacionado' ) : '🔴 FUERA DE ZONA') : '⚫ Desconectado';
      
      html += \`
        <div style="background: \${bgColor}; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; cursor: pointer; display: flex; align-items: center; gap: 12px;" onclick="focusFlotaMarker('\${c.id}')">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 16px;">
            \${isOnline ? '🚗' : '😴'}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 14px; color: white;">\${c.nombres||''} \${c.apellidos||''}</div>
            <div style="font-size: 12px; color: #94a3b8;">\${c.marca||''} \${c.modelo||''} • 🚙 \${c.capacidad_disponible??4}/4</div>
            <div style="font-size: 11px; margin-top: 4px; font-weight: bold; color: \${isOnline ? (loc.inZone ? '#4ade80' : '#ef4444') : '#94a3b8'}">\${statusText} \${isOnline ? Math.round((loc.speed||0)*3.6)+' km/h' : ''}</div>
          </div>
        </div>
      \`;
    });

    if (html === '') html = '<div style="text-align:center; padding:20px; color:#64748b">No hay conductores</div>';
    if (listContainer) listContainer.innerHTML = html;

    // Update Dashboard Stats
    if(document.getElementById('flotaActivos')) document.getElementById('flotaActivos').innerText = activos;
    if(document.getElementById('flotaInactivos')) document.getElementById('flotaInactivos').innerText = inactivos;
    if(document.getElementById('flotaEnMovimiento')) document.getElementById('flotaEnMovimiento').innerText = enMovimiento;
    if(document.getElementById('flotaFueraZona')) document.getElementById('flotaFueraZona').innerText = fueraZona;
  }

  function focusFlotaMarker(driverId) {
    if (mapFlotaInstance && flotaMarkers[driverId]) {
      const marker = flotaMarkers[driverId];
      mapFlotaInstance.flyTo(marker.getLatLng(), 16);
      marker.openPopup();
    } else {
      showToast('No hay ubicación reciente para este conductor', 'error');
    }
  }

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
`;

// Inyectar Javascript compartido en ambos paneles
const injectJS = (content) => {
  if (!content.includes('initFlotaMap()')) {
    return content.replace('</script>\n</body>', jsLogic + '\n</script>\n</body>');
  }
  return content;
};

// Interceptar switchSection para inicializar el mapa cuando la pestaña se haga visible
const switchSectionRegex = /function switchSection\(section, btn\) \{[\s\S]*?document\.getElementById\(section \+ 'Section'\)\.classList\.add\('active'\);/;
const injectMapInitHook = (content) => {
  if (!content.includes("initFlotaMap();")) {
    return content.replace(
      /document\.getElementById\(section \+ 'Section'\)\.classList\.add\('active'\);/g,
      `document.getElementById(section + 'Section').classList.add('active');\n      if (section === 'flota') { setTimeout(() => { initFlotaMap(); if(mapFlotaInstance) mapFlotaInstance.invalidateSize(); }, 200); }`
    );
  }
  return content;
}

adminContent = injectMapInitHook(injectJS(adminContent));
coordContent = injectMapInitHook(injectJS(coordContent));

fs.writeFileSync(adminPath, adminContent);
fs.writeFileSync(coordPath, coordContent);
console.log('Paneles Admin y Coordinador actualizados con Torre de Control (Flota).');
