# La Imagen en la que se basa el proyecto
FROM node
# Instalamos pnpm globalmente
#RUN npm install -g pnpm
# Creamos El Directorio donde se va a copiar el proyecto
WORKDIR /app/NextJS
# Copiamos el archivo package.json
COPY package.json .
# Instalamos las dependencias
RUN npm i
# Copiamos el proyecto a la ruta que creamos en el espacio de trabajo
COPY . .
#exponemos el puerto 3000
EXPOSE 3000
# Comando para iniciar el proyecto
RUN npm run build

CMD ["npm", "run", "start"]