import { getGitHubClient } from '../utils/githubAuth.js';
import * as workflowService from './workflowService.js';
import SyncHistory from '../models/SyncHistory.js';
import WorkflowRun from '../models/WorkflowRun.js';

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
            status: 'in_progress'
        });

        const results = {
            organization: orgName,
            repositories: 0,
            workflows: 0,
            runs: 0,
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

        // Get all repositories in the organization with pagination
        console.log('Fetching repositories...');
        const repos = [];
        let page = 1;
        
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
            
            if (socket) {
                socket.emit('syncProgress', {
                    phase: 'fetching_repos',
                    repositoriesFound: repos.length
                });
            }
        }

        results.repositories = repos.length;
        let processedRepos = 0;

        // Process each repository
        for (const repo of repos) {
            try {
                await checkRateLimit();

                // Fetch workflows with pagination
                const workflows = [];
                page = 1;
                
                while (true) {
                    const { data: { workflows: workflowsPage } } = await octokit.rest.actions.listRepoWorkflows({
                        owner: orgName,
                        repo: repo.name,
                        per_page: 100,
                        page
                    });

                    if (workflowsPage.length === 0) break;
                    workflows.push(...workflowsPage);
                    page++;
                }

                let processedWorkflows = 0;
                const totalWorkflows = workflows.length;

                for (const workflow of workflows) {
                    try {
                        await checkRateLimit();

                        // Fetch workflow runs with pagination, limited by maxWorkflowRuns
                        const runs = [];
                        page = 1;
                        
                        while (runs.length < options.maxWorkflowRuns) {
                            const { data: { workflow_runs: runsPage } } = await octokit.rest.actions.listWorkflowRuns({
                                owner: orgName,
                                repo: repo.name,
                                workflow_id: workflow.id,
                                per_page: Math.min(100, options.maxWorkflowRuns - runs.length),
                                page
                            });

                            if (runsPage.length === 0) break;
                            runs.push(...runsPage);
                            page++;
                        }

                        results.workflows++;
                        processedWorkflows++;

                        // Calculate and emit progress
                        const repoProgress = (processedRepos / repos.length) * 100;
                        const workflowProgress = (processedWorkflows / totalWorkflows) * 100;
                        const totalProgress = (repoProgress + (workflowProgress / repos.length));
                        
                        if (socket) {
                            socket.emit('syncProgress', {
                                progress: Math.round(totalProgress),
                                currentRepo: repo.name,
                                currentWorkflow: workflow.name,
                                rateLimits: results.rateLimits
                            });
                        }

                        // Process each run
                        for (const run of runs) {
                            try {
                                await checkRateLimit();

                                // Fetch jobs with pagination
                                const jobs = [];
                                page = 1;
                                
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

                                // Process workflow run with all its jobs
                                // Determine the actual status based on jobs
                                let actualStatus = run.status;
                                let actualConclusion = run.conclusion;
                                
                                if (jobs && jobs.length > 0) {
                                    const allCompleted = jobs.every(job => job.status === 'completed');
                                    const anyInProgress = jobs.some(job => job.status === 'in_progress');
                                    const anyFailed = jobs.some(job => job.conclusion === 'failure');
                                    
                                    if (allCompleted) {
                                        actualStatus = 'completed';
                                        actualConclusion = anyFailed ? 'failure' : 'success';
                                    } else if (anyInProgress) {
                                        actualStatus = 'in_progress';
                                    }
                                }

                                // Update the run status before processing
                                run.status = actualStatus;
                                run.conclusion = actualConclusion;

                                const workflowRunPayload = {
                                    action: 'completed',
                                    workflow_run: run,
                                    repository: repo,
                                    organization: { login: orgName }
                                };

                                const workflowRun = await workflowService.processWorkflowRun(workflowRunPayload);

                                if (jobs && jobs.length > 0) {
                                    for (const job of jobs) {
                                        console.log(`Processing job ${job.id} for run ${run.run_number}:`, {
                                            labels: job.labels,
                                            runLabels: run.labels,
                                            jobName: job.name,
                                            runNumber: run.run_number
                                        });

                                        // Attach run_number and labels from both workflow run and job
                                        const jobPayload = {
                                            action: 'completed',
                                            workflow_job: {
                                                ...job,
                                                run_number: run.run_number,
                                                ...(job.labels && { labels: job.labels })
                                            },
                                            repository: repo,
                                            organization: { login: orgName }
                                        };
                                        await workflowService.processWorkflowJobEvent(jobPayload);
                                    }

                                    // Emit update after processing all jobs
                                    if (global.io) {
                                        global.io.emit('workflowUpdate', workflowRun);
                                    }
                                }

                                results.runs++;
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
                processedRepos++;
            } catch (error) {
                console.error(`Error processing repository ${repo.name}:`, error);
                results.errors.push({
                    type: 'repository',
                    name: repo.name,
                    error: error.message
                });
            }
        }

        // Update sync record with results
        await SyncHistory.findByIdAndUpdate(syncRecord._id, {
            status: 'completed',
            completedAt: new Date(),
            results: {
                repositories: results.repositories,
                workflows: results.workflows,
                runs: results.runs,
                errors: results.errors,
                rateLimits: results.rateLimits
            }
        });

        if (socket) {
            socket.emit('syncProgress', { progress: 100 });
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