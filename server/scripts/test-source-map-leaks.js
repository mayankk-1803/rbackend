import fs from "fs";
import path from "url";
import filePath from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = filePath.dirname(__filename);

const VITE_CONFIGS = [
  filePath.resolve(__dirname, "../../client-user/vite.config.js"),
  filePath.resolve(__dirname, "../../admin-web/vite.config.js")
];

async function runTests() {
  console.log("=== STARTING SOURCE MAP AND CONSOLE DROPPING LEAK TESTS ===");

  try {
    for (const configPath of VITE_CONFIGS) {
      console.log(`Checking config: ${configPath}...`);
      if (!fs.existsSync(configPath)) {
        throw new Error(`Vite config file not found: ${configPath}`);
      }

      const content = fs.readFileSync(configPath, "utf8");
      const normalizedContent = content.replace(/\s+/g, "");

      // 1. Verify sourcemap: false
      if (!normalizedContent.includes("sourcemap:false")) {
        throw new Error(`Production config check failed: "sourcemap: false" not set in ${configPath}`);
      }
      console.log("  [OK] sourcemap is explicitly disabled.");

      // 2. Verify console & debugger dropping
      if (!normalizedContent.includes("drop_console:true") || !normalizedContent.includes("drop_debugger:true")) {
        throw new Error(`Production config check failed: drop_console and/or drop_debugger is not set to true in ${configPath}`);
      }
      console.log("  [OK] console and debugger statement dropping is enabled.");
    }

    console.log("=== ALL SOURCE MAP LEAK TESTS PASSED ===");
  } catch (error) {
    console.error("TEST FAILED:", error);
    process.exit(1);
  }
}

runTests();
