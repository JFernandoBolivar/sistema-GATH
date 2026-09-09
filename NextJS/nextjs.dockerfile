# La Imagen en la que se basa el proyecto
FROM node
# Instalamos pnpm globalmente
#RUN npm install -g pnpm
# Creamos El Directorio donde se va a copiar el proyecto
WORKDIR /app/NextJS
# Copiamos el archivo package.json
COPY package.json .
# Instalamos las dependencias
# --legacy-peer-deps: next-auth@5 beta y vitest todavia no publican rangos
# de peerDependencies compatibles con next@16 / @types/node@20 respectivamente.
RUN npm i --legacy-peer-deps
# Copiamos el proyecto a la ruta que creamos en el espacio de trabajo
COPY . .
#exponemos el puerto 3000
EXPOSE 3000
# Comando para iniciar el proyecto
RUN npm run build

CMD ["npm", "run", "start"]