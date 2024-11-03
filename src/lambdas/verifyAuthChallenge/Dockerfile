# Estágio de build  
FROM public.ecr.aws/lambda/nodejs:20 AS builder  

WORKDIR /app  

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

# Estágio final  
FROM public.ecr.aws/lambda/nodejs:20  

# Copia apenas os arquivos necessários do estágio de build  
COPY --from=builder /app/dist/ ${LAMBDA_TASK_ROOT}/  
COPY --from=builder /app/node_modules/ ${LAMBDA_TASK_ROOT}/node_modules/  

# Configura o handler  
CMD [ "index.handler" ]
