import mongoose from 'mongoose';

const syncHistorySchema = new mongoose.Schema({
    organization: {
        id: {
            type: Number,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true
        }
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    status: {
        type: String,
        enum: ['in_progress', 'paused', 'completed', 'failed', 'interrupted'],
        default: 'in_progress'
    },
    config: {
        maxWorkflowRuns: {
            type: Number,
            required: true
        }
    },
    results: {
        totalRepositories: Number,
        repositories: Number,
        workflows: Number,
        runs: Number,
        errors: {
            type: [{
                type: {
                    type: String,
                    required: true
                },
                name: String,
                id: String,
                workflow: String,
                error: String
            }],
            default: []
        },
        rateLimits: {
            remaining: Number,
            limit: Number,
            resetTime: String
        },
        rateLimitPause: {
            pausedAt: Date,
            resumeAt: Date
        },
        progress: {
            current: Number,
            total: Number,
            currentRepo: String,
            currentWorkflow: String,
            repoIndex: Number,
            totalRepos: Number,
            workflowIndex: Number,
            totalWorkflows: Number,
            processedRepos: Number,
            processedWorkflows: Number,
            processedRuns: Number
        }
    }
});

export default mongoose.model('SyncHistory', syncHistorySchema);