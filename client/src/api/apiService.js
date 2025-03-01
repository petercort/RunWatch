import axios from 'axios';
import io from 'socket.io-client';

// Use the environment variables, falling back to development defaults if not set
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost/api';
const WS_URL = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost';

console.log('Using API URL:', API_URL);
console.log('Using WebSocket URL:', WS_URL);

// Create socket connection with environment-aware configuration
export const socket = io(WS_URL, {
  transports: ['websocket'],
  path: '/socket.io'
});

// API Services
const apiService = {
  // Get all workflow runs
  getWorkflowRuns: async () => {
    try {
      console.log('Fetching workflow runs from:', `${API_URL}/workflow-runs`);
      const response = await axios.get(`${API_URL}/workflow-runs`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching workflow runs:', error);
      throw error;
    }
  },

  // Get workflow runs for a specific repository
  getRepoWorkflowRuns: async (repoName) => {
    try {
      const response = await axios.get(`${API_URL}/workflow-runs/repo/${repoName}`);
      return response.data.data || [];
    } catch (error) {
      console.error(`Error fetching workflow runs for repo ${repoName}:`, error);
      throw error;
    }
  },

  // Get workflow statistics
  getWorkflowStats: async () => {
    try {
      const response = await axios.get(`${API_URL}/stats`);
      return response.data.data || {};
    } catch (error) {
      console.error('Error fetching workflow stats:', error);
      throw error;
    }
  },

  // Get available organizations
  getOrganizations: async () => {
    try {
      const response = await axios.get(`${API_URL}/organizations`);
      return response.data;
    } catch (error) {
      console.error('Error fetching organizations:', error);
      throw error;
    }
  },

  // Sync GitHub data using installation ID
  syncGitHubData: async (installationId) => {
    try {
      const response = await fetch(`${API_URL}/sync/${encodeURIComponent(String(installationId))}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync GitHub data');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error syncing GitHub data:', error);
      throw error;
    }
  },

  // Get sync history
  getSyncHistory: async () => {
    try {
      const response = await axios.get(`${API_URL}/sync/history`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sync history:', error);
      throw error;
    }
  }
};

export default apiService;