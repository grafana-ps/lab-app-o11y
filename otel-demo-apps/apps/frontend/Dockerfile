# Frontend - Node.js Express
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/

ENV PORT=8080
EXPOSE 8080

USER node

CMD ["node", "src/index.js"]

