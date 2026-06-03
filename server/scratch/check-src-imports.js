import fs from 'fs';
import path from 'path';

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
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
  const srcDir = path.resolve('src');
  console.log(`Scanning src directory: ${srcDir}`);
  const files = walk(srcDir);
  console.log(`Found ${files.length} JS files in src to import check.`);

  let errors = [];

  for (const file of files) {
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
        // Other errors (e.g. Prisma connection, runtime imports, etc.) are expected since we are importing individual files
        // and we can ignore them for syntax validation.
      }
    }
  }

  console.log(`\nImport check complete. Found ${errors.length} syntax/reserved word errors.`);
  if (errors.length > 0) {
    process.exit(1);
  }
};

checkFiles();
