const fs = require('fs');
const path = require('path');

const mapaPath = path.join(__dirname, '..', 'src', 'mapa.html');
let content = fs.readFileSync(mapaPath, 'utf8');

// 1. Inject CSS
const cssToInject = `
  /* ═══ Capacity & Passengers (Driver View) ═══ */
  .capacity-panel {
    display: none;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(118, 179, 44, 0.2);
    border-radius: 14px;
    padding: 12px;
    margin-bottom: 14px;
  }
  .capacity-panel.show { display: block; }
  .capacity-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
  }
  .capacity-title { font-size: 13px; font-weight: 700; color: var(--corp-green); }
  .seats-dots { display: flex; gap: 5px; }
  .seat-dot {
    width: 12px; height: 12px; border-radius: 50%;
    background: rgba(255,255,255,0.2); transition: background 0.3s;
  }
  .seat-dot.ocupado { background: var(--corp-orange); }
  .seat-dot.libre { background: var(--corp-green); }

  .passenger-list {
    display: flex; flex-direction: column; gap: 8px;
    max-height: 180px; overflow-y: auto;
  }
  .passenger-item {
    background: rgba(0,0,0,0.3); padding: 10px; border-radius: 10px;
    display: flex; justify-content: space-between; align-items: center;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .passenger-info { font-size: 13px; flex: 1; margin-right: 10px; }
  .passenger-name { font-weight: 700; color: var(--text-light); }
  .passenger-route { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  .passenger-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .btn-passenger {
    padding: 8px 12px; border-radius: 8px; border: none;
    font-size: 11px; font-weight: 700; cursor: pointer; color: white;
  }
  .btn-abordar { background: var(--corp-blue); }
  .btn-bajar { background: var(--corp-orange); }
`;
if (!content.includes('.capacity-panel {')) {
  content = content.replace('/* ═══ Responsive ═══ */', cssToInject + '\n  /* ═══ Responsive ═══ */');
}

// 2. Inject HTML for Info Panel
const htmlToInject = `
    <!-- Panel de Capacidad y Pasajeros (solo visible para conductores) -->
    <div class="capacity-panel" id="capacityPanel">
      <div class="capacity-header">
        <div class="capacity-title">🚙 Cupos Disponibles (<span id="capacidadCount">4</span>/4)</div>
        <div class="seats-dots" id="driverSeatsDots">
          <div class="seat-dot libre"></div>
          <div class="seat-dot libre"></div>
          <div class="seat-dot libre"></div>
          <div class="seat-dot libre"></div>
        </div>
      </div>
      <div class="passenger-list" id="activePassengerList">
        <div style="font-size: 12px; color: var(--text-muted); text-align: center;">Sin pasajeros asignados</div>
      </div>
    </div>
`;
if (!content.includes('id="capacityPanel"')) {
  content = content.replace('<!-- Lista de conductores activos (solo visible para admin/supervisor) -->', htmlToInject + '\n    <!-- Lista de conductores activos (solo visible para admin/supervisor) -->');
}

// 3. Inject JS: Initialize capacity panel and realtime
const jsToInject1 = `
    // Cargar pasajeros activos al iniciar (Capacidad)
    cargarPasajerosActivos();
    
    // Escuchar UPDATES en viajes_reservados
    const canalViajesUpdate = supabaseClient.channel(\`viajes-updates-\${conductorData.id}\`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'viajes_reservados',
          filter: \`conductor_asignado_id=eq.\${conductorData.id}\` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            mostrarModalViajeAsignado(payload.new);
          }
          cargarPasajerosActivos();
        }
      )
      .subscribe();
`;
if (!content.includes('cargarPasajerosActivos()')) {
  content = content.replace('      .subscribe();\n\n    // Escuchar INSERTS', jsToInject1 + '\n\n    // Escuchar INSERTS');
}

// 4. Inject JS: Functions for Capacity Management
const jsToInject2 = `
  // ═══ GESTIÓN DE CAPACIDAD Y PASAJEROS (CONDUCTOR) ═══
  let activePassengersLayer = null;

  async function cargarPasajerosActivos() {
    if (!conductorData || userRole !== 'conductor') return;
    try {
      const { data: viajes, error } = await supabaseClient
        .from('viajes_reservados')
        .select('*')
        .eq('conductor_asignado_id', conductorData.id)
        .in('estado', ['asignado', 'a_bordo']);
        
      if (error) throw error;
      
      const panel = document.getElementById('capacityPanel');
      panel.classList.add('show');
      
      let cuposOcupados = 0;
      let html = '';
      
      if (!viajes || viajes.length === 0) {
        html = '<div style="font-size: 12px; color: var(--text-muted); text-align: center;">Sin pasajeros asignados</div>';
      } else {
        cuposOcupados = viajes.filter(v => v.estado === 'a_bordo').length;
        
        html = viajes.map(v => {
          let actionBtn = '';
          if (v.estado === 'asignado') {
            actionBtn = \`<button class="btn-passenger btn-abordar" onclick="cambiarEstadoPasajero('\${v.id}', 'a_bordo')">A Bordo</button>\`;
          } else if (v.estado === 'a_bordo') {
            actionBtn = \`<button class="btn-passenger btn-bajar" onclick="cambiarEstadoPasajero('\${v.id}', 'completado')">Finalizar</button>\`;
          }
          return \`
            <div class="passenger-item">
              <div class="passenger-info">
                <div class="passenger-name">👤 \${v.pasajero_nombre || 'Pasajero'} (\${v.estado === 'a_bordo' ? 'En viaje' : 'Esperando'})</div>
                <div class="passenger-route">📍 \${v.origen} <br>🏁 \${v.destino}</div>
              </div>
              <div class="passenger-actions">
                \${actionBtn}
              </div>
            </div>
          \`;
        }).join('');
      }
      
      document.getElementById('activePassengerList').innerHTML = html;
      
      // Actualizar visualización de asientos
      const cuposDisponibles = 4 - cuposOcupados;
      document.getElementById('capacidadCount').innerText = cuposDisponibles;
      
      const dots = document.getElementById('driverSeatsDots');
      dots.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        dots.innerHTML += \`<div class="seat-dot \${i < cuposOcupados ? 'ocupado' : 'libre'}"></div>\`;
      }
      
      // Actualizar en base de datos
      await supabaseClient.from('conductores')
        .update({ capacidad_disponible: cuposDisponibles })
        .eq('id', conductorData.id);
        
      // Trazar rutas de pasajeros en el mapa
      dibujarRutasPasajeros(viajes);
      
    } catch (e) {
      console.warn('Error cargando pasajeros activos:', e);
    }
  }

  async function cambiarEstadoPasajero(viajeId, nuevoEstado) {
    try {
      const { error } = await supabaseClient
        .from('viajes_reservados')
        .update({ estado: nuevoEstado, estado_pasajero: nuevoEstado })
        .eq('id', viajeId);
        
      if (error) throw error;
      showToast(nuevoEstado === 'a_bordo' ? 'Pasajero recogido' : 'Viaje finalizado');
      // La UI se actualizará automáticamente por el Realtime
    } catch (e) {
      showToast('Error al actualizar: ' + e.message, 'error');
    }
  }

  function dibujarRutasPasajeros(viajes) {
    if (!map) return;
    if (activePassengersLayer) {
      map.removeLayer(activePassengersLayer);
    }
    activePassengersLayer = L.layerGroup().addTo(map);
    
    viajes.forEach(v => {
      if (v.coordenadas_origen && v.coordenadas_destino) {
        // En un caso real usaríamos OSRM aquí también para trazar la ruta en el mapa del conductor
        // Por ahora trazaremos una línea recta y pondremos marcadores para no saturar la API
        
        const cOri = v.coordenadas_origen;
        const cDes = v.coordenadas_destino;
        
        if (v.estado === 'asignado') {
          // Si está asignado, mostrar donde hay que recogerlo
          L.marker([cOri.lat, cOri.lng], {
            icon: L.divIcon({
              html: '<div style="background:#f97316;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
              className: ''
            })
          }).addTo(activePassengersLayer).bindPopup('Recoger a: ' + (v.pasajero_nombre || 'Pasajero'));
        }
        
        // Mostrar siempre donde va a bajar
        L.marker([cDes.lat, cDes.lng], {
          icon: L.divIcon({
            html: '<div style="background:#8ac725;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
            className: ''
          })
        }).addTo(activePassengersLayer).bindPopup('Dejar a: ' + (v.pasajero_nombre || 'Pasajero'));
      }
    });
  }
`;

if (!content.includes('cambiarEstadoPasajero(')) {
  content = content.replace('  // ═══ FÓRMULA HAVERSINE (distancia entre 2 coordenadas) ═══', jsToInject2 + '\n\n  // ═══ FÓRMULA HAVERSINE (distancia entre 2 coordenadas) ═══');
}

fs.writeFileSync(mapaPath, content);
console.log('mapa.html patched successfully');
