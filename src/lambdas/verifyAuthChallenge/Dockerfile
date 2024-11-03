# Estágio de build  
FROM public.ecr.aws/lambda/nodejs:20 AS builder  

# Define o diretório de trabalho  
WORKDIR ${LAMBDA_TASK_ROOT}  

# Copia arquivos de dependência  
COPY package*.json ./  
COPY tsconfig.json ./  

# Instala dependências de produção apenas  
RUN npm ci --production  

# Copia código fonte  
COPY src/ ./src/  

# Instala dependências de desenvolvimento temporariamente para build  
RUN npm ci && \
  npm run build && \
  rm -rf node_modules && \
  npm ci --production  

# Remove arquivos desnecessários  
RUN rm -rf src/ tsconfig.json package*.json  

# Estágio final - usando a imagem base oficial do Lambda  
FROM public.ecr.aws/lambda/nodejs:20  

# Copia apenas os arquivos necessários do estágio de build  
COPY --from=builder ${LAMBDA_TASK_ROOT} ${LAMBDA_TASK_ROOT}  

# Configura o handler  
CMD [ "index.handler" ]
