import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material';
import { theme } from './common/theme/theme';
import Layout from './common/components/Layout';
import './App.css';

// Lazy loaded components
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const WorkflowDetails = lazy(() => import('./features/workflows/WorkflowDetails'));
const RepositoryStats = lazy(() => import('./features/stats/RepositoryStats'));
const WorkflowHistory = lazy(() => import('./features/workflows/WorkflowHistory'));
const RepositoryView = lazy(() => import('./features/repository/RepositoryView'));
const Settings = lazy(() => import('./features/settings/Settings'));
const RunnerGroups = lazy(() => import('./features/runners/RunnerGroups'));

// Loading component for suspense fallback
const LoadingComponent = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Layout>
          <Suspense fallback={<LoadingComponent />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/workflow/:id" element={<WorkflowDetails />} />
              <Route path="/workflow-history/:repoName/:workflowName" element={<WorkflowHistory />} />
              <Route path="/repository/:repoName" element={<RepositoryView />} />
              <Route path="/stats" element={<RepositoryStats />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/runners" element={<RunnerGroups />} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
