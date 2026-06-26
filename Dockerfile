# Use official Node.js 20 slim image
FROM node:20-slim

# Install system dependencies needed for AWS CLI and kubectl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI (amd64 version matching the requested platform)
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip ./aws

# Install kubectl (amd64 version matching the requested platform)
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm kubectl

# Create dev user and group matching the standard non-root UID/GID
RUN groupadd -g 1000 dev \
    && useradd -u 1000 -g dev -m -s /bin/bash dev

# Set up working directory and grant ownership to dev user
WORKDIR /app
RUN chown -R dev:dev /app

# Switch to dev user for all package installations and builds
USER dev

# Copy dependency manifests first to leverage Docker caching layers
COPY --chown=dev:dev package*.json ./

# Install clean npm dependencies
RUN npm ci

# Copy the remaining application source code
COPY --chown=dev:dev . .

# Compile frontend static assets (Vite) and backend bundle (esbuild)
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=3000

# Start the bundled Express server
CMD ["npm", "start"]
