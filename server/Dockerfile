# Build stage
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy source code
COPY . .

# Build the application (if you have a build step)
RUN npm install --production

# Expose the port
EXPOSE 5001

# Start the server
CMD ["npm", "start"]