const fs = require('fs');

function extractAndCheck(file, outFile) {
    const content = fs.readFileSync(file, 'utf8');
    const scriptRegex = /<script>(.*?)<\/script>/gs;
    const match = scriptRegex.exec(content);
    if (match) {
        fs.writeFileSync(outFile, match[1], 'utf8');
    }
}

extractAndCheck('c:\\Proyectos_Git\\conductores-frontend\\road-to-app\\src\\perfil.html', 'temp_perfil.js');
extractAndCheck('c:\\Proyectos_Git\\conductores-frontend\\road-to-app\\src\\perfil_publico.html', 'temp_perfil_publico.js');
