import express from 'express';
import * as workflowController from '../controllers/workflowController.js';
import * as runnerController from '../controllers/runnerController.js';
import * as syncController from '../controllers/syncController.js';
import * as githubController from '../controllers/githubController.js';
import * as repositoryController from '../controllers/repositoryController.js';

const router = express.Router();

// Workflow Routes
// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Ngrok verification endpoint - responds to any request
router.get('/ngrok-verify', (req, res) => {
  res.status(200).json({ message: 'Ngrok verification successful', timestamp: new Date().toISOString() });
});

// Get all workflow runs
router.get('/workflow-runs', workflowController.getAllWorkflowRuns);

// Get workflow runs for a specific repository
router.get('/workflow-runs/repo/*', workflowController.getRepoWorkflowRuns);

// Sync all workflow runs for a repository
router.post('/workflow-runs/repo/*/sync', workflowController.syncRepositoryWorkflowRuns);

// Cancel all queued workflow runs for a repository
router.post('/workflow-runs/repo/*/cancel-all', workflowController.cancelAllQueuedWorkflowRuns);

// Get workflow statistics
router.get('/stats', workflowController.getWorkflowStats);

// Get active workflow metrics
router.get('/workflow-runs/metrics', workflowController.getActiveMetrics);

// Get queued workflows
router.get('/workflow-runs/queued', workflowController.getQueuedWorkflows);

// Get workflow run by ID
router.get('/workflow-runs/:id', workflowController.getWorkflowRunById);

// Sync workflow run
router.post('/workflow-runs/:id/sync', workflowController.syncWorkflowRun);

// Update job information for a workflow run
router.post('/workflow-runs/:runId/jobs', workflowController.updateWorkflowJobs);

// Database status endpoint
router.get('/db/status', workflowController.getDatabaseStatus);

// Database backup routes
router.get('/database/backup', workflowController.createBackup);
router.post('/database/restore', workflowController.restoreBackup);

// Runner Routes
router.get('/runners/self-hosted', runnerController.getSelfHostedRunners);
router.get('/runners/github-hosted', runnerController.getGitHubHostedRunners);
router.get('/runners/groups/all', runnerController.getAllRunnerGroups);
router.get('/runners/groups/:level/:name', runnerController.getRunnerGroups);

// Sync Routes
router.get('/organizations', syncController.getOrganizations);
router.get('/sync/history', syncController.getSyncHistory);
router.get('/sync/active', syncController.getActiveSyncStatus);
router.post('/sync/:installationId', syncController.syncGitHubData);

// GitHub Client Routes
router.get('/github/client/:installationId', githubController.getClient);

// Repository Routes
router.get('/repositories/:orgName', repositoryController.getRepositories);

export default router;