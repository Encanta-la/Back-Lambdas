import * as path from 'path';

export function getProjectRoot(): string {
  return path.resolve(__dirname, '../..');
}
