const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      content = content.replace(/api\.get\(['"`]\/api\//g, 'api.get(\'/');
      content = content.replace(/api\.post\(['"`]\/api\//g, 'api.post(\'/');
      content = content.replace(/api\.put\(['"`]\/api\//g, 'api.put(\'/');
      content = content.replace(/api\.delete\(['"`]\/api\//g, 'api.delete(\'/');
      content = content.replace(/api\.patch\(['"`]\/api\//g, 'api.patch(\'/');
      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}

replaceInDir('./client-user/src');
replaceInDir('./admin-web/src');
