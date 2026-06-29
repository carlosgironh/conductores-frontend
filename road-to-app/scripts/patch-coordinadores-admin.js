const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'panel-admin.html');
const coordPath = path.join(__dirname, '..', 'src', 'panel-coordinador.html');

let adminContent = fs.readFileSync(adminPath, 'utf8');
let coordContent = fs.readFileSync(coordPath, 'utf8');

// ==========================================
// 1. PANEL ADMIN: PESTAÑA Y SECCIÓN
// ==========================================

const coordTabHtml = `<button class="section-tab" onclick="switchSection('gestionCoordinadores', this)">👔 Coordinadores</button>`;
if (!adminContent.includes("switchSection('gestionCoordinadores'")) {
  adminContent = adminContent.replace(
    `<button class="section-tab" onclick="switchSection('flota', this)">📊 Estado de Flota</button>`,
    `<button class="section-tab" onclick="switchSection('flota', this)">📊 Estado de Flota</button>\n        ${coordTabHtml}`
  );
}

const gestionCoordSectionHtml = `
    <!-- GESTION COORDINADORES SECTION -->
    <div id="gestionCoordinadoresSection" class="section-content" style="display: none;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3>Gestión de Coordinadores</h3>
        <button class="btn-primary" onclick="openRegistroCoordModal()">+ Nuevo Coordinador</button>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Correo</th>
              <th>Edición/Eliminación</th>
              <th>Mapa Torre de Control</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="coordinadoresGestTable">
            <tr><td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">Cargando coordinadores...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
`;

if (!adminContent.includes('id="gestionCoordinadoresSection"')) {
  adminContent = adminContent.replace(
    `<!-- CONFIGURACIÓN DE PERMISOS PARA COORDINADORES -->`,
    `${gestionCoordSectionHtml}\n\n    <!-- CONFIGURACIÓN DE PERMISOS PARA COORDINADORES -->`
  );
}

const coordModalHtml = `
  <!-- MODAL REGISTRO COORDINADOR -->
  <div class="modal-overlay centered" id="registroCoordModal">
    <div class="modal-content" style="max-width: 500px;">
      <button class="modal-close" onclick="closeRegistroCoordModal()">✕</button>
      <div class="modal-header">
        <h3 class="modal-title">👔 Nuevo Coordinador</h3>
      </div>
      <form id="registroCoordForm" onsubmit="saveNuevoCoordinador(event)">
        <div class="form-group">
          <label>Nombres *</label>
          <input type="text" id="coordNombres" required placeholder="Ej: Juan">
        </div>
        <div class="form-group">
          <label>Apellidos *</label>
          <input type="text" id="coordApellidos" required placeholder="Ej: Pérez">
        </div>
        <div class="form-group">
          <label>Celular</label>
          <input type="text" id="coordCelular" placeholder="Ej: +50761234567">
        </div>
        <div class="form-group">
          <label>Correo Electrónico * (Se usará para iniciar sesión)</label>
          <input type="email" id="coordEmail" required placeholder="correo@ejemplo.com">
        </div>
        <div class="form-group">
          <label>Contraseña Temporal *</label>
          <input type="text" id="coordPassword" required placeholder="Ej: password123">
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
          <button type="button" class="btn-secondary" onclick="closeRegistroCoordModal()">Cancelar</button>
          <button type="submit" class="btn-success">Crear Cuenta</button>
        </div>
      </form>
    </div>
  </div>
`;

if (!adminContent.includes('id="registroCoordModal"')) {
  adminContent = adminContent.replace(
    `<!-- Modal Zona -->`,
    `${coordModalHtml}\n\n  <!-- Modal Zona -->`
  );
}


// ==========================================
// 2. PANEL ADMIN: LÓGICA JS
// ==========================================

const coordJsLogic = `
    let allCoordinadores = [];

    async function renderGestionCoordinadores() {
      const tbody = document.getElementById('coordinadoresGestTable');
      try {
        // Excluimos los IDs globales antiguos si existen
        const { data, error } = await supabaseClient.from('coordinadores').select('*')
          .neq('id', '00000000-0000-0000-0000-000000000000')
          .neq('id', '11111111-1111-1111-1111-111111111111');
          
        if (error) throw error;
        allCoordinadores = data;
        
        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay coordinadores registrados</td></tr>';
          return;
        }
        
        tbody.innerHTML = '';
        data.forEach(c => {
          const tr = document.createElement('tr');
          const permEditarChecked = c.perm_editar ? 'checked' : '';
          const permFlotaChecked = c.perm_flota ? 'checked' : '';
          
          tr.innerHTML = \`
            <td><strong>\${c.nombres} \${c.apellidos}</strong><br><small style="color: #94a3b8;">\${c.celular || 'Sin celular'}</small></td>
            <td>\${c.email}</td>
            <td>
              <label class="switch-mini" style="display: inline-block; vertical-align: middle;">
                <input type="checkbox" \${permEditarChecked} onchange="updatePermisoCoord('\${c.id}', 'perm_editar', this.checked)">
                <span class="slider round" style="width: 34px; height: 20px; position: relative;"></span>
              </label>
            </td>
            <td>
              <label class="switch-mini" style="display: inline-block; vertical-align: middle;">
                <input type="checkbox" \${permFlotaChecked} onchange="updatePermisoCoord('\${c.id}', 'perm_flota', this.checked)">
                <span class="slider round" style="width: 34px; height: 20px; position: relative;"></span>
              </label>
            </td>
            <td>
              <button class="btn-danger" style="padding: 5px 10px; font-size: 12px;" onclick="eliminarCoordinador('\${c.id}', '\${c.nombres}')">🗑️ Eliminar</button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">Error al cargar coordinadores</td></tr>';
      }
    }

    async function updatePermisoCoord(id, campo, valor) {
      const payload = {};
      payload[campo] = valor;
      const { error } = await supabaseClient.from('coordinadores').update(payload).eq('id', id);
      if (error) {
        showToast('Error al actualizar permiso', 'error');
      } else {
        showToast('Permiso actualizado', 'success');
      }
    }

    function openRegistroCoordModal() { document.getElementById('registroCoordForm').reset(); document.getElementById('registroCoordModal').classList.add('show'); }
    function closeRegistroCoordModal() { document.getElementById('registroCoordModal').classList.remove('show'); }

    async function saveNuevoCoordinador(e) {
      e.preventDefault();
      const nombres = document.getElementById('coordNombres').value;
      const apellidos = document.getElementById('coordApellidos').value;
      const celular = document.getElementById('coordCelular').value;
      const email = document.getElementById('coordEmail').value;
      const password = document.getElementById('coordPassword').value;
      
      showLoading('Creando cuenta de coordinador...');
      try {
        // Creamos la cuenta en Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email, password });
        if (authError) throw authError;
        
        const userId = authData.user ? authData.user.id : null;
        if (!userId) throw new Error("No se pudo obtener el ID del usuario creado.");

        // Insertamos en la tabla de coordinadores
        const { error: dbError } = await supabaseClient.from('coordinadores').insert({
          id: userId,
          nombres: nombres,
          apellidos: apellidos,
          celular: celular,
          email: email,
          perm_editar: true,
          perm_flota: true
        });
        if (dbError) throw dbError;
        
        showToast('Coordinador registrado con éxito', 'success');
        closeRegistroCoordModal();
        renderGestionCoordinadores();
      } catch (err) {
        console.error(err);
        showToast('Error al crear: ' + err.message, 'error');
      } finally {
        hideLoading();
      }
    }

    async function eliminarCoordinador(id, nombre) {
      if(!confirm('¿Estás seguro de que deseas eliminar permanentemente al coordinador ' + nombre + '?')) return;
      showLoading('Eliminando...');
      try {
        const { error } = await supabaseClient.from('coordinadores').delete().eq('id', id);
        if (error) throw error;
        showToast('Coordinador eliminado', 'success');
        renderGestionCoordinadores();
      } catch (err) {
        showToast('Error al eliminar: ' + err.message, 'error');
      } finally {
        hideLoading();
      }
    }
`;

if (!adminContent.includes('async function renderGestionCoordinadores()')) {
  adminContent = adminContent.replace(
    `async function renderData() {`,
    `${coordJsLogic}\n\n    async function renderData() {`
  );
  
  // Agregarlo a switchSection si gestionCoordinadores está activo
  adminContent = adminContent.replace(
    `if (section === 'zonas') { renderZonasEnMapa(); renderZonasList(); }`,
    `if (section === 'zonas') { renderZonasEnMapa(); renderZonasList(); }\n      if (section === 'gestionCoordinadores') { renderGestionCoordinadores(); }`
  );
}


// ==========================================
// 3. PANEL ADMIN: ELIMINAR SISTEMA GLOBAL VIEJO
// ==========================================

// Quitamos la caja de permisos de editar
adminContent = adminContent.replace(/<div class="permissions-card">[\s\S]*?id="permisoCoordinadoresSwitch"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '');

// Quitamos la caja de flota
adminContent = adminContent.replace(/<div class="permissions-card"[^>]*>[\s\S]*?id="permisoMapaFlotaSwitch"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '');

// Evitar llamadas viejas en window.onload o setup
adminContent = adminContent.replace(`cargarPermisosCoordinadores();`, `// cargarPermisosCoordinadores();`);
adminContent = adminContent.replace(`await cargarPermisoMapaFlota();`, `// await cargarPermisoMapaFlota();`);


// ==========================================
// 4. PANEL COORDINADOR: LEER PERMISOS INDIVIDUALES
// ==========================================

const coordPermisosJsLogic = `
    let permCoordinadorEditar = false;
    let permCoordinadorFlota = false;

    async function cargarPermisosIndividuales() {
      try {
        const { data: authData } = await supabaseClient.auth.getUser();
        if (!authData || !authData.user) return;
        
        const { data, error } = await supabaseClient
          .from('coordinadores')
          .select('perm_editar, perm_flota')
          .eq('id', authData.user.id)
          .maybeSingle();
          
        if (data) {
          permCoordinadorEditar = !!data.perm_editar;
          permCoordinadorFlota = !!data.perm_flota;
        }

        // Aplicar restricciones UI - FLOTA
        const tabBtnFlota = document.querySelector('button[onclick="switchSection(\\'flota\\', this)"]');
        if (tabBtnFlota) {
          if (!permCoordinadorFlota) {
            tabBtnFlota.style.display = 'none';
            if (tabBtnFlota.classList.contains('active')) {
               const defaultTab = document.querySelector('button[onclick="switchSection(\\'viajes\\', this)"]');
               if (defaultTab) defaultTab.click();
            }
          } else {
            tabBtnFlota.style.display = 'inline-block';
          }
        }

        // Aplicar restricciones UI - EDICIÓN VIAJES Y CONDUCTORES
        if (!permCoordinadorEditar) {
           // Si no tiene permisos de edición, se pueden ocultar botones de asignar/cancelar/editar
           // Por el momento ocultamos los botones de las acciones en renderTablaConductores y renderViajesList 
           // sobre-escribiendo la lógica en esas funciones más adelante.
           permCoordinadoresEditar = false; // Actualizamos la variable global antigua para no reescribir todo
        } else {
           permCoordinadoresEditar = true;
        }

      } catch (err) {
        console.error('Error cargando permisos individuales:', err);
      }
    }
`;

if (!coordContent.includes('async function cargarPermisosIndividuales()')) {
  coordContent = coordContent.replace(
    `async function checkFlotaPermission() {`,
    `${coordPermisosJsLogic}\n\n    async function checkFlotaPermission() {`
  );
  
  coordContent = coordContent.replace(
    `await cargarPermisos();\n        await checkFlotaPermission();`,
    `await cargarPermisosIndividuales(); // Se reemplaza el chequeo antiguo`
  );
}

fs.writeFileSync(adminPath, adminContent);
fs.writeFileSync(coordPath, coordContent);
console.log('Admin & Coord UI patched');
