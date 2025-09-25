FROM node:18-slim AS build
WORKDIR /app

# Install dependencies for GraphicsMagick + Ghostscript
RUN apt-get update && \
    apt-get install -y --no-install-recommends graphicsmagick ghostscript && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
COPY . .

FROM node:18-slim
WORKDIR /app

# Install runtime dependencies (GraphicsMagick + Ghostscript required)
RUN apt-get update && \
    apt-get install -y --no-install-recommends graphicsmagick ghostscript && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app ./
RUN mkdir -p ./images

EXPOSE 8080
CMD ["node", "app.js"]
