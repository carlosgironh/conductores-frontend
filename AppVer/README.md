# Road To v2.0.0

Plataforma de gestión de conductores optimizada para Capacitor 7, Ionic 8 y multiplataforma nativa con Kotlin.

## Características

- **Pantalla de bienvenida animada** con efecto "road/path" y partículas
- **Rebranding completo** a "Road To"
- **Navegación mejorada** con botones de regresar e ir a inicio en todas las páginas
- **CSS moderno** con glassmorphism, animaciones y micro-interacciones
- **Soporte modo oscuro/claro** automático
- **Capacitor 7** con soporte para Ionic 8 y multiplataforma nativa (Kotlin)
- **Optimizado para iOS y Android**

## Estructura de archivos

```
road-to-app/
├── index.html            # Pantalla de bienvenida animada
├── home.html             # Página principal
├── N-Reg.html            # Registro de conductores
├── dashboard.html        # Login
├── perfil.html           # Perfil del conductor
├── panel-usuario.html    # Panel de usuario
├── panel-admin.html      # Panel de administración (con QR y edición)
├── admin.html            # Configuración admin
├── perfil_publico.html   # Perfil público del conductor
├── reset-password.html   # Restablecer contraseña
├── capacitor.config.json # Configuración de Capacitor 7
├── package.json          # Dependencias
└── README.md             # Documentación
```

## Instalación Rápida

### 1. Instalar dependencias

```bash
npm install
```

### 2. Agregar plataformas

```bash
# Android (con Kotlin)
npm run cap:android

# iOS
npm run cap:ios
```

### 3. Sincronizar cambios

```bash
npm run cap:sync
```

### 4. Abrir en IDE

```bash
# Android Studio
npm run cap:open:android

# Xcode
npm run cap:open:ios
```

## Configuración de Supabase

La aplicación está configurada para usar Supabase con las siguientes credenciales:

- **URL**: `https://ugchmuhjzzyofoogprlr.supabase.co`
- **Tablas**: `conductores`, `documentos`, `admins`

## Funcionalidades del Panel Admin

- ✅ Ver lista de conductores
- ✅ Filtrar por estado (todos, activos, pendientes, inactivos)
- ✅ Cambiar estado de conductor (toggle)
- ✅ Editar información del conductor
- ✅ Generar código QR para cada conductor
- ✅ Descargar QR como imagen PNG
- ✅ Enviar QR por email
- ✅ Ver perfil público del conductor
- ✅ Eliminar conductor

## Características visuales

- **Glassmorphism** en todas las tarjetas
- **Animaciones de entrada** suaves
- **Efecto de carretera** en la pantalla de bienvenida
- **Partículas flotantes** en el fondo
- **Micro-interacciones** en botones y campos
- **Safe area support** para notch y barras de sistema

## Compatibilidad

- **iOS**: 14.0+
- **Android**: API 26+ (Android 8.0+)
- **Navegadores**: Chrome, Safari, Firefox, Edge

## Multiplataforma Nativa

Esta aplicación está configurada para usar:
- **Capacitor 7** como bridge nativo
- **Ionic 8** como framework UI
- **Kotlin** para Android (generado automáticamente por Capacitor)
- **Swift** para iOS (generado automáticamente por Capacitor)

## Versión

v2.0.0 - 2026
