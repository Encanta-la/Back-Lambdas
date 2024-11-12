// interactive-version-update.ts

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { prompt } from 'enquirer';
import chalk from 'chalk';

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
    const packageJsonPath = path.join(
      process.cwd(),
      'src/lambdas',
      lambda,
      'package.json'
    );
    if (fs.existsSync(packageJsonPath)) {
      const currentVersion = require(packageJsonPath).version;
      updates.push({
        lambda,
        currentVersion,
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
    const { shouldUpdate } = await prompt<{ shouldUpdate: boolean }>({
      type: 'confirm',
      name: 'shouldUpdate',
      message: `Deseja atualizar a versão da lambda ${chalk.cyan(
        update.lambda
      )}?`,
      initial: true,
    });

    if (shouldUpdate) {
      const { versionType } = await prompt<{
        versionType: 'patch' | 'minor' | 'major';
      }>({
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
      });

      update.type = versionType;

      // Atualiza a versão
      const lambdaPath = path.join(process.cwd(), 'src/lambdas', update.lambda);
      const result = spawnSync('npm', ['version', versionType], {
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

// Exporta a função para ser usada pelo pre-push
export { updateVersionsInteractive };
