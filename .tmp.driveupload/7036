// tracking.js - Versión estable sin plugins de terceros

import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

class DriverTracking {
  constructor() {
    this.isTracking = false;
    this.watchId = null;
    this.locations = [];
    this.consentGiven = false;
    this.driverId = null;
    this.supabase = null;
    this.intervalId = null;
  }

  init(supabaseClient, driverId) {
    this.supabase = supabaseClient;
    this.driverId = driverId;
  }

  async checkConsent() {
    const { value } = await Preferences.get({ key: 'tracking_consent' });
    this.consentGiven = value === 'true';
    return this.consentGiven;
  }

  async requestConsent() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div style="
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.9); backdrop-filter: blur(10px);
          display: flex; justify-content: center; align-items: center;
          z-index: 10000; padding: 20px;
        ">
          <div style="
            background: rgba(30, 41, 59, 0.98);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 24px; padding: 30px; max-width: 400px;
            color: white; font-family: system-ui, sans-serif;
          ">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="
                width: 60px; height: 60px;
                background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                border-radius: 50%; display: flex; align-items: center; justify-content: center;
                margin: 0 auto 15px;
              ">
                <svg width="30" height="30" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <h3 style="margin: 0;">Consentimiento de Monitoreo</h3>
            </div>
            
            <p style="color: #94a3b8; margin-bottom: 20px; line-height: 1.6; font-size: 14px;">
              Para cumplir con las normativas de seguridad y trazabilidad:
            </p>
            
            <ul style="color: #cbd5e1; margin-bottom: 25px; padding-left: 20px; font-size: 13px; line-height: 1.8;">
              <li>Registraremos tu ubicación durante el viaje</li>
              <li>Datos encriptados en servidores seguros</li>
              <li>Solo supervisores autorizados tienen acceso</li>
              <li>Puedes detener el monitoreo en cualquier momento</li>
            </ul>
            
            <div style="display: flex; gap: 12px;">
              <button id="btnReject" style="
                flex: 1; padding: 14px; border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.2);
                background: transparent; color: #94a3b8;
                cursor: pointer; font-weight: 500;
              ">Rechazar</button>
              <button id="btnAccept" style="
                flex: 1; padding: 14px; border-radius: 12px; border: none;
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white; font-weight: 600; cursor: pointer;
              ">Aceptar</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('#btnReject').onclick = () => {
        document.body.removeChild(modal);
        resolve(false);
      };
      
      modal.querySelector('#btnAccept').onclick = async () => {
        await Preferences.set({ key: 'tracking_consent', value: 'true' });
        this.consentGiven = true;
        document.body.removeChild(modal);
        resolve(true);
      };
    });
  }

  async requestPermissions() {
    if (!isNative) {
      // Web: usar navigator.geolocation directamente
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { timeout: 5000 }
        );
      });
    }
    
    // Nativo: usar Capacitor
    const perm = await Geolocation.requestPermissions();
    return perm.location === 'granted';
  }

  async startTracking() {
    if (!this.consentGiven) {
      const consent = await this.requestConsent();
      if (!consent) throw new Error('Se requiere consentimiento');
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) throw new Error('Permisos denegados');

    this.isTracking = true;

    // Crear sesión en Supabase
    await this.supabase.from('tracking_sessions').insert({
      driver_id: this.driverId,
      started_at: new Date().toISOString(),
      status: 'active'
    });

    if (isNative) {
      // Usar watchPosition nativo de Capacitor
      this.watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
        (position, err) => {
          if (position) this.handlePosition(position);
        }
      );
    } else {
      // Web: usar navigator.geolocation.watchPosition
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handlePosition({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading
          },
          timestamp: position.timestamp
        }),
        (err) => console.error('GPS Error:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }

    // Backup: guardar cada 30 segundos
    this.intervalId = setInterval(() => this.sendToServer(), 30000);

    return true;
  }

  handlePosition(position) {
    const location = {
      driver_id: this.driverId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed || 0,
      heading: position.coords.heading || 0,
      timestamp: new Date().toISOString(),
      source: isNative ? 'gps_native' : 'gps_web'
    };

    this.locations.push(location);

    // Evento para UI
    window.dispatchEvent(new CustomEvent('locationUpdate', { 
      detail: location 
    }));

    // Enviar inmediatamente si hay 10+ ubicaciones
    if (this.locations.length >= 10) {
      this.sendToServer();
    }
  }

  async sendToServer() {
    if (this.locations.length === 0) return;

    const { error } = await this.supabase
      .from('driver_locations')
      .insert(this.locations);

    if (!error) {
      this.locations = [];
    } else {
      console.error('Error enviando ubicaciones:', error);
    }
  }

  async stopTracking() {
    this.isTracking = false;

    // Detener watch
    if (isNative && this.watchId !== null) {
      await Geolocation.clearWatch({ id: this.watchId });
    } else if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;

    // Detener intervalo
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Enviar pendientes
    await this.sendToServer();

    // Cerrar sesión
    await this.supabase
      .from('tracking_sessions')
      .update({ 
        ended_at: new Date().toISOString(), 
        status: 'completed' 
      })
      .eq('driver_id', this.driverId)
      .is('ended_at', null);
  }

  async takePhoto() {
    const permission = await Camera.requestPermissions();
    if (permission.camera !== 'granted') {
      throw new Error('Permiso de cámara denegado');
    }

    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: 'base64',
      source: 'CAMERA',
      saveToGallery: false
    });

    // Obtener ubicación actual
    let position;
    if (isNative) {
      position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    } else {
      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ coords: pos.coords }),
          reject,
          { enableHighAccuracy: true }
        );
      });
    }

    return {
      photo: photo.base64String,
      format: photo.format,
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: new Date().toISOString()
      }
    };
  }
}

export default DriverTracking;