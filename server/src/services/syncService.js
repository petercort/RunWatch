import { getGitHubClient } from '../utils/githubAuth.js';
import * as workflowService from './workflowService.js';
import * as runnerService from './runnerService.js';  // Import runnerService for storing runner data
import SyncHistory from '../models/SyncHistory.js';

// Mark any existing in_progress syncs as interrupted when starting up
const markInterruptedSyncs = async () => {
    try {
        // First find all in_progress syncs to preserve their current progress
        const inProgressSyncs = await SyncHistory.find({ status: 'in_progress' });
        
        for (const sync of inProgressSyncs) {
            await SyncHistory.findByIdAndUpdate(sync._id, {
                status: 'interrupted',
                completedAt: new Date(),
                results: {
                    ...sync.results, // Preserve all existing results
                    error: 'Sync process was interrupted by application restart',
                    lastProgress: sync.results?.progress || null
                }
            });
        }
    } catch (error) {
        console.error('Error marking interrupted syncs:', error);
    }
};

// Call this when the module loads
markInterruptedSyncs();

export const getAvailableOrganizations = async () => {
    try {
        console.log('Getting GitHub App installations...');
        const { installations } = await getGitHubClient();
        console.log('Found installations:', installations.length);
        return installations;
    } catch (error) {
        console.error('Error getting organizations:', error);
        throw error;
    }
};

export const getSyncHistory = async () => {
    return await SyncHistory.find().sort({ startedAt: -1 }).limit(10);
};

export const syncGitHubData = async (installationId, socket, options = { maxWorkflowRuns: 100 }) => {
    if (!installationId) {
        throw new Error('Installation ID is required for synchronization');
    }

    console.log('Starting sync for installation ID:', installationId);
    let syncRecord;
    
    try {
        // First ensure any existing in_progress syncs are marked as interrupted
        await markInterruptedSyncs();

        const { app: octokit } = await getGitHubClient(parseInt(installationId, 10));
        console.log('GitHub client initialized');

        // Get the installation details first
        console.log('Fetching installation details...');
        const { data: installation } = await octokit.rest.apps.getInstallation({
            installation_id: parseInt(installationId, 10)
        });
        
        const orgName = installation.account.login;
        console.log('Organization name:', orgName);

        // Create sync record
        syncRecord = await SyncHistory.create({
            organization: {
                id: installation.id,
                name: orgName,
                type: installation.account.type
            },
            status: 'in_progress',
            config: {
                maxWorkflowRuns: options.maxWorkflowRuns
            }
        });

        const results = {
            organization: orgName,
            totalRepositories: 0,
            repositories: 0,
            workflows: 0,
            runs: 0,
            runners: 0,
            runnerGroups: 0,
            errors: [],
            rateLimits: {}
        };

        // Function to check and handle rate limits
        const checkRateLimit = async () => {
            const { data: rateLimit } = await octokit.rest.rateLimit.get();
            const core = rateLimit.resources.core;
            const remaining = core.remaining;
            const resetTime = new Date(core.reset * 1000);
            
            results.rateLimits = {
                remaining,
                limit: core.limit,
                resetTime: resetTime.toISOString()
            };

            if (socket) {
                socket.emit('rateLimitUpdate', results.rateLimits);
            }

            if (remaining < 100) { // Buffer to prevent hitting absolute zero
                const waitTime = Math.max(0, resetTime - new Date());
                console.log(`Rate limit low (${remaining}), waiting for reset in ${Math.ceil(waitTime/1000)} seconds`);
                
                // Update sync record with paused status
                await SyncHistory.findByIdAndUpdate(syncRecord._id, {
                    status: 'paused',
                    results: {
                        ...results,
                        rateLimitPause: {
                            pausedAt: new Date(),
                            resumeAt: resetTime
                        }
                    }
                });

                if (socket) {
                    socket.emit('syncStatus', { 
                        status: 'paused',
                        message: `Rate limit reached. Waiting until ${resetTime.toLocaleString()}`
                    });
                }

                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // Update sync record back to in_progress
                await SyncHistory.findByIdAndUpdate(syncRecord._id, {
                    status: 'in_progress'
                });

                if (socket) {
                    socket.emit('syncStatus', { status: 'resumed' });
                }
            }
        };

        // Initial rate limit check
        await checkRateLimit();

        // Function to update progress and sync record
        const updateProgress = async (progress, currentRepo, currentWorkflow, repoIndex, totalRepos, workflowIndex, totalWorkflows, processedItems = {}) => {
            if (socket) {
                socket.emit('syncProgress', {
                    progress,
                    currentRepo,
                    currentWorkflow,
                    rateLimits: results.rateLimits,
                    details: {
                        currentRepoIndex: repoIndex + 1,
                        totalRepos,
                        currentWorkflowIndex: workflowIndex !== undefined ? workflowIndex + 1 : undefined,
                        totalWorkflows,
                        processedRepos: processedItems.repos || results.repositories,
                        processedWorkflows: processedItems.workflows || results.workflows,
                        processedRuns: processedItems.runs || results.runs
                    }
                });
            }

            // Update sync record with current progress and processed items
            await SyncHistory.findByIdAndUpdate(syncRecord._id, {
                'results.progress': {
                    current: progress,
                    total: 100,
                    currentRepo,
                    currentWorkflow,
                    repoIndex,
                    totalRepos,
                    workflowIndex,
                    totalWorkflows,
                    processedRepos: processedItems.repos || results.repositories,
                    processedWorkflows: processedItems.workflows || results.workflows,
                    processedRuns: processedItems.runs || results.runs
                }
            });
        };

        // Fetch enterprise runner groups and runners if applicable
        let isEnterprise = false;
        if (installation.account.type.toLowerCase() === 'enterprise') {
            isEnterprise = true;
            try {
                await checkRateLimit();
                const enterpriseSlug = installation.account.login;
                
                // Use the combined function to fetch enterprise runner groups and their runners
                const enterpriseRunnersData = await fetchRunnerGroupsWithRunners(octokit, enterpriseSlug, 'enterprise');
                results.runnerGroups += enterpriseRunnersData.runnerGroups.length;
                results.runners += enterpriseRunnersData.runners.length;

                await updateProgress(
                    Math.floor(10),
                    'Fetching enterprise runners...',
                    null,
                    0,
                    0,
                    undefined,
                    undefined,
                    { 
                        runners: results.runners,
                        runnerGroups: results.runnerGroups
                    }
                );
            } catch (error) {
                console.error('Error fetching enterprise runner data:', error);
                results.errors.push({
                    type: 'enterprise_runners',
                    name: installation.account.login,
                    error: error.message
                });
            }
        }

        // Fetch organization runner groups and runners
        try {
            await checkRateLimit();
            
            // Use the combined function to fetch organization runner groups and their runners
            const orgRunnersData = await fetchRunnerGroupsWithRunners(octokit, orgName, 'organization');
            results.runnerGroups += orgRunnersData.runnerGroups.length;
            results.runners += orgRunnersData.runners.length;

            await updateProgress(
                Math.floor(12),
                'Fetching organization runners...',
                null,
                0,
                0,
                undefined,
                undefined,
                { 
                    runners: results.runners,
                    runnerGroups: results.runnerGroups
                }
            );
        } catch (error) {
            console.error('Error fetching organization runner data:', error);
            results.errors.push({
                type: 'organization_runners',
                name: orgName,
                error: error.message
            });
        }

        // Get all repositories in the organization with pagination
        console.log('Fetching repositories...');
        const repos = [];
        let page = 1;
        let processedRepos = 0;  // Track processed repositories separately
        
        while (true) {
            await checkRateLimit();
            
            const { data: reposPage } = await octokit.rest.repos.listForOrg({
                org: orgName,
                type: 'all',
                per_page: 100,
                page
            });

            if (reposPage.length === 0) break;
            repos.push(...reposPage);
            page++;
            
            // Store total repositories count immediately after fetching
            results.totalRepositories = repos.length;
            results.repositories = 0; // Reset processed count

            // Update progress and totals
            await SyncHistory.findByIdAndUpdate(syncRecord._id, {
                'results.totalRepositories': repos.length,
                'results.repositories': 0,
                'results.progress.processedRepos': 0
            });
            
            // Update progress for repository fetching phase
            await updateProgress(
                Math.floor((repos.length / (reposPage.length * page)) * 15),
                'Fetching repositories...',
                null,
                repos.length,
                undefined,
                undefined,
                undefined,
                { 
                    totalRepositories: repos.length,
                    repos: 0
                }
            );
        }

        results.repositories = repos.length;

        // Process each repository
        for (let repoIndex = 0; repoIndex < repos.length; repoIndex++) {
            const repo = repos[repoIndex];
            try {
                await checkRateLimit();

                // Validate repository name to ensure it's in the correct format
                if (!repo.name || typeof repo.name !== 'string') {
                    throw new Error('Invalid repository name format');
                }

                // Calculate progress
                const repoProgress = Math.floor((repoIndex / repos.length) * 85) + 15;

                // Fetch repository-specific self-hosted runners
                try {
                    await checkRateLimit();
                    console.log(`Fetching self-hosted runners for repository: ${orgName}/${repo.name}`);
                    
                    const repoRunnerIds = await fetchRepoRunners(octokit, orgName, repo.name, results);
                    
                    if (repoRunnerIds.length > 0) {
                        console.log(`Found ${repoRunnerIds.length} self-hosted runners for repository ${orgName}/${repo.name}`);
                    }
                } catch (error) {
                    console.error(`Error fetching self-hosted runners for repository ${repo.name}:`, error);
                    results.errors.push({
                        type: 'repository_runners',
                        name: repo.name,
                        error: error.message
                    });
                }

                // Process workflows before incrementing the repository count
                let hasWorkflows = false;
                const workflows = [];
                page = 1;
                
                try {
                    // First check if the repository has actions enabled to avoid unnecessary API calls
                    try {
                        // If actions are disabled for this repo (already checked in fetchRepoRunners), skip fetching workflows
                        const { data: actionsPermissions } = await octokit.rest.actions.getGithubActionsPermissionsRepository({
                            owner: orgName,
                            repo: repo.name
                        });
                        
                        if (actionsPermissions && actionsPermissions.enabled === false) {
                            console.log(`Actions are disabled for repository ${orgName}/${repo.name}, skipping workflow check`);
                            continue; // Skip to the next repository
                        }
                    } catch (error) {
                        // If we can't get permissions, we'll still try to fetch workflows
                        console.log(`Couldn't determine actions permissions for ${orgName}/${repo.name}, continuing with workflow check`);
                    }
                    
                    // Make a lightweight call first to check if there are any workflows
                    const { data: workflowsCheck } = await octokit.rest.actions.listRepoWorkflows({
                        owner: orgName,
                        repo: repo.name,
                        per_page: 1,
                        page: 1
                    });
                    
                    // If no workflows exist, skip fetching all workflows
                    if (workflowsCheck.total_count === 0) {
                        console.log(`No workflows for repository ${orgName}/${repo.name}, skipping`);
                        continue; // Skip to the next repository
                    }
                    
                    // Now fetch all workflows with pagination if we know there are some
                    console.log(`Found ${workflowsCheck.total_count} workflows for repository ${orgName}/${repo.name}, fetching details`);
                    
                    while (true) {
                        const { data: { workflows: workflowsPage } } = await octokit.rest.actions.listRepoWorkflows({
                            owner: orgName,
                            repo: repo.name,
                            per_page: 100,
                            page
                        });

                        if (workflowsPage.length === 0) break;
                        workflows.push(...workflowsPage);
                        hasWorkflows = true;
                        page++;
                    }
                } catch (error) {
                    if (error.status !== 404) {
                        throw error;
                    }
                }

                // Only increment processed repos count if repository was successfully processed
                if (hasWorkflows) {
                    processedRepos++;
                    results.repositories = processedRepos;
                }

                await updateProgress(
                    repoProgress,
                    repo.name,
                    null,
                    repoIndex,
                    repos.length,
                    undefined,
                    undefined,
                    { 
                        totalRepositories: results.totalRepositories,
                        repos: processedRepos,
                        workflows: results.workflows,
                        runs: results.runs
                    }
                );

                // Process workflows
                for (let workflowIndex = 0; workflowIndex < workflows.length; workflowIndex++) {
                    const workflow = workflows[workflowIndex];
                    try {
                        await checkRateLimit();

                        results.workflows++;
                        // Calculate overall progress
                        // 15% for repo fetching + 85% for processing
                        const repoProgress = (repoIndex / repos.length) * 85;
                        const workflowProgress = (workflowIndex / workflows.length) * (85 / repos.length);
                        const totalProgress = Math.floor(15 + repoProgress + workflowProgress);

                        await updateProgress(
                            totalProgress,
                            repo.name,
                            workflow.name,
                            repoIndex,
                            repos.length,
                            workflowIndex,
                            workflows.length,
                            { 
                                repos: results.repositories,
                                workflows: results.workflows,
                                runs: results.runs
                            }
                        );

                        // Fetch workflow runs with pagination, limited by maxWorkflowRuns
                        const runs = [];
                        page = 1;
                        
                        while (runs.length < options.maxWorkflowRuns) {
                            try {
                                const { data: { workflow_runs: runsPage } } = await octokit.rest.actions.listWorkflowRuns({
                                    owner: orgName,
                                    repo: repo.name,
                                    workflow_id: workflow.id,
                                    per_page: Math.min(100, options.maxWorkflowRuns - runs.length),
                                    page
                                });

                                if (runsPage.length === 0) break;
                                
                                // Validate and normalize run status
                                runsPage.forEach(run => {
                                    // Ensure status is one of the valid enum values
                                    if (!['completed', 'action_required', 'cancelled', 'failure', 'neutral', 
                                         'skipped', 'stale', 'success', 'timed_out', 'in_progress', 'queued', 
                                         'requested', 'waiting', 'pending'].includes(run.status)) {
                                        run.status = 'pending';
                                    }
                                    
                                    // Ensure conclusion is one of the valid enum values or null
                                    if (run.conclusion && !['success', 'failure', 'cancelled', 'skipped', 'timed_out', 
                                                           'action_required', 'neutral', 'stale', 'startup_failure'].includes(run.conclusion)) {
                                        run.conclusion = null;
                                    }
                                });
                                
                                runs.push(...runsPage);
                                page++;
                            } catch (error) {
                                console.error(`Error fetching runs for workflow ${workflow.name}:`, error);
                                break;
                            }
                        }

                        results.workflows++;

                        // Process each run
                        const processWorkflowRunWithLabels = async (run, jobs, repo, orgName) => {
                            // Get all labels from jobs
                            const allLabels = new Set();
                            jobs.forEach(job => {
                                if (job.labels) {
                                    job.labels.forEach(label => allLabels.add(label));
                                }
                            });

                            // Create workflow run payload with combined labels
                            const workflowRunPayload = {
                                workflow_run: {
                                    ...run,
                                    labels: Array.from(allLabels) // Add combined labels to the run
                                },
                                repository: repo,
                                organization: { login: orgName }
                            };

                            const workflowRun = await workflowService.processWorkflowRun(workflowRunPayload);

                            // Process each job
                            if (jobs && jobs.length > 0) {
                                for (const job of jobs) {
                                    /* console.log(`Processing job ${job.id} for run ${run.run_number}:`, {
                                        labels: job.labels,
                                        runLabels: Array.from(allLabels),
                                        jobName: job.name,
                                        runNumber: run.run_number
                                    }); */

                                    const jobPayload = {
                                        action: 'completed',
                                        workflow_job: {
                                            ...job,
                                            run_number: run.run_number,
                                            labels: job.labels || []
                                        },
                                        repository: repo,
                                        organization: { login: orgName }
                                    };
                                    await workflowService.processWorkflowJobEvent(jobPayload);
                                }

                                if (global.io) {
                                    global.io.emit('workflowUpdate', workflowRun);
                                }
                            }

                            return workflowRun;
                        };

                        for (const run of runs) {
                            try {
                                await checkRateLimit();

                                // Fetch jobs with pagination
                                const jobs = [];
                                let page = 1;
                                
                                while (true) {
                                    const { data: { jobs: jobsPage } } = await octokit.rest.actions.listJobsForWorkflowRun({
                                        owner: orgName,
                                        repo: repo.name,
                                        run_id: run.id,
                                        per_page: 100,
                                        page
                                    });

                                    if (jobsPage.length === 0) break;
                                    jobs.push(...jobsPage);
                                    page++;
                                }

                                // Process run with all its jobs
                                const workflowRun = await processWorkflowRunWithLabels(run, jobs, repo, orgName);
                                results.runs++;

                                // Update progress
                                const totalProgress = Math.floor(15 + (repoIndex / repos.length) * 85);
                                await updateProgress(
                                    totalProgress,
                                    repo.name,
                                    workflow.name,
                                    repoIndex,
                                    repos.length,
                                    workflowIndex,
                                    workflows.length,
                                    { 
                                        repos: results.repositories,
                                        workflows: results.workflows,
                                        runs: results.runs
                                    }
                                );
                            } catch (error) {
                                console.error(`Error processing run ${run.id}:`, error);
                                results.errors.push({
                                    type: 'run',
                                    id: run.id,
                                    workflow: workflow.name,
                                    error: error.message
                                });
                            }
                        }
                    } catch (error) {
                        console.error(`Error processing workflow ${workflow.name}:`, error);
                        results.errors.push({
                            type: 'workflow',
                            name: workflow.name,
                            error: error.message
                        });
                    }
                }
                
            } catch (error) {
                console.error(`Error processing repository ${repo.name}:`, error);
                results.errors.push({
                    type: 'repository',
                    name: repo.name,
                    error: error.message
                });
            }
        }

        // Set final progress
        await updateProgress(100, null, null, repos.length, repos.length, null, null);

        // Update sync record with final results
        await SyncHistory.findByIdAndUpdate(syncRecord._id, {
            status: 'completed',
            completedAt: new Date(),
            results: {
                ...results,
                repositories: processedRepos,
                totalRepositories: results.totalRepositories,
                workflows: results.workflows,
                runs: results.runs,
                errors: results.errors,
                rateLimits: results.rateLimits,  // Preserve rate limits
                progress: {
                    current: 100,
                    total: 100,
                    currentRepo: null,
                    currentWorkflow: null,
                    repoIndex: repos.length,
                    totalRepos: repos.length,
                    workflowIndex: null,
                    totalWorkflows: null,
                    processedRepos: processedRepos
                }
            }
        });

        // Set progress to 100% when completed
        if (socket) {
            socket.emit('syncProgress', { 
                progress: 100,
                completed: true
            });
        }

        return results;
    } catch (error) {
        console.error('Error in syncGitHubData:', error);
        if (syncRecord) {
            await SyncHistory.findByIdAndUpdate(syncRecord._id, {
                status: 'failed',
                completedAt: new Date(),
                results: {
                    errors: [{
                        type: 'sync',
                        error: error.message
                    }]
                }
            });
        }
        throw error;
    }
};

// Combined function to fetch runner groups and their associated runners
export const fetchRunnerGroupsWithRunners = async (octokit, context, contextType) => {
    console.log(`Fetching runner groups and runners for ${contextType}: ${context}`);
    const results = {
        runnerGroups: [],
        runners: []
    };
    
    try {
        // Arrays to track IDs from GitHub for cleanup
        const fetchedRunnerGroupIds = [];
        const fetchedRunnerIds = [];
        
        // Track accurate runner counts per group
        const runnerCountsByGroup = {};
        
        // First fetch the runner groups
        let page = 1;
        const endpoint = contextType === 'enterprise' 
            ? 'GET /enterprises/{enterprise}/actions/runner-groups'
            : 'GET /orgs/{org}/actions/runner-groups';
        
        const params = contextType === 'enterprise' 
            ? { enterprise: context, per_page: 100 }
            : { org: context, per_page: 100 };
            
        // Fetch all runner groups with pagination
        while (true) {
            const { data: { runner_groups: groupsPage } } = await octokit.request(endpoint, {
                ...params,
                page
            });
            
            if (groupsPage.length === 0) break;
            
            // Process each runner group
            for (const group of groupsPage) {
                // create the unique ID for this runner group
                const id = `${context}-${group.id}`;
                // Track this group ID for cleanup later
                fetchedRunnerGroupIds.push(id);
                
                // Initialize runner count for this group
                runnerCountsByGroup[id] = {
                    selfHosted: 0,
                    githubHosted: 0,
                    total: 0
                };
                
                // group runners are stored in the runners_url and hosted_runners_url properties
                // make two calls, one for the runners and one for the hosted runners
                const groupRunnerIds = await fetchRunnersForGroup(octokit, group.runners_url, context, contextType, id, results, runnerCountsByGroup);
                const hostedRunnerIds = await fetchRunnersForGroup(octokit, group.hosted_runners_url, context, contextType, id, results, runnerCountsByGroup);
                fetchedRunnerIds.push(...groupRunnerIds, ...hostedRunnerIds);
                
                // Verify runner count matches what's reported by GitHub
                console.log(`Runner group ${group.name} (${id}): GitHub reports ${group.runners_count}, we found ${runnerCountsByGroup[id].total} (${runnerCountsByGroup[id].selfHosted} self-hosted, ${runnerCountsByGroup[id].githubHosted} GitHub-hosted)`);
                
                // Store runner group in database with accurate counts
                await runnerService.storeRunnerGroup({
                    id: id,
                    name: group.name,
                    visibility: group.visibility,
                    default: group.default,
                    runners_count: runnerCountsByGroup[id].total, // Use our accurate count
                    self_hosted_runners_count: runnerCountsByGroup[id].selfHosted,
                    github_hosted_runners_count: runnerCountsByGroup[id].githubHosted,
                    github_reported_count: group.runners_count, // Also store GitHub's reported count for reference
                    inherited: group.inherited || false,
                    allows_public_repositories: group.allows_public_repositories,
                    restricted_to_workflows: group.restricted_to_workflows,
                    selected_workflows: group.selected_workflows,
                    level: contextType,
                    enterprise: contextType === 'enterprise' ? context : null,
                    organization: contextType === 'organization' ? context : null,
                    updatedAt: new Date()
                });
                
                // Store run group with accurate counts for the sync results
                results.runnerGroups.push({
                    ...group,
                    self_hosted_runners_count: runnerCountsByGroup[id].selfHosted,
                    github_hosted_runners_count: runnerCountsByGroup[id].githubHosted,
                    actual_runners_count: runnerCountsByGroup[id].total
                });
            }
            
            page++;
            
            // If there are no more pages, break out of the loop
            if (groupsPage.length < 100) break;
        }
        
        console.log(`Found ${results.runnerGroups.length} runner groups and ${results.runners.length} runners for ${contextType}: ${context}`);
        
        // Clean up deleted runner groups
        await cleanupDeletedRunnerGroups(fetchedRunnerGroupIds, context, contextType);
        
        // Clean up deleted runners
        await cleanupDeletedRunners(fetchedRunnerIds, context, contextType);
        
        return results;
    } catch (error) {
        console.error(`Error fetching runner groups and runners for ${contextType} ${context}:`, error);
        throw error;
    }
};

// Helper function to clean up deleted runner groups
async function cleanupDeletedRunnerGroups(fetchedIds, context, contextType) {
    try {
        // Build query based on context
        const query = {
            level: contextType
        };
        
        if (contextType === 'enterprise') {
            query.enterprise = context;
        } else if (contextType === 'organization') {
            query.organization = context;
        }
        
        // Find all runner groups in database for this context
        const runnerGroups = await runnerService.getAllRunnerGroups(query);
        
        // Find groups that exist in database but not in fetched data
        const deletedGroups = runnerGroups.filter(group => !fetchedIds.includes(group.id));
        
        if (deletedGroups.length > 0) {
            console.log(`Found ${deletedGroups.length} runner groups that were deleted from GitHub for ${contextType} ${context}`);
            
            // Delete each group
            for (const group of deletedGroups) {
                await runnerService.deleteRunnerGroup(group.id);
                console.log(`Deleted runner group ${group.name} (ID: ${group.id}) from database`);
            }
        }
    } catch (error) {
        console.error(`Error cleaning up deleted runner groups for ${contextType} ${context}:`, error);
    }
}

// Helper function to clean up deleted runners
async function cleanupDeletedRunners(fetchedIds, context, contextType) {
    try {
        // Build query based on context
        const query = {
            level: contextType
        };
        
        if (contextType === 'enterprise') {
            query.enterprise = context;
        } else if (contextType === 'organization') {
            query.organization = context;
        }
        
        // Find all runners in database for this context
        const runners = await runnerService.getAllRunners(query);
        
        // Find runners that exist in database but not in fetched data
        const deletedRunners = runners.filter(runner => !fetchedIds.includes(runner.id));
        
        if (deletedRunners.length > 0) {
            console.log(`Found ${deletedRunners.length} runners that were deleted from GitHub for ${contextType} ${context}`);
            
            // Delete each runner
            for (const runner of deletedRunners) {
                await runnerService.deleteRunner(runner.id);
                console.log(`Deleted runner ${runner.name} (ID: ${runner.id}) from database`);
            }
        } else {
            console.log(`No runners to delete for ${contextType} ${context}`);
        }
    } catch (error) {
        console.error(`Error cleaning up deleted runners for ${contextType} ${context}:`, error);
    }
}

// Helper function to fetch runners for a specific group
async function fetchRunnersForGroup(octokit, endpoint, context, contextType, groupId, results, runnerCountsByGroup) {
    let page = 1;
    const runnerIds = [];
    
    const params = { runner_group_id: groupId, per_page: 100 };
    
    try {
        while (true) {
            const { data: { runners: runnersPage } } = await octokit.request(endpoint, {
                ...params,
                page
            });
            
            if (runnersPage.length === 0) break;
            
            // Store runners in database and track IDs
            for (const runner of runnersPage) {
                // create unique ID for this runner
                const id = `${groupId}-${runner.id}`;
                runnerIds.push(id);
                
                // Determine if this is a self-hosted or GitHub-hosted runner
                const isGitHubHosted = endpoint.includes('hosted-runners');
                
                if (isGitHubHosted) {
                    // Process as GitHub-hosted runner
                    await runnerService.storeGitHubHostedRunner({
                        id,
                        name: runner.name,
                        runner_group_id: groupId,
                        platform: runner.platform || '',
                        image: runner.image || { id: '', size: 0 },
                        machine_size_details: runner.machine_size_details || { id: '', cpu_cores: 0, memory_gb: 0, storage_gb: 0 },
                        status: runner.status,
                        maximum_runners: runner.maximum_runners || 1,
                        public_ip_enabled: runner.public_ip_enabled || false,
                        public_ips: runner.public_ips || [],
                        last_active_on: runner.last_active_on || null,
                        level: contextType,
                        enterprise: contextType === 'enterprise' ? context : null,
                        organization: contextType === 'organization' ? context : null,
                        repository: null,
                        updatedAt: new Date()
                    });
                    
                    // Update counts for this group
                    if (runnerCountsByGroup && runnerCountsByGroup[groupId]) {
                        runnerCountsByGroup[groupId].githubHosted++;
                        runnerCountsByGroup[groupId].total++;
                    }
                } else {
                    // Process as self-hosted runner
                    await runnerService.storeSelfHostedRunner({
                        id,
                        name: runner.name,
                        os: runner.os,
                        status: runner.status,
                        busy: runner.busy,
                        ephemeral: runner.ephemeral || false,
                        runner_group_id: groupId,
                        labels: runner.labels?.map(l => ({ id: l.id, name: l.name, type: l.type })) || [],
                        level: contextType,
                        enterprise: contextType === 'enterprise' ? context : null,
                        organization: contextType === 'organization' ? context : null,
                        repository: null,
                        updatedAt: new Date()
                    });
                    
                    // Update counts for this group
                    if (runnerCountsByGroup && runnerCountsByGroup[groupId]) {
                        runnerCountsByGroup[groupId].selfHosted++;
                        runnerCountsByGroup[groupId].total++;
                    }
                }
                
                results.runners.push({
                    ...runner,
                    runnerType: isGitHubHosted ? 'github-hosted' : 'self-hosted'
                });
            }
            
            page++;
            
            // If there are no more pages, break out of the loop
            if (runnersPage.length < 100) break;
        }
        return runnerIds;
    } catch (error) {
        console.error(`Error fetching runners for ${contextType} ${context} group ${groupId}:`, error);
        // Don't throw error, just log and continue
        return runnerIds;
    }
}

// Helper function to fetch repository-specific self-hosted runners
async function fetchRepoRunners(octokit, owner, repoName, results) {
    // First check if the repository has actions enabled to avoid unnecessary API calls
    console.log(`Checking if actions are enabled for repository ${owner}/${repoName}`);
    try {
        // Try to get the repository actionsPermissions first - if actions aren't enabled,
        // there's no need to query for runners (significant performance improvement)
        const { data: actionsPermissions } = await octokit.rest.actions.getGithubActionsPermissionsRepository({
            owner,
            repo: repoName
        });
        
        // If actions are disabled for this repo, skip fetching runners
        if (actionsPermissions && actionsPermissions.enabled === false) {
            console.log(`Actions are disabled for repository ${owner}/${repoName}, skipping runner check`);
            return [];
        }
    } catch (error) {
        // If we can't get permissions, we'll still try to fetch runners
        // This usually means we don't have sufficient permissions or the repository doesn't support actions
        console.log(`Couldn't determine actions permissions for ${owner}/${repoName}, continuing with runner check`);
    }
    
    const runnerIds = [];
    let page = 1;
    
    try {
        // First make a head request to check if runners exist before fetching all data
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/runners', {
            owner,
            repo: repoName
        });
        // Check if total_count in headers exists and is greater than 0
        const totalCount = parseInt(data['total_count'] || '0', 10);
        if (totalCount === 0) {
            console.log(`No runners for repository ${owner}/${repoName}, skipping fetch`);
            return [];
        }
        
        console.log(`Found ${totalCount} runners for repository ${owner}/${repoName}, fetching details`);
        
        // Only proceed with fetching if we know there are runners
        while (true) {
            const { data: { runners: runnersPage } } = await octokit.rest.actions.listSelfHostedRunnersForRepo({
                owner,
                repo: repoName,
                per_page: 100,
                page
            });
            
            if (!runnersPage || runnersPage.length === 0) break;
            
            // Batch process runners to reduce database operations
            const runnerBatch = [];
            
            // Store runners in database and track IDs
            for (const runner of runnersPage) {
                // create unique ID for this runner
                
                const id = `${repoName}-${runner.id}`;
                runnerIds.push(id);
                
                // Prepare runner data for batch insert
                runnerBatch.push({
                    id,
                    name: runner.name,
                    os: runner.os,
                    status: runner.status,
                    busy: runner.busy,
                    ephemeral: runner.ephemeral || false,
                    labels: runner.labels?.map(l => ({ id: l.id, name: l.name, type: l.type })) || [],
                    level: 'repository',
                    enterprise: null,
                    organization: owner,
                    repository: repoName,
                    updatedAt: new Date()
                });
                
                // Add to results count
                if (results) {
                    results.runners = (results.runners || 0) + 1;
                }
            }
            
            // Batch store runners to improve database performance
            if (runnerBatch.length > 0) {
                await runnerService.storeSelfHostedRunnersBatch(runnerBatch);
            }
            
            page++;
            
            // If we've fetched all runners based on total count, or we received fewer than 100, break
            if (runnerIds.length >= totalCount || runnersPage.length < 100) break;
        }
        
        return runnerIds;
    } catch (error) {
        // Check if it's a 404 error, which means the repository doesn't have runners configured
        if (error.status === 404) {
            console.log(`Repository ${owner}/${repoName} doesn't have self-hosted runners configured`);
            return [];
        }
        
        console.error(`Error fetching runners for repository ${owner}/${repoName}:`, error);
        return runnerIds;
    }
}
