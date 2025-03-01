import express from 'express';
import * as workflowController from '../controllers/workflowController.js';
import { syncGitHubData, getAvailableOrganizations, getSyncHistory } from '../services/syncService.js';
import { validateGitHubConfig } from '../utils/githubAuth.js';

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

// Get available organizations
router.get('/organizations', async (req, res) => {
    try {
        validateGitHubConfig();
        const organizations = await getAvailableOrganizations();
        res.json({
            success: true,
            data: organizations
        });
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch organizations',
            error: error.message
        });
    }
});

// Get sync history
router.get('/sync/history', async (req, res) => {
    try {
        const history = await getSyncHistory();
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Error fetching sync history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sync history',
            error: error.message
        });
    }
});

// Sync endpoint using installation ID
router.post('/sync/:installationId', async (req, res) => {
    try {
        validateGitHubConfig();
        const { installationId } = req.params;
        
        const results = await syncGitHubData(installationId, req.io);
        
        res.json({
            success: true,
            message: 'GitHub data sync completed successfully',
            results
        });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync GitHub data',
            error: error.message
        });
    }
});

export default router;