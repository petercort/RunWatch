import { getGitHubClient } from '../utils/githubAuth.js';
import * as workflowService from './workflowService.js';
import SyncHistory from '../models/SyncHistory.js';

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

export const syncGitHubData = async (installationId, socket) => {
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

        // Create sync history record
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
            errors: []
        };

        // Get all repositories in the organization
        console.log('Fetching repositories...');
        const { data: repos } = await octokit.rest.repos.listForOrg({
            org: orgName,
            type: 'all',
            per_page: 100
        });

        results.repositories = repos.length;
        const totalRepos = repos.length;
        let processedRepos = 0;

        // Process each repository
        for (const repo of repos) {
            try {
                const { data: { workflows } } = await octokit.actions.listRepoWorkflows({
                    owner: orgName,
                    repo: repo.name
                });

                let processedWorkflows = 0;
                const totalWorkflows = workflows.length;

                for (const workflow of workflows) {
                    try {
                        const { data: { workflow_runs } } = await octokit.actions.listWorkflowRuns({
                            owner: orgName,
                            repo: repo.name,
                            workflow_id: workflow.id,
                            per_page: 100
                        });

                        results.workflows++;
                        processedWorkflows++;

                        // Calculate and emit progress
                        const repoProgress = (processedRepos / totalRepos) * 100;
                        const workflowProgress = (processedWorkflows / totalWorkflows) * 100;
                        const totalProgress = (repoProgress + (workflowProgress / totalRepos));
                        
                        if (socket) {
                            socket.emit('syncProgress', {
                                progress: Math.round(totalProgress),
                                currentRepo: repo.name,
                                currentWorkflow: workflow.name
                            });
                        }

                        // Process runs
                        for (const run of workflow_runs) {
                            try {
                                const { data: { jobs } } = await octokit.actions.listJobsForWorkflowRun({
                                    owner: orgName,
                                    repo: repo.name,
                                    run_id: run.id
                                });

                                const workflowRunPayload = {
                                    action: 'completed',
                                    workflow_run: run,
                                    repository: repo,
                                    organization: { login: orgName }
                                };

                                await workflowService.processWorkflowRun(workflowRunPayload);

                                if (jobs && jobs.length > 0) {
                                    for (const job of jobs) {
                                        const jobPayload = {
                                            action: 'completed',
                                            workflow_job: job,
                                            repository: repo,
                                            organization: { login: orgName }
                                        };
                                        await workflowService.processWorkflowJobEvent(jobPayload);
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
                errors: results.errors
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