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
             'requested', 'waiting', 'pending', 'unknown'],
      default: 'pending'
    },
    conclusion: {
      type: String,
      enum: ['success', 'failure', 'cancelled', 'skipped', 'timed_out', 
             'action_required', 'neutral', 'stale', 'startup_failure', null],
      default: null
    },
    url: String,
    head_branch: String,
    event: String,
    labels: [String],
    runner_id: Number,
    runner_name: String,
    runner_group_id: Number,
    runner_group_name: String
  },
  jobs: [{
    id: Number,
    name: String,
    status: {
      type: String,
      enum: ['completed', 'in_progress', 'queued', 'waiting', 'pending', 'unknown'],
      default: 'pending'
    },
    conclusion: {
      type: String,
      enum: ['success', 'failure', 'cancelled', 'skipped', 'timed_out', 
             'action_required', 'neutral', 'stale', 'startup_failure', null],
      default: null
    },
    started_at: Date,
    completed_at: Date,
    runner_id: Number,
    runner_name: String,
    runner_group_id: Number,
    runner_group_name: String,
    runner_os: String,
    runner_version: String,
    runner_image_version: String,
    steps: [{
      name: String,
      status: {
        type: String,
        enum: ['completed', 'in_progress', 'queued', 'pending', 'unknown'],
        default: 'pending'
      },
      conclusion: {
        type: String,
        enum: ['success', 'failure', 'cancelled', 'skipped', 'timed_out', null],
        default: null
      },
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