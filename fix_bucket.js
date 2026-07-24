const fs = require('fs');

const files = [
    'c:\\Proyectos_Git\\conductores-frontend\\panel-admin.html',
    'c:\\Proyectos_Git\\conductores-frontend\\road-to-app\\src\\panel-admin.html'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    content = content.replace(/\.from\('documentos'\)/g, ".from('documentos-conductores')");

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed bucket name in ${file}`);
}
