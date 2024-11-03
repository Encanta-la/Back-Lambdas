import { spawnSync, SpawnSyncOptions } from 'child_process';
import { environments } from './config/environments';
import { deployConfig } from './config/deployConfig';
import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { getProjectRoot } from '../utils/getRoot';
import { checkAndUpdateVersion } from '../utils/versionChecker';
import { prompt } from 'enquirer';
import { logger } from '../utils/logger';

import * as ora from 'ora';

interface Args {
  profile: string;
  env: string;
  lambda?: string;
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

function executeCommandWithOutput(command: string): string {
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }

  return result.stdout.trim();
}

async function executeCommand(
  command: string,
  options: SpawnSyncOptions = {}
): Promise<CommandResult> {
  const MAX_RETRIES = deployConfig.maxRetries;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const result = spawnSync(command, {
        shell: true,
        timeout: deployConfig.timeout,
        encoding: 'utf-8', // Isso garante que o output será string
        ...options,
      });

      if (result.status === 0) {
        return {
          status: result.status,
          stdout: result.stdout.toString(), // Convertemos explicitamente para string
          stderr: result.stderr.toString(), // Convertemos explicitamente para string
        };
      }

      attempt++;
      logger.warning(`Command failed, attempt ${attempt}/${MAX_RETRIES}`);
    } catch (error: unknown) {
      // Tipagem explícita do error
      attempt++;
      // Tratamento seguro do erro com type guard
      if (error instanceof Error) {
        logger.warning(`Command failed with error: ${error.message}`);
      } else {
        logger.warning(`Command failed with unknown error: ${String(error)}`);
      }
    }
  }

  throw new Error(`Command failed after ${MAX_RETRIES} attempts: ${command}`);
}

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
  client: CloudFormationClient,
  stackName: string
): Promise<string> {
  const command = new DescribeStacksCommand({
    StackName: stackName,
  });

  const response = await client.send(command);
  const stack = response.Stacks?.[0];

  if (!stack) {
    throw new Error(`Stack ${stackName} not found`);
  }

  const repositoryUri = stack.Outputs?.find(
    (output) => output.OutputKey === 'RepositoryUri'
  )?.OutputValue;

  if (!repositoryUri) {
    throw new Error('Repository URI not found in stack outputs');
  }

  return repositoryUri;
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
  const lambdaPath = path.join(getProjectRoot(), 'src', 'lambdas', lambdaName);

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
        backupTags(repositoryUri, version),
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

async function main() {
  try {
    const argv = (await yargs.options({
      profile: { type: 'string', demandOption: true },
      env: { type: 'string', demandOption: true },
      lambda: { type: 'string' },
    }).argv) as Args;

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
      getRepositoryUri(cfClient, envConfig.stackName),
      'Getting repository URI'
    );

    if (argv.lambda) {
      await deployLambda(argv.profile, envConfig, argv.lambda, repositoryUri);
    } else {
      const lambdasDir = path.join(__dirname, '../lambdas');
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
}

main();
