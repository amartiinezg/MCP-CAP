FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (incluidas dev) para el build
RUN npm ci

# Copiar código fuente
COPY . .

# Crear directorio para la base de datos
RUN mkdir -p /app/data

# Desplegar base de datos
RUN npm run deploy

# Limpiar devDependencies después del deploy
RUN npm prune --production

# Exponer puerto
EXPOSE 4004

# Usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# Comando de inicio
CMD ["npm", "start"]