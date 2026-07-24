const fs = require('fs');
const path = require('path');

function fixFilesInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixFilesInDir(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            // Regex to match /* log removed */
            const regex = /\/\* log removed \*\/[^\n;}]*\);?/g;
            if (regex.test(content)) {
                content = content.replace(regex, '/* log removed */
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Fixed syntax errors in: ${fullPath}`);
            }
        }
    }
}

fixFilesInDir('c:\\Proyectos_Git\\conductores-frontend\\road-to-app\\src');
fixFilesInDir('c:\\Proyectos_Git\\conductores-frontend');
