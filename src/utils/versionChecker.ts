import * as fs from 'fs';
import * as path from 'path';
import { prompt } from 'enquirer';
import { spawnSync } from 'child_process';
import { logger } from './logger';

export async function checkAndUpdateVersion(
  lambdaPath: string,
  stackName: string
): Promise<boolean> {
  try {
    const packageJsonPath = path.join(lambdaPath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const currentVersion = packageJson.version;
    const gitSha = executeCommandWithOutput(
      'git rev-parse --short HEAD'
    ).trim();

    logger.info(`Current version: ${currentVersion}`);
    logger.info(`Git hash: ${gitSha}`);

    // Verificar se a tag já existe
    const tagExists = executeCommandWithOutput(
      `git tag -l v${currentVersion}`
    ).trim();

    if (tagExists) {
      logger.warning(`Version ${currentVersion} already exists as a git tag.`);
      const { action } = await prompt<{
        action: 'increment' | 'continue' | 'cancel';
      }>({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'increment', message: 'Increment version automatically' },
          { name: 'continue', message: 'Continue with current version' },
          { name: 'cancel', message: 'Cancel deployment' },
        ],
      });

      if (action === 'cancel') {
        return false;
      }

      if (action === 'increment') {
        // Incrementar versão
        const result = spawnSync('npm', ['version', 'patch'], {
          cwd: lambdaPath,
          stdio: 'inherit',
          encoding: 'utf-8',
        });

        if (result.status !== 0) {
          throw new Error('Failed to increment version');
        }

        // Ler a nova versão
        const updatedPackageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf-8')
        );
        logger.success(`Version updated to: ${updatedPackageJson.version}`);
      }
    }

    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Version check failed: ${error.message}`);
    }
    throw new Error('Version check failed with unknown error');
  }
}

// Função auxiliar para executar comandos e retornar output
function executeCommandWithOutput(command: string): string {
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}\n${result.stderr}`);
  }

  return result.stdout;
}
