# RunWatch - GitHub Actions Workflow Monitor

RunWatch is a real-time monitoring application for GitHub Actions workflows. It provides an interactive dashboard to track GitHub Action runs, including their status, execution time, and performance trends.

## Features

- 🔄 Real-time monitoring of GitHub Actions workflow runs
- 📊 Dashboard displaying current and historical workflow runs
- 🔍 Detailed view of individual workflow runs and jobs
- 📈 Statistics and analytics on workflow performance
- 🔔 WebSocket-based real-time updates

## Tech Stack

### Backend

- Node.js & Express - API and webhook handling
- MongoDB with Mongoose - Data storage
- Socket.IO - Real-time communication
- @octokit/webhooks - GitHub webhook processing

### Frontend

- Vite / React - UI framework
- Material UI - Component library
- React Router - Navigation
- Chart.js - Data visualization
- Socket.IO Client - Real-time updates

## Architecture

The application is structured as follows:

1. **GitHub Webhook Integration**: The backend receives webhook events from GitHub when workflow runs start, update, and complete.

2. **Data Processing Pipeline**: Incoming webhook data is processed, normalized, and stored in the database.

3. **Real-time Communication**: Updates are broadcast to connected clients via WebSockets.

4. **Dashboard UI**: The React frontend displays current and historical workflow data.

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- MongoDB
- GitHub repository with Actions workflows
- Ability to configure GitHub webhooks

### Environment Configuration

#### Configure the client

1. Copy the example environment file:

   ```bash
   cp .env.client.example ./client/.env
   ```

2. Configure the following environment variables in `./client/.env`:

   ```ini
   # Node environment (development/production)
   NODE_ENV=development

   # Server Configuration
   PORT=3000

   # Client Configuration
   CLIENT_URL=http://localhost

   # Vite prefixes environment variables with VITE_
   VITE_APP_API_URL=http://localhost:5001/api
   VITE_APP_WEBSOCKET_URL=ws://localhost:5001
   ```

#### Configure the server

1. Generate a webhook secret:

   ```bash
   node scripts/generate-webhook-secret.js
   ```

2. Set up your GitHub App:
   - Create a GitHub App in your organization's settings
   - Make sure you set the webhook secret to the value we generated in step 1
   - Note down the App ID
   - Generate and download the private key
   - Place the private key file in your project directory

3. Copy the example environment file:

   ```bash
   cp .env.server.example ./server/.env
   ```

4. Configure the following environment variables in `./server/.env`:

   ```ini
   # Node environment (development/production)
   NODE_ENV=development

   # Server Configuration
   PORT=5001
   MONGODB_URI=mongodb://localhost:27017/runwatch

   # GitHub Configuration
   GITHUB_WEBHOOK_SECRET=webhook-secret
   GITHUB_APP_ID=github-app-id
   GITHUB_APP_PRIVATE_KEY_PATH=/absolute/path/to/private-key.pem
   ```

Note: If you create an enterprise app and install it across multiple organizations you can use the same private key and app_id to manage multiple orgs

## Running the server

### Backend Server

1. Navigate to the server directory:

   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

### Frontend Client

1. Navigate to the client directory:

   ```bash
   cd client
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run start
   ```

## Usage

1. After setting up the application and configuring the webhooks, visit `http://localhost:3000` to access the dashboard.

2. When GitHub Actions workflows run in your repositories, you'll see real-time updates on the dashboard.

3. Click on individual workflow runs to view detailed information about the jobs and steps.

4. Check the Statistics page for insights on workflow performance and trends.

## Deployment

### Docker Deployment

The application can be deployed using Docker and Docker Compose. This will create three containers:

- MongoDB database
- Node.js backend server
- Nginx serving the React frontend

#### Requirements

- Docker
- Docker Compose
- Git

#### Quick Start with Docker

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd RunWatch
   ```

2. Copy the example environment file:

   ```bash
   cp .env.docker.example .env
   ```

3. Configure the following environment variables in `.env`:

   ```ini
   # Node Environment
   NODE_ENV=production

   # MongoDB Configuration
   MONGO_INITDB_DATABASE=runwatch
   MONGO_INITDB_ROOT_USERNAME=admin
   MONGO_INITDB_ROOT_PASSWORD=changeme

   # GitHub App Configuration
   GITHUB_APP_ID=your_app_id
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   GITHUB_APP_PRIVATE_KEY_PATH=/absolute/path/to/private-key.pem

   # Client Configuration
   VITE_APP_API_URL=http://localhost/api
   VITE_APP_WEBSOCKET_URL=ws://localhost
   ```

4. Use the deployment script to manage the application:

   - `./deploy.sh start` - Start all services
   - `./deploy.sh stop` - Stop all services
   - `./deploy.sh restart` - Restart all services
   - `./deploy.sh logs` - Show logs from all services
   - `./deploy.sh build` - Rebuild all services
   - `./deploy.sh clean` - Remove all containers and volumes
   - `./deploy.sh status` - Show status of all services

5. Access the application:

- Frontend: http://localhost
- Backend API: http://localhost/api
- WebSocket: ws://localhost/socket.io

#### Container Management

The Docker setup includes:

- Automatic container restart on failure
- Volume persistence for MongoDB data
- Nginx reverse proxy configuration
- Network isolation between services
- Health checks and dependency management

## Future Enhancements

- Authentication and multi-user support
- More advanced filtering and search capabilities
- Custom notifications for workflow failures
- Integration with other CI/CD platforms

## License

MIT
