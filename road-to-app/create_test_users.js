const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ugchmuhjzzyofoogprlr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnY2htdWhqenp5b2Zvb2dwcmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODUyNDQsImV4cCI6MjA4NTY2MTI0NH0.kB4ZjPhfP29JL6apWFKrXfW-AwnsCKHfmVsBUVjPsX4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createTestUsers() {
    console.log("Creando usuario Conductor...");
    const { data: driverData, error: driverError } = await supabase.auth.signUp({
        email: 'test_conductor@roadto.temp',
        password: 'Password123!',
        options: {
            data: {
                role: 'conductor',
                nombres: 'Test',
                apellidos: 'Conductor'
            }
        }
    });

    if (driverError) {
        console.error("Error Conductor:", driverError.message);
    } else {
        console.log("Conductor creado. USER_ID:", driverData.user.id);
    }

    console.log("\nCreando usuario Pasajero...");
    const { data: paxData, error: paxError } = await supabase.auth.signUp({
        email: 'test_pasajero@roadto.temp',
        password: 'Password123!',
        options: {
            data: {
                role: 'pasajero',
                nombres: 'Test',
                apellidos: 'Pasajero'
            }
        }
    });

    if (paxError) {
        console.error("Error Pasajero:", paxError.message);
    } else {
        console.log("Pasajero creado. USER_ID:", paxData.user.id);
    }
}

createTestUsers();
