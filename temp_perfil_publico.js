

const supabaseClient = window.RoadTo.createSupabase();

async function cargarPerfil() {
  const urlParams = new URLSearchParams(window.location.search);
  const conductorId = urlParams.get('id');

  if (!conductorId) {
    mostrarError("ID no especificado", "No se proporcionó un identificador de conductor válido en la URL.");
    return;
  }

  try {
    const { data: conductor, error } = await supabaseClient
      .from("conductores")
      .select("*")
      .eq("id", conductorId)
      .single();

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('permission') || error.message?.includes('JWT') || error.message?.includes('auth')) {
        throw new Error('RLS_BLOCK');
      }
      throw error;
    }

    if (!conductor) {
      throw new Error('NOT_FOUND');
    }

    const { data: documentos, error: docError } = await supabaseClient
      .from("documentos")
      .select("*")
      .eq("conductor_id", conductor.id);

    /* log removed */
    /* log removed */

    // Cargar estado de pago desde tabla pagos
    const { data: pagos } = await supabaseClient
      .from("pagos")
      .select("*")
      .eq("conductor_id", conductor.id)
      .order("created_at", { ascending: false })
      .limit(1);

    await renderPerfil(conductor, documentos, pagos);

  } catch (error) {
    console.error("Error ocurrido en el cliente", "Contacte a soporte");

    if (error.message === 'RLS_BLOCK' || error.code === 'PGRST116' || error.message?.includes('permission')) {
      mostrarError(
        "Acceso restringido",
        "Este perfil requiere configuración de permisos públicos en la base de datos. El administrador debe habilitar la lectura anónima (RLS) para la tabla de conductores y documentos."
      );
    } else if (error.message === 'NOT_FOUND') {
      mostrarError("Conductor no encontrado", "No existe un conductor registrado con el ID proporcionado.");
    } else {
      mostrarError("Error al cargar", "No se pudieron obtener los datos del conductor. Verifica tu conexión e intenta de nuevo.");
    }
  }
}

function mostrarError(titulo, mensaje) {
  document.getElementById("contenido").innerHTML = `
    <div class="error-box">
      <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-bottom: 16px; opacity: 0.8;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
      <h3>${titulo}</h3>
      <p>${mensaje}</p>
    </div>
  `;
  document.getElementById("fotos-container").style.display = 'none';
  document.getElementById("documentos-section").style.display = 'none';
  document.getElementById("statusHero").style.display = 'none';
  document.getElementById("paymentStatus").style.display = 'none';
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
      console.error(`[PUBLICO] Error signedUrl ${tipo}:`, error.message);
      return null;
    }
    /* log removed */
    return signedUrl.signedUrl;
  } catch (e) {
    console.error("Error ocurrido en el cliente", "Contacte a soporte");
    return null;
  }
}

async function renderPerfil(conductor, documentosDB, pagos) {
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

  // ===== ESTADO DE PAGO =====
  // Primero verificar campos del conductor (actualizados por backend IPN)
  const ahora = new Date();
  const suscripcionActiva = conductor.suscripcion_activa === true;
  const pagoAlDia = conductor.pago_al_dia === true;
  const paymentStatus = conductor.payment_status || 'pending';
  const fechaVencCond = conductor.fecha_vencimiento || conductor.proximo_pago;
  const fechaVenc = fechaVencCond ? new Date(fechaVencCond) : null;
  const diasRestantes = fechaVenc ? Math.ceil((fechaVenc - ahora) / (1000 * 60 * 60 * 24)) : null;

  // También verificar tabla pagos como respaldo
  const ultimoPago = pagos && pagos.length > 0 ? pagos[0] : null;
  const pagoPagado = ultimoPago && ultimoPago.estado === 'pagado';

  let paymentHTML = '';

  // Lógica: si conductor dice que está activo Y no ha vencido = PAID
  if ((suscripcionActiva || pagoAlDia || paymentStatus === 'paid') && fechaVenc && fechaVenc > ahora) {
    paymentHTML = `
      <div class="payment-status-banner paid">
        <div class="payment-status-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="payment-status-info">
          <h4>Pago al día</h4>
          <p>Suscripción activa. Vence en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}.</p>
        </div>
      </div>
    `;
  } else if ((suscripcionActiva || pagoPagado) && (!fechaVenc || fechaVenc <= ahora)) {
    // Pagado pero vencido
    paymentHTML = `
      <div class="payment-status-banner overdue">
        <div class="payment-status-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="payment-status-info">
          <h4>Suscripción vencida</h4>
          <p>El pago anterior ha expirado. Se requiere renovación.</p>
        </div>
      </div>
    `;
  } else if (ultimoPago && ultimoPago.estado === 'pendiente') {
    paymentHTML = `
      <div class="payment-status-banner pending">
        <div class="payment-status-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="payment-status-info">
          <h4>Pago pendiente</h4>
          <p>El conductor tiene un pago en proceso de verificación.</p>
        </div>
      </div>
    `;
  } else {
    paymentHTML = `
      <div class="payment-status-banner overdue">
        <div class="payment-status-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <div class="payment-status-info">
          <h4>Pago pendiente</h4>
          <p>Este conductor no ha realizado el pago de suscripción.</p>
        </div>
      </div>
    `;
  }
  document.getElementById("paymentStatus").innerHTML = paymentHTML;

  // ===== ESTADO DEL CONDUCTOR =====
  let statusClass, statusTitle, statusMsg;
  const estado = String(conductor.estado).toLowerCase();

  if (estado === 'activo' || estado === 'true') {
    statusClass = 'active';
    statusTitle = 'Conductor Verificado';
    statusMsg = 'Este conductor se encuentra activo y habilitado para operar.';
  } else if (estado === 'pendiente') {
    statusClass = 'pending';
    statusTitle = 'Verificación Pendiente';
    statusMsg = 'La documentación de este conductor está en proceso de revisión.';
  } else {
    statusClass = 'inactive';
    statusTitle = 'Conductor Inactivo';
    statusMsg = 'Este conductor no se encuentra habilitado para operar.';
  }

  document.getElementById("statusHero").innerHTML = `
    <div class="status-hero ${statusClass}">
      <div class="status-icon-wrap">
        ${statusClass === 'active' ? 
          `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>` :
          statusClass === 'pending' ?
          `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>` :
          `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`
        }
      </div>
      <div class="status-info">
        <h3>${statusTitle}</h3>
        <p>${statusMsg}</p>
      </div>
    </div>
  `;

  const tieneAviso = conductor.tiene_aviso_operaciones === true;
  const avisoUrl = urls['AVISO_OPERACIONES'];

  document.getElementById("contenido").innerHTML = `
    <div class="campo"><strong>Nombre completo</strong> <span>${conductor.nombres || ''} ${conductor.apellidos || ''}</span></div>
    <div class="campo"><strong>Cédula</strong> <span>${conductor.cedula || '—'}</span></div>
    <div class="campo"><strong>Licencia</strong> <span>${conductor.licencia || '—'}</span></div>
    <div class="campo"><strong>Vehículo</strong> <span>${conductor.marca || ''} ${conductor.modelo || ''}</span></div>
    <div class="campo"><strong>Placa</strong> <span>${conductor.placa || '—'}</span></div>
    <div class="campo"><strong>Color</strong> <span>${conductor.color || '—'}</span></div>
    <div class="campo"><strong>N° Póliza</strong> <span>${conductor.poliza_numero || '—'}</span></div>
    <div class="campo">
      <strong>Aviso de Operaciones</strong>
      <span>${tieneAviso ? '<span class="aviso-badge">✓ Registrado</span>' : '<span style="color:#94a3b8">No registrado</span>'}</span>
    </div>
  `;

  // ===== FOTOS CON VISTA PREVIA =====
  const fotosCont = document.getElementById("fotos-container");
  fotosCont.innerHTML = "";

  const fotoVeh = urls['FOTO_VEHICULO'];
  const fotoCond = urls['FOTO_CONDUCTOR'];

  if (fotoVeh) {
    fotosCont.innerHTML += `
      <div class="foto-wrapper" onclick="mostrarModal('${fotoVeh}', 'img')">
        <img src="${fotoVeh}" class="foto" alt="Vehículo" loading="lazy">
        <div class="foto-label">Vehículo</div>
      </div>
    `;
  }
  if (fotoCond) {
    fotosCont.innerHTML += `
      <div class="foto-wrapper" onclick="mostrarModal('${fotoCond}', 'img')">
        <img src="${fotoCond}" class="foto" alt="Conductor" loading="lazy">
        <div class="foto-label">Conductor</div>
      </div>
    `;
  }

  // ===== DOCUMENTOS CON VISTA PREVIA =====
  const docSection = document.getElementById("documentos-section");
  const docGrid = document.getElementById("documentos-grid");
  docGrid.innerHTML = "";

  /* log removed */
  /* log removed */

  const documentosConfig = [
    { tipo: "CEDULA", label: "Cédula", icon: "📄" },
    { tipo: "LICENCIA", label: "Licencia", icon: "🪪" },
    { tipo: "REGISTRO", label: "Registro Vehicular", icon: "🚗" },
    { tipo: "POLIZA", label: "Póliza de Seguro", icon: "🛡️" },
    { tipo: "AUTH_PROPIETARIO", label: "Autorización Propietario", icon: "✉️" }
  ];

  let tieneDocumentos = false;

  documentosConfig.forEach(doc => {
    const url = urls[doc.tipo];
    /* log removed */
    if (url) {
      tieneDocumentos = true;
      const isPdf = url.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        docGrid.innerHTML += `
          <div class="doc-preview" onclick="mostrarModal('${url}', 'pdf')">
            <div class="doc-preview-pdf">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span>PDF</span>
            </div>
            <div class="doc-preview-label">${doc.label}</div>
            <div class="doc-preview-overlay"><span>Ver documento</span></div>
          </div>
        `;
      } else {
        docGrid.innerHTML += `
          <div class="doc-preview" onclick="mostrarModal('${url}', 'img')">
            <img src="${url}" class="doc-preview-img" alt="${doc.label}" loading="lazy">
            <div class="doc-preview-label">${doc.label}</div>
            <div class="doc-preview-overlay"><span>Ver documento</span></div>
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
        <div class="doc-preview" onclick="mostrarModal('${avisoUrl}', 'pdf')">
          <div class="doc-preview-pdf">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span>PDF</span>
          </div>
          <div class="doc-preview-label">Aviso de Operaciones</div>
          <div class="doc-preview-overlay"><span>Ver documento</span></div>
        </div>
      `;
    } else {
      docGrid.innerHTML += `
        <div class="doc-preview" onclick="mostrarModal('${avisoUrl}', 'img')">
          <img src="${avisoUrl}" class="doc-preview-img" alt="Aviso de Operaciones" loading="lazy">
          <div class="doc-preview-label">Aviso de Operaciones</div>
          <div class="doc-preview-overlay"><span>Ver documento</span></div>
        </div>
      `;
    }
  }

  /* log removed */

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
}

function mostrarModal(src, type) {
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

function cerrarModal() {
  document.getElementById("modalPreview").style.display = "none";
  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", cargarPerfil);
