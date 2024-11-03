interface EnvConfig {
  account: string;
  region: string;
  stackName: string; // Nome da stack que contém os repositórios ECR
}

export const environments: { [key: string]: EnvConfig } = {
  dev: {
    account: '904233129840',
    region: 'sa-east-1',
    stackName: 'EcrStack-dev',
  },
  prod: {
    account: '897729120601',
    region: 'sa-east-1',
    stackName: 'EcrStack-prod',
  },
  staging: {
    account: 'YOUR_STAGING_ACCOUNT',
    region: 'sa-east-1',
    stackName: 'EcrStack-staging',
  },
};

export type Environment = keyof typeof environments;
