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
    const gitHash = executeCommandWithOutput(
      'git rev-parse --short HEAD'
    ).trim();

    logger.info(`Current version: ${currentVersion}`);
    logger.info(`Git hash: ${gitHash}`);

    // Verificar se há alterações não commitadas
    const gitStatus = executeCommandWithOutput('git status --porcelain');
    if (gitStatus.trim() !== '') {
      throw new Error(
        'Git working directory is not clean. Please commit or stash changes.'
      );
    }

    // Verificar se a tag já existe
    const tagExists = executeCommandWithOutput(
      `git tag -l v${currentVersion}`
    ).trim();

    if (tagExists) {
      logger.warning(`Version ${currentVersion} already exists as a git tag.`);
      const { proceed } = await prompt<{ proceed: boolean }>({
        type: 'confirm',
        name: 'proceed',
        message: 'Do you want to proceed with deployment anyway?',
        initial: false,
      });
      return proceed;
    }

    // Se chegou aqui, está tudo ok para continuar
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
