import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '../.env.local')
];

const envPath = envCandidates.find(candidate => fs.existsSync(candidate));
if (envPath) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}
