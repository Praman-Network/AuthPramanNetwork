import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_DIR = path.join(__dirname, '../public/models');
const CDN_BASE_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

const filesToDownload = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1'
];

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

function downloadFile(fileName) {
  return new Promise((resolve, reject) => {
    const dest = path.join(MODELS_DIR, fileName);
    const url = `${CDN_BASE_URL}/${fileName}`;
    const file = fs.createWriteStream(dest);

    console.log(`Downloading ${fileName}...`);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${fileName}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded ${fileName}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  try {
    for (const file of filesToDownload) {
      await downloadFile(file);
    }
    console.log('All models downloaded successfully!');
  } catch (error) {
    console.error('Error downloading models:', error);
    process.exit(1);
  }
}

main();
