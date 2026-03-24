FROM node:18-alpine

# Build backend from monorepo root context
WORKDIR /app/backend

# Copy dependency manifests from backend folder
COPY aura-market/backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY aura-market/backend/ ./

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "server.js"]
