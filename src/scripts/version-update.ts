import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const updateVersion = (type: any) => {
  const lambdasDir = path.join(__dirname, '../src/lambdas');
  const lambdaFolders = fs.readdirSync(lambdasDir);

  for (const folder of lambdaFolders) {
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

const type = process.argv[2] || 'patch';
updateVersion(type);
