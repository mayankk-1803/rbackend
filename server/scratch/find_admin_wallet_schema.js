import fs from 'fs';
import path from 'path';

const schemaPath = 'd:/Dizipay/recharge-backend/server/prisma/schema.prisma';
const content = fs.readFileSync(schemaPath, 'utf8');
const lines = content.split('\n');

let print = false;
let modelName = '';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim().startsWith('model ')) {
    modelName = line.trim().split(/\s+/)[1];
    if (modelName.toLowerCase().includes('admin')) {
      print = true;
      console.log(`--- Model ${modelName} (starts at line ${i+1}) ---`);
    } else {
      print = false;
    }
  }
  if (print) {
    console.log(`${i+1}: ${line}`);
  }
}
