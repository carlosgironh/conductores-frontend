const fs = require('fs');

const files = [
    'c:\\Proyectos_Git\\conductores-frontend\\panel-admin.html',
    'c:\\Proyectos_Git\\conductores-frontend\\road-to-app\\src\\panel-admin.html'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // We want to replace `supabaseClient.from('documentos-conductores')`
    // with `supabaseClient.from('documentos')`.
    // But we MUST NOT replace `supabaseClient.storage.from('documentos-conductores')`.
    // So we match precisely: `supabaseClient.from('documentos-conductores')`
    
    content = content.replace(/supabaseClient\.from\('documentos-conductores'\)/g, "supabaseClient.from('documentos')");
    
    // Also check if there was any `await supabaseClient.from(...)` where we might have just used `.from`
    // Let's just be very explicit:
    // If it's preceded by `storage`, it shouldn't match `supabaseClient.from` anyway.
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed table name in ${file}`);
}
