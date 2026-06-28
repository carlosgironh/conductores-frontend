package com.roadto.app

import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * ═══════════════════════════════════════════════════════════
 * ROAD TO — Plugin Bridge Capacitor ↔ Kotlin
 *
 * Este plugin permite que el JavaScript (tracking.js) invoque
 * el servicio nativo de GPS en background.
 *
 * Desde JS se llama así:
 *   const { NativeTracking } = Capacitor.Plugins;
 *   await NativeTracking.startTracking({ driverId: '...' });
 *   await NativeTracking.stopTracking();
 *   const { isActive } = await NativeTracking.isTracking();
 * ═══════════════════════════════════════════════════════════
 */
@CapacitorPlugin(name = "NativeTracking")
class NativeTrackingPlugin : Plugin() {

    companion object {
        private const val TAG = "RoadTo-Plugin"
        private const val PREFS_NAME = "roadto_tracking"
        private const val KEY_ACTIVE_DRIVER = "active_driver_id"
    }

    /**
     * Inicia el servicio de GPS en background.
     * Parámetros JS: { driverId: string }
     */
    @PluginMethod
    fun startTracking(call: PluginCall) {
        val driverId = call.getString("driverId")
        if (driverId.isNullOrEmpty()) {
            call.reject("Se requiere driverId")
            return
        }

        Log.i(TAG, "JS → Kotlin: startTracking($driverId)")

        // Guardar ID del conductor activo para reinicio por boot
        val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_ACTIVE_DRIVER, driverId).apply()

        // Iniciar servicio nativo
        val intent = Intent(context, LocationForegroundService::class.java).apply {
            action = LocationForegroundService.ACTION_START
            putExtra(LocationForegroundService.EXTRA_DRIVER_ID, driverId)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }

        val ret = com.getcapacitor.JSObject()
        ret.put("success", true)
        ret.put("message", "Tracking nativo iniciado")
        call.resolve(ret)
    }

    /**
     * Detiene el servicio de GPS en background.
     */
    @PluginMethod
    fun stopTracking(call: PluginCall) {
        Log.i(TAG, "JS → Kotlin: stopTracking()")

        // Limpiar conductor activo
        val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_ACTIVE_DRIVER).apply()

        // Detener servicio
        val intent = Intent(context, LocationForegroundService::class.java).apply {
            action = LocationForegroundService.ACTION_STOP
        }
        context.startService(intent)

        val ret = com.getcapacitor.JSObject()
        ret.put("success", true)
        ret.put("message", "Tracking nativo detenido")
        call.resolve(ret)
    }

    /**
     * Verifica si el servicio de tracking está activo.
     */
    @PluginMethod
    fun isTracking(call: PluginCall) {
        val ret = com.getcapacitor.JSObject()
        ret.put("isActive", LocationForegroundService.isRunning)
        call.resolve(ret)
    }
}
