const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ugchmuhjzzyofoogprlr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnY2htdWhqenp5b2Zvb2dwcmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODUyNDQsImV4cCI6MjA4NTY2MTI0NH0.kB4ZjPhfP29JL6apWFKrXfW-AwnsCKHfmVsBUVjPsX4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function addDriver() {
    const { data, error } = await supabase.auth.signUp({
        email: 'edwin.mendoza2026@roadto.temp',
        password: 'Panama2026!',
        options: {
            data: {
                role: 'conductor',
                nombres: 'Edwin Anel',
                apellidos: 'Mendoza Mendoza'
            }
        }
    });

    if (error) {
        console.error(error.message);
    } else {
        console.log("USER_ID:", data.user.id);
    }
}

addDriver();
