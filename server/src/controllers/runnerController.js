import runnerService from '../services/runnerService.js';
import { successResponse as success, errorResponse as errorResp } from '../utils/responseHandler.js';

/**
 * Get all runner groups from the database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getAllRunnerGroups = async (req, res) => {
  try {
    // Get all runner groups from the database
    const runnerGroups = await runnerService.getAllRunnerGroups();
    success(res, runnerGroups);
  } catch (err) {
    console.error('Error in getAllRunnerGroups controller:', err);
    errorResp(res, err.message, 500);
  }
};

/**
 * Get runner groups at different levels (enterprise, organization, repository)
 * directly from the database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getRunnerGroups = async (req, res) => {
  try {
    const { level, name } = req.params;

    const options = {
      level,
      name
    };

    // Use the database backed method to fetch runner groups
    const runnerGroups = await runnerService.getRunnerGroups(options);
    success(res, runnerGroups);
  } catch (err) {
    console.error('Error in getRunnerGroups controller:', err);
    errorResp(res, err.message, 500);
  }
};

/**
 * Get detailed information about a specific runner group from the database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getRunnerGroupDetails = async (req, res) => {
  try {
    //const { level, groupId } = req.params;
    const { level, name } = req.params;

    // Use the database backed method to fetch runner group details
    const details = await runnerService.getRunnerGroupDetails(
      level,
      name
    );
    success(res, details);
  } catch (err) {
    console.error('Error in getRunnerGroupDetails controller:', err);
    errorResp(res, err.message, 500);
  }
};

/**
 * Get all self-hosted runners from the database with optional filters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getSelfHostedRunners = async (req, res) => {
  try {
    const { level, enterprise, organization, repository } = req.query;
    
    const filters = {
      level,
      enterprise,
      organization,
      repository
    };
    
    // Remove undefined values
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    
    const runners = await runnerService.getAllSelfHostedRunners(filters);
    success(res, runners);
  } catch (err) {
    console.error('Error in getSelfHostedRunners controller:', err);
    errorResp(res, err.message, 500);
  }
};

/**
 * Get all GitHub-hosted runners from the database with optional filters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getGitHubHostedRunners = async (req, res) => {
  try {
    const { level, enterprise, organization, repository } = req.query;
    
    const filters = {
      level,
      enterprise,
      organization,
      repository
    };
    
    // Remove undefined values
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    
    const runners = await runnerService.getAllGitHubHostedRunners(filters);
    success(res, runners);
  } catch (err) {
    console.error('Error in getGitHubHostedRunners controller:', err);
    errorResp(res, err.message, 500);
  }
};

export default {
  getAllRunnerGroups,
  getRunnerGroups,
  getRunnerGroupDetails,
  getSelfHostedRunners,
  getGitHubHostedRunners
};