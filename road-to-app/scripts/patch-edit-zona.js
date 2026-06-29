const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'panel-admin.html');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Añadir editZonaId si no existe
if (!content.includes('let editZonaId = null;')) {
  content = content.replace(
    `let selectedLatLng = null;`,
    `let selectedLatLng = null;\n    let editZonaId = null;`
  );
}

// 2. Modificar openCreateZonaModal
if (!content.includes("document.getElementById('zonaModalTitle').textContent = 'Nueva Zona Especial';")) {
  content = content.replace(
    `    function openCreateZonaModal() {\n      if (!selectedLatLng) {\n        showToast('Haz clic en el mapa para seleccionar la ubicación de la zona', 'warning');\n        return;\n      }\n      document.getElementById('zonaForm').reset();\n      document.getElementById('zonaModal').classList.add('show');\n    }`,
    `    function openCreateZonaModal() {\n      if (!selectedLatLng) {\n        showToast('Haz clic en el mapa para seleccionar la ubicación de la zona', 'warning');\n        return;\n      }\n      editZonaId = null;\n      document.getElementById('zonaModalTitle').textContent = 'Nueva Zona Especial';\n      document.getElementById('zonaForm').reset();\n      document.getElementById('zonaModal').classList.add('show');\n    }`
  );
}

// 3. Crear openEditZonaModal
const editFunction = `
    function openEditZonaModal(id) {
      const zona = allZonas.find(z => z.id === id);
      if(!zona) return;
      
      editZonaId = zona.id;
      selectedLatLng = { lat: zona.latitud, lng: zona.longitud };
      
      document.getElementById('zonaModalTitle').textContent = 'Editar Zona Especial';
      document.getElementById('zonaNombre').value = zona.nombre || '';
      document.getElementById('zonaDescripcion').value = zona.descripcion || '';
      document.getElementById('zonaRadio').value = zona.radio_metros || 1500;
      
      document.getElementById('zonaModal').classList.add('show');
    }
`;
if (!content.includes('function openEditZonaModal(id)')) {
  content = content.replace(
    `function closeZonaModal() {`,
    `${editFunction}\n    function closeZonaModal() {`
  );
}

// 4. Modificar saveZona para soportar Update
if (!content.includes('if (editZonaId) {')) {
  // Encontramos el bloque insert original y lo reemplazamos por if/else
  const originalInsert = `const { error } = await supabaseClient.from('zonas_geofence').insert({
          nombre: nombre,
          descripcion: desc,
          latitud: selectedLatLng.lat,
          longitud: selectedLatLng.lng,
          radio_metros: radio
        });`;
        
  const newUpsert = `let error;
        if (editZonaId) {
          const res = await supabaseClient.from('zonas_geofence').update({
            nombre: nombre,
            descripcion: desc,
            radio_metros: radio
          }).eq('id', editZonaId);
          error = res.error;
        } else {
          const res = await supabaseClient.from('zonas_geofence').insert({
            nombre: nombre,
            descripcion: desc,
            latitud: selectedLatLng.lat,
            longitud: selectedLatLng.lng,
            radio_metros: radio
          });
          error = res.error;
        }`;
        
  content = content.replace(originalInsert, newUpsert);
}

// 5. Modificar renderZonasList para incluir el botón Editar
if (!content.includes("editBtn.innerHTML = '✏️';")) {
  const btnGroup = `        const deleteBtn = document.createElement('button');`;
  
  const editBtnLogic = `        const editBtn = document.createElement('button');
        editBtn.className = 'btn-secondary';
        editBtn.style.padding = '8px 12px';
        editBtn.style.marginRight = '5px';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Editar Zona';
        editBtn.onclick = () => openEditZonaModal(z.id);
        
        const deleteBtn = document.createElement('button');`;
        
  content = content.replace(btnGroup, editBtnLogic);
  
  content = content.replace(
    `actions.appendChild(deleteBtn);`,
    `actions.appendChild(editBtn);\n        actions.appendChild(deleteBtn);`
  );
}

fs.writeFileSync(adminPath, content);
console.log('Patch edit zona aplicado con éxito');
