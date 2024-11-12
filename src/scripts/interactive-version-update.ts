import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { spawnSync } from 'child_process';
import Enquirer from 'enquirer';
import chalk from 'chalk';

// ESM não tem __filename e __dirname globais, precisamos criar
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ShouldUpdatePrompt {
  shouldUpdate: boolean;
}

interface VersionTypePrompt {
  versionType: 'patch' | 'minor' | 'major';
}

interface VersionUpdate {
  lambda: string;
  currentVersion: string;
  type?: 'patch' | 'minor' | 'major';
}

async function updateVersionsInteractive(
  lambdasToUpdate: string[]
): Promise<void> {
  const updates: VersionUpdate[] = [];

  // Prepara informações das lambdas
  for (const lambda of lambdasToUpdate) {
    const packageJsonPath = join(
      process.cwd(),
      'src/lambdas',
      lambda,
      'package.json'
    );
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      updates.push({
        lambda,
        currentVersion: packageJson.version,
      });
    }
  }

  // Mostra tabela de lambdas que precisam atualização
  console.log('\n');
  console.log(
    chalk.yellow('📦 Lambdas que precisam de atualização de versão:')
  );
  console.log(chalk.yellow('+-----------------------+-----------------+'));
  console.log(chalk.yellow('| Lambda                | Versão Atual   |'));
  console.log(chalk.yellow('+-----------------------+-----------------+'));

  for (const update of updates) {
    console.log(
      chalk.yellow(
        `| ${update.lambda.padEnd(21)} | ${update.currentVersion.padEnd(13)} |`
      )
    );
  }

  console.log(chalk.yellow('+-----------------------+-----------------+'));
  console.log('\n');

  // Pergunta para cada lambda
  for (const update of updates) {
    const response: ShouldUpdatePrompt = (await Enquirer.prompt({
      type: 'confirm',
      name: 'shouldUpdate',
      message: `Deseja atualizar a versão da lambda ${chalk.cyan(
        update.lambda
      )}?`,
      initial: true,
    })) as ShouldUpdatePrompt;

    if (response.shouldUpdate) {
      const versionResponse: VersionTypePrompt = (await Enquirer.prompt({
        type: 'select',
        name: 'versionType',
        message: `Selecione o tipo de atualização para ${chalk.cyan(
          update.lambda
        )}:`,
        choices: [
          { name: 'patch', message: `patch ${chalk.gray('(1.0.0 -> 1.0.1)')}` },
          { name: 'minor', message: `minor ${chalk.gray('(1.0.0 -> 1.1.0)')}` },
          { name: 'major', message: `major ${chalk.gray('(1.0.0 -> 2.0.0)')}` },
        ],
      })) as VersionTypePrompt;

      update.type = versionResponse.versionType;

      // Atualiza a versão
      const lambdaPath = join(process.cwd(), 'src/lambdas', update.lambda);
      const result = spawnSync('npm', ['version', update.type], {
        cwd: lambdaPath,
        stdio: 'inherit',
      });

      if (result.status === 0) {
        console.log(
          chalk.green(
            `✅ Versão da lambda ${chalk.cyan(
              update.lambda
            )} atualizada com sucesso!`
          )
        );
      } else {
        console.log(
          chalk.red(
            `❌ Erro ao atualizar versão da lambda ${chalk.cyan(update.lambda)}`
          )
        );
      }
    }
  }

  // Mostra resumo das atualizações
  const updatedLambdas = updates.filter((u) => u.type);
  if (updatedLambdas.length > 0) {
    console.log('\n');
    console.log(chalk.green('✨ Resumo das atualizações:'));
    console.log(
      chalk.green('+-----------------------+-----------------+---------+')
    );
    console.log(
      chalk.green('| Lambda                | Versão Atual   | Tipo    |')
    );
    console.log(
      chalk.green('+-----------------------+-----------------+---------+')
    );

    for (const update of updatedLambdas) {
      console.log(
        chalk.green(
          `| ${update.lambda.padEnd(21)} | ${update.currentVersion.padEnd(
            13
          )} | ${update.type?.padEnd(7)} |`
        )
      );
    }

    console.log(
      chalk.green('+-----------------------+-----------------+---------+')
    );
  }
}

// Função para listar todas as lambdas
function executeGitCommand(args: string[]): string {
  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    cwd: process.cwd(),
  });
  return result.stdout.trim();
}

// Função para verificar se uma lambda foi modificada
function isLambdaModified(lambdaPath: string): boolean {
  // Verifica alterações não commitadas
  const untrackedChanges = executeGitCommand([
    'status',
    '--porcelain',
    lambdaPath,
  ]);
  if (untrackedChanges) {
    return true;
  }

  // Verifica alterações entre o remote e local
  const remoteChanges = executeGitCommand([
    'diff',
    'origin/main...HEAD',
    '--name-only',
    lambdaPath,
  ]);

  // Verifica alterações commitadas localmente
  const localChanges = executeGitCommand([
    'diff',
    'HEAD',
    '--name-only',
    lambdaPath,
  ]);

  return Boolean(remoteChanges || localChanges);
}

function getModifiedLambdas(): string[] {
  const lambdasDir = join(process.cwd(), 'src/lambdas');
  const allLambdas = readdirSync(lambdasDir).filter((file) =>
    statSync(join(lambdasDir, file)).isDirectory()
  );

  return allLambdas.filter((lambda) => {
    const lambdaPath = join('src/lambdas', lambda);
    return isLambdaModified(lambdaPath);
  });
}

// Se o arquivo for executado diretamente (não importado como módulo)
if (import.meta.url === `file://${process.argv[1]}`) {
  const modifiedLambdas = getModifiedLambdas();

  if (modifiedLambdas.length === 0) {
    console.log(chalk.yellow('ℹ️  Nenhuma lambda com alterações detectadas.'));
    process.exit(0);
  }

  await updateVersionsInteractive(modifiedLambdas);
}

export { updateVersionsInteractive, getModifiedLambdas };
