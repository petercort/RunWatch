import RunnerGroup from '../models/RunnerGroup.js';
import SelfHostedRunner from '../models/SelfHostedRunner.js';
import GitHubHostedRunner from '../models/GitHubHostedRunner.js';

/**
 * Fetch all runner groups from the database
 * @param {Object} filters - Optional filters to apply (level, enterprise, organization)
 * @returns {Promise<Object>} - All runner groups from database
 */
export const getAllRunnerGroups = async (filters = {}) => {
  try {
    // If filters are provided, use them
    if (Object.keys(filters).length > 0) {
      return await RunnerGroup.find(filters);
    }
    
    // Otherwise, return the original structure
    const result = {
      enterprise: [],
      organization: []
    };
    
    // Fetch all runner groups from database
    const enterpriseGroups = await RunnerGroup.find({ level: 'enterprise' });
    const organizationGroups = await RunnerGroup.find({ level: 'organization' });
    
    result.enterprise = enterpriseGroups;
    result.organization = organizationGroups;
    
    return result;
  } catch (error) {
    console.error('Error fetching all runner groups from database:', error);
    throw error;
  }
};

/**
 * Get all runners from the database with optional filters
 * @param {Object} filters - Filters to apply (level, enterprise, organization, repository, type)
 * @returns {Promise<Array>} - List of runners matching filters
 */
export const getRunners = async (filters = {}) => {
  try {
    // Build query based on provided filters
    const query = {};
    
    if (filters.level) query.level = filters.level;
    if (filters.enterprise) query.enterprise = filters.enterprise;
    if (filters.organization) query.organization = filters.organization;
    if (filters.repository) query.repository = filters.repository;
    
    let runners = [];
    
    // If type filter is provided, query only that type of runner
    if (filters.type === 'self-hosted') {
      runners = await SelfHostedRunner.find(query);
    } else if (filters.type === 'github-hosted') {
      runners = await GitHubHostedRunner.find(query);
    } else {
      // Query both types of runners and merge the results
      const selfHostedRunners = await SelfHostedRunner.find(query);
      const githubHostedRunners = await GitHubHostedRunner.find(query);
      
      runners = [
        ...selfHostedRunners.map(runner => ({
          ...runner.toObject(),
          runnerType: 'self-hosted'
        })),
        ...githubHostedRunners.map(runner => ({
          ...runner.toObject(),
          runnerType: 'github-hosted'
        }))
      ];
    }
    
    return runners;
  } catch (error) {
    console.error('Error fetching runners from database:', error);
    throw error;
  }
};

/**
 * Fetch runner groups at various levels (enterprise, organization, repository)
 * @param {Object} options - Options for fetching runner groups
 * @param {string} options.enterpriseId - GitHub Enterprise ID (optional)
 * @param {string} options.org - GitHub Organization name (optional)
 * @param {string} options.repo - GitHub Repository name (optional)
 * @returns {Promise<Object>} - Runner groups data
 */
export const getRunnerGroups = async (options = {}) => {
  try {
    const result = {
      enterprise: [],
      organization: []
    };

    console.log('Fetching runner groups with options:', options);
    
    // Query from database instead of GitHub API
    if (options.level === 'enterprise') {
      const enterpriseGroups = await RunnerGroup.find({ 
        level: 'enterprise', 
        enterprise: options.enterpriseId 
      });
      result.enterprise = enterpriseGroups;
    }
    
    if (options.level === 'organization') {
      const orgGroups = await RunnerGroup.find({ 
        level: options.level, 
        organization: options.name 
      });
      result.organization = orgGroups;
    }

    return result;
  } catch (error) {
    console.error('Error fetching runner groups from database:', error);
    throw error;
  }
};

/**
 * Store a runner group in the database
 * @param {Object} runnerGroup - Runner group data to store
 * @returns {Promise<Object>} - Stored runner group
 */
export const storeRunnerGroup = async (runnerGroup) => {
  try {
    // Check if the runner group already exists
    const existingGroup = await RunnerGroup.findOne({ id: runnerGroup.id });
    
    if (existingGroup) {
      // Update existing group
      Object.assign(existingGroup, runnerGroup, { updatedAt: new Date() });
      await existingGroup.save();
      return existingGroup;
    } else {
      // Create new group
      const newGroup = new RunnerGroup({
        ...runnerGroup,
        updatedAt: new Date()
      });
      await newGroup.save();
      return newGroup;
    }
  } catch (error) {
    console.error('Error storing runner group in database:', error);
    throw error;
  }
};

/**
 * Store a runner in the database based on runner type
 * @param {Object} runner - Runner data to store
 * @param {String} runnerType - Runner type ('self-hosted' or 'github-hosted')
 * @returns {Promise<Object>} - Stored runner
 */
export const storeRunner = async (runner, runnerType = 'self-hosted') => {
  try {
    // Determine which model to use based on runner type
    const RunnerModel = runnerType === 'github-hosted' ? GitHubHostedRunner : SelfHostedRunner;
    
    // For GitHub-hosted runners, create a unique ID that includes organization and runner ID
    if (runnerType === 'github-hosted') {
      // Get the organization name or enterprise name based on level
      let _orgName = '';
      
      if (runner.level === 'organization' && runner.organization) {
        _orgName = runner.organization;
      } else if (runner.level === 'enterprise' && runner.enterprise) {
        _orgName = runner.enterprise;
      } else if (runner.level === 'repository' && runner.repository && runner.organization) {
        _orgName = `${runner.organization}/${runner.repository}`;
      }
    }
    
    // Check if the runner already exists
    const existingRunner = await RunnerModel.findOne({ id: runner.id });
    
    if (existingRunner) {
      // Update existing runner
      Object.assign(existingRunner, runner, { updatedAt: new Date() });
      await existingRunner.save();
      return existingRunner;
    } else {
      // Create new runner
      const newRunner = new RunnerModel({
        ...runner,
        updatedAt: new Date()
      });
      await newRunner.save();
      return newRunner;
    }
  } catch (error) {
    console.error(`Error storing ${runnerType} runner in database:`, error);
    throw error;
  }
};

/**
 * Store a self-hosted runner in the database
 * @param {Object} runner - Runner data to store
 * @returns {Promise<Object>} - Stored self-hosted runner
 */
export const storeSelfHostedRunner = async (runner) => {
  return storeRunner(runner, 'self-hosted');
};

/**
 * Store a GitHub-hosted runner in the database
 * @param {Object} runner - Runner data to store
 * @returns {Promise<Object>} - Stored GitHub-hosted runner
 */
export const storeGitHubHostedRunner = async (runner) => {
  return storeRunner(runner, 'github-hosted');
};

/**
 * Store multiple self-hosted runners in the database in a single batch operation
 * @param {Array<Object>} runners - Array of runner data to store
 * @returns {Promise<Number>} - Number of runners processed
 */
export const storeSelfHostedRunnersBatch = async (runners) => {
  if (!runners || runners.length === 0) {
    return 0;
  }

  try {
    const bulkOps = runners.map(runner => ({
      updateOne: {
        filter: { id: runner.id },
        update: { $set: { ...runner, updatedAt: new Date() } },
        upsert: true
      }
    }));

    const _result = await SelfHostedRunner.bulkWrite(bulkOps);
    console.log(`Successfully processed ${runners.length} self-hosted runners in batch mode`);
    return runners.length;
  } catch (error) {
    console.error('Error storing self-hosted runners batch in database:', error);
    // If bulkWrite fails, fall back to individual inserts
    console.log('Falling back to individual runner inserts...');
    let successCount = 0;
    for (const runner of runners) {
      try {
        await storeSelfHostedRunner(runner);
        successCount++;
      } catch (individualError) {
        console.error(`Error storing individual runner ${runner.id}:`, individualError);
      }
    }
    return successCount;
  }
};

/**
 * Store multiple GitHub-hosted runners in the database in a single batch operation
 * @param {Array<Object>} runners - Array of runner data to store
 * @returns {Promise<Number>} - Number of runners processed
 */
export const storeGitHubHostedRunnersBatch = async (runners) => {
  if (!runners || runners.length === 0) {
    return 0;
  }

  try {
    const bulkOps = runners.map(runner => ({
      updateOne: {
        filter: { id: runner.id },
        update: { $set: { ...runner, updatedAt: new Date() } },
        upsert: true
      }
    }));

    const _result = await GitHubHostedRunner.bulkWrite(bulkOps);
    console.log(`Successfully processed ${runners.length} GitHub-hosted runners in batch mode`);
    return runners.length;
  } catch (error) {
    console.error('Error storing GitHub-hosted runners batch in database:', error);
    // If bulkWrite fails, fall back to individual inserts
    console.log('Falling back to individual GitHub-hosted runner inserts...');
    let successCount = 0;
    for (const runner of runners) {
      try {
        await storeGitHubHostedRunner(runner);
        successCount++;
      } catch (individualError) {
        console.error(`Error storing individual GitHub-hosted runner ${runner.id}:`, individualError);
      }
    }
    return successCount;
  }
};

/**
 * Delete a runner from the database
 * @param {Number} runnerId - ID of the runner to delete
 * @param {String} runnerType - Type of runner ('self-hosted', 'github-hosted', or 'both')
 * @returns {Promise<Boolean>} - True if runner was deleted, false otherwise
 */
export const deleteRunner = async (runnerId, runnerType = 'both') => {
  try {
    let deleted = false;
    
    if (runnerType === 'self-hosted' || runnerType === 'both') {
      const selfHostedResult = await SelfHostedRunner.deleteOne({ id: runnerId });
      deleted = deleted || selfHostedResult.deletedCount > 0;
    }
    
    if (runnerType === 'github-hosted' || runnerType === 'both') {
      const githubHostedResult = await GitHubHostedRunner.deleteOne({ id: runnerId });
      deleted = deleted || githubHostedResult.deletedCount > 0;
    }
    
    return deleted;
  } catch (error) {
    console.error(`Error deleting runner ${runnerId} from database:`, error);
    throw error;
  }
};

/**
 * Delete a self-hosted runner from the database
 * @param {Number} runnerId - ID of the runner to delete
 * @returns {Promise<Boolean>} - True if runner was deleted, false otherwise
 */
export const deleteSelfHostedRunner = async (runnerId) => {
  return deleteRunner(runnerId, 'self-hosted');
};

/**
 * Delete a GitHub-hosted runner from the database
 * @param {Number} runnerId - ID of the runner to delete
 * @returns {Promise<Boolean>} - True if runner was deleted, false otherwise
 */
export const deleteGitHubHostedRunner = async (runnerId) => {
  return deleteRunner(runnerId, 'github-hosted');
};

/**
 * Delete a runner group from the database
 * @param {Number} runnerGroupId - ID of the runner group to delete
 * @returns {Promise<Boolean>} - True if runner group was deleted, false otherwise
 */
export const deleteRunnerGroup = async (runnerGroupId) => {
  try {
    const result = await RunnerGroup.deleteOne({ id: runnerGroupId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`Error deleting runner group ${runnerGroupId} from database:`, error);
    throw error;
  }
};

/**
 * Get all self-hosted runners from database with optional filters
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - All self-hosted runners matching filters
 */
export const getAllSelfHostedRunners = async (filters = {}) => {
  return getRunners({ ...filters, type: 'self-hosted' });
};

/**
 * Get all GitHub-hosted runners from database with optional filters
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - All GitHub-hosted runners matching filters
 */
export const getAllGitHubHostedRunners = async (filters = {}) => {
  return getRunners({ ...filters, type: 'github-hosted' });
};

export default {
  getAllRunnerGroups,
  getAllSelfHostedRunners,
  getAllGitHubHostedRunners,
  getRunnerGroups,
  storeRunnerGroup,
  storeRunner,
  storeSelfHostedRunner,
  storeGitHubHostedRunner,
  storeSelfHostedRunnersBatch,
  storeGitHubHostedRunnersBatch,
  deleteRunner,
  deleteSelfHostedRunner,
  deleteGitHubHostedRunner,
  deleteRunnerGroup
};