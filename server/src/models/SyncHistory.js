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
        enum: ['in_progress', 'completed', 'failed'],
        default: 'in_progress'
    },
    results: {
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
        }
    }
});

export default mongoose.model('SyncHistory', syncHistorySchema);