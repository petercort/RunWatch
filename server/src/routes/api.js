import express from 'express';
import * as workflowController from '../controllers/workflowController.js';

const router = express.Router();

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
router.get('/workflow-runs/repo/:repoName', workflowController.getRepoWorkflowRuns);

// Get workflow statistics
router.get('/stats', workflowController.getWorkflowStats);

// Update job information for a workflow run
router.post('/workflow-runs/:runId/jobs', workflowController.updateWorkflowJobs);

// Database status endpoint
router.get('/db/status', workflowController.getDatabaseStatus);

export default router;