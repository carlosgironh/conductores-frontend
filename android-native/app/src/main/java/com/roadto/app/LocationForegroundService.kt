package com.roadto.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

/**
 * ═══════════════════════════════════════════════════════════
 * ROAD TO — Servicio de Ubicación en Primer Plano
 *
 * Este servicio mantiene el GPS activo aunque la app esté
 * minimizada o el usuario esté en WhatsApp/Spotify/etc.
 *
 * Android lo trata como un "Foreground Service", lo que
 * significa que muestra una notificación persistente para
 * que el usuario sepa que se está rastreando su ubicación.
 * ═══════════════════════════════════════════════════════════
 */
class LocationForegroundService : Service() {

    companion object {
        private const val TAG = "RoadTo-Location"
        private const val NOTIFICATION_CHANNEL_ID = "roadto_tracking"
        private const val NOTIFICATION_ID = 1001
        private const val LOCATION_INTERVAL = 5000L  // 5 segundos
        private const val FASTEST_INTERVAL = 3000L   // 3 segundos mínimo

        // Supabase config (misma que en config.js)
        private const val SUPABASE_URL = "https://ugchmuhjzzyofoogprlr.supabase.co"
        private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnY2htdWhqenp5b2Zvb2dwcmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODUyNDQsImV4cCI6MjA4NTY2MTI0NH0.kB4ZjPhfP29JL6apWFKrXfW-AwnsCKHfmVsBUVjPsX4"

        // Actions para controlar el servicio desde JS
        const val ACTION_START = "com.roadto.app.START_TRACKING"
        const val ACTION_STOP = "com.roadto.app.STOP_TRACKING"
        const val EXTRA_DRIVER_ID = "driver_id"

        var isRunning = false
            private set
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var driverId: String? = null
    private val locationBuffer = mutableListOf<JSONObject>()
    private var lastSendTime = 0L

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                driverId = intent.getStringExtra(EXTRA_DRIVER_ID)
                Log.i(TAG, "Iniciando tracking para conductor: $driverId")
                startForegroundTracking()
            }
            ACTION_STOP -> {
                Log.i(TAG, "Deteniendo tracking")
                stopForegroundTracking()
            }
        }
        return START_STICKY // Si Android mata el servicio, lo reinicia automáticamente
    }

    private fun startForegroundTracking() {
        isRunning = true

        // Crear notificación persistente
        val notification = buildNotification("Rastreando tu viaje...")

        // Iniciar como servicio en primer plano
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // Configurar peticiones de ubicación
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL)
            .setMinUpdateIntervalMillis(FASTEST_INTERVAL)
            .setWaitForAccurateLocation(false)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    Log.d(TAG, "Ubicación: ${location.latitude}, ${location.longitude} | Vel: ${location.speed}")

                    // Crear objeto de ubicación
                    val locData = JSONObject().apply {
                        put("driver_id", driverId)
                        put("latitude", location.latitude)
                        put("longitude", location.longitude)
                        put("accuracy", location.accuracy.toDouble())
                        put("speed", location.speed.toDouble())
                        put("heading", location.bearing.toDouble())
                        put("timestamp", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                            timeZone = TimeZone.getTimeZone("UTC")
                        }.format(Date()))
                        put("source", "gps_native_android")
                    }

                    locationBuffer.add(locData)

                    // Actualizar notificación con velocidad
                    val speedKmh = (location.speed * 3.6).toInt()
                    updateNotification("Viaje activo · $speedKmh km/h")

                    // Enviar cada 10 ubicaciones o cada 30 segundos
                    val now = System.currentTimeMillis()
                    if (locationBuffer.size >= 10 || (now - lastSendTime > 30000 && locationBuffer.isNotEmpty())) {
                        sendLocationsToSupabase()
                    }
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Permiso de ubicación denegado: ${e.message}")
            stopSelf()
        }
    }

    private fun stopForegroundTracking() {
        isRunning = false

        // Detener actualizaciones GPS
        if (::locationCallback.isInitialized) {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }

        // Enviar ubicaciones pendientes
        if (locationBuffer.isNotEmpty()) {
            sendLocationsToSupabase()
        }

        // Detener servicio
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    /**
     * Envía las ubicaciones acumuladas a Supabase en batch.
     * Usa un hilo separado para no bloquear el hilo principal.
     */
    private fun sendLocationsToSupabase() {
        if (locationBuffer.isEmpty()) return

        val batch = ArrayList(locationBuffer)
        locationBuffer.clear()
        lastSendTime = System.currentTimeMillis()

        Thread {
            try {
                val url = URL("$SUPABASE_URL/rest/v1/driver_locations")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("apikey", SUPABASE_ANON_KEY)
                conn.setRequestProperty("Authorization", "Bearer $SUPABASE_ANON_KEY")
                conn.setRequestProperty("Prefer", "return=minimal")
                conn.doOutput = true

                // Construir JSON array
                val jsonArray = StringBuilder("[")
                batch.forEachIndexed { index, loc ->
                    if (index > 0) jsonArray.append(",")
                    jsonArray.append(loc.toString())
                }
                jsonArray.append("]")

                OutputStreamWriter(conn.outputStream).use { it.write(jsonArray.toString()) }

                val responseCode = conn.responseCode
                if (responseCode in 200..299) {
                    Log.i(TAG, "✅ ${batch.size} ubicaciones enviadas a Supabase")
                } else {
                    Log.e(TAG, "❌ Error enviando ubicaciones: HTTP $responseCode")
                    // Re-agregar al buffer para reintentar
                    locationBuffer.addAll(0, batch)
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error de red: ${e.message}")
                // Re-agregar al buffer para reintentar
                locationBuffer.addAll(0, batch)
            }
        }.start()
    }

    // ═══ NOTIFICACIONES ═══

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Rastreo de Viaje",
                NotificationManager.IMPORTANCE_LOW // Sin sonido, solo visual
            ).apply {
                description = "Notificación mostrada mientras Road To rastrea tu ubicación"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        // Intent para abrir la app al tocar la notificación
        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent para detener el tracking
        val stopIntent = Intent(this, LocationForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Road To")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation) // TODO: reemplazar con ícono propio
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_media_pause, "Detener", stopPendingIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val notification = buildNotification(text)
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        if (::locationCallback.isInitialized) {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }
        // Enviar pendientes
        if (locationBuffer.isNotEmpty()) {
            sendLocationsToSupabase()
        }
        Log.i(TAG, "Servicio de ubicación destruido")
    }
}
