# Estágio de build  
FROM node:20.10-alpine AS builder  

WORKDIR /app  

# Copia arquivos de dependência  
COPY package*.json ./  
COPY tsconfig.json ./  

# Instala dependências  
RUN npm ci  

# Copia código fonte  
COPY src/ ./src/  

# Compila TypeScript  
RUN npm run build  

# Estágio final  
FROM public.ecr.aws/lambda/nodejs:20  

# Copia apenas os arquivos necessários do estágio de build  
COPY --from=builder /app/dist/ ${LAMBDA_TASK_ROOT}/  
COPY --from=builder /app/node_modules/ ${LAMBDA_TASK_ROOT}/node_modules/  

# Configura o handler  
CMD [ "index.handler" ]