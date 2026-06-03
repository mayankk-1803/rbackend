import fs from 'fs';
import path from 'path';

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    // Exclude node_modules and .git directories
    if (file === 'node_modules' || file === '.git') return;
    
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (file.endsWith('.js')) {
      results.push(filePath);
    }
  });
  return results;
};

const checkFiles = async () => {
  const rootDir = path.resolve('.');
  console.log(`Scanning root directory: ${rootDir}`);
  const files = walk(rootDir);
  console.log(`Found ${files.length} JS files to import check.`);

  for (const file of files) {
    // Skip the checker script itself to avoid infinite loop or redundant logs
    if (file.endsWith('check-imports.js')) continue;

    try {
      const fileUrl = 'file://' + file.replace(/\\/g, '/');
      await import(fileUrl);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.error(`\n=== SYNTAX ERROR DETECTED IN FILE ===\n${file}\n`);
        console.error(err);
        console.error("=====================================\n");
      } else {
        if (err.message && err.message.includes('reserved word')) {
          console.error(`\n=== RESERVED WORD ERROR DETECTED IN FILE ===\n${file}\n`);
          console.error(err);
          console.error("============================================\n");
        }
      }
    }
  }
  console.log("Check complete.");
};

checkFiles();
