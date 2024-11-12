import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Definição do __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type VersionType = 'major' | 'minor' | 'patch';

const updateVersion = (type: VersionType, specificLambda?: string): void => {
  const lambdasDir = join(__dirname, '../lambdas');
  const lambdaFolders = readdirSync(lambdasDir);

  for (const folder of lambdaFolders) {
    // Pula se uma lambda específica foi especificada e não é a atual
    if (specificLambda && folder !== specificLambda) {
      continue;
    }

    const packageJsonPath = join(lambdasDir, folder, 'package.json');
    if (existsSync(packageJsonPath)) {
      console.log(`📦 Atualizando versão para ${folder}`);
      const result = spawnSync('npm', ['version', type], {
        cwd: join(lambdasDir, folder),
        stdio: 'inherit',
      });

      if (result.status === 0) {
        console.log(`✅ Versão atualizada com sucesso para ${folder}`);
      } else {
        console.error(`❌ Erro ao atualizar versão para ${folder}`);
      }
    }
  }
};

// Validação do tipo de versão
const validateVersionType = (type: string): VersionType => {
  if (!['major', 'minor', 'patch'].includes(type)) {
    throw new Error('Tipo de versão inválido. Use: major, minor ou patch');
  }
  return type as VersionType;
};

// Execução principal
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const type = validateVersionType(process.argv[2] || 'patch');
    const specificLambda = process.argv[3];

    if (specificLambda) {
      console.log(
        `🎯 Atualizando versão para lambda específica: ${specificLambda}`
      );
    }

    updateVersion(type, specificLambda);
  } catch (error) {
    console.error(
      '❌ Erro:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

export { updateVersion, validateVersionType };
