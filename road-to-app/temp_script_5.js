
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

  