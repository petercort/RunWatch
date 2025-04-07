import repoService from '../services/repoService.js';
import { successResponse as success, errorResponse as errorResp } from '../utils/responseHandler.js';

/**
 * Get repositories for a specific organization
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getRepositories = async (req, res) => {
  try {
    const { orgName } = req.params;
      
    const repos = await repoService.fetchRepos(orgName);
    success(res, repos);
  } catch (err) {
    console.error('Error in getRunnerGroups controller:', err);
    errorResp(res, err.message, 500);
  }
};

export default {
    getRepositories
};