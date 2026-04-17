export const DOCKERFILE_TEMPLATES: Record<string, string> = {
    'typescript': `# Multi-stage Build for Node.js Applications
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Adjust start command as needed
CMD ["npm", "start"]
`,
    'python': `# Multi-stage Build for Python Applications
FROM python:3.10-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --user -r requirements.txt

FROM python:3.10-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .

ENV PATH=/root/.local/bin:$PATH
# Adjust start command as needed (e.g., uvicorn main:app --host 0.0.0.0 --port 80)
CMD ["python", "main.py"]
`,
    'generic': `# Basic Generic Dockerfile
FROM alpine:latest
WORKDIR /app
COPY . .
CMD ["sh", "-c", "echo 'Generic container started' && sleep infinity"]
`
};

export const DOCKERIGNORE_TEMPLATE = `node_modules
npm-debug.log
dist
build
.git
.env
.github
*.md
`;

export const DOCKER_COMPOSE_TEMPLATES: Record<string, string> = {
    'typescript': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
`,
    'python': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1
`,
    'generic': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
`
};
