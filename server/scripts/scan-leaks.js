import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BANNED_KEYWORDS = [
  "ezytm",
  "mplan",
  "apibox",
  "prisma",
  "redis",
  "nextgate",
  "stacktrace",
  "stack trace",
  "internal api",
  "gatewaytxnid",
  "providertxnid"
];

// Paths relative to this script
const TARGET_PATHS = [
  path.resolve(__dirname, "../../client-user/src"),
  path.resolve(__dirname, "../../admin-web/src")
];

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDirectory(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if ([".js", ".jsx", ".ts", ".tsx", ".html", ".css"].includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

async function runScan() {
  console.log("=== STARTING ZERO-TRUST FRONTEND LEAK SCAN ===");
  let leakCount = 0;

  for (const targetPath of TARGET_PATHS) {
    console.log(`Scanning path: ${targetPath}...`);
    if (!fs.existsSync(targetPath)) {
      console.warn(`Path does not exist: ${targetPath}`);
      continue;
    }

    const files = scanDirectory(targetPath);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        for (const keyword of BANNED_KEYWORDS) {
          // Check if keyword is found as a whole word or substring
          if (line.includes(keyword)) {
            // Exceptions: we might import tools or have sanitizers, but the actual UI should not leak them.
            // Let's print out the leak warning.
            // We want to be strict but allow sanitizeErrorMessage.js itself (which contains whitelists/regexes).
            if (file.includes("sanitizeErrorMessage.js")) {
              continue;
            }
            console.error(`[LEAK DETECTED] File: ${path.basename(file)} | Line ${i + 1}: Found banned keyword "${keyword}"`);
            console.error(`  > ${lines[i].trim().substring(0, 120)}`);
            leakCount++;
          }
        }
      }
    }
  }

  console.log(`\nScan finished. Total leaks found: ${leakCount}`);
  if (leakCount > 0) {
    console.error("FAIL: Banned keywords or variables leaked to the client codebase!");
    process.exit(1);
  } else {
    console.log("PASS: Zero-trust leak checks succeeded.");
  }
}

runScan();
