import mongoose from 'mongoose';

const WorkflowRunSchema = new mongoose.Schema({
  repository: {
    id: Number,
    name: String,
    fullName: String,
    owner: {
      login: String,
      url: String
    },
    url: String
  },
  workflow: {
    id: Number,
    name: String,
    path: String
  },
  run: {
    id: Number,
    number: Number,
    created_at: Date,
    updated_at: Date,
    status: {
      type: String,
      enum: ['completed', 'action_required', 'cancelled', 'failure', 'neutral', 
             'skipped', 'stale', 'success', 'timed_out', 'in_progress', 'queued', 
             'requested', 'waiting', 'pending'],
      default: 'pending'
    },
    conclusion: {
      type: String,
      enum: ['success', 'failure', 'cancelled', 'skipped', 'timed_out', 
             'action_required', 'neutral', 'stale', null],
      default: null
    },
    url: String
  },
  jobs: [{
    id: Number,
    name: String,
    status: String,
    conclusion: String,
    started_at: Date,
    completed_at: Date,
    steps: [{
      name: String,
      status: String,
      conclusion: String,
      number: Number,
      started_at: Date,
      completed_at: Date
    }]
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('WorkflowRun', WorkflowRunSchema);