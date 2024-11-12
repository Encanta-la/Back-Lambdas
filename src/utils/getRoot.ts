import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getProjectRoot(): string {
  return path.resolve(__dirname, '../..');
}
