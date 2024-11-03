import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import * as ora from 'ora';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import { prompt } from 'enquirer';
import { getProjectRoot } from '../utils/getRoot';
import { deployConfig } from './config/deployConfig';
import { environments } from './config/environments';
import { logger } from '../utils/logger';

interface DeployMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  environment: string;
  version: string;
  lambdaName: string;
}

class DeploymentMetrics {
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

const LAMBDA_STATES = {
  Pending: 'Pending',
  Active: 'Active',
  Inactive: 'Inactive',
  Failed: 'Failed',
} as const;

type LambdaState = (typeof LAMBDA_STATES)[keyof typeof LAMBDA_STATES];

interface Args {
  profile: string;
  env: string;
  lambda: string;
  [key: string]: unknown;
}

interface DetailedError {
  type: string;
  message: string;
  command?: string;
}

function executeCommandWithOutput(command: string): string {
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf-8',
  });
  return result.stdout?.toString().trim() || '';
}

async function executeCommand(
  command: string,
  options: Record<string, any> = {},
  attempt = 1
): Promise<{ status: number; stdout: string; stderr: string }> {
  const MAX_RETRIES = deployConfig.maxRetries;

  function checkForMissingDependency(
    stderr: string,
    stdout: string
  ): DetailedError | null {
    const errorOutput = (stderr + stdout).toLowerCase();

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

      attempt++;
      logger.warning(`Tentativa ${attempt}/${MAX_RETRIES} falhou`);
      logger.warning(`Saída de erro: ${result.stderr}`);
      logger.warning(`Saída padrão: ${result.stdout}`);
    } catch (error: unknown) {
      attempt++;

      if ((error as DetailedError).type) {
        const detailedError = error as DetailedError;
        logger.error(`${detailedError.type}: ${detailedError.message}`);

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
}

async function verifyDockerSetup() {
  try {
    await executeCommand('docker buildx version');
    await executeCommand(
      'docker buildx inspect default || docker buildx create --name default --use'
    );
    return true;
  } catch (error) {
    logger.error('Docker buildx not properly configured');
    if (error instanceof Error) {
      logger.error(error.message);
    }
    return false;
  }
}

async function checkDependencies() {
  const dependencies = ['docker', 'git', 'aws'];
  for (const dep of dependencies) {
    const result = spawnSync('which', [dep]);
    if (result.status !== 0) {
      throw new Error(`Required dependency "${dep}" is not installed`);
    }
  }

  const buildxOk = await verifyDockerSetup();
  if (!buildxOk) {
    throw new Error(
      'Docker buildx setup is required for multi-architecture builds'
    );
  }
}

async function checkImageSize(imageName: string): Promise<boolean> {
  const result = await executeCommand(
    `docker image inspect ${imageName} --format='{{.Size}}'`
  );
  const sizeInBytes = parseInt(result.stdout);
  const sizeInGB = sizeInBytes / (1024 * 1024 * 1024);

  if (sizeInGB > 10) {
    throw new Error(
      `Image size (${sizeInGB.toFixed(2)}GB) exceeds Lambda limit of 10GB`
    );
  }
  return true;
}

function validateECREndpoint(repositoryUri: string): void {
  if (repositoryUri.includes('ecr-fips')) {
    throw new Error(
      'Lambda does not support Amazon ECR FIPS endpoints for container images'
    );
  }
}

async function validateECRPermissions(
  repositoryUri: string,
  profile: string
): Promise<void> {
  try {
    const repositoryName = repositoryUri.split('/').pop();
    const command = `aws ecr get-repository-policy --repository-name ${repositoryName} --profile ${profile}`;

    await executeCommand(command);
  } catch (error) {
    logger.warning(
      'ECR repository policy not found. Adding required permissions...'
    );

    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'LambdaECRImageRetrievalPolicy',
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
          Action: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
        },
      ],
    };

    const setCommand = `aws ecr set-repository-policy --repository-name ${repositoryUri
      .split('/')
      .pop()} --policy-text '${JSON.stringify(policy)}' --profile ${profile}`;

    await executeCommand(setCommand);
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
    const { confirm } = await prompt<{ confirm: boolean }>({
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

async function backupTags(repositoryUri: string, version: string) {
  const date = new Date().toISOString().split('T')[0];
  const backupCommand = `aws ecr batch-get-image --repository-name ${repositoryUri} --image-ids imageTag=v${version} | jq -r '.images[].imageManifest' > backup-${date}.json`;
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
  env: string,
  lambdaName: string
): Promise<string> {
  try {
    const ecrStackName = `EcrStack-${env}`;

    const response = await cfClient.send(
      new DescribeStacksCommand({
        StackName: ecrStackName,
      })
    );

    const stack = response.Stacks?.[0];
    if (!stack) {
      throw new Error(`Stack ${ecrStackName} not found`);
    }

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
  // Verificações iniciais
  validateECREndpoint(repositoryUri);
  await validateECRPermissions(repositoryUri, profile);

  const lambdaPath = path.join(getProjectRoot(), 'src', 'lambdas', lambdaName);

  logger.info('Running tests...');
  const testsPass = await showProgress(
    runLambdaTests(lambdaPath),
    'Running lambda tests'
  );

  if (!testsPass) {
    logger.error(`Tests failed for lambda: ${lambdaName}`);
    return;
  }

  logger.info('Checking version...');
  const shouldContinue = await checkAndUpdateVersion(
    lambdaPath,
    envConfig.stackName
  );

  if (!shouldContinue) {
    logger.warning('Deployment cancelled');
    return;
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(lambdaPath, 'package.json'), 'utf-8')
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
        `docker buildx create --use && docker buildx build --platform linux/amd64 \
        --build-arg LAMBDA_TASK_ROOT=/var/task \
        -t ${lambdaName.toLowerCase()} \
        --load \
        ${lambdaPath}`
      ),
      'Building Docker image'
    );

    await checkImageSize(lambdaName.toLowerCase());

    const version = packageJson.version;
    const gitSha = executeCommandWithOutput('git rev-parse --short HEAD');

    await showProgress(async () => {
      await executeCommand(
        `docker tag ${lambdaName.toLowerCase()}:latest ${repositoryUri}:latest && \
         docker image inspect ${repositoryUri}:latest --format '{{.Architecture}}' | grep -q 'amd64'`
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
        backupTags(repositoryUri, version),
        'Backing up image tags'
      );
    }

    logger.info('Waiting for function to become active...');
    await showProgress(
      new Promise((resolve) => setTimeout(resolve, 5000)),
      'Function optimization in progress'
    );

    try {
      const functionState = await executeCommand(
        `aws lambda get-function --function-name ${lambdaName} --profile ${profile} --query 'Configuration.State' --output text`
      );
      logger.info(`Function state: ${functionState.stdout}`);
    } catch (error) {
      logger.warning('Could not get function state');
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
    throw error;
  }
}

async function checkAndUpdateVersion(
  lambdaPath: string,
  stackName: string
): Promise<boolean> {
  const packageJsonPath = path.join(lambdaPath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = packageJson.version;

  logger.info(`Current version: ${currentVersion}`);
  logger.info(`Target stack: ${stackName}`);

  const { confirmVersion } = await prompt<{ confirmVersion: boolean }>({
    type: 'confirm',
    name: 'confirmVersion',
    message: 'Proceed with deployment?',
    initial: true,
  });

  return confirmVersion;
}

async function main() {
  try {
    const argv = (await yargs(process.argv.slice(2))
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
    await checkGitStatus();

    const shouldContinue = await validateEnvironment(argv.env);
    if (!shouldContinue) {
      logger.warning('Deployment cancelled');
      return;
    }

    const envConfig = environments[argv.env];
    if (!envConfig) {
      throw new Error(`Environment configuration not found for: ${argv.env}`);
    }

    const cfClient = new CloudFormationClient({
      region: envConfig.region,
      credentials: fromIni({ profile: argv.profile }),
    });

    const repositoryUri = await getRepositoryUri(
      cfClient,
      argv.env,
      argv.lambda
    );

    await deployLambda(argv.profile, envConfig, argv.lambda, repositoryUri);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Deployment failed: ${error.message}`);
    } else {
      logger.error('Deployment failed with unknown error');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    if (error instanceof Error) {
      logger.error(`Deployment failed: ${error.message}`);
    } else {
      logger.error(`Deployment failed: ${String(error)}`);
    }
    process.exit(1);
  });
}

export {
  deployLambda,
  checkDependencies,
  validateEnvironment,
  checkGitStatus,
  getRepositoryUri,
  checkAndUpdateVersion,
};
