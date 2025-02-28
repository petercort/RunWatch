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
    let workflowRun = await WorkflowRun.findOne({ 'run.id': run.id });
    
    if (!workflowRun) {
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
          conclusion: run.conclusion,
          url: transformGitHubUrl(run.html_url)
        }
      });
    } else {
      workflowRun.run.status = run.status;
      workflowRun.run.conclusion = run.conclusion;
      workflowRun.run.updated_at = run.updated_at;
      workflowRun.run.url = transformGitHubUrl(run.html_url);
    }

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
    let workflowRun = await WorkflowRun.findOne({ 'run.id': workflow_job.run_id });
    
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
          number: null,
          created_at: workflow_job.created_at,
          updated_at: workflow_job.started_at || workflow_job.created_at,
          status: workflow_job.status,
          conclusion: workflow_job.conclusion,
          url: transformGitHubUrl(workflow_job.run_url)
        }
      });
    }

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

    await workflowRun.save();
    return workflowRun;
  } catch (error) {
    console.error('Error processing workflow job:', error);
    throw error;
  }
};