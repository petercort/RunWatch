# RunWatch Server

The server-side application for RunWatch, built with Node.js and Express.

This handles GitHub webhook events, manages runner groups, and provides real-time updates through Socket.IO.

## Technology Stack

- **Runtime**: Node.js (>=18.0.0)
- **Framework**: Express
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.IO
- **GitHub Integration**:
  - @octokit/rest
  - @octokit/webhooks
  - @octokit/auth-app

## Available Commands

```bash
# Development
npm start         # Start the server
npm run dev      # Start with nodemon for development

# Code Quality
npm run lint      # Run ESLint
npm run lint:fix  # Fix automatic lint issues

# Maintenance
npm run clean     # Remove dist and node_modules
npm run reinstall # Clean install of dependencies
```

## Architecture

The server follows a modular architecture with clear separation of concerns:

```ini
src/
├── config/         # Configuration (database, etc.)
├── controllers/    # Request handlers
│   ├── githubController.js
│   ├── repositoryController.js
│   ├── runnerController.js
│   ├── syncController.js
│   └── workflowController.js
├── middleware/     # Custom middleware
│   ├── github.js   # GitHub webhook handling
│   └── socket.js   # Socket.IO setup
├── models/        # Mongoose models
│   ├── GitHubHostedRunner.js
│   ├── RunnerGroup.js
│   ├── SelfHostedRunner.js
│   ├── SyncHistory.js
│   └── WorkflowRun.js
├── routes/        # API route definitions
├── services/      # Business logic
│   ├── repoService.js
│   ├── runnerService.js
│   ├── syncService.js
│   └── workflowService.js
└── utils/         # Utility functions
    ├── githubAuth.js
    └── responseHandler.js
```

## API Endpoints

- `/api/health` - Health check endpoint
- `/api/webhooks/github` - GitHub webhook endpoint
- `/api/*` - Various API endpoints for runners, workflows, and repositories

## Environment Variables

Required environment variables:

- `PORT` or `SERVER_PORT` - Server port (default: 5001)
- `GITHUB_WEBHOOK_SECRET` - Secret for webhook verification
- `MONGODB_URI` - MongoDB connection string

## Development Features

- CORS enabled for development
- Webhook signature verification
- Real-time updates via Socket.IO
- Automatic restart with nodemon in dev mode
- Error handling middleware
- Raw body parsing for webhook verification
- 100MB request body limit for non-webhook routes
