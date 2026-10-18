# Образ програми для власного сервера (Docker / Coolify / Portainer)
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# схема бази оновлюється при кожному старті; наповнення — окремо: npm run db:seed
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]
