const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'panel-admin.html');
const coordPath = path.join(__dirname, '..', 'src', 'panel-coordinador.html');

let adminContent = fs.readFileSync(adminPath, 'utf8');
let coordContent = fs.readFileSync(coordPath, 'utf8');

// ==========================================
// PANEL ADMIN
// ==========================================

const adminToggleHTML = `
    <!-- ESTADO DE PERMISOS MAPA FLOTA -->
    <div class="permissions-card" style="margin-top: 15px;">
      <div class="permissions-info">
        <h4>🗺️ Permiso de Mapa de Flota</h4>
        <p>Habilitar o deshabilitar que los coordinadores puedan ver la Torre de Control.</p>
      </div>
      <div class="switch-container">
        <span class="switch-label" id="labelPermisoMapaFlota">Habilitado</span>
        <div class="switch-main active" id="permisoMapaFlotaSwitch" onclick="togglePermisoMapaFlotaClick()">
          <div class="switch-thumb-main"></div>
        </div>
      </div>
    </div>
`;

if (!adminContent.includes('Permiso de Mapa de Flota')) {
  adminContent = adminContent.replace(
    `      </div>\n    </div>\n\n    <!-- CONDUCTORES SECTION -->`,
    `      </div>\n    </div>\n${adminToggleHTML}\n    <!-- CONDUCTORES SECTION -->`
  );
}

if (!adminContent.includes('let permFlotaCoordinadores')) {
  adminContent = adminContent.replace(
    `let permCoordinadoresEditar = false;`,
    `let permCoordinadoresEditar = false;\n    let permFlotaCoordinadores = true;`
  );
}

const adminJsLogic = `
    // CONTROL DE PERMISO MAPA FLOTA COORDINADORES
    async function togglePermisoMapaFlotaClick() {
      permFlotaCoordinadores = !permFlotaCoordinadores;
      const sw = document.getElementById('permisoMapaFlotaSwitch');
      const lbl = document.getElementById('labelPermisoMapaFlota');
      
      if (permFlotaCoordinadores) {
        sw.classList.add('active');
        lbl.textContent = "Habilitado";
        lbl.style.color = "#4ade80";
      } else {
        sw.classList.remove('active');
        lbl.textContent = "Deshabilitado";
        lbl.style.color = "#ef4444";
      }

      showLoading('Guardando configuración...');
      const { error } = await supabaseClient
        .from('coordinadores')
        .upsert({
          id: '11111111-1111-1111-1111-111111111111',
          nombres: 'Config_Permiso_Mapa_Flota',
          apellidos: 'Permisos',
          celular: permFlotaCoordinadores ? 'true' : 'false',
          email: 'permisos_flota@roadto.app'
        }, { onConflict: 'id' });
      hideLoading();

      if (error) {
        showToast('Error al guardar permisos: ' + error.message, 'error');
      } else {
        showToast('Permiso actualizado con éxito', 'success');
      }
    }

    async function cargarPermisoMapaFlota() {
      try {
        const { data } = await supabaseClient
          .from('coordinadores')
          .select('celular')
          .eq('id', '11111111-1111-1111-1111-111111111111')
          .maybeSingle();

        if (data) {
          permFlotaCoordinadores = data.celular === 'true';
          const sw = document.getElementById('permisoMapaFlotaSwitch');
          const lbl = document.getElementById('labelPermisoMapaFlota');
          if (permFlotaCoordinadores) {
            sw.classList.add('active');
            lbl.textContent = "Habilitado";
            lbl.style.color = "#4ade80";
          } else {
            sw.classList.remove('active');
            lbl.textContent = "Deshabilitado";
            lbl.style.color = "#ef4444";
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
`;

if (!adminContent.includes('togglePermisoMapaFlotaClick')) {
  adminContent = adminContent.replace(
    `async function obtenerEmailDesdeAuth(authUserId)`,
    `${adminJsLogic}\n    async function obtenerEmailDesdeAuth(authUserId)`
  );
}

if (!adminContent.includes('cargarPermisoMapaFlota();')) {
  adminContent = adminContent.replace(
    `cargarPermisosCoordinadores();\n        await refreshData();`,
    `cargarPermisosCoordinadores();\n        await cargarPermisoMapaFlota();\n        await refreshData();`
  );
}


// ==========================================
// PANEL COORDINADOR
// ==========================================

const coordJsLogic = `
    // CARGAR PERMISOS MAPA DE FLOTA DESDE ADMIN
    async function checkFlotaPermission() {
      try {
        const { data } = await supabaseClient
          .from('coordinadores')
          .select('celular')
          .eq('id', '11111111-1111-1111-1111-111111111111')
          .maybeSingle();
        
        const isEnabled = !data || data.celular === 'true'; // Por defecto true si no existe
        
        const tabBtn = document.querySelector('button[onclick="switchSection(\\'flota\\', this)"]');
        if (tabBtn) {
          if (!isEnabled) {
            tabBtn.style.display = 'none';
            // Si estaba activo, cambiar a viajes
            if (tabBtn.classList.contains('active')) {
               const defaultTab = document.querySelector('button[onclick="switchSection(\\'viajes\\', this)"]');
               if (defaultTab) defaultTab.click();
            }
          } else {
            tabBtn.style.display = 'inline-block';
          }
        }
      } catch (err) {
        console.error('Error revisando permisos:', err);
      }
    }
`;

if (!coordContent.includes('checkFlotaPermission()')) {
  coordContent = coordContent.replace(
    `async function cargarPermisos() {`,
    `${coordJsLogic}\n    async function cargarPermisos() {`
  );
  
  coordContent = coordContent.replace(
    `await cargarPermisos();\n        await refreshData();`,
    `await cargarPermisos();\n        await checkFlotaPermission();\n        await refreshData();`
  );
}

fs.writeFileSync(adminPath, adminContent);
fs.writeFileSync(coordPath, coordContent);
console.log('Patch de permisos aplicado con éxito.');
