import fs from 'fs';
import path from 'path';

const schemaPath = path.resolve('prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

const lines = schemaContent.split('\n');

console.log("Lines containing 'mode' or 'CommissionMode' or 'Mode':");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('mode') || line.includes('CommissionMode') || line.includes('Mode')) {
    console.log(`${i + 1}: ${line}`);
  }
}
