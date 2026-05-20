import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const consoleRegex = /(?<!\/\/\s*)(?<!\/\*\s*)(?<!import\.meta\.env\.DEV\s*&&\s*)(console\.(log|error|warn)\()/g;

const toastErrorRegex1 = /toast\.error\(\s*(?:err|error)\.(?:message|response\?.data\?.message|response\.data\.message)\s*\)/g;
const toastErrorRegex2 = /toast\.error\(\s*(?:err|error)\.safeMessage\s*\|\|\s*["']([^"']+)["']\s*\)/g;
const toastErrorRegex3 = /toast\.error\(\s*(?:err|error)\.safeMessage\s*\|\|\s*(?:err|error)\.message\s*\)/g;

function sanitizeFile(filePath) {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Wrap console logs with import.meta.env.DEV
  content = content.replace(consoleRegex, 'if (import.meta.env.DEV) $1');

  // 2. Sanitize generic toast.error
  // e.g. toast.error(err.message) -> toast.error(err.safeMessage || 'Something went wrong. Please try again.')
  content = content.replace(toastErrorRegex1, "toast.error(err?.safeMessage || 'Something went wrong. Please try again.')");
  
  // 3. Ensure fallback messages in toast.error don't contain bad terms
  content = content.replace(toastErrorRegex2, (match, fallbackMsg) => {
    const bad = ['Failed', 'error', 'Error', 'Exception'];
    if (bad.some(b => fallbackMsg.includes(b))) {
      return `toast.error(err?.safeMessage || 'Something went wrong. Please try again.')`;
    }
    return match; // keep original if it's "Payment could not be completed."
  });

  // 4. Update err.safeMessage || err.message
  content = content.replace(toastErrorRegex3, "toast.error(err?.safeMessage || 'Something went wrong. Please try again.')");

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Sanitized: ${filePath}`);
  }
}

walkDir(srcDir, sanitizeFile);
console.log('Sanitization complete.');
