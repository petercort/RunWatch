import { socket } from './apiService';

// Debounce function to prevent rapid successive updates
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Keep track of last update timestamps to prevent out-of-order updates
const lastUpdateTimes = new Map();

export const setupSocketListeners = (callbacks) => {
  console.log('Setting up socket listeners');
  
  const handleUpdate = (eventName, data, callback) => {
    const lastUpdate = lastUpdateTimes.get(data.run.id) || 0;
    const currentUpdate = new Date(data.run.updated_at).getTime();
    
    // Only process if this update is newer than the last one
    if (currentUpdate > lastUpdate) {
      lastUpdateTimes.set(data.run.id, currentUpdate);
      callback(data);
    } else {
      console.log(`Skipping outdated ${eventName} update for workflow ${data.run.id}`);
    }
  };

  // Debounced callback handlers
  const debouncedWorkflowUpdate = debounce((data) => {
    if (callbacks.onWorkflowUpdate) {
      handleUpdate('workflow', data, callbacks.onWorkflowUpdate);
    }
  }, 250);

  const debouncedJobsUpdate = debounce((data) => {
    if (callbacks.onJobsUpdate) {
      handleUpdate('jobs', data, callbacks.onJobsUpdate);
    }
  }, 250);

  // Socket event listeners
  socket.on('workflowUpdate', (data) => {
    console.log('Received workflow update:', data);
    if (callbacks.onNewWorkflow) {
      callbacks.onNewWorkflow(data);
    }
    debouncedWorkflowUpdate(data);
  });

  socket.on('workflow_update', (data) => {
    console.log('Received workflow_update event:', data);
    debouncedWorkflowUpdate(data);
  });

  socket.on('workflowJobsUpdate', (data) => {
    console.log('Received workflowJobsUpdate event:', data);
    debouncedJobsUpdate(data);
  });

  // Cleanup function
  return () => {
    socket.off('workflowUpdate');
    socket.off('workflow_update');
    socket.off('workflowJobsUpdate');
    lastUpdateTimes.clear();
  };
};