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

const keywords = ['package', 'private', 'public', 'interface', 'implements', 'protected', 'static', 'yield'];

const checkReservedWords = () => {
  const files = walk(path.resolve('.'));
  console.log(`Checking reserved words in ${files.length} files...`);

  let count = 0;
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
      // Ignore comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) return;

      keywords.forEach(kw => {
        // Regex to match variable declarations, assignments, parameters, or destructuring
        const varDecl = new RegExp(`\\b(const|let|var|function|import|export|class)\\s+\\b${kw}\\b`);
        const assign = new RegExp(`\\b${kw}\\s*=`);
        const paramList = new RegExp(`[\\(, ]\\s*\\b${kw}\\b\\s*[\\), ]`);
        const destructure = new RegExp(`\\{\\s*\\b${kw}\\b|\\b${kw}\\b\\s*\\}`);

        if (varDecl.test(line) || assign.test(line) || paramList.test(line) || destructure.test(line)) {
          // Exclude safe usages (like express.static or object property definitions like package: )
          if (line.includes(`express.static`) && kw === 'static') return;
          if (line.includes(`${kw}:`) && !line.includes(`{ ${kw}`) && !line.includes(`, ${kw}`)) return; // property key
          if (line.includes(`status === "${kw.toUpperCase()}"`)) return;

          console.log(`[MATCH] ${file}:${idx + 1} -> keyword: ${kw}`);
          console.log(`  Line: ${line.trim()}`);
          count++;
        }
      });
    });
  }
  console.log(`Scan complete. Found ${count} potential reserved word violations.`);
};

checkReservedWords();
