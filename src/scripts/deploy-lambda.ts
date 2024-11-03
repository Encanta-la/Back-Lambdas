// src/scripts/deploy-lambda.ts

import { spawnSync } from 'child_process';
import { environments } from './config/environments';
import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { getProjectRoot } from '../utils/getRoot';

interface Args {
  profile: string;
  env: string;
  lambda?: string;
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

async function deployLambda(
  profile: string,
  envConfig: (typeof environments)[keyof typeof environments],
  lambdaName: string,
  repositoryUri: string
) {
  console.log(`Deploying lambda: ${lambdaName} to ${envConfig.stackName}`);

  // Login to ECR
  const loginCommand = `aws ecr get-login-password --region ${envConfig.region} --profile ${profile}`;
  const loginResult = spawnSync(loginCommand, {
    shell: true,
    stdio: 'inherit',
  });

  if (loginResult.status !== 0) {
    throw new Error('Failed to login to ECR');
  }

  // Docker login
  const dockerLoginCommand = `aws ecr get-login-password --region ${envConfig.region} --profile ${profile} | docker login --username AWS --password-stdin ${envConfig.account}.dkr.ecr.${envConfig.region}.amazonaws.com`;
  const dockerLoginResult = spawnSync(dockerLoginCommand, {
    shell: true,
    stdio: 'inherit',
  });

  if (dockerLoginResult.status !== 0) {
    throw new Error('Failed to docker login');
  }

  // Build image
  const lambdaPath = path.join(getProjectRoot(), 'src', 'lambdas', lambdaName);
  console.log(`Building from path: ${lambdaPath}`); // Add this for debugging
  const buildCommand = `docker build -t ${lambdaName.toLowerCase()} ${lambdaPath}`;
  const buildResult = spawnSync(buildCommand, {
    shell: true,
    stdio: 'inherit',
  });

  if (buildResult.status !== 0) {
    throw new Error('Failed to build image');
  }

  // Tag image with latest
  const tagLatestCommand = `docker tag ${lambdaName.toLowerCase()}:latest ${repositoryUri}:latest`;
  const tagLatestResult = spawnSync(tagLatestCommand, {
    shell: true,
    stdio: 'inherit',
  });

  if (tagLatestResult.status !== 0) {
    throw new Error('Failed to tag image with latest');
  }

  // Tag image with version (opcional, baseado no package.json da lambda se existir)
  try {
    const packageJsonPath = path.join(
      getProjectRoot(),
      'src',
      'lambdas',
      lambdaName,
      'package.json'
    );
    console.log(`Package.json path: ${packageJsonPath}`); // Add this for debugging
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const version = packageJson.version;
    if (version) {
      const tagVersionCommand = `docker tag ${lambdaName.toLowerCase()}:latest ${repositoryUri}:v${version}`;
      spawnSync(tagVersionCommand, { shell: true, stdio: 'inherit' });
    }
  } catch (error) {
    console.log(
      'No package.json found or no version specified, skipping version tag'
    );
  }

  // Push images
  const pushLatestCommand = `docker push ${repositoryUri}:latest`;
  const pushLatestResult = spawnSync(pushLatestCommand, {
    shell: true,
    stdio: 'inherit',
  });

  if (pushLatestResult.status !== 0) {
    throw new Error('Failed to push latest image');
  }

  console.log(`Successfully deployed ${lambdaName} to ${envConfig.stackName}`);
}

async function main() {
  const argv = (await yargs.options({
    profile: { type: 'string', demandOption: true },
    env: { type: 'string', demandOption: true },
    lambda: { type: 'string' },
  }).argv) as Args;

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

  const repositoryUri = await getRepositoryUri(cfClient, envConfig.stackName);

  if (argv.lambda) {
    await deployLambda(argv.profile, envConfig, argv.lambda, repositoryUri);
  } else {
    const lambdasDir = path.join(__dirname, '../lambdas');
    const lambdaFolders = fs.readdirSync(lambdasDir);

    for (const folder of lambdaFolders) {
      await deployLambda(argv.profile, envConfig, folder, repositoryUri);
    }
  }
}

main().catch(console.error);
