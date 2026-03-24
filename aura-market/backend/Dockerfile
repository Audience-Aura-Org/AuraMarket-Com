FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Default environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE ${PORT}

CMD ["node", "server.js"]
