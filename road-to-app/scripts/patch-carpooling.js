const fs = require('fs');
const path = require('path');

const mapaPath = path.join(__dirname, '..', 'src', 'mapa.html');
const reservarPath = path.join(__dirname, '..', 'src', 'reservar-viaje.html');
const adminPath = path.join(__dirname, '..', 'src', 'panel-admin.html');
const coordPath = path.join(__dirname, '..', 'src', 'panel-coordinador.html');

let mapaContent = fs.readFileSync(mapaPath, 'utf8');
let reservarContent = fs.readFileSync(reservarPath, 'utf8');
let adminContent = fs.readFileSync(adminPath, 'utf8');
let coordContent = fs.readFileSync(coordPath, 'utf8');

// ==========================================
// 1. CONDUCTOR: mapa.html
// ==========================================

// Variable para almacenar la ruta
if (!mapaContent.includes('let currentRouteData = null;')) {
    mapaContent = mapaContent.replace(
        `let searchDestEl;`,
        `let searchDestEl;\n  let currentRouteData = null;`
    );
}

// Guardar la ruta calculada
mapaContent = mapaContent.replace(
    `const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);`,
    `const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);\n      currentRouteData = route.geometry; // Guardamos la geometria para Supabase`
);

// Limpiar la ruta
mapaContent = mapaContent.replace(
    `document.getElementById('routeInfo').classList.remove('show');`,
    `document.getElementById('routeInfo').classList.remove('show');\n    currentRouteData = null;`
);

// En toggleTracking() -> update supabase con la ruta si se Inicia Viaje
const updateRutaActivaJS = `
    const updatePayload = { estado: 'activo' };
    if (currentRouteData) {
      updatePayload.ruta_activa = currentRouteData;
    }
    await supabaseClient.from('conductores').update(updatePayload).eq('id', conductorData.id);
`;
if (mapaContent.includes(`await supabaseClient.from('conductores').update({ estado: 'activo' }).eq('id', conductorData.id);`)) {
    mapaContent = mapaContent.replace(
        `await supabaseClient.from('conductores').update({ estado: 'activo' }).eq('id', conductorData.id);`,
        updateRutaActivaJS
    );
}

// Al finalizar viaje, limpiar la ruta y restablecer cupos
const limpiarRutaActivaJS = `
    await supabaseClient.from('conductores').update({ 
      estado: 'inactivo', 
      ruta_activa: null,
      cupos_disponibles: 4 // Restablecer cupos al finalizar turno
    }).eq('id', conductorData.id);
`;
if (mapaContent.includes(`await supabaseClient.from('conductores').update({ estado: 'inactivo' }).eq('id', conductorData.id);`)) {
    mapaContent = mapaContent.replace(
        `await supabaseClient.from('conductores').update({ estado: 'inactivo' }).eq('id', conductorData.id);`,
        limpiarRutaActivaJS
    );
}

// Al FINALIZAR viaje de un pasajero (cambiarEstadoPasajero -> 'completado'), devolverle 1 cupo
const addCuposJS = `
      // Si el pasajero se bajó (completado), liberamos 1 cupo
      if (nuevoEstado === 'completado') {
         const { data: currentConductor } = await supabaseClient.from('conductores').select('cupos_disponibles').eq('id', conductorData.id).single();
         if (currentConductor) {
             const nuevosCupos = Math.min(4, (currentConductor.cupos_disponibles || 0) + 1);
             await supabaseClient.from('conductores').update({ cupos_disponibles: nuevosCupos }).eq('id', conductorData.id);
         }
      }
`;
if (!mapaContent.includes(`if (nuevoEstado === 'completado') {`)) {
    mapaContent = mapaContent.replace(
        `showToast(nuevoEstado === 'a_bordo' ? 'Pasajero recogido' : 'Viaje finalizado');`,
        `showToast(nuevoEstado === 'a_bordo' ? 'Pasajero recogido' : 'Viaje finalizado');\n${addCuposJS}`
    );
}

// ==========================================
// 2. PASAJERO: reservar-viaje.html
// ==========================================
const loadFixedRoutesJS = `
        // CARGAR RUTAS ESTABLECIDAS
        let rutasActivasLayer = null;
        async function cargarRutasEstablecidas() {
            try {
                if (!map) return;
                const { data: conductoresActivos, error } = await supabaseClient
                    .from('conductores')
                    .select('nombres, ruta_activa')
                    .eq('estado', 'activo')
                    .not('ruta_activa', 'is', null);
                    
                if (error) throw error;
                
                if (rutasActivasLayer) map.removeLayer(rutasActivasLayer);
                rutasActivasLayer = L.layerGroup().addTo(map);
                
                conductoresActivos.forEach(cond => {
                    if (cond.ruta_activa && cond.ruta_activa.coordinates) {
                        const coords = cond.ruta_activa.coordinates.map(c => [c[1], c[0]]);
                        L.polyline(coords, {
                            color: '#3b82f6', // Azul para indicar rutas disponibles
                            weight: 4,
                            opacity: 0.6,
                            dashArray: '5, 10'
                        }).addTo(rutasActivasLayer).bindPopup(\`Ruta Activa: <b>\${cond.nombres}</b>\`);
                    }
                });
            } catch (err) {
                console.error("Error cargando rutas fijas:", err);
            }
        }
`;

if (!reservarContent.includes('cargarRutasEstablecidas()')) {
    reservarContent = reservarContent.replace(
        `async function requestMicrophone() {`,
        `${loadFixedRoutesJS}\n\n        async function requestMicrophone() {`
    );
    
    reservarContent = reservarContent.replace(
        `await iniciarMapa();`,
        `await iniciarMapa();\n            await cargarRutasEstablecidas();`
    );
}


// ==========================================
// 3. ADMIN / COORDINADOR: Validar Cupos al Asignar
// ==========================================

const patchAdmin = (content) => {
    // Al asignar, validar que cupos_disponibles > 0 y luego restar 1
    const asignarLogicOld = `const { error } = await supabaseClient.from('viajes_reservados').update({
          conductor_asignado_id: id,
          estado: 'asignado',
          estado_pasajero: 'asignado'
        }).eq('id', viajeId);`;
        
    const asignarLogicNew = `
        // Verificar cupos del conductor
        const { data: condData } = await supabaseClient.from('conductores').select('cupos_disponibles').eq('id', id).single();
        if (condData && condData.cupos_disponibles <= 0) {
            showToast('El conductor no tiene cupos disponibles (Max 4)', 'error');
            return; // Bloquea la asignación
        }
        
        const { error } = await supabaseClient.from('viajes_reservados').update({
          conductor_asignado_id: id,
          estado: 'asignado',
          estado_pasajero: 'asignado'
        }).eq('id', viajeId);
        
        if (!error && condData) {
            // Restar un cupo
            await supabaseClient.from('conductores').update({ cupos_disponibles: condData.cupos_disponibles - 1 }).eq('id', id);
        }
    `;
    
    // There are a few instances of assigning in admin (from dragging, or from dropdowns, or waitlist)
    // We will do a generic replacement for the basic assign flow in the trips board
    if (content.includes(asignarLogicOld)) {
        content = content.replace(asignarLogicOld, asignarLogicNew);
    }
    
    // Al despachar desde la zona de espera (Waitlist Modal)
    const despacharOld = `const { error: viajeError } = await supabaseClient.from('viajes_reservados').insert({
          conductor_asignado_id: currentDespachoInfo.conductorId,`;
          
    const despacharNew = `
        const { data: condDataDespacho } = await supabaseClient.from('conductores').select('cupos_disponibles').eq('id', currentDespachoInfo.conductorId).single();
        if (condDataDespacho && condDataDespacho.cupos_disponibles <= 0) {
            showToast('El conductor ya está lleno (0 cupos)', 'error');
            hideLoading();
            return;
        }
        
        const { error: viajeError } = await supabaseClient.from('viajes_reservados').insert({
          conductor_asignado_id: currentDespachoInfo.conductorId,`;
          
    if (content.includes(despacharOld) && !content.includes('condDataDespacho')) {
        content = content.replace(despacharOld, despacharNew);
        
        // After insert, decrease
        const postInsert = `const { error: deleteError } = await supabaseClient.from('lista_espera')`;
        const postInsertNew = `
        if (!viajeError && condDataDespacho) {
            await supabaseClient.from('conductores').update({ cupos_disponibles: condDataDespacho.cupos_disponibles - 1 }).eq('id', currentDespachoInfo.conductorId);
        }
        const { error: deleteError } = await supabaseClient.from('lista_espera')`;
        content = content.replace(postInsert, postInsertNew);
    }
    
    return content;
};

adminContent = patchAdmin(adminContent);
coordContent = patchAdmin(coordContent);


fs.writeFileSync(mapaPath, mapaContent);
fs.writeFileSync(reservarPath, reservarContent);
fs.writeFileSync(adminPath, adminContent);
fs.writeFileSync(coordPath, coordContent);
console.log('Carpooling logic patched across all files');
