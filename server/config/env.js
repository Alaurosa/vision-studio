import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load root .env (single source of truth for this monorepo)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
