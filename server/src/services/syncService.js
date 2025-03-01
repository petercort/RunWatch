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

        // Clean up duplicate workflow runs before syncing
        console.log('Cleaning up potential duplicates...');
        const duplicates = await WorkflowRun.aggregate([
            {
                $group: {
                    _id: {
                        repoFullName: "$repository.fullName",
                        workflowName: "$workflow.name",
                        runNumber: "$run.number"
                    },
                    count: { $sum: 1 },
                    docs: { $push: "$$ROOT" }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        for (const duplicate of duplicates) {
            // Sort by created date and keep only the most recent
            const sorted = duplicate.docs.sort((a, b) => 
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            // Delete all but the most recent
            const toDelete = sorted.slice(1);
            await Promise.all(toDelete.map(doc => 
                WorkflowRun.deleteOne({ _id: doc._id })
            ));
        }

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