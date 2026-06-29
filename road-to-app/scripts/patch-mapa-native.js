const fs = require('fs');
const path = require('path');

const mapaPath = path.join(__dirname, '..', 'src', 'mapa.html');
let content = fs.readFileSync(mapaPath, 'utf8');

// 1. Modificar startTracking
const oldStartTrackingRegex = /async function startTracking\(\) \{[\s\S]*?\}\s*function startWebTrackingFallback\(\) \{/m;
const newStartTracking = `async function startTracking() {
    isTracking = true;
    startTime = Date.now();
    totalDistance = 0;
    lastPosition = null;
    routePolyline.setLatLngs([]);

    const btn = document.getElementById('trackBtn');
    btn.className = 'btn-action btn-stop';
    btn.innerHTML = '⏹ Detener Viaje';
    document.getElementById('liveIndicator').classList.add('active');

    if (window.Capacitor && window.Capacitor.Plugins.RoadToLocation) {
      try {
        const RoadToLocation = window.Capacitor.Plugins.RoadToLocation;
        
        // Listener de actualización nativa
        RoadToLocation.addListener('onLocationUpdate', (loc) => {
          handlePositionUpdate({
            coords: {
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
              speed: loc.speed,
              heading: loc.heading
            }
          });
        });

        // Iniciar servicio nativo
        await RoadToLocation.startTracking();
        showToast('🟢 Viaje iniciado (Modo Nativo 100% Background)');
      } catch (e) {
        console.error("Fallo al iniciar RoadToLocation nativo", e);
        startWebTrackingFallback();
      }
    } else if (window.BackgroundGeolocation) {
      // Fallback a plugin de capacitor antiguo
      try {
        watchId = await window.BackgroundGeolocation.addWatcher(
          { backgroundMessage: "Rastreando ubicación en segundo plano.", backgroundTitle: "Road To Activo", requestPermissions: true, stale: false, distanceFilter: 2 },
          function (location, error) {
            if (error) return console.error(error);
            handlePositionUpdate({ coords: { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, speed: location.speed, heading: location.bearing } });
          }
        );
        showToast('🟢 Viaje iniciado (Modo Capacitor Básico)');
      } catch (e) {
        startWebTrackingFallback();
      }
    } else {
      startWebTrackingFallback();
    }

    timerInterval = setInterval(updateTimer, 1000);

    if (conductorData) {
      supabaseClient.from('tracking_sessions').insert({
        driver_id: conductorData.id, started_at: new Date().toISOString(), status: 'active'
      }).then(({ error }) => {
        if (error) console.warn('Error creando sesión:', error);
      });
    }
  }

  function startWebTrackingFallback() {`;

content = content.replace(oldStartTrackingRegex, newStartTracking);

// 2. Modificar stopTracking
const oldStopTrackingRegex = /async function stopTracking\(\) \{[\s\S]*?if \(!startTime\) return;/m;
const newStopTracking = `async function stopTracking() {
    isTracking = false;

    if (window.Capacitor && window.Capacitor.Plugins.RoadToLocation) {
      const RoadToLocation = window.Capacitor.Plugins.RoadToLocation;
      await RoadToLocation.stopTracking();
      RoadToLocation.removeAllListeners();
    } else if (window.BackgroundGeolocation && watchId !== null && typeof watchId === 'string') {
      await window.BackgroundGeolocation.removeWatcher({ id: watchId });
      watchId = null;
    } else if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    const btn = document.getElementById('trackBtn');
    btn.className = 'btn-action btn-start';
    btn.innerHTML = '▶ Iniciar Viaje';
    document.getElementById('liveIndicator').classList.remove('active');

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

  function handlePositionUpdate(pos) {`;

// Necesitamos ajustar el regex para no borrar handlePositionUpdate
const oldStopTrackingRegex2 = /async function stopTracking\(\) \{[\s\S]*?function handlePositionUpdate\(pos\) \{/m;

content = content.replace(oldStopTrackingRegex2, newStopTracking);

fs.writeFileSync(mapaPath, content);
console.log('mapa.html native background tracking patched successfully');
