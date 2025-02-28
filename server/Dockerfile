FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose the port (will be overridden by docker-compose)
EXPOSE 5001

# Start the server
CMD ["npm", "start"]