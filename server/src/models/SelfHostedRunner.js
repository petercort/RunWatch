// filepath: /Users/petercort/Documents/Code/RunWatch/server/src/models/SelfHostedRunner.js
import mongoose from 'mongoose';

// Re-use the label schema from the original Runner model
const labelSchema = new mongoose.Schema({
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
    default: 'read-only'
  }
});

const selfHostedRunnerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  os: String,
  status: {
    type: String,
    enum: ['online', 'offline', 'busy'],
    default: 'offline'
  },
  busy: {
    type: Boolean,
    default: false
  },
  ephemeral: {
    type: Boolean,
    default: false
  },
  labels: [labelSchema],
  // Runner association fields
  runner_group_id: String,
  level: {
    type: String,
    enum: ['enterprise', 'organization', 'repository'],
    required: true
  },
  enterprise: String,
  organization: String,
  repository: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create a compound index for looking up runners efficiently
selfHostedRunnerSchema.index({ 
  level: 1, 
  enterprise: 1, 
  organization: 1, 
  repository: 1 
});

export default mongoose.model('SelfHostedRunner', selfHostedRunnerSchema);