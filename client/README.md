# RunWatch Client

The client-side application for RunWatch, built with React and Vite.

This application provides real-time monitoring and management of GitHub Actions workflows.

## Technology Stack

- **Framework**: React 19
- **Build Tool**: Vite 6
- **UI Library**: Material-UI v6
- **State Management**: React Context/Hooks
- **Routing**: React Router v7
- **Real-time Updates**: Socket.IO
- **Data Visualization**: Chart.js with react-chartjs-2
- **API Communication**: Axios
- **Testing**: Vitest with React Testing Library

## Available Commands

```bash
# Development
npm start         # Start development server
npm run preview   # Preview production build locally

# Building
npm run build         # Production build
npm run build:dev     # Development build
npm run build:prod    # Production build with optimizations
npm run analyze       # Build and analyze bundle size

# Testing
npm test             # Run tests
npm run test:watch   # Run tests in watch mode

# Code Quality
npm run lint         # Run ESLint
npm run lint:check   # Check for lint issues
npm run lint:fix     # Fix automatic lint issues
npm run format       # Format code with Prettier
```

## Architecture

The client application follows a feature-based architecture:

```ini
src/
├── api/          # API and WebSocket services
├── common/       # Shared components and utilities
│   ├── components/
│   ├── theme/
│   └── utils/
└── features/     # Feature-based modules
    ├── dashboard/
    ├── repository/
    ├── runners/
    ├── settings/
    ├── stats/
    └── workflows/
```

## Build Optimization

The production build is optimized with:

- Code splitting for vendor chunks (React, MUI, Chart.js)
- Gzip and Brotli compression
- Tree shaking
- Modern browser targeting (ES2015+)
- Source maps in development only
- Bundle size analysis via rollup-plugin-visualizer

## Development

The development server runs on port 3000 by default and includes:

- Hot Module Replacement (HMR)
- Path aliases (@/ points to src/)
- Automatic dependency optimization
- ESLint and Prettier integration
