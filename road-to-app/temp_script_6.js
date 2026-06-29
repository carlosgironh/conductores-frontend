
    const SUPABASE_URL = "https://ugchmuhjzzyofoogprlr.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnY2htdWhqenp5b2Zvb2dwcmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODUyNDQsImV4cCI6MjA4NTY2MTI0NH0.kB4ZjPhfP29JL6apWFKrXfW-AwnsCKHfmVsBUVjPsX4";
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let allConductores = [];
    let allPasajeros = [];
    let allViajes = [];
    let currentFilter = 'todos';
    let currentFilterPasajeros = 'todos';
    let currentFilterViajes = 'todos';
    let conductorEditId = null;
    let conductorEditActivo = null;
    let conductorEditAviso = false;
    let pasajeroEditId = null;
    let pasajeroEditActivo = null;
    const emailCache = new Map();

    let permCoordinadoresEditar = false;

    // QR & Pago vars
    let currentQRConductor = null;
    let currentQRDataUrl = null;
    let paymentDetailConductorId = null;
    const PAYMENT_CONFIG = { duracionHoras: 24, monto: 5.00, moneda: 'USD' };

    function showLoading(text = 'Cargando...') {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.querySelector('.loading-text').textContent = text;
        overlay.classList.add('show');
      }
    }

    function hideLoading() {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) overlay.classList.remove('show');
    }

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = message;
      toast.className = `toast ${type}`;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function goBack() { window.history.back(); }
    function goHome() { window.location.href = 'index.html'; }

    // CONTROL DE PERMISOS COORDINADORES
    async function togglePermisoCoordinadoresClick() {
      permCoordinadoresEditar = !permCoordinadoresEditar;
      const sw = document.getElementById('permisoCoordinadoresSwitch');
      const lbl = document.getElementById('labelPermisoCoord');
      
      if (permCoordinadoresEditar) {
        sw.classList.add('active');
        lbl.textContent = "Habilitado";
        lbl.style.color = "#4ade80";
      } else {
        sw.classList.remove('active');
        lbl.textContent = "Deshabilitado";
        lbl.style.color = "#ef4444";
      }

      showLoading('Guardando permisos...');
      const { error } = await supabaseClient
        .from('coordinadores')
        .upsert({
          id: '00000000-0000-0000-0000-000000000000',
          nombres: 'Config_Permiso_Editar',
          apellidos: 'Permisos',
          celular: permCoordinadoresEditar ? 'true' : 'false',
          email: 'permisos_coordinador@roadto.app'
        }, { onConflict: 'id' });
      hideLoading();

      if (error) {
        showToast('Error al guardar permisos: ' + error.message, 'error');
      } else {
        showToast('Permisos de coordinadores actualizados con éxito', 'success');
      }
    }

    async function cargarPermisosCoordinadores() {
      try {
        const { data, error } = await supabaseClient
          .from('coordinadores')
          .select('celular')
          .eq('id', '00000000-0000-0000-0000-000000000000')
          .maybeSingle();

        if (data) {
          permCoordinadoresEditar = data.celular === 'true';
          const sw = document.getElementById('permisoCoordinadoresSwitch');
          const lbl = document.getElementById('labelPermisoCoord');
          if (permCoordinadoresEditar) {
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
        console.error("Error loading coordinator permissions:", e);
      }
    }

    // VERIFICACIÓN ADMIN
    async function verificarAdmin() {
      showLoading('Verificando acceso...');
      try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
          window.location.href = "index.html";
          return;
        }

        const { data: adminData } = await supabaseClient
          .from('admins')
          .select('auth_user_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (!adminData) {
          window.location.href = "perfil.html";
          return;
        }

        await cargarPermisosCoordinadores();
        await refreshData();
        hideLoading();
      } catch (error) {
        hideLoading();
        showToast('Error de conexión', 'error');
      }
    }

    async function obtenerEmailDesdeAuth(authUserId) {
      if (!authUserId) return "No registrado";
      if (emailCache.has(authUserId)) return emailCache.get(authUserId);
      try {
        const { data, error } = await supabaseClient.rpc('get_user_email', { user_id: authUserId });
        if (error) {
          const { data: condData } = await supabaseClient.from("conductores").select("email").eq("auth_user_id", authUserId).single();
          if (condData?.email) {
            emailCache.set(authUserId, condData.email);
            return condData.email;
          }
          return "No disponible";
        }
        emailCache.set(authUserId, data || "No disponible");
        return data || "No disponible";
      } catch (e) {
        return "Error";
      }
    }

    // ═══ REALTIME: LISTA ESPERA (FASE 3) ═══
    function initAdminRealtime() {
      // Escuchar INSERTS en lista_espera para notificar al admin
      const listaEsperaChannel = supabaseClient.channel('admin-lista-espera')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'lista_espera' },
          (payload) => {
            // Notificar al administrador visualmente
            showToast('🔔 Un conductor ha entrado a una zona de espera.', 'success');
            
            // Si el modal de lista de espera está abierto de esa zona, refrescarlo
            if (window.currentZonaIdLista && window.currentZonaIdLista === payload.new.zona_id) {
              verListaEspera(payload.new.zona_id);
            }
          }
        )
        .subscribe();
    }

    function switchSection(section, btn) {
      document.querySelectorAll('.section-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
      document.getElementById(section + 'Section').classList.add('active');

      if (section === 'zonas' && !window.adminMapInstance) {
        // Inicializar mapa si es la primera vez que entramos
        setTimeout(initZonasMap, 100);
      } else if (section === 'zonas' && window.adminMapInstance) {
        setTimeout(() => window.adminMapInstance.invalidateSize(), 100);
      }
    }

    // CONDUCTORES MANAGEMENT
    async function cargarConductores() {
      const { data, error } = await supabaseClient.from('conductores').select('*').order('created_at', { ascending: false });
      if (!error) allConductores = data || [];
    }

    function obtenerEstadoConductor(c) {
      return c.estado === true || c.estado === 'activo' ? 'activo' : 'inactivo';
    }

    function verificarSuscripcionActiva(c) {
      if (!c.fecha_vencimiento) return false;
      return new Date(c.fecha_vencimiento) > new Date();
    }

    function renderPaymentIndicator(c) {
      if (!c.fecha_vencimiento) return `<span class="payment-indicator pending">⏳ Sin pago</span>`;
      const activa = verificarSuscripcionActiva(c);
      if (activa) {
        const ms = new Date(c.fecha_vencimiento) - new Date();
        const hrs = Math.max(0, Math.floor(ms / 3600000));
        return `<span class="payment-indicator paid">✅ Pago al día</span><br><span class="countdown-small active">${hrs} hrs rest.</span>`;
      }
      return `<span class="payment-indicator expired">❌ Vencido</span>`;
    }

    async function renderTable() {
      const tbody = document.getElementById('conductoresTable');
      let filtered = allConductores;

      if (currentFilter === 'con_pago') {
        filtered = allConductores.filter(c => verificarSuscripcionActiva(c));
      } else if (currentFilter === 'sin_pago') {
        filtered = allConductores.filter(c => !verificarSuscripcionActiva(c));
      } else if (currentFilter !== 'todos') {
        filtered = allConductores.filter(c => obtenerEstadoConductor(c) === currentFilter);
      }

      const q = document.getElementById('searchConductores').value.toLowerCase().trim();
      if (q) {
        filtered = filtered.filter(c => 
          `${c.nombres} ${c.apellidos}`.toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.cedula || '').toLowerCase().includes(q) ||
          (c.placa || '').toLowerCase().includes(q)
        );
      }

      tbody.innerHTML = '';
      for (const c of filtered) {
        const estado = obtenerEstadoConductor(c);
        const email = c.email || await obtenerEmailDesdeAuth(c.auth_user_id);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="status-badge ${estado}">${estado}</span></td>
          <td><div class="conductor-name">${c.nombres} ${c.apellidos}</div></td>
          <td><div class="conductor-email">${email}</div></td>
          <td style="color:#60a5fa">${c.marca || ''} ${c.modelo || ''} (${c.placa || ''})</td>
          <td>${renderPaymentIndicator(c)}</td>
          <td>
            <div class="actions">
              <button class="action-btn view" onclick="window.open('perfil_publico.html?id=${c.id}', '_blank')" title="Ver Perfil">👁️</button>
              <button class="action-btn edit" onclick="openEditModal('${c.id}')" title="Editar Conductor">✏️</button>
              <button class="action-btn qr" onclick="generateQR('${c.id}')" title="Generar Código QR">📱</button>
              <button class="action-btn toggle ${estado === 'inactivo' ? 'inactive' : ''}" onclick="toggleEstado('${c.id}')" title="Habilitar/Deshabilitar">🔄</button>
              <button class="action-btn qr" onclick="openPaymentDetailModal('${c.id}')" title="Estado de Pago">💳</button>
              <button class="action-btn delete" onclick="deleteConductor('${c.id}')" title="Eliminar permanentemente">🗑️</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      }
      updateStats();
    }

    function updateStats() {
      document.getElementById('totalCount').textContent = allConductores.length;
      document.getElementById('activeCount').textContent = allConductores.filter(c => obtenerEstadoConductor(c) === 'activo').length;
      document.getElementById('paidCount').textContent = allConductores.filter(c => verificarSuscripcionActiva(c)).length;
      document.getElementById('expiredCount').textContent = allConductores.filter(c => !verificarSuscripcionActiva(c)).length;
    }

    async function toggleEstado(id) {
      const c = allConductores.find(x => x.id === id);
      if (!c) return;
      const estado = obtenerEstadoConductor(c);
      const nuevo = estado === 'activo' ? false : true;
      let motivo = null;

      if (nuevo === false) {
        motivo = prompt('Ingrese motivo de desactivación:');
        if (!motivo) return;
      }

      showLoading('Actualizando estado...');
      const { error } = await supabaseClient.from('conductores').update({ estado: nuevo, motivo_desactivacion: motivo }).eq('id', id);
      hideLoading();
      if (!error) {
        showToast('Estado actualizado correctamente', 'success');
        await cargarConductores();
        await renderTable();
      } else {
        showToast(error.message, 'error');
      }
    }

    function filterConductores(f, btn) {
      currentFilter = f;
      document.querySelectorAll('#conductoresSection .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTable();
    }

    // PASAJEROS GESTION
    async function cargarPasajeros() {
      const { data, error } = await supabaseClient.from('passengers').select('*').order('created_at', { ascending: false });
      if (!error) allPasajeros = data || [];
    }

    function obtenerEstadoPasajero(p) {
      return p.status === 'active' ? 'active' : 'inactive';
    }

    async function renderTablePasajeros() {
      const tbody = document.getElementById('pasajerosTable');
      let filtered = allPasajeros;
      const q = document.getElementById('searchPasajeros').value.toLowerCase().trim();

      if (currentFilterPasajeros !== 'todos') {
        filtered = allPasajeros.filter(p => obtenerEstadoPasajero(p) === currentFilterPasajeros);
      }

      if (q) {
        filtered = filtered.filter(p => 
          `${p.nombres} ${p.apellidos}`.toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.celular || '').includes(q)
        );
      }

      tbody.innerHTML = '';
      for (const p of filtered) {
        const est = obtenerEstadoPasajero(p);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="status-badge ${est === 'active' ? 'active' : 'inactive'}">${est}</span></td>
          <td><div class="conductor-name">${p.nombres} ${p.apellidos}</div></td>
          <td>${p.email || 'Sin email'}</td>
          <td>${p.celular || '-'}</td>
          <td>
            <div class="actions">
              <button class="action-btn edit" onclick="openEditModalPasajero('${p.id}')" title="Editar Pasajero">✏️</button>
              <button class="action-btn delete" onclick="deletePasajero('${p.id}')" title="Eliminar Pasajero">🗑️</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      }
      updateStatsPasajeros();
    }

    function updateStatsPasajeros() {
      document.getElementById('totalCountPasajeros').textContent = allPasajeros.length;
      document.getElementById('activeCountPasajeros').textContent = allPasajeros.filter(p => p.status === 'active').length;
      document.getElementById('pendingCountPasajeros').textContent = allPasajeros.filter(p => p.status === 'pending').length;
      document.getElementById('inactiveCountPasajeros').textContent = allPasajeros.filter(p => p.status === 'inactive').length;
    }

    function filterPasajeros(f, btn) {
      currentFilterPasajeros = f;
      document.querySelectorAll('#pasajerosSection .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTablePasajeros();
    }

    // VIAJES GESTION & BLOCK/UNLOCK LOGIC
    async function cargarViajes() {
      const { data, error } = await supabaseClient.from('viajes_reservados').select('*').order('created_at', { ascending: false });
      if (!error) allViajes = data || [];
    }

    async function bloquearViajeAdmin(viajeId) {
      const viaje = allViajes.find(v => v.id === viajeId);
      if (!viaje) return;
      if (viaje.estado.startsWith('bloqueado_')) {
        showToast('El viaje ya está bloqueado', 'warning');
        return;
      }
      const confirmado = confirm('¿Deseas BLOQUEAR este viaje? Los coordinadores no podrán modificarlo.');
      if (!confirmado) return;
      showLoading('Bloqueando viaje...');
      try {
        const { error } = await supabaseClient
          .from('viajes_reservados')
          .update({
            estado: 'bloqueado_' + viaje.estado,
            updated_at: new Date().toISOString()
          })
          .eq('id', viajeId);
        if (error) throw error;
        showToast('Viaje bloqueado con éxito', 'success');
        await cargarViajes();
        await renderViajesList();
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
      } finally {
        hideLoading();
      }
    }

    async function desbloquearViajeAdmin(viajeId) {
      const viaje = allViajes.find(v => v.id === viajeId);
      if (!viaje) return;
      if (!viaje.estado.startsWith('bloqueado_')) {
        showToast('El viaje no está bloqueado', 'warning');
        return;
      }
      const confirmado = confirm('¿Deseas DESBLOQUEAR este viaje? Los coordinadores volverán a tener control.');
      if (!confirmado) return;
      showLoading('Desbloqueando...');
      try {
        const originalEstado = viaje.estado.replace('bloqueado_', '');
        const { error } = await supabaseClient
          .from('viajes_reservados')
          .update({
            estado: originalEstado,
            updated_at: new Date().toISOString()
          })
          .eq('id', viajeId);
        if (error) throw error;
        showToast('Viaje desbloqueado con éxito', 'success');
        await cargarViajes();
        await renderViajesList();
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
      } finally {
        hideLoading();
      }
    }

    function renderViajesList() {
      const list = document.getElementById('viajesList');
      let filtered = allViajes;
      const q = document.getElementById('searchViajes').value.toLowerCase().trim();

      if (currentFilterViajes !== 'todos') {
        filtered = allViajes.filter(v => {
          const isBlocked = v.estado.startsWith('bloqueado_');
          const cleanEstado = isBlocked ? v.estado.replace('bloqueado_', '') : v.estado;
          return cleanEstado === currentFilterViajes;
        });
      }

      if (q) {
        filtered = filtered.filter(v => 
          (v.origen || '').toLowerCase().includes(q) ||
          (v.destino || '').toLowerCase().includes(q)
        );
      }

      list.innerHTML = '';
      if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:20px;color:#64748b">No hay viajes registrados.</div>`;
        return;
      }

      for (const v of filtered) {
        const isBlocked = v.estado.startsWith('bloqueado_');
        const cleanEstado = isBlocked ? v.estado.replace('bloqueado_', '') : v.estado;

        const div = document.createElement('div');
        div.className = `viaje-item ${isBlocked ? 'bloqueado' : cleanEstado}`;
        div.innerHTML = `
          <div class="viaje-route">
            <span class="origin">📍 ${v.origen}</span>
            <span class="arrow">→</span>
            <span class="destiny">🏁 ${v.destino}</span>
          </div>
          <div class="viaje-meta">
            <span>📅 ${new Date(v.fecha_hora).toLocaleString()}</span>
            <span class="status-badge ${isBlocked ? 'bloqueado' : cleanEstado}">
              ${isBlocked ? '🔒 Bloqueado' : cleanEstado.toUpperCase()}
            </span>
          </div>
          <div class="viaje-actions">
            <button class="action-btn view" onclick="viewViajeDetailAdmin('${v.id}')" title="Ver Detalle">👁️</button>
            ${isBlocked ? `
              <button class="action-btn unlock" onclick="desbloquearViajeAdmin('${v.id}')" title="Desbloquear Viaje" style="font-size:16px">🔓</button>
            ` : `
              <button class="action-btn lock" onclick="bloquearViajeAdmin('${v.id}')" title="Bloquear Viaje" style="font-size:16px">🔒</button>
            `}
            <button class="action-btn delete" onclick="deleteViajeAdmin('${v.id}')" title="Eliminar Viaje">🗑️</button>
          </div>
        `;
        list.appendChild(div);
      }
      updateStatsViajes();
    }

    function updateStatsViajes() {
      document.getElementById('totalCountViajes').textContent = allViajes.length;
      document.getElementById('pendienteCountViajes').textContent = allViajes.filter(v => v.estado.includes('pendiente')).length;
      document.getElementById('asignadoCountViajes').textContent = allViajes.filter(v => v.estado.includes('asignado')).length;
      document.getElementById('completadoCountViajes').textContent = allViajes.filter(v => v.estado.includes('completado')).length;
    }

    function filterViajes(f, btn) {
      currentFilterViajes = f;
      document.querySelectorAll('#viajesSection .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderViajesList();
    }

    // GENERAL ADMIN ACTIONS
    async function openEditModal(id) {
      conductorEditId = id;
      showLoading('Cargando conductor...');
      const { data, error } = await supabaseClient.from('conductores').select('*').eq('id', id).single();
      if (!error && data) {
        document.getElementById('editId').value = data.id;
        document.getElementById('editEmail').value = data.email || 'No disponible';
        document.getElementById('editNombres').value = data.nombres || '';
        document.getElementById('editApellidos').value = data.apellidos || '';
        document.getElementById('editCelular').value = data.celular || '';
        document.getElementById('editCedula').value = data.cedula || '';
        document.getElementById('editDireccion').value = data.direccion || '';
        document.getElementById('editLicencia').value = data.licencia || '';
        document.getElementById('editPlaca').value = data.placa || '';
        document.getElementById('editMarca').value = data.marca || '';
        document.getElementById('editModelo').value = data.modelo || '';
        document.getElementById('editColor').value = data.color || '';
        document.getElementById('editPoliza').value = data.poliza_numero || '';
        document.getElementById('editMotivo').value = data.motivo_desactivacion || '';

        conductorEditActivo = obtenerEstadoConductor(data) === 'activo';
        conductorEditAviso = data.tiene_aviso_operaciones === true;
        const sw = document.getElementById('modalAvisoSwitch');
        if (conductorEditAviso) sw.classList.add('active');
        else sw.classList.remove('active');

        // Clear files inputs
        const fileInputs = [
          'editCedulaDoc', 'editLicenciaDoc', 'editRegistroDoc', 'editPolizaDoc',
          'editFotoVehiculo', 'editFotoConductor', 'editAuthPropietario', 'editAvisoOperaciones', 'editRecordPolicivo'
        ];
        fileInputs.forEach(fid => {
          const el = document.getElementById(fid);
          if (el) el.value = '';
        });

        // Load documents
        await cargarDocumentosConductor(id);

        hideLoading();
        document.getElementById('editModal').classList.add('show');
      } else {
        hideLoading();
        showToast('Error al cargar conductor', 'error');
      }
    }

    function closeEditModal() {
      document.getElementById('editModal').classList.remove('show');
    }

    async function cargarDocumentosConductor(conductorId) {
      const container = document.getElementById('documentosExistentes');
      if (!container) return;
      container.innerHTML = '<div style="color:#a1a1aa">Cargando documentos...</div>';

      const { data: docs, error } = await supabaseClient
        .from('documentos')
        .select('*')
        .eq('conductor_id', conductorId);

      if (error) {
        container.innerHTML = `<div style="color:#ef4444">Error al cargar documentos: ${error.message}</div>`;
        return;
      }

      if (!docs || docs.length === 0) {
        container.innerHTML = '<div style="color:#a1a1aa;font-style:italic">No hay documentos registrados para este conductor.</div>';
        return;
      }

      const tipoNombres = {
        cedula: 'Cédula',
        licencia: 'Licencia de Conducir',
        registro_vehicular: 'Registro Vehicular',
        poliza: 'Póliza de Seguro',
        foto_vehiculo: 'Foto del Vehículo',
        foto_conductor: 'Foto del Conductor',
        auth_propietario: 'Autorización de Propietario',
        aviso_operaciones: 'Aviso de Operaciones',
        record_policivo: 'Record Policivo'
      };

      container.innerHTML = '';
      docs.forEach(doc => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px 12px';
        item.style.background = '#18181b';
        item.style.borderRadius = '6px';
        item.style.marginBottom = '6px';
        item.style.border = '1px solid #27272a';

        const info = document.createElement('div');
        info.innerHTML = `<strong style="color:#f4f4f5">${tipoNombres[doc.tipo] || doc.tipo}</strong><br><span style="font-size:11px;color:#71717a">Subido: ${new Date(doc.created_at).toLocaleDateString()}</span>`;

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';

        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'btn-success';
        viewBtn.style.padding = '4px 8px';
        viewBtn.style.fontSize = '12px';
        viewBtn.textContent = '👁️ Ver';
        viewBtn.onclick = () => {
          const url = obtenerDocumentoURL(doc);
          window.open(url, '_blank');
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-danger';
        deleteBtn.style.padding = '4px 8px';
        deleteBtn.style.fontSize = '12px';
        deleteBtn.textContent = '🗑️';
        deleteBtn.onclick = () => eliminarDocumento(doc.id, doc.path, conductorId);

        actions.appendChild(viewBtn);
        actions.appendChild(deleteBtn);
        item.appendChild(info);
        item.appendChild(actions);
        container.appendChild(item);
      });
    }

    function obtenerDocumentoURL(doc) {
      if (!doc.path) return '#';
      if (doc.path.startsWith('http://') || doc.path.startsWith('https://') || doc.path.startsWith('data:')) {
        return doc.path;
      }
      const { data } = supabaseClient.storage.from('documentos').getPublicUrl(doc.path);
      return data?.publicUrl || doc.path;
    }

    async function subirDocumento(conductorId, tipo, file) {
      const fileName = `${conductorId}_${tipo}_${Date.now()}_${file.name}`;
      
      try {
        const { data, error } = await supabaseClient.storage.from('documentos').upload(fileName, file, { cacheControl: '3600', upsert: true });
        if (!error && data) {
          const { data: urlData } = supabaseClient.storage.from('documentos').getPublicUrl(fileName);
          const publicUrl = urlData?.publicUrl || fileName;
          const { error: dbError } = await supabaseClient.from('documentos').insert({
            conductor_id: conductorId,
            tipo: tipo,
            path: publicUrl
          });
          if (dbError) throw dbError;
          return true;
        } else {
          console.warn('Storage upload failed, falling back to Base64:', error?.message);
          const base64Data = await fileToBase64(file);
          const { error: dbError } = await supabaseClient.from('documentos').insert({
            conductor_id: conductorId,
            tipo: tipo,
            path: base64Data
          });
          if (dbError) throw dbError;
          return true;
        }
      } catch (err) {
        console.error('Error uploading document:', err);
        try {
          const base64Data = await fileToBase64(file);
          const { error: dbError } = await supabaseClient.from('documentos').insert({
            conductor_id: conductorId,
            tipo: tipo,
            path: base64Data
          });
          if (dbError) throw dbError;
          return true;
        } catch (fallbackErr) {
          showToast(`Error al subir ${tipo}: ${fallbackErr.message || fallbackErr}`, 'error');
          return false;
        }
      }
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
    }

    async function eliminarDocumento(id, path, conductorId) {
      if (!confirm('¿Seguro de eliminar este documento?')) return;
      showLoading('Eliminando documento...');
      
      const { error: dbError } = await supabaseClient.from('documentos').delete().eq('id', id);
      if (dbError) {
        hideLoading();
        showToast('Error al eliminar: ' + dbError.message, 'error');
        return;
      }

      if (path && !path.startsWith('data:')) {
        try {
          const filename = path.substring(path.lastIndexOf('/') + 1);
          await supabaseClient.storage.from('documentos').remove([filename]);
        } catch (e) {
          console.warn('Could not delete file from storage:', e);
        }
      }

      await cargarDocumentosConductor(conductorId);
      hideLoading();
      showToast('Documento eliminado', 'success');
    }

    // PASSENGER ACTIONS
    async function openEditModalPasajero(id) {
      showLoading('Cargando pasajero...');
      const { data, error } = await supabaseClient.from('passengers').select('*').eq('id', id).single();
      hideLoading();
      if (!error && data) {
        document.getElementById('editPasajeroId').value = data.id;
        document.getElementById('editPasajeroEmail').value = data.email || 'No disponible';
        document.getElementById('editPasajeroNombres').value = data.nombres || '';
        document.getElementById('editPasajeroApellidos').value = data.apellidos || '';
        document.getElementById('editPasajeroCelular').value = data.celular || '';
        document.getElementById('editPasajeroCedula').value = data.cedula || '';
        document.getElementById('editPasajeroDireccion').value = data.direccion || '';

        const btnToggle = document.getElementById('btnToggleModalPasajero');
        if (btnToggle) {
          if (data.status === 'inactive' || data.status === 'disabled') {
            btnToggle.textContent = 'Habilitar';
            btnToggle.className = 'btn-success';
          } else {
            btnToggle.textContent = 'Deshabilitar';
            btnToggle.className = 'btn-warning';
          }
        }

        document.getElementById('editModalPasajero').classList.add('show');
      } else {
        showToast('Error al cargar pasajero', 'error');
      }
    }

    function closeEditModalPasajero() {
      document.getElementById('editModalPasajero').classList.remove('show');
    }

    async function toggleEstadoPasajeroDesdeModal() {
      const id = document.getElementById('editPasajeroId').value;
      const btnToggle = document.getElementById('btnToggleModalPasajero');
      const habilitar = btnToggle.textContent === 'Habilitar';
      const nuevoEstado = habilitar ? 'active' : 'inactive';

      showLoading('Actualizando estado...');
      const { error } = await supabaseClient.from('passengers').update({ status: nuevoEstado }).eq('id', id);
      hideLoading();

      if (!error) {
        showToast(`Pasajero ${habilitar ? 'habilitado' : 'deshabilitado'} con éxito`, 'success');
        closeEditModalPasajero();
        await refreshData();
      } else {
        showToast(error.message, 'error');
      }
    }

    async function deleteCurrentPasajero() {
      const id = document.getElementById('editPasajeroId').value;
      await deletePasajero(id);
      closeEditModalPasajero();
    }

    async function deletePasajero(id) {
      if (!confirm('¿Seguro de eliminar permanentemente a este pasajero?')) return;
      showLoading('Eliminando pasajero...');
      const { error } = await supabaseClient.from('passengers').delete().eq('id', id);
      hideLoading();

      if (!error) {
        showToast('Pasajero eliminado con éxito', 'success');
        await refreshData();
      } else {
        showToast(error.message, 'error');
      }
    }

    function toggleAvisoModal() {
      conductorEditAviso = !conductorEditAviso;
      const sw = document.getElementById('modalAvisoSwitch');
      if (conductorEditAviso) sw.classList.add('active');
      else sw.classList.remove('active');
    }

    async function deleteConductor(id) {
      if (!confirm('¿Seguro de eliminar permanentemente a este conductor? Se eliminarán todos sus documentos.')) return;
      showLoading('Eliminando...');
      const { error } = await supabaseClient.from('conductores').delete().eq('id', id);
      hideLoading();
      if (!error) {
        showToast('Conductor eliminado', 'success');
        await refreshData();
      } else {
        showToast(error.message, 'error');
      }
    }

    // MODAL PAGOS
    async function openPaymentDetailModal(conductorId) {
      paymentDetailConductorId = conductorId;
      const conductor = allConductores.find(c => c.id === conductorId);
      if (!conductor) return;

      const modal = document.getElementById('paymentDetailModal');
      const content = document.getElementById('paymentDetailContent');
      modal.classList.add('show');

      const activa = verificarSuscripcionActiva(conductor);
      content.innerHTML = `
        <div class="payment-detail-grid">
          <div class="payment-detail-item">
            <div class="payment-detail-label">Plan</div>
            <div class="payment-detail-value">${conductor.plan || 'Básico'}</div>
          </div>
          <div class="payment-detail-item">
            <div class="payment-detail-label">Vencimiento</div>
            <div class="payment-detail-value">${conductor.fecha_vencimiento ? new Date(conductor.fecha_vencimiento).toLocaleDateString() : 'N/A'}</div>
          </div>
        </div>
        <div style="text-align:center;margin-top:15px">
          ${!activa ? `<button class="btn-success" onclick="activarPagoManual('${conductorId}')">Activar suscripción (24h)</button>` : '<span style="color:#4ade80;font-weight:700">✅ Suscripción Activa</span>'}
        </div>
      `;
    }

    function closePaymentDetailModal() {
      document.getElementById('paymentDetailModal').classList.remove('show');
    }

    async function activarPagoManual(conductorId) {
      if (!confirm('¿Activar suscripción por 24 horas?')) return;
      showLoading('Activando...');
      const ahora = new Date();
      const vencimiento = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
      const { error } = await supabaseClient.from('conductores').update({
        fecha_vencimiento: vencimiento.toISOString(),
        payment_status: 'paid',
        pago_al_dia: true,
        suscripcion_activa: true
      }).eq('id', conductorId);
      hideLoading();
      if (!error) {
        showToast('Pago manual activado', 'success');
        closePaymentDetailModal();
        await refreshData();
      } else {
        showToast(error.message, 'error');
      }
    }

    // QR LOGIC
    function generateQR(id) {
      const c = allConductores.find(x => x.id === id);
      if (!c) return;
      const url = `${window.location.origin}/perfil_publico.html?id=${id}`;
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, url, { width: 250 }, (err) => {
        if (!err) {
          const qrContainer = document.getElementById('qrContainer');
          qrContainer.innerHTML = '';
          qrContainer.appendChild(canvas);
          document.getElementById('qrConductorInfo').innerHTML = `<strong>${c.nombres} ${c.apellidos}</strong><br>${c.email || ''}`;
          document.getElementById('qrModal').classList.add('show');
        }
      });
    }

    function closeQrModal() {
      document.getElementById('qrModal').classList.remove('show');
    }

    // REFRESH & UTILS
    async function refreshData() {
      showLoading('Actualizando...');
      await Promise.all([cargarConductores(), cargarPasajeros(), cargarViajes()]);
      await renderTable();
      await renderTablePasajeros();
      await renderViajesList();
      hideLoading();
    }

    async function logout() {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    }

    document.addEventListener('DOMContentLoaded', () => {
      verificarAdmin();
      initAdminRealtime();

      // Conductor Edit Form Submission
      const editForm = document.getElementById('editForm');
      if (editForm) {
        editForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const id = document.getElementById('editId').value;
          const nombres = document.getElementById('editNombres').value.trim();
          const apellidos = document.getElementById('editApellidos').value.trim();
          const celular = document.getElementById('editCelular').value.trim();
          const cedula = document.getElementById('editCedula').value.trim();
          const direccion = document.getElementById('editDireccion').value.trim();
          const licencia = document.getElementById('editLicencia').value.trim();
          const placa = document.getElementById('editPlaca').value.trim();
          const marca = document.getElementById('editMarca').value.trim();
          const modelo = document.getElementById('editModelo').value.trim();
          const color = document.getElementById('editColor').value.trim();
          const poliza_numero = document.getElementById('editPoliza').value.trim();
          const motivo_desactivacion = document.getElementById('editMotivo').value.trim();

          showLoading('Guardando cambios...');
          
          const { error } = await supabaseClient.from('conductores').update({
            nombres,
            apellidos,
            celular,
            cedula,
            direccion,
            licencia,
            placa,
            marca,
            modelo,
            color,
            poliza_numero,
            tiene_aviso_operaciones: conductorEditAviso,
            motivo_desactivacion,
            updated_at: new Date().toISOString()
          }).eq('id', id);

          if (error) {
            hideLoading();
            showToast('Error al actualizar conductor: ' + error.message, 'error');
            return;
          }

          // Upload files if any
          const filesToUpload = [
            { id: 'editCedulaDoc', tipo: 'cedula' },
            { id: 'editLicenciaDoc', tipo: 'licencia' },
            { id: 'editRegistroDoc', tipo: 'registro_vehicular' },
            { id: 'editPolizaDoc', tipo: 'poliza' },
            { id: 'editFotoVehiculo', tipo: 'foto_vehiculo' },
            { id: 'editFotoConductor', tipo: 'foto_conductor' },
            { id: 'editAuthPropietario', tipo: 'auth_propietario' },
            { id: 'editAvisoOperaciones', tipo: 'aviso_operaciones' },
            { id: 'editRecordPolicivo', tipo: 'record_policivo' }
          ];

          for (const item of filesToUpload) {
            const fileInput = document.getElementById(item.id);
            if (fileInput && fileInput.files && fileInput.files[0]) {
              showLoading(`Subiendo ${item.tipo}...`);
              await subirDocumento(id, item.tipo, fileInput.files[0]);
            }
          }

          hideLoading();
          showToast('Conductor actualizado con éxito!', 'success');
          closeEditModal();
          await refreshData();
        });
      }

      // Passenger Edit Form Submission
      const editFormPasajero = document.getElementById('editFormPasajero');
      if (editFormPasajero) {
        editFormPasajero.addEventListener('submit', async (e) => {
          e.preventDefault();
          const id = document.getElementById('editPasajeroId').value;
          const nombres = document.getElementById('editPasajeroNombres').value.trim();
          const apellidos = document.getElementById('editPasajeroApellidos').value.trim();
          const celular = document.getElementById('editPasajeroCelular').value.trim();
          const cedula = document.getElementById('editPasajeroCedula').value.trim();
          const direccion = document.getElementById('editPasajeroDireccion').value.trim();

          showLoading('Guardando cambios...');
          
          const { error } = await supabaseClient.from('passengers').update({
            nombres,
            apellidos,
            celular,
            cedula,
            direccion,
            updated_at: new Date().toISOString()
          }).eq('id', id);

          hideLoading();

          if (error) {
            showToast('Error al actualizar pasajero: ' + error.message, 'error');
          } else {
            showToast('Pasajero actualizado con éxito!', 'success');
            closeEditModalPasajero();
            await refreshData();
          }
        });
      }
    });
  
    // ========== FUNCIONES FALTANTES AÑADIDAS ==========
    let viajeIdParaAsignar = null;

    async function toggleDesdeModal() {
      if (!conductorEditId) return;
      const c = allConductores.find(x => x.id === conductorEditId);
      if (!c) return;
      const estado = obtenerEstadoConductor(c);
      const nuevo = estado === 'activo' ? false : true;
      let motivo = null;
      if (nuevo === false) {
        motivo = prompt('Ingrese motivo de desactivación:');
        if (!motivo) return;
      }
      showLoading('Actualizando estado...');
      try {
        const { error } = await supabaseClient.from('conductores').update({
          estado: nuevo,
          motivo_desactivacion: motivo,
          updated_at: new Date().toISOString()
        }).eq('id', conductorEditId);
        if (error) throw error;
        showToast('Estado actualizado correctamente', 'success');
        closeEditModal();
        await refreshData();
      } catch (e) {
        showToast(e.message || 'Error al actualizar estado', 'error');
      } finally {
        hideLoading();
      }
    }

    function deleteCurrentConductor() {
      if (!conductorEditId) return;
      deleteConductor(conductorEditId);
      closeEditModal();
    }

    async function viewViajeDetailAdmin(viajeId) {
      const v = allViajes.find(x => x.id === viajeId);
      if (!v) return;
      const isBlocked = v.estado && v.estado.startsWith('bloqueado_');
      const cleanEstado = isBlocked ? v.estado.replace('bloqueado_', '') : (v.estado || 'pendiente');
      alert(`📍 Origen: ${v.origen || '-'}
🏁 Destino: ${v.destino || '-'}
📅 Fecha: ${new Date(v.fecha_hora).toLocaleString()}
📊 Estado: ${isBlocked ? '🔒 BLOQUEADO - ' : ''}${cleanEstado.toUpperCase()}
👤 Pasajero ID: ${v.pasajero_id || '-'}
🚗 Conductor ID: ${v.conductor_asignado_id || 'Sin asignar'}
💰 Precio: ${v.precio || '-'}
📝 Notas: ${v.notas || '-'}`);
    }

    async function deleteViajeAdmin(viajeId) {
      if (!confirm('¿Seguro de eliminar permanentemente este viaje?')) return;
      showLoading('Eliminando viaje...');
      try {
        const { error } = await supabaseClient.from('viajes_reservados').delete().eq('id', viajeId);
        if (error) throw error;
        showToast('Viaje eliminado', 'success');
        await refreshData();
      } catch (e) {
        showToast(e.message || 'Error al eliminar viaje', 'error');
      } finally {
        hideLoading();
      }
    }

    function downloadQR() {
      const canvas = document.querySelector('#qrContainer canvas');
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `qr-conductor-${currentQRConductor?.id || 'roadto'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }

    async function sendQRByEmail() {
      showToast('Función de envío por email requiere configuración de servidor SMTP', 'warning');
    }

    // Modal asignar conductor (admin)
    function openAsignarModal(viajeId) {
      viajeIdParaAsignar = viajeId;
      renderConductoresDisponiblesAdmin();
      document.getElementById('asignarConductorModal').classList.add('show');
    }

    function renderConductoresDisponiblesAdmin() {
      const container = document.getElementById('conductoresDisponiblesList');
      const activos = allConductores.filter(c => c.estado === true || c.estado === 'activo');
      if (activos.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b">No hay conductores activos.</div>';
        return;
      }
      container.innerHTML = '';
      activos.forEach(c => {
        const div = document.createElement('div');
        div.className = 'conductor-select-item';
        div.onclick = () => seleccionarConductorAdmin(c.id);
        div.innerHTML = `
          <div class="avatar">${(c.nombres || '')[0]}${(c.apellidos || '')[0]}</div>
          <div class="info">
            <div class="name">${c.nombres || ''} ${c.apellidos || ''}</div>
            <div class="vehicle">${c.marca || ''} ${c.modelo || ''} (${c.placa || ''})</div>
          </div>
        `;
        container.appendChild(div);
      });
    }

    async function seleccionarConductorAdmin(id) {
      showLoading('Asignando conductor...');
      try {
        const { error } = await supabaseClient.from('viajes_reservados').update({
          conductor_asignado_id: id,
          estado: 'asignado',
          updated_at: new Date().toISOString()
        }).eq('id', viajeIdParaAsignar);
        if (error) throw error;
        showToast('Conductor asignado con éxito', 'success');
        closeAsignarModal();
        await refreshData();
      } catch (e) {
        showToast(e.message || 'Error al asignar conductor', 'error');
      } finally {
        hideLoading();
      }
    }

    function closeAsignarModal() {
      document.getElementById('asignarConductorModal').classList.remove('show');
    }

    // Cerrar modales con click fuera y tecla Escape
    document.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('show');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
      }
    });

    // ========== GEOFENCING (ZONAS ESPECIALES) ==========
    let allZonas = [];
    window.adminMapInstance = null;
    let selectedLatLng = null;
    let zonasLayers = [];

    async function cargarZonas() {
      const { data, error } = await supabaseClient.from('zonas_geofence').select('*').order('created_at', { ascending: false });
      if (!error) {
        allZonas = data || [];
      }
    }

    function initZonasMap() {
      if (window.adminMapInstance) return;
      window.adminMapInstance = L.map('adminMap').setView([10.4806, -66.9036], 12); // Caracas by default
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(window.adminMapInstance);

      window.adminMapInstance.on('click', function(e) {
        if (!document.getElementById('zonaModal').classList.contains('show')) {
          selectedLatLng = e.latlng;
          openCreateZonaModal();
        }
      });

      renderZonasEnMapa();
      renderZonasList();
    }

    function renderZonasEnMapa() {
      if (!window.adminMapInstance) return;
      zonasLayers.forEach(l => window.adminMapInstance.removeLayer(l));
      zonasLayers = [];

      allZonas.forEach(z => {
        if (!z.activa) return;
        const color = z.activa ? '#8ac725' : '#ef4444';
        const circle = L.circle([z.latitud, z.longitud], {
          color: color,
          fillColor: color,
          fillOpacity: 0.2,
          radius: z.radio_metros
        }).addTo(window.adminMapInstance);
        circle.bindPopup(`<b>${z.nombre}</b><br>Radio: ${z.radio_metros}m`);
        zonasLayers.push(circle);
      });
    }

    function openCreateZonaModal() {
      if (!selectedLatLng) {
        showToast('Haz clic en el mapa para seleccionar la ubicación de la zona', 'warning');
        return;
      }
      document.getElementById('zonaForm').reset();
      document.getElementById('zonaModal').classList.add('show');
    }

    function closeZonaModal() {
      document.getElementById('zonaModal').classList.remove('show');
      selectedLatLng = null;
    }

    async function saveZona(e) {
      e.preventDefault();
      if (!selectedLatLng) return;

      const nombre = document.getElementById('zonaNombre').value;
      const desc = document.getElementById('zonaDescripcion').value;
      const radio = parseFloat(document.getElementById('zonaRadio').value);

      showLoading('Guardando zona...');
      try {
        const { error } = await supabaseClient.from('zonas_geofence').insert({
          nombre: nombre,
          descripcion: desc,
          latitud: selectedLatLng.lat,
          longitud: selectedLatLng.lng,
          radio_metros: radio
        });
        if (error) throw error;
        
        showToast('Zona creada', 'success');
        closeZonaModal();
        await cargarZonas();
        renderZonasEnMapa();
        renderZonasList();
      } catch (err) {
        showToast('Error al crear zona', 'error');
      } finally {
        hideLoading();
      }
    }

    function renderZonasList() {
      const container = document.getElementById('zonasList');
      if (allZonas.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748b;">No hay zonas especiales creadas. Haz clic en el mapa para crear una.</div>';
        return;
      }
      container.innerHTML = '';
      allZonas.forEach(z => {
        const div = document.createElement('div');
        div.style.background = 'rgba(15, 23, 42, 0.4)';
        div.style.padding = '15px';
        div.style.marginBottom = '10px';
        div.style.borderRadius = '12px';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';

        const info = document.createElement('div');
        info.innerHTML = `<strong>${z.nombre}</strong><br><small style="color: #94a3b8">${z.descripcion || 'Sin desc'}</small><br><span style="color: #60a5fa; font-size: 12px;">Radio: ${z.radio_metros}m</span>`;
        
        const actions = document.createElement('div');
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-danger';
        deleteBtn.style.padding = '8px 12px';
        deleteBtn.innerHTML = 'Eliminar';
        deleteBtn.onclick = async () => {
          if (!confirm('¿Eliminar esta zona?')) return;
          showLoading('Eliminando...');
          await supabaseClient.from('zonas_geofence').delete().eq('id', z.id);
          hideLoading();
          await cargarZonas();
          renderZonasEnMapa();
          renderZonasList();
        };

        const viewListaBtn = document.createElement('button');
        viewListaBtn.className = 'btn-primary';
        viewListaBtn.style.padding = '8px 12px';
        viewListaBtn.style.marginLeft = '10px';
        viewListaBtn.innerHTML = 'Lista Espera';
        viewListaBtn.onclick = () => verListaEspera(z.id);

        actions.appendChild(deleteBtn);
        actions.appendChild(viewListaBtn);

        div.appendChild(info);
        div.appendChild(actions);
        container.appendChild(div);
      });
    }

    let currentZonaIdLista = null;
    
    function closeListaEsperaModal() {
      document.getElementById('listaEsperaModal').classList.remove('show');
      currentZonaIdLista = null;
    }

    async function verListaEspera(zonaId) {
      currentZonaIdLista = zonaId;
      document.getElementById('listaEsperaModal').classList.add('show');
      const container = document.getElementById('listaEsperaContainer');
      container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px;">Cargando conductores...</div>';
      
      try {
        const { data, error } = await supabaseClient
          .from('lista_espera')
          .select(`
            id,
            estado,
            conductor_id,
            conductores ( nombres, apellidos, vehiculo_marca, vehiculo_modelo, placa )
          `)
          .eq('zona_id', zonaId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        if (!data || data.length === 0) {
          container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px;">No hay conductores esperando en esta zona.</div>';
          return;
        }

        container.innerHTML = '';
        data.forEach(item => {
          const div = document.createElement('div');
          div.style.background = 'rgba(15, 23, 42, 0.4)';
          div.style.padding = '15px';
          div.style.marginBottom = '10px';
          div.style.borderRadius = '12px';
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.alignItems = 'center';

          const c = item.conductores;
          const conductorName = c ? `${c.nombres} ${c.apellidos}` : 'Conductor Desconocido';
          const vehicleInfo = c ? `${c.vehiculo_marca} ${c.vehiculo_modelo} (${c.placa})` : '';

          let estadoLabel = '';
          if (item.estado === 'esperando') {
             estadoLabel = '<span style="color: #fbbf24;">Esperando</span>';
          } else if (item.estado === 'aprobado') {
             estadoLabel = '<span style="color: #4ade80;">Aprobado</span>';
          } else {
             estadoLabel = `<span style="color: #f87171;">${item.estado}</span>`;
          }

          const info = document.createElement('div');
          info.innerHTML = `<strong>${conductorName}</strong><br><small style="color: #94a3b8">${vehicleInfo}</small><br>Estado: ${estadoLabel}`;
          
          const actions = document.createElement('div');
          
          if (item.estado === 'esperando') {
            const btnAprobar = document.createElement('button');
            btnAprobar.className = 'btn-success';
            btnAprobar.style.padding = '6px 10px';
            btnAprobar.style.fontSize = '12px';
            btnAprobar.innerHTML = 'Aprobar';
            btnAprobar.onclick = () => cambiarEstadoLista(item.id, 'aprobado');
            
            const btnRechazar = document.createElement('button');
            btnRechazar.className = 'btn-danger';
            btnRechazar.style.padding = '6px 10px';
            btnRechazar.style.fontSize = '12px';
            btnRechazar.style.marginLeft = '8px';
            btnRechazar.innerHTML = 'Rechazar';
            btnRechazar.onclick = () => cambiarEstadoLista(item.id, 'rechazado');
            
            actions.appendChild(btnAprobar);
            actions.appendChild(btnRechazar);
          } else {
            const btnReset = document.createElement('button');
            btnReset.className = 'btn-secondary';
            btnReset.style.padding = '6px 10px';
            btnReset.style.fontSize = '12px';
            btnReset.innerHTML = 'Resetear';
            btnReset.onclick = () => cambiarEstadoLista(item.id, 'esperando');
            actions.appendChild(btnReset);
          }

          div.appendChild(info);
          div.appendChild(actions);
          container.appendChild(div);
        });
      } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="color: #ef4444; padding: 20px; text-align: center;">Error al cargar lista</div>';
      }
    }

    async function cambiarEstadoLista(id, nuevoEstado) {
      showLoading('Actualizando estado...');
      try {
        const { error } = await supabaseClient
          .from('lista_espera')
          .update({ estado: nuevoEstado })
          .eq('id', id);
        if (error) throw error;
        showToast(`Estado cambiado a ${nuevoEstado}`, 'success');
        if (currentZonaIdLista) verListaEspera(currentZonaIdLista);
      } catch (err) {
        showToast('Error al actualizar estado', 'error');
      } finally {
        hideLoading();
      }
    }

    // Integrar la carga de zonas en refreshData()
    const originalRefreshDataForZonas = refreshData;
    refreshData = async function() {
      await originalRefreshDataForZonas();
      await cargarZonas();
      if (document.getElementById('zonasSection').classList.contains('active')) {
        renderZonasEnMapa();
        renderZonasList();
      }
    };
  