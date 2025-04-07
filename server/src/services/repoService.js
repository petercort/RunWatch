import SelfHostedRunner from '../models/SelfHostedRunner.js';
import GitHubHostedRunner from '../models/GitHubHostedRunner.js';

/**
 * Fetch repositories for an organization that have runners or are part of runner groups
 * @param {string} orgName - GitHub Organization name
 * @param {Object} options - Options for fetching repositories
 * @param {number} options.perPage - Number of repositories per page (default: 100)
 * @param {string} options.type - Type of repositories to return (all, public, private, forks, sources, member)
 * @param {string} options.sort - How to sort the repositories (created, updated, pushed, full_name)
 * @param {string} options.direction - Direction of sort (asc or desc)
 * @returns {Promise<Array>} - List of repositories with runners or in runner groups
 */
export const fetchRepos = async (orgName) => {
    try {
        console.log(`Querying database for repositories where organization=${orgName}`);
        
        // Find distinct repository values where organization matches the parameter from both models
        const selfHostedReposWithRunners = await SelfHostedRunner.distinct('repository', { 
            organization: orgName,
            repository: { $exists: true, $ne: null } // Ensure repository field exists and is not null
        });
        
        const githubHostedReposWithRunners = await GitHubHostedRunner.distinct('repository', { 
            organization: orgName,
            repository: { $exists: true, $ne: null } // Ensure repository field exists and is not null
        });
        
        // Combine and deduplicate repository names
        const allRepos = [...new Set([...selfHostedReposWithRunners, ...githubHostedReposWithRunners])];
        
        console.log(`Found ${allRepos.length} unique repositories with runners for ${orgName}`);
        
        // Transform the repository names into objects with the expected structure
        const repositories = await Promise.all(allRepos.map(async (repoName) => {
            // Check which types of runners this repository has
            const selfHostedCount = await SelfHostedRunner.countDocuments({ 
                organization: orgName, 
                repository: repoName 
            });
            
            const githubHostedCount = await GitHubHostedRunner.countDocuments({ 
                organization: orgName, 
                repository: repoName 
            });
            
            // Determine runner type based on the actual data
            let runnerType = 'None';
            if (selfHostedCount > 0 && githubHostedCount > 0) {
                runnerType = 'Both';
            } else if (selfHostedCount > 0) {
                runnerType = 'SelfHosted';
            } else if (githubHostedCount > 0) {
                runnerType = 'GitHubHosted';
            }
            
            return {
                name: repoName,
                full_name: `${orgName}/${repoName}`,
                html_url: `https://github.com/${orgName}/${repoName}`,
                has_runners: selfHostedCount + githubHostedCount > 0,
                runner_type: runnerType,
                runner_counts: {
                    self_hosted: selfHostedCount,
                    github_hosted: githubHostedCount,
                    total: selfHostedCount + githubHostedCount
                }
            };
        }));
        
        return repositories;
    } catch (error) {
        console.error(`Error fetching repositories from database for ${orgName}:`, error);
        throw error;
    }
};

export default {
  fetchRepos
};