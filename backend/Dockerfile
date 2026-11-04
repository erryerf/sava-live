FROM node:20-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy package descriptors
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy server code and assets
COPY . .

# Ports:
# 3001: WebSockets & Bridge REST API
# 2121: FTP Control Command port
# 50000-50050: FTP Passive data ports
EXPOSE 3001 2121 50000-50050

ENV PORT=3001
ENV FTP_PORT=2121
ENV FTP_PASV_MIN=50000
ENV FTP_PASV_MAX=50050

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/v1/bridge-status || exit 1

CMD ["node", "live-camera-server.js"]

