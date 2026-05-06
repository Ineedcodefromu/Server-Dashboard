FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build-Argumente für Vite (werden zur Compile-Zeit benötigt)
ARG VITE_APP_URL
ENV VITE_APP_URL=$VITE_APP_URL

RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.cjs ./
COPY --from=builder /app/firebase-applet-config.json ./

EXPOSE 3000
CMD ["node", "server.cjs"]
