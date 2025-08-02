FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (force fresh install)
RUN npm install --production

# Explicitly install ws package and verify it's there
RUN npm install ws@^8.14.2
RUN npm list ws || echo "ws package not found!"
RUN ls -la node_modules/ | grep ws || echo "ws directory not found!"

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S gameengine -u 1001

# Change ownership of the app directory
RUN chown -R gameengine:nodejs /app
USER gameengine

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]