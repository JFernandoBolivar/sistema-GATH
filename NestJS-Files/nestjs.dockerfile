FROM node
WORKDIR /app/NestFS
COPY package.json .
#RUN npm i -g pnpm
RUN npm i
COPY . .
EXPOSE 5000
CMD npm start
