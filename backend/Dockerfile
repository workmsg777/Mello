FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json .sequelizerc ./
COPY database ./database
COPY src ./src
COPY scripts ./scripts

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
