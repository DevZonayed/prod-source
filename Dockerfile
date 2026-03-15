FROM node:22-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright system deps for headless Chromium
RUN npx playwright install-deps chromium 2>/dev/null || true
RUN npx playwright install chromium 2>/dev/null || true

# ─── Build stage ───
FROM base AS builder

WORKDIR /build

# Copy workspace root
COPY package.json package-lock.json* ./
COPY adorable/package.json adorable/

# Install all dependencies (including dev)
RUN npm install

# Copy source
COPY adorable/ adorable/

# Build Next.js standalone
RUN cd adorable && npx next build

# ─── Production stage ───
FROM base AS runner

WORKDIR /app

# Copy standalone output
COPY --from=builder /build/adorable/.next/standalone ./
COPY --from=builder /build/adorable/.next/static ./.next/static
COPY --from=builder /build/adorable/public ./public 2>/dev/null || true

# Create persistent directories
RUN mkdir -p /data /projects /host-projects

# Environment
ENV PORT=4000
ENV NODE_ENV=production
ENV VOXEL_DATA_DIR=/data
ENV VOXEL_PROJECTS_DIR=/projects
ENV VOXEL_HOST_PROJECTS_DIR=/host-projects
ENV HOSTNAME=0.0.0.0

EXPOSE 4000
EXPOSE 4100-4199

CMD ["node", "server.js"]
