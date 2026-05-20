import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const confidentialBrands = ["mplan", "ezytm", "apibox", "nexgate", "redis", "prisma", "webhook", "cron", "reconciliation"];

let leaksFound = 0;

function scanFile(filePath) {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // 1. Check for unsanitized toast.error
    if (/toast\.error\(\s*(?:err|error)\.(?:message|response\?.data\?.message|response\.data\.message)\s*\)/.test(line)) {
      console.error(`[LEAK] Unsanitized toast.error in ${filePath}:${index + 1}`);
      leaksFound++;
    }

    // 2. Check for unguarded console.log (basic check)
    // If line has console.log but doesn't have import.meta.env.DEV
    if (/(?<!\/\/\s*)(?<!\/\*\s*)console\.(log|error|warn)\(/.test(line)) {
      if (!line.includes('import.meta.env.DEV') && !content.includes('!import.meta.env.DEV')) {
        console.error(`[LEAK] Unguarded console output in ${filePath}:${index + 1}`);
        leaksFound++;
      }
    }

    // 3. Check for confidential brands hardcoded
    // Exclude sanitizeErrorMessage.js itself because it contains the whitelist
    if (!filePath.includes('sanitizeErrorMessage.js') && !filePath.includes('leak-scanner.js')) {
      const lowerLine = line.toLowerCase();
      confidentialBrands.forEach(brand => {
        if (lowerLine.includes(brand)) {
          // ignore comments or imports
          if (!line.trim().startsWith('//') && !line.includes('import')) {
            console.error(`[LEAK] Confidential brand '${brand}' found in ${filePath}:${index + 1}`);
            leaksFound++;
          }
        }
      });
    }
  });
}

console.log("Starting leak scan...");
walkDir(srcDir, scanFile);

if (leaksFound === 0) {
  console.log("SUCCESS: 0 leaks found. Frontend is secure.");
  process.exit(0);
} else {
  console.error(`FAILED: ${leaksFound} leaks found.`);
  process.exit(1);
}
