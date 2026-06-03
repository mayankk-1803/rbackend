import fs from 'fs';
import path from 'path';

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    if (file === 'node_modules' || file === '.git' || file === 'uploads' || file === 'scratch' || file === 'scripts') return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
      results.push(filePath);
    }
  });
  return results;
};

const checkFiles = async () => {
  const serverDir = path.resolve('.');
  console.log(`Scanning server directory: ${serverDir}`);
  const files = walk(serverDir);
  console.log(`Found ${files.length} JS/MJS files to import check.`);

  let errors = [];

  for (const file of files) {
    // Skip entry points that run long servers/workers when imported
    if (file.endsWith('server.js') || file.endsWith('worker.js') || file.endsWith('loadTest.js')) {
      console.log(`Skipping runtime file: ${file}`);
      continue;
    }

    try {
      const fileUrl = 'file://' + file.replace(/\\/g, '/');
      console.log(`Importing: ${file}`);
      await import(fileUrl);
    } catch (err) {
      if (err.message && err.message.includes('reserved word')) {
        console.error(`\n=== RESERVED WORD ERROR DETECTED ===\nFile: ${file}\n`);
        console.error(err);
        console.error("====================================\n");
        errors.push({ file, err });
      } else if (err instanceof SyntaxError) {
        console.error(`\n=== SYNTAX ERROR DETECTED ===\nFile: ${file}\n`);
        console.error(err);
        console.error("==============================\n");
        errors.push({ file, err });
      } else {
        // Ignored runtime errors
      }
    }
  }

  console.log(`\nImport check complete. Found ${errors.length} syntax/reserved word errors.`);
  if (errors.length > 0) {
    process.exit(1);
  }
};

checkFiles();
