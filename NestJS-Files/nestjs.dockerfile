FROM node
WORKDIR /app/NestFS
COPY package.json .
RUN npm i -g pnpm
RUN pnpm i
COPY . .
EXPOSE 5000
CMD pnpm start
