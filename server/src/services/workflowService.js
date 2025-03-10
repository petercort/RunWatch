import WorkflowRun from '../models/WorkflowRun.js';

const transformGitHubUrl = (apiUrl) => {
  if (!apiUrl) return '';
  // Transform from API URL to web interface URL
  // From: https://api.github.com/repos/owner/repo/actions/runs/123456
  // To:   https://github.com/owner/repo/actions/runs/123456
  return apiUrl.replace('https://api.github.com/repos/', 'https://github.com/');
};

export const processWorkflowRun = async (payload) => {
  const { repository, workflow_run: run } = payload;
  
  try {
    // First try to find by run ID
    let workflowRun = await WorkflowRun.findOne({ 'run.id': run.id });
    
    if (!workflowRun) {
      // Create new workflow run logic...
      workflowRun = new WorkflowRun({
        repository: {
          id: repository.id,
          name: repository.name,
          fullName: repository.full_name,
          owner: {
            login: repository.owner.login,
            url: transformGitHubUrl(repository.owner.html_url)
          },
          url: transformGitHubUrl(repository.html_url)
        },
        workflow: {
          id: run.workflow_id,
          name: run.name,
          path: run.path
        },
        run: {
          id: run.id,
          number: run.run_number,
          created_at: run.created_at,
          updated_at: run.updated_at,
          status: run.status,
          conclusion: run.status === 'completed' ? run.conclusion : null, // Only set conclusion if completed
          url: transformGitHubUrl(run.html_url),
          head_branch: run.head_branch,
          event: run.event,
          labels: run.labels || [],  // Just store the array as is, no mapping needed
          runner_id: run.runner_id,
          runner_name: run.runner_name,
          runner_group_id: run.runner_group_id,
          runner_group_name: run.runner_group_name
        }
      });
    } else {
      // Update existing workflow run
      workflowRun.workflow.id = run.workflow_id;
      workflowRun.workflow.name = run.name;
      workflowRun.workflow.path = run.path;
      workflowRun.run.status = run.status;
      // Only update conclusion if the status is completed or if we're transitioning from completed
      if (run.status === 'completed') {
        workflowRun.run.conclusion = run.conclusion;
      } else if (run.status !== 'completed') {
        workflowRun.run.conclusion = null; // Reset conclusion for non-completed states
      }
      workflowRun.run.updated_at = run.updated_at;
      workflowRun.run.url = transformGitHubUrl(run.html_url);
      workflowRun.run.head_branch = run.head_branch;
      workflowRun.run.event = run.event;
      if (run.labels) {
        workflowRun.run.labels = run.labels;
      }
      workflowRun.run.runner_id = run.runner_id;
      workflowRun.run.runner_name = run.runner_name;
      workflowRun.run.runner_group_id = run.runner_group_id;
      workflowRun.run.runner_group_name = run.runner_group_name;
    }

    console.log('Saving workflow run:', {
      id: workflowRun.run.id,
      status: workflowRun.run.status,
      conclusion: workflowRun.run.conclusion
    });

    await workflowRun.save();
    return workflowRun;
  } catch (error) {
    console.error('Error processing workflow run:', error);
    throw error;
  }
};

export const updateWorkflowJobs = async (runId, jobs) => {
  try {
    const workflowRun = await WorkflowRun.findOne({ 'run.id': runId });
    
    if (!workflowRun) {
      throw new Error('Workflow run not found');
    }

    workflowRun.jobs = jobs.map(job => ({
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      started_at: job.started_at,
      completed_at: job.completed_at,
      steps: job.steps.map(step => ({
        name: step.name,
        status: step.status,
        conclusion: step.conclusion,
        number: step.number,
        started_at: step.started_at,
        completed_at: step.completed_at
      }))
    }));

    await workflowRun.save();
    return workflowRun;
  } catch (error) {
    console.error('Error updating workflow jobs:', error);
    throw error;
  }
};

export const calculateWorkflowStats = async () => {
  try {
    const [
      totalRuns,
      successfulRuns,
      failedRuns,
      inProgressRuns,
      recentRuns
    ] = await Promise.all([
      WorkflowRun.countDocuments(),
      WorkflowRun.countDocuments({ 'run.conclusion': 'success' }),
      WorkflowRun.countDocuments({ 'run.conclusion': 'failure' }),
      WorkflowRun.countDocuments({ 'run.status': 'in_progress' }),
      WorkflowRun.find()
        .sort({ 'run.created_at': -1 })
        .limit(5)
        .select('repository workflow run')
    ]);

    // Get repository-specific stats
    const repoStats = await WorkflowRun.aggregate([
      {
        $group: {
          _id: '$repository.fullName',
          totalRuns: { $sum: 1 },
          successfulRuns: {
            $sum: {
              $cond: [{ $eq: ['$run.conclusion', 'success'] }, 1, 0]
            }
          },
          failedRuns: {
            $sum: {
              $cond: [{ $eq: ['$run.conclusion', 'failure'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { totalRuns: -1 } }
    ]);

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      inProgressRuns,
      successRate: totalRuns ? (successfulRuns / totalRuns * 100).toFixed(2) : 0,
      recentRuns,
      repoStats
    };
  } catch (error) {
    console.error('Error calculating workflow stats:', error);
    throw error;
  }
};

export const processWorkflowJobEvent = async (payload) => {
  const { workflow_job, repository } = payload;
  
  try {
    console.log('Processing workflow job event:', {
      jobId: workflow_job.id,
      runId: workflow_job.run_id,
      labels: workflow_job.labels,
      status: workflow_job.status
    });

    // First try to find by run ID
    let workflowRun = await WorkflowRun.findOne({ 'run.id': workflow_job.run_id });
    
    // If not found by run ID, check if we have a duplicate by run number and workflow name
    if (!workflowRun) {
      workflowRun = await WorkflowRun.findOne({
        'repository.fullName': repository.full_name,
        'workflow.name': workflow_job.workflow_name,
        'run.number': workflow_job.run_number
      });
      
      // If still not found, create new workflow run
      if (!workflowRun) {
        workflowRun = new WorkflowRun({
          repository: {
            id: repository.id,
          name: repository.name,
          fullName: repository.full_name,
          owner: {
            login: repository.owner.login,
            url: transformGitHubUrl(repository.owner.url)
          },
          url: transformGitHubUrl(repository.url)
        },
        workflow: {
          id: null,
          name: workflow_job.workflow_name,
          path: null
        },
        run: {
          id: workflow_job.run_id,
          number: workflow_job.run_number,
          created_at: workflow_job.created_at,
          updated_at: workflow_job.started_at || workflow_job.created_at,
          status: workflow_job.status,
          conclusion: workflow_job.conclusion,
          url: transformGitHubUrl(workflow_job.run_url),
          labels: workflow_job.labels || [],
          runner_id: workflow_job.runner_id,
          runner_name: workflow_job.runner_name,
          runner_group_id: workflow_job.runner_group_id,
          runner_group_name: workflow_job.runner_group_name
        }
      });
    }
  }

  // Update existing run with any new information from the job
  if (workflow_job.labels && workflow_job.labels.length > 0) {
    workflowRun.run.labels = workflow_job.labels;
    console.log('Updated labels for run:', workflow_job.labels);
  }
  // Note: If no labels in the job event, we preserve existing labels

  // Update or add the job information
  const jobIndex = workflowRun.jobs?.findIndex(job => job.id === workflow_job.id) ?? -1;
  const updatedJob = {
    id: workflow_job.id,
    name: workflow_job.name,
    status: workflow_job.status,
    conclusion: workflow_job.conclusion,
    started_at: workflow_job.started_at,
    completed_at: workflow_job.completed_at,
    steps: workflow_job.steps?.map(step => ({
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      number: step.number,
      started_at: step.started_at,
      completed_at: step.completed_at
    })) || []
  };

  if (jobIndex === -1) {
    if (!workflowRun.jobs) workflowRun.jobs = [];
    workflowRun.jobs.push(updatedJob);
  } else {
    workflowRun.jobs[jobIndex] = updatedJob;
  }

  // If any job is in_progress, update the overall run status
  if (updatedJob.status === 'in_progress') {
    workflowRun.run.status = 'in_progress';
  }

  // Update run number if it's not set and we have it from the job
  if (!workflowRun.run.number && workflow_job.run_number) {
    workflowRun.run.number = workflow_job.run_number;
  }

  // Update labels if they exist in the workflow_job
  if (workflow_job.labels) {
    workflowRun.run.labels = workflow_job.labels;
  }

  await workflowRun.save();
  console.log('Saved workflow run with labels:', workflowRun.run.labels);
  return workflowRun;
} catch (error) {
  console.error('Error processing workflow job:', error);
  throw error;
}
};

export const syncWorkflowRun = async (runId) => {
  try {
    // Find the workflow run in our database
    const workflowRun = await WorkflowRun.findOne({ 'run.id': runId });
    if (!workflowRun) {
      throw new Error('Workflow run not found');
    }

    // Get the necessary GitHub installation details
    const { Octokit } = await import('@octokit/rest');
    const { getGitHubClient } = await import('../utils/githubAuth.js');
    const [owner] = workflowRun.repository.fullName.split('/');

    // First get the app client to list installations
    const { app, installations } = await getGitHubClient();
    
    // Find the installation for this owner
    const installation = installations.find(i => i.account.login.toLowerCase() === owner.toLowerCase());
    if (!installation) {
      throw new Error(`No GitHub App installation found for ${owner}`);
    }

    // Now get a client for this specific installation
    const { app: octokitWithAuth } = await getGitHubClient(installation.id);

    // Extract repository name
    const repo = workflowRun.repository.name;

    // Fetch latest workflow run data from GitHub
    const { data: run } = await octokitWithAuth.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId
    });

    // Fetch jobs for the workflow run
    const jobs = [];
    let page = 1;
    while (true) {
      const { data: { jobs: jobsPage } } = await octokitWithAuth.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: runId,
        per_page: 100,
        page
      });

      if (jobsPage.length === 0) break;
      jobs.push(...jobsPage);
      page++;
    }

    // Update the workflow run in our database
    const payload = {
      workflow_run: run,
      repository: {
        id: workflowRun.repository.id,
        name: repo,
        full_name: `${owner}/${repo}`,
        owner: {
          login: owner
        }
      }
    };

    // Process the workflow run update
    const updatedRun = await processWorkflowRun(payload);

    // Update jobs if available
    if (jobs.length > 0) {
      await updateWorkflowJobs(runId, jobs);
    }

    return updatedRun;
  } catch (error) {
    console.error('Error syncing workflow run:', error);
    throw error;
  }
};

export const getActiveWorkflowMetrics = async () => {
  try {
    console.log('Starting to calculate active workflow metrics...');
    const metrics = {};
    
    // First, let's verify the data with a simple count
    const totalActive = await WorkflowRun.countDocuments({
      'run.status': { $in: ['in_progress', 'queued', 'waiting', 'pending'] },
      'run.conclusion': null
    });
    
    console.log('Total active workflows:', totalActive);
    
    // Get all workflows grouped by organization
    const workflowsByOrg = await WorkflowRun.aggregate([
      {
        $match: {
          'run.status': { $in: ['in_progress', 'queued', 'waiting', 'pending'] },
          'run.conclusion': null
        }
      },
      {
        $project: {
          orgName: { $arrayElemAt: [{ $split: ['$repository.fullName', '/'] }, 0] },
          status: '$run.status'
        }
      },
      {
        $group: {
          _id: '$orgName',
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          queued: {
            $sum: {
              $cond: [
                { $in: ['$status', ['queued', 'waiting', 'pending']] },
                1,
                0
              ]
            }
          },
          total: { $sum: 1 }
        }
      }
    ]);

    console.log('Raw aggregate results:', JSON.stringify(workflowsByOrg, null, 2));

    // Format the results
    workflowsByOrg.forEach(org => {
      if (!org._id) {
        console.log('Warning: Invalid organization data:', org);
        return;
      }
      
      metrics[org._id] = {
        inProgress: org.inProgress || 0,
        queued: org.queued || 0,
        total: org.total || 0
      };
    });

    console.log('Final metrics:', JSON.stringify(metrics, null, 2));
    return metrics;
  } catch (error) {
    console.error('Error getting active workflow metrics:', error);
    throw error;
  }
};