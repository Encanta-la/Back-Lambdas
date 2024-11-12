import { SpawnOptions, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as fs from 'node:fs';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import Enquirer from 'enquirer';
import ora from 'ora';

import { environments } from './config/environments.js';
import { deployConfig } from './config/deployConfig.js';
import { getProjectRoot } from '../utils/getRoot.js';
import { checkAndUpdateVersion } from '../utils/versionChecker.js';
import { logger } from '../utils/logger.js';

interface DetailedError {
  type:
    | 'DEPENDENCY_MISSING'
    | 'PERMISSION_ERROR'
    | 'COMMAND_ERROR'
    | 'UNKNOWN_ERROR';
  message: string;
  details?: string;
  command?: string;
}

interface Args {
  profile: string;
  env: string;
  lambda: string;
  [key: string]: unknown;
}

interface DeployMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  environment: string;
  version: string;
  lambdaName: string;
}

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export class DeploymentMetrics {
  private static metrics: DeployMetrics[] = [];

  static startDeploy(lambdaName: string, env: string, version: string) {
    this.metrics.push({
      startTime: Date.now(),
      success: false,
      environment: env,
      version,
      lambdaName,
    });
  }

  static endDeploy(success: boolean) {
    const currentDeploy = this.metrics[this.metrics.length - 1];
    currentDeploy.endTime = Date.now();
    currentDeploy.duration = currentDeploy.endTime - currentDeploy.startTime;
    currentDeploy.success = success;
  }

  static printSummary() {
    console.table(this.metrics);
  }
}

const executeCommandWithOutput = (command: string): string => {
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}\n${result.stderr}`);
  }

  return result.stdout.trim();
};

const executeCommand = async (
  command: string,
  options: SpawnOptions = {}
): Promise<CommandResult> => {
  const MAX_RETRIES = deployConfig.maxRetries;
  let attempt = 0;

  // Função auxiliar para verificar dependências ausentes
  function checkForMissingDependency(
    stderr: string,
    stdout: string
  ): DetailedError | null {
    const errorOutput = (stderr + stdout).toLowerCase();

    // Mapeamento de erros comuns
    const commonErrors = [
      {
        pattern: 'command not found: jq',
        type: 'DEPENDENCY_MISSING' as const,
        message:
          'O comando jq não está instalado. Por favor, instale usando:\n' +
          '- Mac: brew install jq\n' +
          '- Ubuntu/Debian: sudo apt-get install jq\n' +
          '- RHEL/CentOS: sudo yum install jq',
      },
      {
        pattern: 'command not found: aws',
        type: 'DEPENDENCY_MISSING' as const,
        message:
          'AWS CLI não está instalado. Por favor, instale usando:\n' +
          '- Mac: brew install awscli\n' +
          '- Ubuntu/Debian: sudo apt-get install awscli\n' +
          '- Ou siga a documentação oficial: https://aws.amazon.com/cli/',
      },
      // Adicione outros padrões de erro conforme necessário
    ];

    for (const error of commonErrors) {
      if (errorOutput.includes(error.pattern)) {
        return {
          type: error.type,
          message: error.message,
          command: command,
        };
      }
    }

    return null;
  }

  while (attempt < MAX_RETRIES) {
    try {
      const result = spawnSync(command, {
        shell: true,
        timeout: deployConfig.timeout,
        encoding: 'utf-8',
        ...options,
      });

      // Verifica se há erros de dependências
      const dependencyError = checkForMissingDependency(
        result.stderr?.toString() || '',
        result.stdout?.toString() || ''
      );

      if (dependencyError) {
        throw dependencyError;
      }

      if (result.status === 0) {
        return {
          status: result.status,
          stdout: result.stdout?.toString() || '',
          stderr: result.stderr?.toString() || '',
        };
      }

      // Se chegou aqui, houve erro na execução do comando
      attempt++;
      logger.warning(`Tentativa ${attempt}/${MAX_RETRIES} falhou`);
      logger.warning(`Saída de erro: ${result.stderr}`);
      logger.warning(`Saída padrão: ${result.stdout}`);
    } catch (error: unknown) {
      attempt++;

      // Se for um erro detalhado que identificamos
      if ((error as DetailedError).type) {
        const detailedError = error as DetailedError;
        logger.error(`${detailedError.type}: ${detailedError.message}`);

        // Se for erro de dependência, não faz sentido tentar novamente
        if (detailedError.type === 'DEPENDENCY_MISSING') {
          throw new Error(detailedError.message);
        }
      } else if (error instanceof Error) {
        logger.warning(`Erro na execução do comando: ${error.message}`);
      } else {
        logger.warning(`Erro desconhecido: ${String(error)}`);
      }
    }
  }

  throw new Error(`Comando falhou após ${MAX_RETRIES} tentativas: ${command}`);
};

async function checkDependencies() {
  const dependencies = ['docker', 'git', 'aws'];
  for (const dep of dependencies) {
    const result = spawnSync('which', [dep]);
    if (result.status !== 0) {
      throw new Error(`Required dependency "${dep}" is not installed`);
    }
  }
}

async function checkGitStatus(): Promise<void> {
  const status = executeCommandWithOutput('git status --porcelain');

  if (status) {
    throw new Error(
      'Git working directory is not clean. Please commit or stash changes.'
    );
  }
}

async function validateEnvironment(env: string) {
  const validEnvs = ['dev', 'staging', 'prod'];
  if (!validEnvs.includes(env)) {
    throw new Error(
      `Invalid environment: ${env}. Must be one of: ${validEnvs.join(', ')}`
    );
  }

  if (env === 'prod') {
    const { confirm } = await Enquirer.prompt<{ confirm: boolean }>({
      type: 'confirm',
      name: 'confirm',
      message: '⚠️ You are deploying to PRODUCTION. Are you sure?',
      initial: false,
    });
    return confirm;
  }
  return true;
}

async function cleanupDocker(lambdaName: string) {
  const cleanupCommand = `docker image prune -f --filter "label=lambda=${lambdaName}"`;
  return executeCommand(cleanupCommand);
}

async function backupTags(
  repositoryUri: string,
  version: string,
  profile: string
) {
  const date = new Date().toISOString().split('T')[0];

  // Cria o diretório backup/lambda-tags se não existir
  const backupDir = 'backup/lambda-tags';
  await executeCommand(`mkdir -p ${backupDir}`);

  const backupCommand = `aws ecr batch-get-image --profile ${profile} --repository-name ${repositoryUri} --image-ids imageTag=v${version} | jq -r '.images[].imageManifest' > ${backupDir}/backup-${date}.json`;
  return executeCommand(backupCommand);
}

async function showProgress<T>(
  action: (() => Promise<T>) | Promise<T>,
  message: string
): Promise<T> {
  const spinner = ora(message).start();
  try {
    const result = await (typeof action === 'function' ? action() : action);
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}

async function getRepositoryUri(
  cfClient: CloudFormationClient,
  env: string, // agora recebe o ambiente diretamente
  lambdaName: string
): Promise<string> {
  try {
    const ecrStackName = `EcrStack-${env}`; // Constrói o nome da stack ECR

    const response = await cfClient.send(
      new DescribeStacksCommand({
        StackName: ecrStackName,
      })
    );

    const stack = response.Stacks?.[0];
    if (!stack) {
      throw new Error(`Stack ${ecrStackName} not found`);
    }

    // Procura pelo output específico da lambda
    const repositoryUri = stack.Outputs?.find(
      (output) => output.OutputKey === `${lambdaName}RepositoryUri`
    )?.OutputValue;

    if (!repositoryUri) {
      throw new Error(
        `Repository URI not found for lambda ${lambdaName} in stack ${ecrStackName}`
      );
    }

    return repositoryUri;
  } catch (error) {
    throw new Error(
      `Failed to get repository URI: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function runLambdaTests(lambdaPath: string): Promise<boolean> {
  try {
    const testCommand = `npm test --prefix ${lambdaPath}`;
    await executeCommand(testCommand);
    return true;
  } catch (error) {
    logger.error('Tests failed!');
    if (error instanceof Error) {
      logger.error(error.message);
    }
    return false;
  }
}

async function deployLambda(
  profile: string,
  envConfig: (typeof environments)[keyof typeof environments],
  lambdaName: string,
  repositoryUri: string
) {
  const lambdaPath = join(getProjectRoot(), 'src', 'lambdas', lambdaName);

  // Executa os testes primeiro
  logger.info('Running tests...');
  const testsPass = await showProgress(
    runLambdaTests(lambdaPath),
    'Running lambda tests'
  );

  if (!testsPass) {
    logger.error(`Tests failed for lambda: ${lambdaName}`);
    return;
  }

  // Agora checkAndUpdateVersion
  logger.info('Checking version...');
  const shouldContinue = await checkAndUpdateVersion(
    lambdaPath,
    envConfig.stackName
  );

  if (!shouldContinue) {
    logger.warning('Deployment cancelled');
    return;
  }

  // Recarrega o package.json APÓS a atualização da versão
  const packageJson = JSON.parse(
    fs.readFileSync(join(lambdaPath, 'package.json'), 'utf-8')
  );

  DeploymentMetrics.startDeploy(
    lambdaName,
    envConfig.stackName,
    packageJson.version
  );

  try {
    logger.info(`Deploying lambda: ${lambdaName} to ${envConfig.stackName}`);

    if (deployConfig.cleanupImages) {
      await showProgress(cleanupDocker(lambdaName), 'Cleaning up old images');
    }

    await showProgress(
      executeCommand(
        `aws ecr get-login-password --region ${envConfig.region} --profile ${profile}`
      ),
      'Logging into ECR'
    );

    await showProgress(
      executeCommand(
        `aws ecr get-login-password --region ${envConfig.region} --profile ${profile} | docker login --username AWS --password-stdin ${envConfig.account}.dkr.ecr.${envConfig.region}.amazonaws.com`
      ),
      'Docker login'
    );

    logger.info(`Building from path: ${lambdaPath}`);
    await showProgress(
      executeCommand(
        `docker build -t ${lambdaName.toLowerCase()} ${lambdaPath}`
      ),
      'Building Docker image'
    );

    const version = packageJson.version;
    const gitSha = executeCommandWithOutput('git rev-parse --short HEAD');
    await showProgress(async () => {
      await executeCommand(
        `docker tag ${lambdaName.toLowerCase()}:latest ${repositoryUri}:latest`
      );
      await executeCommand(
        `docker tag ${lambdaName.toLowerCase()}:latest ${repositoryUri}:v${version}`
      );
      await executeCommand(
        `docker tag ${lambdaName.toLowerCase()}:latest ${repositoryUri}:sha-${gitSha}`
      );
    }, 'Tagging images');

    logger.info('Pushing all tags to repository...');
    await showProgress(
      executeCommand(`docker push --all-tags ${repositoryUri}`),
      'Pushing images to ECR'
    );

    if (deployConfig.backupTags) {
      await showProgress(
        backupTags(repositoryUri, version, profile),
        'Backing up image tags'
      );
    }

    logger.success(
      `Successfully deployed ${lambdaName} to ${envConfig.stackName}`
    );
    logger.info(`Deployed version: v${version} (${gitSha})`);
    logger.info('Tags deployed:');
    logger.info(`  - latest`);
    logger.info(`  - v${version}`);
    logger.info(`  - sha-${gitSha}`);

    DeploymentMetrics.endDeploy(true);
  } catch (error) {
    DeploymentMetrics.endDeploy(false);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}

const main = async () => {
  try {
    const argv = (await yargs(hideBin(process.argv))
      .options({
        profile: {
          alias: 'p',
          type: 'string',
          description: 'AWS profile to use',
          demandOption: true,
        },
        env: {
          alias: 'e',
          type: 'string',
          description: 'Environment to deploy to',
          demandOption: true,
        },
        lambda: {
          alias: 'l',
          type: 'string',
          description: 'Lambda function to deploy',
          demandOption: true,
        },
      })
      .help()
      .alias('help', 'h')
      .parseAsync()) as Args;

    await checkDependencies();
    const envValidated = await validateEnvironment(argv.env);

    if (!envValidated) {
      logger.warning('Deployment cancelled by user');
      return;
    }

    if (deployConfig.validateGitStatus) {
      await checkGitStatus();
    }

    const envConfig = environments[argv.env];
    if (!envConfig) {
      throw new Error(`Invalid environment: ${argv.env}`);
    }

    const cfClient = new CloudFormationClient({
      region: envConfig.region,
      credentials: fromIni({
        profile: argv.profile,
      }),
    });

    const repositoryUri = await showProgress(
      getRepositoryUri(cfClient, argv.env, argv.lambda),
      'Getting repository URI'
    );

    if (argv.lambda) {
      await deployLambda(argv.profile, envConfig, argv.lambda, repositoryUri);
    } else {
      const projectRoot = getProjectRoot();
      const lambdasDir = join(projectRoot, 'src', 'lambdas');
      const lambdaFolders = fs.readdirSync(lambdasDir);

      for (const folder of lambdaFolders) {
        await deployLambda(argv.profile, envConfig, folder, repositoryUri);
      }
    }

    if (deployConfig.metrics) {
      DeploymentMetrics.printSummary();
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Deployment failed: ${error.message}`);
    } else {
      logger.error(`Deployment failed: ${String(error)}`);
    }
    process.exit(1);
  }
};

(async () => {
  await main();
})();
