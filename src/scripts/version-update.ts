import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const updateVersion = (type: string, specificLambda?: string) => {
  const lambdasDir = path.join(__dirname, '../lambdas');
  const lambdaFolders = fs.readdirSync(lambdasDir);

  for (const folder of lambdaFolders) {
    // Pula se uma lambda específica foi especificada e não é a atual
    if (specificLambda && folder !== specificLambda) {
      continue;
    }

    const packageJsonPath = path.join(lambdasDir, folder, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      console.log(`Updating version for ${folder}`);
      spawnSync('npm', ['version', type], {
        cwd: path.join(lambdasDir, folder),
        stdio: 'inherit',
      });
    }
  }
};

// Pega os argumentos da linha de comando
const type = process.argv[2] || 'patch';
const specificLambda = process.argv[3];

if (specificLambda) {
  console.log(`Updating version for specific lambda: ${specificLambda}`);
}

updateVersion(type, specificLambda);
