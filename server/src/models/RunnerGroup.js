import mongoose from 'mongoose';

const runnerGroupSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  visibility: {
    type: String,
    enum: ['selected', 'all', 'private', 'org'],
    default: 'org'
  },
  default: {
    type: Boolean,
    default: false
  },
  runners_count: {
    type: Number,
    default: 0
  },
  inherited: {
    type: Boolean,
    default: false
  },
  allows_public_repositories: {
    type: Boolean,
    default: true
  },
  restricted_to_workflows: {
    type: Boolean,
    default: false
  },
  selected_workflows: [String],
  level: {
    type: String,
    enum: ['enterprise', 'organization', 'repository'],
    required: true
  },
  enterprise: String,
  organization: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create a compound index for looking up runner groups efficiently
runnerGroupSchema.index({ 
  level: 1, 
  enterprise: 1, 
  organization: 1 
});

export default mongoose.model('RunnerGroup', runnerGroupSchema);