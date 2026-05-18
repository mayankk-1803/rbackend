import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const replacements = [
  { old: /Vault/g, new: 'Wallet' },
  { old: /Telemetry/g, new: 'Transactions' },
  { old: /Audit Ledger/g, new: 'Transaction History' },
  { old: /Control/g, new: 'Manage' },
  { old: /Provider/g, new: 'Operator' },
  { old: /Execution/g, new: 'Processing' },
  { old: /Protocol/g, new: 'Search' },
  { old: /Core Console/g, new: 'Admin Panel' },
  { old: /Authority/g, new: 'Admin Access' },
  { old: /Archive/g, new: 'View All' },
  { old: /Settlement/g, new: 'Payment' },
  { old: /Realtime Recharge Telemetry/g, new: 'Recent Transactions' },
  { old: /Initiate Recharge/g, new: 'Recharge Now' }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== '.next') {
        processDirectory(fullPath);
      }
    } else if (/\.(jsx|js|tsx|ts|html|css)$/.test(file)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      for (const replacement of replacements) {
        if (replacement.old.test(content)) {
          content = content.replace(replacement.old, replacement.new);
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

const targetDirs = [
  path.resolve(__dirname, 'admin-web/src'),
  path.resolve(__dirname, 'client-user/src'),
  path.resolve(__dirname, 'admin-web'),
  path.resolve(__dirname, 'client-user')
];

targetDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`Processing: ${dir}`);
    processDirectory(dir);
  }
});
