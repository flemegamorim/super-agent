# ---- Stage 1: Install dependencies ----
FROM node:20-slim AS deps

RUN apt-get update && \
    apt-get install -y python3 make g++ --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci

# ---- Stage 2: Build Next.js ----
FROM node:20-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY web/ ./web/

RUN cd web && npm run build

# ---- Stage 3: Production image ----
FROM node:20-slim

RUN apt-get update && \
    apt-get install -y curl bash git ca-certificates --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Install OpenCode CLI
RUN curl -fsSL https://opencode.ai/install | bash 2>/dev/null || true
ENV PATH="/root/.opencode/bin:/root/.local/bin:${PATH}"

# Root deps & config
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY opencode.json ./
COPY prompts/ ./prompts/

# Next.js production build
COPY --from=builder /app/web/.next ./web/.next
COPY web/public ./web/public
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY web/package.json ./web/
COPY web/scripts ./web/scripts/

RUN mkdir -p .data input output

EXPOSE 3000 4096

CMD ["npm", "start"]
