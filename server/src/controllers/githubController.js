import { getGitHubClient } from '../utils/githubAuth.js';
import { successResponse, errorResponse } from '../utils/responseHandler.js';

/**
 * Get authenticated GitHub client for an installation ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getClient = async (req, res) => {
  try {
    const { installationId } = req.params;
    
    if (!installationId) {
      return errorResponse(res, 'Installation ID is required', 400);
    }
    
    const client = await getGitHubClient(installationId);
    
    // Store the client in the request object for later use by other middleware/controllers
    req.githubClient = client;
    
    // Return success message instead of the client object
    return successResponse(res, { 
      success: true, 
      message: 'GitHub client created successfully',
      installationId
    });
  } catch (err) {
    console.error('Error creating GitHub client:', err.message);
    // Only pass the error message, not the entire error object which might have circular references
    return errorResponse(res, `Failed to create GitHub client: ${err.message}`, 500);
  }
};


export default {
  getClient
};