import mongoose from 'mongoose';

// Schema for public IPs
const publicIpSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true
  },
  prefix: String,
  length: Number
});

// Schema for image details
const imageSchema = new mongoose.Schema({
  id: String,
  size: Number
});

// Schema for machine size details
const machineSizeSchema = new mongoose.Schema({
  id: String,
  cpu_cores: Number,
  memory_gb: Number,
  storage_gb: Number
});

const gitHubHostedRunnerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  runner_group_id: String,
  platform: String,
  image: imageSchema,
  machine_size_details: machineSizeSchema,
  status: {
    type: String,
    enum: ['Ready', 'Offline', 'Busy'],
    default: 'Offline'
  },
  maximum_runners: Number,
  public_ip_enabled: Boolean,
  public_ips: [publicIpSchema],
  last_active_on: Date,
  // Runner association fields
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
gitHubHostedRunnerSchema.index({ 
  level: 1, 
  enterprise: 1, 
  organization: 1, 
  repository: 1 
});

export default mongoose.model('GitHubHostedRunner', gitHubHostedRunnerSchema);