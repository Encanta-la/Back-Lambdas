import * as fs from 'fs';
import * as path from 'path';
import { prompt } from 'enquirer';
import { spawnSync } from 'child_process';

export async function checkAndUpdateVersion(
  lambdaPath: string,
  env: string
): Promise<boolean> {
  const packageJsonPath = path.join(lambdaPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.log('No package.json found, skipping version check');
    return true;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = packageJson.version;

  // Verificar se a versão já existe no ECR
  const gitHash = spawnSync('git rev-parse --short HEAD', {
    shell: true,
    encoding: 'utf-8',
  }).stdout.trim();

  console.log(`Current version: ${currentVersion}`);
  console.log(`Git hash: ${gitHash}`);

  const { shouldUpdate } = await prompt<{ shouldUpdate: boolean }>({
    type: 'confirm',
    name: 'shouldUpdate',
    message: `Deploy to ${env} with version ${currentVersion}? (No will bump patch version)`,
    initial: true,
  });

  if (!shouldUpdate) {
    // Atualizar versão automaticamente
    const result = spawnSync('npm', ['version', 'patch'], {
      cwd: lambdaPath,
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      throw new Error('Failed to update version');
    }

    // Ler a nova versão
    const updatedPackageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf-8')
    );
    console.log(`Updated to version: ${updatedPackageJson.version}`);
  }

  return true;
}
