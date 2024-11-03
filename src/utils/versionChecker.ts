import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { prompt } from 'enquirer';
import { logger } from './logger';

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

    // Buscar todas as tags remotas
    executeCommandWithOutput('git fetch --tags');

    // Verificar se a tag existe (local ou remota)
    const tagExists =
      executeCommandWithOutput(`git tag -l v${currentVersion}`).trim() ||
      executeCommandWithOutput(
        `git ls-remote --tags origin refs/tags/v${currentVersion}`
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

        // Criar e enviar a nova tag
        executeCommandWithOutput(
          `git tag -a v${updatedPackageJson.version} -m "Version ${updatedPackageJson.version}"`
        );
        executeCommandWithOutput('git push --tags');
      }
    } else {
      // Se a tag não existe, criar ela
      executeCommandWithOutput(
        `git tag -a v${currentVersion} -m "Version ${currentVersion}"`
      );
      executeCommandWithOutput('git push --tags');
      logger.info(`Created new tag v${currentVersion}`);
    }

    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Version check failed: ${error.message}`);
    }
    throw new Error('Version check failed with unknown error');
  }
}
