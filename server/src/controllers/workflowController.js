import WorkflowRun from '../models/WorkflowRun.js';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import * as workflowService from '../services/workflowService.js';

export const handleWorkflowRun = async (req, res) => {
  try {
    const workflowRun = await workflowService.processWorkflowRun(req.body);
    req.io.emit('workflowUpdate', workflowRun);
    return successResponse(res, workflowRun, 'Workflow run processed successfully');
  } catch (error) {
    return errorResponse(res, 'Error processing workflow run', 500, error);
  }
};

export const getAllWorkflowRuns = async (req, res) => {
  try {
    const workflowRuns = await WorkflowRun.find().sort({ 'run.created_at': -1 });
    return successResponse(res, workflowRuns);
  } catch (error) {
    return errorResponse(res, 'Error retrieving workflow runs', 500, error);
  }
};

export const getRepoWorkflowRuns = async (req, res) => {
  try {
    const { repoName } = req.params;
    const workflowRuns = await WorkflowRun.find({
      'repository.name': repoName
    }).sort({ 'run.created_at': -1 });
    return successResponse(res, workflowRuns);
  } catch (error) {
    return errorResponse(res, 'Error retrieving repository workflow runs', 500, error);
  }
};

export const getWorkflowStats = async (req, res) => {
  try {
    const stats = await workflowService.calculateWorkflowStats();
    return successResponse(res, stats);
  } catch (error) {
    return errorResponse(res, 'Error retrieving workflow statistics', 500, error);
  }
};

export const updateWorkflowJobs = async (req, res) => {
  try {
    const { runId } = req.params;
    const { jobs } = req.body;
    const updatedRun = await workflowService.updateWorkflowJobs(runId, jobs);
    req.io.emit('workflowJobsUpdate', updatedRun);
    return successResponse(res, updatedRun, 'Workflow jobs updated successfully');
  } catch (error) {
    return errorResponse(res, 'Error updating workflow jobs', 500, error);
  }
};

export const getDatabaseStatus = async (req, res) => {
  try {
    const stats = {
      totalWorkflows: await WorkflowRun.countDocuments(),
      lastUpdated: await WorkflowRun.findOne().sort({ 'run.updated_at': -1 }).select('run.updated_at'),
      storageSize: await WorkflowRun.collection.stats().then(stats => stats.size),
    };
    return successResponse(res, stats);
  } catch (error) {
    return errorResponse(res, 'Error getting database status', 500, error);
  }
};