import { validateGitHubConfig } from '../utils/githubAuth.js';
import * as syncService from '../services/syncService.js';
import SyncHistory from '../models/SyncHistory.js';
import { successResponse, errorResponse } from '../utils/responseHandler.js';

/**
 * Get available GitHub App installations/organizations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getOrganizations = async (req, res) => {
    try {
        validateGitHubConfig();
        const organizations = await syncService.getAvailableOrganizations();
        return successResponse(res, organizations);
    } catch (error) {
        console.error('Error fetching organizations:', error);
        return errorResponse(res, 'Failed to fetch organizations', 500, error);
    }
};

/**
 * Get sync history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getSyncHistory = async (req, res) => {
    try {
        const history = await syncService.getSyncHistory();
        return successResponse(res, history);
    } catch (error) {
        console.error('Error fetching sync history:', error);
        return errorResponse(res, 'Failed to fetch sync history', 500, error);
    }
};

/**
 * Get active sync status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getActiveSyncStatus = async (req, res) => {
    try {
        const activeSync = await SyncHistory.findOne({
            status: { $in: ['in_progress', 'paused'] }
        }).sort({ startedAt: -1 });
        
        return successResponse(res, activeSync);
    } catch (error) {
        console.error('Error fetching active sync:', error);
        return errorResponse(res, 'Failed to fetch active sync status', 500, error);
    }
};

/**
 * Sync GitHub data using installation ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const syncGitHubData = async (req, res) => {
    try {
        validateGitHubConfig();
        const { installationId } = req.params;
        const { maxWorkflowRuns = 100 } = req.body;
        
        const results = await syncService.syncGitHubData(installationId, req.io, { maxWorkflowRuns });
        
        return successResponse(res, results, 'GitHub data sync completed successfully');
    } catch (error) {
        console.error('Sync error:', error);
        return errorResponse(res, 'Failed to sync GitHub data', 500, error);
    }
};

export default {
    getOrganizations,
    getSyncHistory,
    getActiveSyncStatus,
    syncGitHubData
};