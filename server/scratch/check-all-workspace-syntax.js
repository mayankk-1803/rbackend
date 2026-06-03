import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    if (file === 'node_modules' || file === '.git' || file === 'dist') return;
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

const checkFiles = () => {
  const rootDir = path.resolve('..');
  console.log(`Checking syntax recursively in workspace: ${rootDir}`);
  const files = walk(rootDir);
  console.log(`Found ${files.length} JS/MJS files to check.`);

  let errorCount = 0;
  for (const file of files) {
    if (file.endsWith('check-syntax.js') || file.endsWith('check-imports.js') || file.includes('check-all-workspace-syntax.js')) continue;
    try {
      execSync(`node --check "${file}"`, { stdio: 'pipe' });
    } catch (err) {
      errorCount++;
      console.error(`\n[SYNTAX ERROR FOUND] in file: ${file}`);
      console.error(err.stderr.toString().trim());
      console.error('--------------------------------------------------');
    }
  }
  console.log(`\nWorkspace syntax check completed. Found ${errorCount} file(s) with syntax errors.`);
};

checkFiles();
