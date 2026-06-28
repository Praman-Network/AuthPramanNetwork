import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../node_modules/@vladmandic/face-api/dist/face-api.esm.js');

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Find which lines have length >= 13413
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length >= 13413) {
      console.log(`Line ${i + 1} has length ${lines[i].length}`);
      const colIndex = 13413;
      const start = Math.max(0, colIndex - 100);
      const end = Math.min(lines[i].length, colIndex + 100);

      console.log(`Snippet around column 13413 on Line ${i + 1}:`);
      console.log('----------------------------');
      console.log(lines[i].slice(start, end));
      console.log('----------------------------');
      found = true;
    }
  }
  if (!found) {
    console.log('No lines found with length >= 13413');
  }
} catch (error) {
  console.error('Error reading file:', error);
}
