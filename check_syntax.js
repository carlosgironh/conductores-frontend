const fs = require('fs');

function checkHtmlScriptSyntax(file) {
    const content = fs.readFileSync(file, 'utf8');
    const scriptRegex = /<script>(.*?)<\/script>/gs;
    let match;
    let index = 0;
    while ((match = scriptRegex.exec(content)) !== null) {
        const scriptContent = match[1];
        try {
            new Function(scriptContent);
            console.log(`[OK] Script ${index} in ${file}`);
        } catch (e) {
            console.error(`[ERROR] Script ${index} in ${file}: ${e.message}`);
        }
        index++;
    }
}

checkHtmlScriptSyntax('c:\\Proyectos_Git\\conductores-frontend\\road-to-app\\src\\perfil-pasajero.html');
checkHtmlScriptSyntax('c:\\Proyectos_Git\\conductores-frontend\\road-to-app\\src\\perfil.html');
checkHtmlScriptSyntax('c:\\Proyectos_Git\\conductores-frontend\\road-to-app\\src\\perfil_publico.html');
