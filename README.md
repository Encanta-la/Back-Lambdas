# PrimeLambdas

![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-FF9900?style=for-the-badge&logo=aws-lambda&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

Repositório para gerenciamento e deploy de funções AWS Lambda usando Docker e AWS CLI. As imagens são armazenadas no Amazon ECR (Elastic Container Registry).

## Estrutura de Diretórios

```
PrimeLambdas/
├── .github/
├── node_modules/
├── src/
│ ├── lambdas/
│ │ ├── createAuthChallenge/
│ │ ├── defineAuthChallenge/
│ │ ├── executeRegistration/
│ │ ├── preRegister/
│ │ └── verifyAuthChallenge/
│ ├── scripts/
│ │ └── config/
│ │ ├── environments.ts
│ │ └── deploy-lambda.ts
│ ├── shared/
│ └── utils/
│ └── getRoot.ts
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
└── tsconfig.json
```

## Fluxo de Deploy

```mermaid
graph TD
    A[Início do Deploy] --> B[Login no ECR]
    B --> C[Build da Imagem Docker]
    C --> D[Tag da Imagem]
    D --> E[Push para ECR]
    E --> F[Deploy Concluído]

    style A fill:#f9f,stroke:#333,stroke-width:4px
    style F fill:#9f9,stroke:#333,stroke-width:4px
```

## Processo de Build e Deploy

```mermaid
sequenceDiagram
    participant Dev as Desenvolvedor
    participant CLI as AWS CLI
    participant Docker
    participant ECR as Amazon ECR

    Dev->>CLI: npm run deploy:<env>
    CLI->>ECR: Login ECR
    CLI->>Docker: Build Image
    Docker->>Docker: Tag Image
    Docker->>ECR: Push Image
    ECR-->>Dev: Deploy Concluído
```

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- Node.js e npm
- Docker
- AWS CLI
- TypeScript

## Configuração dos Perfis AWS CLI

É necessário configurar perfis AWS CLI para diferentes ambientes:

```bash
# Configurar Perfil de Desenvolvimento
aws configure --profile pgcdev
# Digite seu AWS Access Key ID
# Digite sua AWS Secret Access Key
# Digite a região padrão (ex: us-east-1)
# Digite o formato de saída (ex: json)

# Configurar Perfil de Produção
aws configure --profile pgcprod

# Configurar Perfil de Staging
aws configure --profile pgcstaging
```

## Scripts Disponíveis

O repositório inclui scripts de deploy para diferentes ambientes:

```bash
# Deploy em Desenvolvimento
npm run deploy:dev -- --lambda <nome-da-lambda>

# Deploy em Produção
npm run deploy:prod -- --lambda <nome-da-lambda>

# Deploy em Staging
npm run deploy:staging -- --lambda <nome-da-lambda>
```

**Importante**: Note o duplo traço (--) antes do parâmetro --lambda. Isso é necessário para o comando funcionar corretamente.

Exemplo:

```bash
npm run deploy:prod -- --lambda verifyAuthChallenge
```

## Estrutura do Projeto

### Lambdas

Cada função Lambda está contida em seu próprio diretório em `src/lambdas/` com:

- `package.json` individual
- `Dockerfile` customizado para build e deploy
- Código fonte e configuração específicos da função

### Recursos Compartilhados

O diretório `shared` contém código comum e utilitários usados em múltiplas funções Lambda.

### Scripts

O diretório `scripts` contém arquivos de deploy e configuração:

- `deploy-lambda.ts`: Script principal de deploy
- `environments.ts`: Configurações específicas de ambiente

## Desenvolvimento

1. Criar uma nova função Lambda:

   - Criar novo diretório em `src/lambdas/`
   - Inicializar com `package.json`
   - Criar `Dockerfile`
   - Implementar a função Lambda

2. Deploy da Lambda:
   ```bash
   npm run deploy:<ambiente> -- --lambda <nome-da-sua-lambda>
   ```

## Observações

- Certifique-se que o Docker esteja rodando antes de executar scripts de deploy
- Verifique se os perfis AWS CLI estão configurados corretamente
- Cada função Lambda deve ter um Dockerfile válido
- O diretório shared pode ser usado para código comum entre Lambdas
