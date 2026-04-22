/**
 * Shared local file storage helper.
 * Extracted from rooms.js and recognition.js where it was duplicated.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/**
 * Save a buffer to disk and return a URL path accessible from the client.
 * @param {Buffer} buffer - File contents
 * @param {string} folder - Subdirectory (e.g. 'floor-plans', 'room-photos')
 * @param {string} filename - Original filename
 * @returns {string} URL path like /uploads/floor-plans/12345-plan.jpg
 */
export function saveFileLocally(buffer, folder, filename) {
  const dir = path.join(UPLOADS_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(dir, safeName);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${folder}/${safeName}`;
}
