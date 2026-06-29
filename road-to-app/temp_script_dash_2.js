
const SUPABASE_URL = "https://ugchmuhjzzyofoogprlr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnY2htdWhqenp5b2Zvb2dwcmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODUyNDQsImV4cCI6MjA4NTY2MTI0NH0.kB4ZjPhfP29JL6apWFKrXfW-AwnsCKHfmVsBUVjPsX4";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUserId = null;
let currentUserEmail = null;

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.href = 'index.html';
}
function goHome() { window.location.href = 'index.html'; }

function showMessage(text, type = '', targetId = 'msg') {
  const msg = document.getElementById(targetId);
  msg.textContent = text;
  msg.className = 'msg show ' + type;
  if (!text) msg.classList.remove('show');
}

function showLoginForm() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('completeProfileForm').classList.remove('show');
}

function showCompleteProfileForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('completeProfileForm').classList.add('show');
}

async function logoutAndReturn() {
  await supabaseClient.auth.signOut();
  showLoginForm();
  showMessage("Ingresa nuevamente para registrarte", "", "msg");
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const btn = document.getElementById("loginBtn");

  if(!email || !password){
    showMessage("Completa todos los campos", "error");
    return;
  }

  showMessage("Verificando credenciales...", "loading");
  btn.disabled = true;

  try {
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });

    if(authError){
      console.error("[LOGIN] Auth error:", authError);
      if(authError.message?.includes("Invalid login")) {
        showMessage("Correo o contraseña incorrectos", "error");
      } else {
        showMessage("Error: " + authError.message, "error");
      }
      btn.disabled = false;
      return;
    }

    const userId = authData.user.id;
    currentUserId = userId;
    currentUserEmail = email;
    console.log("[LOGIN] Usuario autenticado:", userId);

    // 1. Verificar si es admin
    const { data: adminData } = await supabaseClient
      .from('admins').select('auth_user_id').eq('auth_user_id', userId).maybeSingle();

    if(adminData?.auth_user_id){ 
      showMessage("¡Ingreso exitoso! Redirigiendo...", "success");
      setTimeout(() => window.location.href = "panel-admin.html", 1200);
      return;
    }

    // 2. Verificar si es coordinador
    const { data: coordData } = await supabaseClient
      .from('coordinadores').select('auth_user_id').eq('auth_user_id', userId).maybeSingle();

    if(coordData?.auth_user_id){ 
      showMessage("¡Bienvenido coordinador! Redirigiendo...", "success");
      setTimeout(() => window.location.href = "panel-coordinador.html", 1200);
      return;
    }

    // 3. Verificar si es conductor (CORREGIDO: busca por auth_user_id, no por id)
    const { data: conductorData } = await supabaseClient
      .from('conductores').select('id').eq('auth_user_id', userId).maybeSingle();

    if(conductorData) {
      showMessage("¡Bienvenido conductor! Redirigiendo...", "success");
      setTimeout(() => window.location.href = "panel-viajes.html", 1200);
      return;
    }

    // 4. Verificar si es pasajero
    const { data: pasajeroData } = await supabaseClient
      .from('passengers').select('id, status').eq('id', userId).maybeSingle();

    if(pasajeroData) {
      if(pasajeroData.status === 'banned' || pasajeroData.status === 'inactive') {
        showMessage("Tu cuenta está suspendida. Contacta soporte.", "error");
        await supabaseClient.auth.signOut();
        btn.disabled = false;
        return;
      }
      showMessage("¡Bienvenido! Redirigiendo...", "success");
      setTimeout(() => window.location.href = "reservar-viaje.html", 1200);
      return;
    }

    // 5. NO ESTA EN NINGUNA TABLA -> Mostrar formulario de completar perfil
    console.log("[LOGIN] Usuario no encontrado en tablas. Mostrando formulario de completar perfil.");
    showMessage("Es necesario completar tu perfil", "success");
    showCompleteProfileForm();
    btn.disabled = false;

  } catch (err) {
    console.error("[LOGIN] Error inesperado:", err);
    showMessage("Error de conexión: " + err.message, "error");
    btn.disabled = false;
  }
}

async function createPassengerProfile() {
  const nombres = document.getElementById('cp-nombres').value.trim();
  const apellidos = document.getElementById('cp-apellidos').value.trim();
  const celular = document.getElementById('cp-celular').value.trim();
  const btn = document.getElementById('cpBtn');

  if(!nombres || !apellidos || !celular){
    showMessage("Completa todos los campos obligatorios", "error", "cp-msg");
    return;
  }

  showMessage("Creando tu perfil...", "loading", "cp-msg");
  btn.disabled = true;

  try {
    const { error: insertError } = await supabaseClient
      .from('passengers')
      .insert({ 
        id: currentUserId,
        nombres: nombres,
        apellidos: apellidos,
        celular: celular,
        email: currentUserEmail,
        status: 'active'
      });

    if(insertError) {
      console.error("[LOGIN] Error creando pasajero:", insertError);
      showMessage("Error: " + insertError.message, "error", "cp-msg");
      btn.disabled = false;
      return;
    }

    console.log("[LOGIN] Perfil de pasajero creado exitosamente");
    showMessage("¡Perfil creado! Redirigiendo...", "success", "cp-msg");
    setTimeout(() => window.location.href = "reservar-viaje.html", 1500);

  } catch (err) {
    console.error("[LOGIN] Error inesperado:", err);
    showMessage("Error de conexión: " + err.message, "error", "cp-msg");
    btn.disabled = false;
  }
}

async function recuperar(){
  const email = prompt("Ingresa tu correo electrónico registrado:");
  if(!email) return;
  showMessage("Enviando correo de recuperación...", "loading");
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password.html"
    });
    if(error){
      showMessage("Error al enviar el correo: " + error.message, "error");
    } else {
      showMessage("Si el correo existe, recibirás un enlace de recuperación", "success");
    }
  } catch (err) {
    showMessage("Error de conexión", "error");
  }
}

document.getElementById('password').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') login();
});

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, false);
