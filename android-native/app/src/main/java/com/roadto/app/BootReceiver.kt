package com.roadto.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log

/**
 * ═══════════════════════════════════════════════════════════
 * ROAD TO — Boot Receiver
 *
 * Si el teléfono se reinicia mientras un viaje estaba activo,
 * este BroadcastReceiver reinicia el servicio de tracking
 * automáticamente cuando el dispositivo termina de encender.
 * ═══════════════════════════════════════════════════════════
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "RoadTo-Boot"
        private const val PREFS_NAME = "roadto_tracking"
        private const val KEY_ACTIVE_DRIVER = "active_driver_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        Log.i(TAG, "Dispositivo reiniciado. Verificando sesión de tracking activa...")

        val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val activeDriverId = prefs.getString(KEY_ACTIVE_DRIVER, null)

        if (activeDriverId != null) {
            Log.i(TAG, "Sesión activa encontrada para conductor: $activeDriverId. Reiniciando tracking...")

            val serviceIntent = Intent(context, LocationForegroundService::class.java).apply {
                action = LocationForegroundService.ACTION_START
                putExtra(LocationForegroundService.EXTRA_DRIVER_ID, activeDriverId)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } else {
            Log.i(TAG, "No hay sesión activa. No se reinicia tracking.")
        }
    }
}
