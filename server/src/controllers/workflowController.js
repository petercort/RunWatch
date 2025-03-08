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
    const skip = (page - 1) * pageSize;

    // Get distinct repositories with search filter if provided
    let repoQuery = {};
    if (searchQuery) {
      repoQuery['repository.fullName'] = { $regex: searchQuery, $options: 'i' };
    }

    // First get distinct repositories filtered by search
    const distinctRepos = await WorkflowRun.distinct('repository.fullName', repoQuery);
    const totalCount = distinctRepos.length;

    // Get the paginated repositories
    const paginatedRepos = distinctRepos.slice(skip, skip + pageSize);

    // Then get workflow runs for these repositories
    const workflowRuns = await WorkflowRun.find({
      'repository.fullName': { $in: paginatedRepos }
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
    // Extract the full repository path from the URL
    const repoPath = req.params[0]; // This gets everything after /workflow-runs/repo/
    if (!repoPath) {
      return errorResponse(res, 'Repository name is required', 400);
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 30;
    const skip = (page - 1) * pageSize;

    // Get total count for pagination
    const totalCount = await WorkflowRun.countDocuments({
      'repository.fullName': repoPath
    });

    const workflowRuns = await WorkflowRun.find({
      'repository.fullName': repoPath
    })
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