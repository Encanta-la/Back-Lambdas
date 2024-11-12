const fs = require('fs');
const path = require('path');
const { prompt } = require('enquirer');
const { execSync } = require('child_process');

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const currentVersion = packageJson.version;

function getNewVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return version;
  }
}

async function main() {
  try {
    const gitStatus = execSync('git status --porcelain').toString().trim();
    if (gitStatus) {
      console.error(
        'O diretório de trabalho do Git não está limpo. Por favor, faça commit ou stash das mudanças.'
      );
      process.exit(1);
    }

    // Verifica se o script está sendo executado em um ambiente interativo
    if (!process.stdin.isTTY) {
      console.error(
        'O script não está sendo executado em um ambiente interativo.'
      );
      process.exit(1);
    }

    const { confirm } = await prompt({
      type: 'confirm',
      name: 'confirm',
      message: `A versão atual é ${currentVersion}. Deseja atualizar a versão?`,
      initial: false,
    });

    if (!confirm) {
      console.log('Push cancelado pelo usuário.');
      process.exit(2); // Código de saída específico para cancelamento pelo usuário
    }

    const { versionType } = await prompt({
      type: 'select',
      name: 'versionType',
      message: 'Selecione o tipo de versão para atualizar:',
      choices: ['patch', 'minor', 'major'],
    });

    const newVersion = getNewVersion(currentVersion, versionType);
    packageJson.version = newVersion;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    execSync('git add package.json');
    execSync(`git commit -m "chore: bump version to ${newVersion}"`);

    console.log(`Versão atualizada para ${newVersion}.`);
    process.exit(0);
  } catch (error) {
    console.error(`Erro ao atualizar a versão: ${error.message}`);
    process.exit(1);
  }
}

main();
