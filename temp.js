
  // ═══ CONFIGURACIÓN ═══
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.RoadTo?.config || {};

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ═══ ESTADO GLOBAL ═══
  let map, userMarker;
  let watchId = null;
  let timerInterval = null;
  let startTime = null;
  let routePolyline;
  let totalDistance = 0; // en metros
  let lastPosition = null;

  // ═══ GEOFENCING ═══
  let activeGeofenceZones = [];
  let currentZonesInside = new Set();
  let driverMarkers = {};
  let realtimeChannel = null;
  let currentUser = null;
  let originCoords = null;
  let destCoords = null;
  let routeLayer = null;
  let originMarker = null;
  let destMarker = null;
  let searchDebounce = null;
  let activeSearchField = null;
  let conductorData = null;
  let userRole = null; // 'conductor', 'admin', 'coordinador'

  // ═══ POSICIÓN POR DEFECTO (Panamá) ═══
  const DEFAULT_LAT = 9.0;
  const DEFAULT_LNG = -79.5;
  const DEFAULT_ZOOM = 13;

  // ═══ INICIALIZACIÓN ═══
  document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await identifyUser();
    await getUserLocation();
    await loadGeofenceZones();
    hideLoading();
    
    // Nueva lógica de URL params
    processURLParams();
  });

  async function loadGeofenceZones() {
    try {
      const { data } = await supabaseClient.from('zonas_geofence').select('*').eq('activa', true);
      if (data) activeGeofenceZones = data;
    } catch(e) { console.error("Error ocurrido en el cliente", "Contacte a soporte"); }
  }

  function initMap() {
    map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
    }).setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);

    // OpenStreetMap tiles (gratuito, sin API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      subdomains: 'abc',
    }).addTo(map);

    // Polyline para ruta recorrida
    routePolyline = L.polyline([], {
      color: '#76b32c',
      weight: 4,
      opacity: 0.85,
      smoothFactor: 1,
    }).addTo(map);
  }

  // ═══ IDENTIFICAR USUARIO ═══
  async function identifyUser() {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return;
      currentUser = user;

      // Intentar determinar rol
      const { data: admin } = await supabaseClient
        .from('administradores')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (admin) {
        userRole = 'admin';
        document.getElementById('btnDriverList').style.display = 'flex';
        document.getElementById('trackBtn').style.display = 'none';
        subscribeToDriverLocations();
        return;
      }

      const { data: coord } = await supabaseClient
        .from('coordinadores')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (coord) {
        userRole = 'coordinador';
        document.getElementById('btnDriverList').style.display = 'flex';
        document.getElementById('trackBtn').style.display = 'none';
        subscribeToDriverLocations();
        return;
      }

      const { data: conductor } = await supabaseClient
        .from('conductores')
        .select('id, nombres, apellidos')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (conductor) {
        userRole = 'conductor';
        conductorData = conductor;
        document.getElementById('btnDriverList').style.display = 'none';
        initPushNotifications();
      }
    } catch (e) {
      console.warn('Error identificando usuario:', e);
    }
  }

  // 🔔 NOTIFICACIONES PUSH (FCM) 🔔
  async function initPushNotifications() {
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
      try {
        const push = Capacitor.Plugins.PushNotifications;
        
        let permStatus = await push.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await push.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('Permisos de notificaciones denegados');
          return;
        }

        await push.register();

        push.addListener('registration', async (token) => {
          /* log removed */
          if (conductorData) {
             await supabaseClient.from('conductores').update({
               fcm_token: token.value
             }).eq('id', conductorData.id);
          }
        });

        push.addListener('registrationError', (error) => {
          console.error("Error ocurrido en el cliente", "Contacte a soporte");
        });

        push.addListener('pushNotificationReceived', (notification) => {
          showToast('🔔 NUEVO VIAJE: ' + notification.title, 'success');
        });

      } catch (err) {
        console.warn('PushNotifications plugin no disponible o error:', err);
      }
    }
  }

  // ═══ GEOLOCALIZACIÓN ═══
  async function getUserLocation() {
    if (!navigator.geolocation) {
      showToast('Tu navegador no soporta geolocalización');
      return;
    }

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 15);
      updateUserMarker(latitude, longitude);
    } catch (err) {
      console.warn('No se pudo obtener ubicación:', err.message);
      showToast('Activa el GPS para ver tu ubicación');
    }
  }

  function updateUserMarker(lat, lng) {
    const icon = L.divIcon({
      className: 'user-marker',
      html: `<div style="
        width: 40px; height: 40px;
        background: linear-gradient(135deg, #76b32c, #3f6d12);
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 15px rgba(118, 179, 44, 0.5);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (userMarker) {
      userMarker.setLatLng([lat, lng]);
    } else {
      userMarker = L.marker([lat, lng], { icon }).addTo(map);
    }
  }

  // ═══ TRACKING ═══
  function toggleTracking() {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }

  function startTracking() {
    if (!navigator.geolocation) {
      showToast('Geolocalización no disponible');
      return;
    }

    isTracking = true;
    startTime = Date.now();
    totalDistance = 0;
    lastPosition = null;
    routePolyline.setLatLngs([]);

    // Actualizar UI
    const btn = document.getElementById('trackBtn');
    btn.className = 'btn-action btn-stop';
    btn.innerHTML = '⏹ Detener Viaje';
    document.getElementById('liveIndicator').classList.add('active');

    // Iniciar watchPosition
    watchId = navigator.geolocation.watchPosition(
      (pos) => handlePositionUpdate(pos),
      (err) => {
        console.error("Error ocurrido en el cliente", "Contacte a soporte");
        showToast('Error de GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    // Timer para actualizar tiempo
    timerInterval = setInterval(updateTimer, 1000);

    // Guardar sesión en Supabase
    if (conductorData) {
      supabaseClient.from('tracking_sessions').insert({
        driver_id: conductorData.id,
        started_at: new Date().toISOString(),
        status: 'active',
      }).then(({ error }) => {
        if (error) console.warn('Error creando sesión:', error);
      });
    }

    showToast('🟢 Viaje iniciado');
  }

  function stopTracking() {
    isTracking = false;

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Actualizar UI
    const btn = document.getElementById('trackBtn');
    btn.className = 'btn-action btn-start';
    btn.innerHTML = '▶ Iniciar Viaje';
    document.getElementById('liveIndicator').classList.remove('active');

    // Cerrar sesión en Supabase
    if (conductorData) {
      supabaseClient.from('tracking_sessions')
        .update({ ended_at: new Date().toISOString(), status: 'completed' })
        .eq('driver_id', conductorData.id)
        .is('ended_at', null)
        .then(({ error }) => {
          if (error) console.warn('Error cerrando sesión:', error);
        });
    }

    showToast('🔴 Viaje finalizado');
  }

  function handlePositionUpdate(pos) {
    const { latitude, longitude, speed, accuracy } = pos.coords;

    // Actualizar marcador y mapa
    updateUserMarker(latitude, longitude);
    map.panTo([latitude, longitude]);

    // Agregar punto a la ruta
    routePolyline.addLatLng([latitude, longitude]);

    // Calcular distancia
    if (lastPosition) {
      const dist = haversineDistance(
        lastPosition[0], lastPosition[1],
        latitude, longitude
      );
      if (dist > 2) { // Ignorar movimientos < 2m (ruido GPS)
        totalDistance += dist;
      }
    }
    lastPosition = [latitude, longitude];

    // Check Geofencing
    if (typeof turf !== 'undefined' && activeGeofenceZones.length > 0) {
      const pt = turf.point([longitude, latitude]);
      activeGeofenceZones.forEach(async (zona) => {
        let coords = zona.poligono.map(p => [p.lng, p.lat]);
        if (coords.length >= 3) {
           if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
             coords.push([...coords[0]]);
           }
           const poly = turf.polygon([coords]);
           const isInside = turf.booleanPointInPolygon(pt, poly);
           
           if (isInside && !currentZonesInside.has(zona.id)) {
             currentZonesInside.add(zona.id);
             if (conductorData) {
               // 1. Notificación
               supabaseClient.from('notificaciones').insert({
                 tipo: 'geofence_enter',
                 titulo: 'Entrada a Zona: ' + zona.nombre,
                 mensaje: `El conductor ${conductorData.nombres || ''} ha entrado a la zona ${zona.nombre}.`,
                 leida: false
               }).then();
               
               // 2. Entrar a Lista de Espera
               const { data: colaData } = await supabaseClient.from('lista_espera_zonas').insert({
                 zona_id: zona.id,
                 conductor_id: conductorData.id,
                 estado: 'en_cola'
               }).select();
               
               // Informar posición
               const { count } = await supabaseClient.from('lista_espera_zonas')
                 .select('*', { count: 'exact', head: true })
                 .eq('zona_id', zona.id)
                 .eq('estado', 'en_cola');
               
               showToast(`🚗 Entraste a: ${zona.nombre}. Eres el #${count || 1} en la fila.`);
             }
           } else if (!isInside && currentZonesInside.has(zona.id)) {
             currentZonesInside.delete(zona.id);
             if (conductorData) {
               // 1. Notificación
               supabaseClient.from('notificaciones').insert({
                 tipo: 'geofence_exit',
                 titulo: 'Salida de Zona: ' + zona.nombre,
                 mensaje: `El conductor ${conductorData.nombres || ''} ha salido de la zona ${zona.nombre}.`,
                 leida: false
               }).then();
               
               // 2. Salir de Lista de Espera
               supabaseClient.from('lista_espera_zonas').update({
                 estado: 'salio',
                 salio_en: new Date().toISOString()
               })
               .eq('zona_id', zona.id)
               .eq('conductor_id', conductorData.id)
               .eq('estado', 'en_cola').then();
               
               showToast(`👋 Saliste de: ${zona.nombre}. Tu turno ha sido cancelado.`);
             }
           }
        }
      });
    }

    // Actualizar stats UI
    document.getElementById('distanceValue').textContent = (totalDistance / 1000).toFixed(1);
    if (speed !== null && speed >= 0) {
      document.getElementById('speedValue').textContent = Math.round(speed * 3.6);
    }

    // Enviar ubicación a Supabase
    if (conductorData) {
      supabaseClient.from('driver_locations').insert({
        driver_id: conductorData.id,
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        speed: speed || 0,
        timestamp: new Date().toISOString(),
        source: 'gps_web',
      }).then(({ error }) => {
        if (error) console.warn('Error guardando ubicación:', error);
      });
    }
  }

  function updateTimer() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const min = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const sec = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('timeValue').textContent = `${min}:${sec}`;
  }

  // ═══ FÓRMULA HAVERSINE (distancia entre 2 coordenadas) ═══
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metros
    const toRad = (x) => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ═══ VISTA SUPERVISOR: Conductores en tiempo real ═══
  function subscribeToDriverLocations() {
    // Cargar ubicaciones recientes
    loadActiveDrivers();

    // Suscribirse a cambios en tiempo real
    realtimeChannel = supabaseClient
      .channel('driver-locations-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'driver_locations',
      }, (payload) => {
        updateDriverOnMap(payload.new);
      })
      .subscribe();
  }

  async function loadActiveDrivers() {
    try {
      // Obtener sesiones activas
      const { data: sessions } = await supabaseClient
        .from('tracking_sessions')
        .select('driver_id')
        .eq('status', 'active');

      if (!sessions || sessions.length === 0) return;

      const driverIds = sessions.map(s => s.driver_id);

      // Obtener última ubicación de cada conductor activo
      for (const driverId of driverIds) {
        const { data: loc } = await supabaseClient
          .from('driver_locations')
          .select('*')
          .eq('driver_id', driverId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (loc) {
          updateDriverOnMap(loc);
        }
      }

      // Cargar nombres
      const { data: conductores } = await supabaseClient
        .from('conductores')
        .select('id, nombres, apellidos')
        .in('id', driverIds);

      if (conductores) {
        renderDriverList(conductores);
      }
    } catch (e) {
      console.warn('Error cargando conductores activos:', e);
    }
  }

  function updateDriverOnMap(locationData) {
    const { driver_id, latitude, longitude, speed } = locationData;
    const driverIcon = L.divIcon({
      className: 'driver-marker',
      html: `<div style="
        width: 34px; height: 34px;
        background: linear-gradient(135deg, ${getDriverColor(driver_id)});
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 16px;
      ">🚗</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    if (driverMarkers[driver_id]) {
      driverMarkers[driver_id].setLatLng([latitude, longitude]);
    } else {
      driverMarkers[driver_id] = L.marker([latitude, longitude], { icon: driverIcon })
        .addTo(map)
        .bindPopup(`Conductor: ${driver_id}<br>Velocidad: ${Math.round((speed || 0) * 3.6)} km/h`);
    }
  }

  function getDriverColor(id) {
    // Genera un color basado en el hash del ID para distinguir conductores
    const colors = [
      '#f97316, #c2410c',
      '#3b82f6, #1d4ed8',
      '#8b5cf6, #6d28d9',
      '#ec4899, #be185d',
      '#14b8a6, #0d9488',
      '#f59e0b, #d97706',
    ];
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  function renderDriverList(conductores) {
    const list = document.getElementById('driverList');
    list.innerHTML = conductores.map(c => `
      <div class="driver-item" onclick="focusDriver('${c.id}')">
        <div class="driver-dot online"></div>
        <div class="driver-name">${c.nombres || ''} ${c.apellidos || ''}</div>
        <div class="driver-speed" id="speed-${c.id}">-- km/h</div>
      </div>
    `).join('');
  }

  function focusDriver(driverId) {
    if (driverMarkers[driverId]) {
      const pos = driverMarkers[driverId].getLatLng();
      map.setView(pos, 16);
      driverMarkers[driverId].openPopup();
    }
  }

  // ═══ UI HELPERS ═══
  function goBack() {
    window.history.back();
  }

  function centerOnUser() {
    if (userMarker) {
      map.setView(userMarker.getLatLng(), 16);
    } else {
      getUserLocation();
    }
  }

  function togglePanel() {
    document.getElementById('infoPanel').classList.toggle('hidden');
  }

  function toggleDriverList() {
    document.getElementById('driverList').classList.toggle('show');
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  // ═══ BÚSQUEDA DE DIRECCIONES (Nominatim — OpenStreetMap, gratis) ═══
  const searchOriginEl = document.getElementById('searchOrigin');
  const searchDestEl = document.getElementById('searchDestination');
  const searchResultsEl = document.getElementById('searchResults');

  searchOriginEl.addEventListener('input', (e) => {
    activeSearchField = 'origin';
    debounceSearch(e.target.value);
  });

  searchDestEl.addEventListener('input', (e) => {
    activeSearchField = 'destination';
    debounceSearch(e.target.value);
  });

  searchOriginEl.addEventListener('focus', () => { activeSearchField = 'origin'; });
  searchDestEl.addEventListener('focus', () => { activeSearchField = 'destination'; });

  // Cerrar resultados al tocar fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-overlay')) {
      searchResultsEl.classList.remove('show');
    }
  });

  function debounceSearch(query) {
    clearTimeout(searchDebounce);
    if (query.length < 3) {
      searchResultsEl.classList.remove('show');
      return;
    }
    searchDebounce = setTimeout(() => searchAddress(query), 400);
  }

  async function searchAddress(query) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=pa&accept-language=es`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'RoadToApp/2.0 (contact@roadto.app)' }
      });
      const results = await res.json();

      if (results.length === 0) {
        searchResultsEl.innerHTML = '<div class="search-result-item"><span class="search-result-name">Sin resultados</span></div>';
      } else {
        searchResultsEl.innerHTML = results.map(r => `
          <div class="search-result-item" onclick="selectSearchResult(${r.lat}, ${r.lon}, '${r.display_name.replace(/'/g, "\\'").substring(0, 80)}')">
            <div class="search-result-name">${r.display_name.split(',')[0]}</div>
            <div class="search-result-address">${r.display_name.split(',').slice(1, 3).join(',')}</div>
          </div>
        `).join('');
      }
      searchResultsEl.classList.add('show');
    } catch (e) {
      console.warn('Error buscando dirección:', e);
    }
  }

  function selectSearchResult(lat, lng, name) {
    searchResultsEl.classList.remove('show');

    const pinIcon = L.divIcon({
      className: 'pin-marker',
      html: `<div style="
        width: 32px; height: 32px;
        background: ${activeSearchField === 'origin' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #b91c1c)'};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    if (activeSearchField === 'origin') {
      searchOriginEl.value = name;
      originCoords = [lat, lng];
      if (originMarker) map.removeLayer(originMarker);
      originMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(map).bindPopup('Origen: ' + name);
    } else {
      searchDestEl.value = name;
      destCoords = [lat, lng];
      if (destMarker) map.removeLayer(destMarker);
      destMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(map).bindPopup('Destino: ' + name);
    }

    map.setView([lat, lng], 15);

    // Si ambos están definidos, calcular ruta
    if (originCoords && destCoords) {
      calculateRoute(originCoords, destCoords);
    }
  }

  // ═══ CÁLCULO DE RUTAS (OSRM — Open Source, gratis) ═══
  async function calculateRoute(origin, dest) {
    try {
      // OSRM demo server (gratis, para uso no comercial intensivo)
      const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        showToast('No se pudo calcular la ruta');
        return;
      }

      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(c => [c[1], c[0]]); // GeoJSON es [lng,lat]

      // Dibujar ruta en mapa
      if (routeLayer) map.removeLayer(routeLayer);
      routeLayer = L.polyline(coords, {
        color: '#3b82f6',
        weight: 5,
        opacity: 0.8,
        dashArray: null,
        smoothFactor: 1,
      }).addTo(map);

      // Ajustar vista para mostrar toda la ruta
      map.fitBounds(routeLayer.getBounds(), { padding: [60, 60] });

      // Mostrar info de ruta
      const distKm = (route.distance / 1000).toFixed(1);
      const durMin = Math.ceil(route.duration / 60);
      document.getElementById('routeInfoText').innerHTML = `<strong>${distKm} km</strong> · ~${durMin} min`;
      document.getElementById('routeInfo').classList.add('show');

      showToast(`Ruta: ${distKm} km, ~${durMin} min`);
    } catch (e) {
      console.warn('Error calculando ruta OSRM:', e);
      showToast('Error al calcular ruta');
    }
  }

  function clearRoute() {
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (originMarker) { map.removeLayer(originMarker); originMarker = null; }
    if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
    originCoords = null;
    destCoords = null;
    searchOriginEl.value = '';
    searchDestEl.value = '';
    document.getElementById('routeInfo').classList.remove('show');
    showToast('Ruta limpiada');
  }

  // ═══ COMPARTIR UBICACIÓN ═══
  async function shareLocation() {
    if (!lastPosition) {
      showToast('Esperando ubicación GPS...');
      return;
    }

    const [lat, lng] = lastPosition;
    const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
    const googleLink = `https://www.google.com/maps?q=${lat},${lng}`;
    const text = `📍 Mi ubicación en Road To:\n${googleLink}`;

    // Intentar Web Share API (funciona en móviles)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mi ubicación — Road To',
          text: text,
          url: googleLink,
        });
        showToast('Ubicación compartida');
        return;
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('Share failed:', e);
      }
    }

    // Fallback: copiar al portapapeles
    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Enlace copiado al portapapeles');
    } catch (e) {
      // Último fallback
      prompt('Copia este enlace:', googleLink);
    }
  }

  // ═══ NUEVA LÓGICA DE URL PARAMS ═══
  async function processURLParams() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const viajeId = params.get('viaje_id');
    const mode = params.get('mode');
    const conductorId = params.get('conductor_id');

    if (view === 'all') {
      // Vista Global Admin/Coordinador
      showToast('Cargando todos los conductores activos...');
      toggleDriverList(); // Abrir panel de conductores si está oculto
      cargarConductoresActivos(); // Esta función ya hace pooling cada 10s en el script, pero aquí la forzamos
    } else if (viajeId) {
      // Rastreo para Pasajero
      showToast('Cargando viaje en vivo...');
      await renderViajeEnVivo(viajeId);
    } else if (mode === 'driver' && conductorId) {
      // Rastreo y próximas carreras para Conductor
      showToast('Cargando tu ruta y carreras disponibles...');
      await renderModoConductor(conductorId);
    }
  }

  async function renderViajeEnVivo(viajeId) {
    try {
      // 1. Cargar viaje
      const { data: viaje } = await supabaseClient
        .from('viajes_reservados')
        .select('*')
        .eq('id', viajeId)
        .maybeSingle();
      
      if (!viaje) { showToast('Viaje no encontrado'); return; }

      // 2. Trazar ruta origen-destino
      if (viaje.lat_origen && viaje.lng_origen && viaje.lat_destino && viaje.lng_destino) {
        await calculateRoute([viaje.lat_origen, viaje.lng_origen], [viaje.lat_destino, viaje.lng_destino]);
      } else {
        // Fallback: buscar por texto
        await searchAddress(viaje.origen);
        const originCoord = originCoords;
        await searchAddress(viaje.destino);
        if (originCoord && destCoords) await calculateRoute(originCoord, destCoords);
      }

      // 3. Suscribirse a la ubicación del conductor
      if (viaje.conductor_asignado_id) {
        // Cargar última ubicación
        const { data: loc } = await supabaseClient
          .from('driver_locations')
          .select('*')
          .eq('driver_id', viaje.conductor_asignado_id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (loc) {
          updateDriverOnMap(loc);
          if (driverMarkers[loc.driver_id]) {
            map.setView(driverMarkers[loc.driver_id].getLatLng(), 15);
          }
        }
        
        // Configurar realtime para este conductor
        supabaseClient.channel('viaje-vivo')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${viaje.conductor_asignado_id}` }, payload => {
            updateDriverOnMap(payload.new);
          }).subscribe();
      }
    } catch(e) {
      console.error("Error ocurrido en el cliente", "Contacte a soporte");
    }
  }

  async function calculateMultiStopRoute(waypoints) {
    if (waypoints.length < 2) return;
    try {
      const coordsString = waypoints.map(wp => `${wp[1]},${wp[0]}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        
        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.polyline(coords, {
          color: '#f59e0b',
          weight: 5,
          opacity: 0.9,
          dashArray: '10, 10'
        }).addTo(map);
        
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
      }
    } catch (e) {
      console.warn('Error calculando ruta multipunto:', e);
    }
  }

  async function renderModoConductor(conductorId) {
    try {
      // 1. Obtener todos los viajes asignados al conductor (Carpooling)
      const { data: viajes } = await supabaseClient
        .from('viajes_reservados')
        .select('*')
        .eq('conductor_asignado_id', conductorId)
        .in('estado', ['asignado', 'en_curso']);
      
      const waypoints = [];
      if (lastPosition) waypoints.push(lastPosition);

      if (viajes && viajes.length > 0) {
        viajes.forEach((v, index) => {
          // Marcador de recogida (Pasajero)
          if (v.lat_origen && v.lng_origen && v.estado_pasajero !== 'a_bordo' && v.estado_pasajero !== 'completado') {
            L.marker([v.lat_origen, v.lng_origen], {
              icon: L.divIcon({
                className: 'stop-marker pickup',
                html: `<div style="background:#22c55e; width:24px; height:24px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; box-shadow:0 2px 5px rgba(0,0,0,0.4);">↑</div>`
              })
            }).addTo(map).bindPopup(`<b>Recoger Pasajero</b><br>${v.origen}<br>Pasajero ID: ${v.pasajero_id || 'N/A'}`);
            waypoints.push([v.lat_origen, v.lng_origen]);
          }

          // Marcador de bajada
          if (v.lat_destino && v.lng_destino && v.estado_pasajero !== 'completado') {
            L.marker([v.lat_destino, v.lng_destino], {
              icon: L.divIcon({
                className: 'stop-marker dropoff',
                html: `<div style="background:#ef4444; width:24px; height:24px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; box-shadow:0 2px 5px rgba(0,0,0,0.4);">↓</div>`
              })
            }).addTo(map).bindPopup(`<b>Dejar Pasajero</b><br>${v.destino}<br>Pasajero ID: ${v.pasajero_id || 'N/A'}`);
            waypoints.push([v.lat_destino, v.lng_destino]);
          }
        });

        // Trazar ruta multipunto si hay paradas
        if (waypoints.length > 1) {
           await calculateMultiStopRoute(waypoints);
        }
      } else {
         showToast('No tienes viajes activos asignados.');
      }

      // 2. Buscar viajes disponibles "pendientes"
      const { data: disponibles } = await supabaseClient
        .from('viajes_reservados')
        .select('*')
        .eq('estado', 'pendiente');
      
      if (disponibles) {
        disponibles.forEach(v => {
          if (v.lat_origen && v.lng_origen) {
            L.marker([v.lat_origen, v.lng_origen]).addTo(map)
              .bindPopup(`<b>Viaje Disponible</b><br>${v.origen}<br>➔ ${v.destino}`);
          }
        });
      }
    } catch(e) {
      console.error("Error cargando modo conductor:", e);
      showToast('Error cargando paradas del viaje.');
    }
  }
