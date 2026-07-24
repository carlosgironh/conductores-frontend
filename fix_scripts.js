const fs = require('fs');

const files = [
    'c:\\Proyectos_Git\\conductores-frontend\\panel-admin.html',
    'c:\\Proyectos_Git\\conductores-frontend\\road-to-app\\src\\panel-admin.html'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace the content inside the first script tag
    content = content.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\/dist\/umd\/supabase\.min\.js">[\s\S]*?<\/script>/, '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>');
    
    // Replace the content inside the second script tag
    content = content.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/qrcode\/build\/qrcode\.min\.js">[\s\S]*?<\/script>/, '<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>');

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed ${file}`);
}
