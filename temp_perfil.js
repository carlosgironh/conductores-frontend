

const supabaseClient = window.RoadTo.createSupabase();

let perfilCache = null;
let documentosCache = null;

function initConnectivity() {
  const indicator = document.getElementById('offlineIndicator');
  
  function updateOnlineStatus() {
    if (navigator.onLine) {
      indicator.classList.remove('show');
      showToast('Conexión restaurada');
      if (perfilCache === null) {
        cargarPerfil();
      }
    } else {
      indicator.classList.add('show');
      showToast('Modo offline - Usando datos en caché');
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  if (!navigator.onLine) {
    indicator.classList.add('show');
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function renderStatusBanner(estado, motivoDeshabilitado = '') {
  const card = document.getElementById('mainCard');
  const existingBanner = document.querySelector('.status-banner');
  
  if (existingBanner) {
    existingBanner.remove();
  }
  
  let bannerHTML = '';
  const estadoStr = String(estado).toLowerCase();
  
  if (estadoStr === 'true' || estadoStr === 'activo') {
    bannerHTML = `
      <div class="status-banner active">
        <svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="status-content">
          <div class="status-title">
            Cuenta Verificada
            <span class="status-check">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
              </svg>
              Activo
            </span>
          </div>
          <div class="status-message">Su cuenta está completamente habilitada.</div>
        </div>
      </div>
    `;
  } else if (estadoStr === 'pendiente' || estadoStr === 'revision') {
    bannerHTML = `
      <div class="status-banner pending">
        <svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="status-content">
          <div class="status-title">
            Verificación Pendiente
            <span class="status-check">En Revisión</span>
          </div>
          <div class="status-message">Su documentación está siendo revisada (24h hábiles).</div>
        </div>
      </div>
    `;
  } else {
    bannerHTML = `
      <div class="status-banner inactive">
        <svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <div class="status-content">
          <div class="status-title">
            Cuenta Deshabilitada
            <span class="status-check">Inactivo</span>
          </div>
          <div class="status-message">${motivoDeshabilitado || 'Contacte soporte para más información.'}</div>
        </div>
      </div>
    `;
  }
  
  card.insertAdjacentHTML('afterbegin', bannerHTML);
}

async function cargarPerfil() {
  try {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      window.location.href = "index.html";
      return;
    }

    if (!navigator.onLine && perfilCache) {
      renderPerfil(perfilCache, documentosCache, user);
      return;
    }

    const { data: conductor, error: condError } = await supabaseClient
      .from("conductores")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();

    if (condError || !conductor) {
      throw new Error('No se encontró el perfil');
    }

    const { data: documentos } = await supabaseClient
      .from("documentos")
      .select("*")
      .eq("conductor_id", conductor.id);

    perfilCache = conductor;
    documentosCache = documentos;

    await renderPerfil(conductor, documentos, user);

  } catch (error) {
    console.error("Error ocurrido en el cliente", "Contacte a soporte");
    
    if (perfilCache) {
      showToast('Error de conexión - Mostrando datos guardados');
      renderPerfil(perfilCache, documentosCache, { email: perfilCache.email || 'Usuario' });
      return;
    }
    
    document.getElementById("contenido").innerHTML = `
      <div style="text-align: center; padding: 40px; color: #f87171;">
        <p>Error al cargar el perfil. Intente nuevamente.</p>
        <button onclick="cargarPerfil()" style="margin-top: 20px;">Reintentar</button>
      </div>
    `;
  }
}

async function listarDocumentosBucket(conductorId) {
  try {
    const { data: files, error } = await supabaseClient
      .storage
      .from("documentos-conductores")
      .list(conductorId, { limit: 100 });
    if (error || !files || files.length === 0) {
      /* log removed */
      return [];
    }
    /* log removed */

    const tipoMap = {
      'cedula': 'CEDULA',
      'licencia': 'LICENCIA',
      'registro': 'REGISTRO',
      'poliza': 'POLIZA',
      'foto_conductor': 'FOTO_CONDUCTOR',
      'foto_vehiculo': 'FOTO_VEHICULO',
      'aviso_operaciones': 'AVISO_OPERACIONES',
      'auth_propietario': 'AUTH_PROPIETARIO'
    };

    return files.map(f => {
      const lowerName = f.name.toLowerCase();
      let tipo = null;
      for (const prefix in tipoMap) {
        if (lowerName.startsWith(prefix + '_') || lowerName.startsWith(prefix + '.')) {
          tipo = tipoMap[prefix];
          break;
        }
      }
      return {
        tipo: tipo || 'OTRO',
        url_archivo: conductorId + '/' + f.name,
        name: f.name
      };
    }).filter(d => d.tipo !== 'OTRO');
  } catch (e) {
    console.error("Error ocurrido en el cliente", "Contacte a soporte");
    return [];
  }
}

async function docUrl(tipo, documentos) {
  const doc = documentos?.find(d => d.tipo === tipo);
  if (!doc) return null;
  try {
    const { data: signedUrl, error } = await supabaseClient
      .storage
      .from("documentos-conductores")
      .createSignedUrl(doc.url_archivo, 3600);
    if (error) {
      console.error(`[PERFIL] Error signedUrl ${tipo}:`, error.message);
      return null;
    }
    /* log removed */
    return signedUrl.signedUrl;
  } catch (e) {
    console.error("Error ocurrido en el cliente", "Contacte a soporte");
    return null;
  }
}

async function renderPerfil(conductor, documentosDB, user) {
  renderStatusBanner(conductor.estado, conductor.motivo_deshabilitado || conductor.motivo_desactivacion);
  /* log removed */

  // Fallback: if table is empty, read directly from bucket
  let documentos = documentosDB;
  if (!documentos || documentos.length === 0) {
    /* log removed */
    documentos = await listarDocumentosBucket(conductor.id);
    /* log removed */
  }

  // Pre-resolve all document URLs
  const urls = {};
  const tipos = ["CEDULA", "LICENCIA", "REGISTRO", "POLIZA", "AUTH_PROPIETARIO", "FOTO_VEHICULO", "FOTO_CONDUCTOR", "AVISO_OPERACIONES"];
  for (const tipo of tipos) {
    urls[tipo] = await docUrl(tipo, documentos);
  }

  const tieneAviso = conductor.tiene_aviso_operaciones === true;
  const avisoUrl = urls['AVISO_OPERACIONES'];

  document.getElementById("contenido").innerHTML = `
    <div class="campo"><strong>Nombre</strong> <span>${conductor.nombres} ${conductor.apellidos}</span></div>
    <div class="campo"><strong>Cédula</strong> <span>${conductor.cedula}</span></div>
    <div class="campo"><strong>Licencia</strong> <span>${conductor.licencia}</span></div>
    <div class="campo"><strong>Vehículo</strong> <span>${conductor.marca} ${conductor.modelo}</span></div>
    <div class="campo"><strong>Placa</strong> <span>${conductor.placa}</span></div>
    <div class="campo"><strong>Color</strong> <span>${conductor.color}</span></div>
    <div class="campo"><strong>Póliza</strong> <span>${conductor.poliza_numero}</span></div>
    <div class="campo">
      <strong>Aviso Operaciones</strong> 
      <span>
        ${tieneAviso ? 
          `<span class="aviso-badge si">✓ Sí</span>` : 
          `<span class="aviso-badge no">✕ No</span>`
        }
      </span>
    </div>
    <div class="campo"><strong>Correo</strong> <span>${user.email}</span></div>
    <div class="campo"><strong>Teléfono</strong> <span>${conductor.celular}</span></div>
  `;

  const fotosCont = document.getElementById("fotos-container");
  fotosCont.innerHTML = "";

  const fotoVeh = urls['FOTO_VEHICULO'];
  const fotoCond = urls['FOTO_CONDUCTOR'];

  if (fotoVeh) {
    fotosCont.innerHTML += `
      <div class="foto-wrapper" onclick="mostrarModalPreview('${fotoVeh}', 'img')">
        <img src="${fotoVeh}" class="foto" alt="Vehículo" loading="lazy">
        <div class="foto-label">Vehículo</div>
      </div>
    `;
  }

  if (fotoCond) {
    fotosCont.innerHTML += `
      <div class="foto-wrapper" onclick="mostrarModalPreview('${fotoCond}', 'img')">
        <img src="${fotoCond}" class="foto" alt="Conductor" loading="lazy">
        <div class="foto-label">Conductor</div>
      </div>
    `;
  }

  const docSection = document.getElementById("documentos-section");
  const docGrid = document.getElementById("documentos-grid");
  docGrid.innerHTML = "";

  // ===== CONTROL DE ACTUALIZACIÓN POR ADMIN =====
  const puedeActualizar = conductor.permitir_actualizar === true;
  const btnUpdate = document.getElementById('btnUpdate');
  const updateBlocked = document.getElementById('updateBlocked');

  if (puedeActualizar) {
    btnUpdate.classList.remove('hidden');
    if (updateBlocked) updateBlocked.style.display = 'none';
  } else {
    btnUpdate.classList.add('hidden');
    if (updateBlocked) updateBlocked.style.display = 'flex';
  }

  const documentosConfig = [
    { tipo: "CEDULA", label: "Cédula" },
    { tipo: "LICENCIA", label: "Licencia" },
    { tipo: "REGISTRO", label: "Registro" },
    { tipo: "POLIZA", label: "Seguro" },
    { tipo: "AUTH_PROPIETARIO", label: "Autorización" }
  ];

  let tieneDocumentos = false;

  documentosConfig.forEach(doc => {
    const url = urls[doc.tipo];
    if (url) {
      tieneDocumentos = true;
      const isPdf = url.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        docGrid.innerHTML += `
          <div class="doc-preview" onclick="mostrarModalPreview('${url}', 'pdf')">
            <div class="doc-preview-pdf">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span>PDF</span>
            </div>
            <div class="doc-preview-label">${doc.label}</div>
            <div class="doc-preview-overlay"><span>Ver</span></div>
          </div>
        `;
      } else {
        docGrid.innerHTML += `
          <div class="doc-preview" onclick="mostrarModalPreview('${url}', 'img')">
            <img src="${url}" class="doc-preview-img" alt="${doc.label}" loading="lazy">
            <div class="doc-preview-label">${doc.label}</div>
            <div class="doc-preview-overlay"><span>Ver</span></div>
          </div>
        `;
      }
    }
  });

  if (tieneAviso && avisoUrl) {
    tieneDocumentos = true;
    const isPdf = avisoUrl.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      docGrid.innerHTML += `
        <div class="doc-preview" onclick="mostrarModalPreview('${avisoUrl}', 'pdf')">
          <div class="doc-preview-pdf">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span>PDF</span>
          </div>
          <div class="doc-preview-label">Aviso de Operaciones</div>
          <div class="doc-preview-overlay"><span>Ver</span></div>
        </div>
      `;
    } else {
      docGrid.innerHTML += `
        <div class="doc-preview" onclick="mostrarModalPreview('${avisoUrl}', 'img')">
          <img src="${avisoUrl}" class="doc-preview-img" alt="Aviso de Operaciones" loading="lazy">
          <div class="doc-preview-label">Aviso de Operaciones</div>
          <div class="doc-preview-overlay"><span>Ver</span></div>
        </div>
      `;
    }
  }

  if (tieneDocumentos) {
    docSection.style.display = "block";
  } else {
    docSection.style.display = "block";
    docGrid.innerHTML = `
      <div class="doc-empty">
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-bottom: 12px; opacity: 0.5;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p>No hay documentos registrados</p>
      </div>
    `;
  }

  // ELIMINADO: generarQR(conductor.id);
}

// ELIMINADAS: funciones generarQR() y descargarQR()

function mostrarModal(src) {
  const modal = document.getElementById("modalFoto");
  const img = document.getElementById("modalImg");
  img.src = src;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function cerrarModal() {
  document.getElementById("modalFoto").style.display = "none";
  document.body.style.overflow = "";
}

function mostrarModalPreview(src, type) {
  const modal = document.getElementById("modalPreview");
  const img = document.getElementById("modalImg");
  const pdf = document.getElementById("modalPdf");

  if (type === 'pdf') {
    img.style.display = 'none';
    pdf.style.display = 'block';
    pdf.src = src;
  } else {
    pdf.style.display = 'none';
    img.style.display = 'block';
    img.src = src;
  }

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function cerrarModalPreview() {
  document.getElementById("modalPreview").style.display = "none";
  document.body.style.overflow = "";
}

function irAPanel() {
  document.body.style.opacity = "0.5";
  setTimeout(() => {
    window.location.href = "panel-usuario.html";
  }, 200);
}

if (window.Capacitor) {
  window.addEventListener('keyboardWillShow', () => {
    document.body.style.height = window.innerHeight + 'px';
  });
  
  window.addEventListener('keyboardWillHide', () => {
    document.body.style.height = '';
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initConnectivity();
  cargarPerfil();
});

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);
