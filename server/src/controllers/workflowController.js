import mongoose from 'mongoose';
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
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 30;
    const searchQuery = req.query.search || '';
    const status = req.query.status || 'all';
    const skip = (page - 1) * pageSize;

    // Build the query with search and status filters
    let query = {};
    if (searchQuery) {
      query['repository.fullName'] = { $regex: searchQuery, $options: 'i' };
    }

    // Add status filter
    if (status !== 'all') {
      if (['in_progress', 'queued', 'waiting', 'pending'].includes(status)) {
        query['run.status'] = status;
      } else {
        // For conclusion statuses (success, failure, etc.)
        query['run.status'] = 'completed';
        query['run.conclusion'] = status;
      }
    }

    // First get distinct repositories with filters
    const distinctRepos = await WorkflowRun.distinct('repository.fullName', query);
    const totalCount = distinctRepos.length;

    // Get the paginated repositories
    const paginatedRepos = distinctRepos.slice(skip, skip + pageSize);

    // Then get workflow runs for these repositories
    const workflowRuns = await WorkflowRun.find({
      'repository.fullName': { $in: paginatedRepos },
      ...query
    }).sort({ 'run.created_at': -1 });

    return successResponse(res, {
      data: workflowRuns,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (error) {
    return errorResponse(res, 'Error retrieving workflow runs', 500, error);
  }
};

export const getRepoWorkflowRuns = async (req, res) => {
  try {
    const repoPath = req.params[0];
    if (!repoPath) {
      return errorResponse(res, 'Repository name is required', 400);
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 30;
    const workflowName = req.query.workflowName ? decodeURIComponent(req.query.workflowName) : null;
    const skip = (page - 1) * pageSize;

    // Build query with workflow name filter if provided
    const query = {
      'repository.fullName': repoPath
    };
    if (workflowName) {
      query['workflow.name'] = workflowName;
    }

    // Get total count for pagination with the workflow filter
    const totalCount = await WorkflowRun.countDocuments(query);

    const workflowRuns = await WorkflowRun.find(query)
      .sort({ 'run.created_at': -1 })
      .skip(skip)
      .limit(pageSize);

    return successResponse(res, {
      data: workflowRuns,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
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
    const db = mongoose.connection.db;
    const stats = await db.stats();
    const lastWorkflowRun = await WorkflowRun.findOne().sort({ 'run.updated_at': -1 });
    const totalWorkflows = await WorkflowRun.countDocuments();

    const status = {
      totalWorkflows,
      lastUpdated: {
        run: lastWorkflowRun
      },
      storageSize: stats.storageSize,
      dataSize: stats.dataSize,
      collections: stats.collections,
      indexes: stats.indexes,
      avgObjSize: stats.avgObjSize,
      ok: stats.ok
    };

    return successResponse(res, status);
  } catch (error) {
    return errorResponse(res, 'Error retrieving database status', 500, error);
  }
};

export const getWorkflowRunById = async (req, res) => {
  try {
    const { id } = req.params;
    const workflowRun = await WorkflowRun.findOne({ 'run.id': parseInt(id) });
    
    if (!workflowRun) {
      return errorResponse(res, 'Workflow run not found', 404);
    }

    return successResponse(res, workflowRun);
  } catch (error) {
    return errorResponse(res, 'Error retrieving workflow run', 500, error);
  }
};

export const syncWorkflowRun = async (req, res) => {
  try {
    const { id } = req.params;
    const workflowRun = await workflowService.syncWorkflowRun(parseInt(id));
    req.io.emit('workflowUpdate', workflowRun);
    return successResponse(res, workflowRun);
  } catch (error) {
    return errorResponse(res, 'Error syncing workflow run', 500, error);
  }
};

export const getActiveMetrics = async (req, res) => {
  try {
    console.log('Getting active workflow metrics...');
    const metrics = await workflowService.getActiveWorkflowMetrics();
    console.log('Metrics response:', metrics);
    return successResponse(res, metrics);
  } catch (error) {
    console.error('Error retrieving active workflow metrics:', error);
    return errorResponse(res, 'Error retrieving active workflow metrics', 500, error);
  }
};