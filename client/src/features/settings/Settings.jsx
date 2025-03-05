import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  LinearProgress,
  Chip,
  Card,
  CardContent,
  FormHelperText
} from '@mui/material';
import { Sync as SyncIcon } from '@mui/icons-material';
import apiService from '../../api/apiService';
import { socket } from '../../api/socketService';
import { formatDistanceToNow } from 'date-fns';

const Settings = () => {
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [selectedInstallation, setSelectedInstallation] = useState('');
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [maxWorkflowRuns, setMaxWorkflowRuns] = useState(100);
  const [rateLimits, setRateLimits] = useState(null);

  useEffect(() => {
    fetchOrganizations();
    fetchSyncHistory();
    
    // Set up socket listeners
    socket.on('syncProgress', (data) => {
      setProgress(data.progress);
      if (data.rateLimits) {
        setRateLimits(data.rateLimits);
      }
      if (data.currentRepo && data.currentWorkflow) {
        setCurrentOperation({
          repo: data.currentRepo,
          workflow: data.currentWorkflow
        });
      }
    });

    socket.on('rateLimitUpdate', (data) => {
      setRateLimits(data);
    });

    socket.on('syncStatus', (data) => {
      if (data.status === 'paused') {
        setError(data.message);
      } else if (data.status === 'resumed') {
        setError(null);
      }
    });

    return () => {
      socket.off('syncProgress');
      socket.off('rateLimitUpdate');
      socket.off('syncStatus');
    };
  }, []);

  const fetchSyncHistory = async () => {
    try {
      const response = await apiService.getSyncHistory();
      setSyncHistory(response.data);
    } catch (err) {
      console.error('Failed to fetch sync history:', err);
    }
  };

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await apiService.getOrganizations();
      setOrganizations(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch organizations. Please check your GitHub App configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedInstallation) {
      setError('Please select an organization to sync');
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      setResults(null);
      setProgress(0);
      setCurrentOperation(null);
      
      const response = await apiService.syncGitHubData(selectedInstallation, { maxWorkflowRuns });
      setResults(response.results);
      await fetchSyncHistory(); // Refresh history after sync
    } catch (err) {
      setError(err.message || 'Failed to sync GitHub data');
    } finally {
      setSyncing(false);
      setProgress(0);
      setCurrentOperation(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          GitHub Synchronization
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Sync your GitHub Actions workflow history with RunWatch. This will fetch historical data for all workflows in your organization's repositories.
        </Typography>

        {rateLimits && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(0, 0, 0, 0.1)', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              GitHub API Rate Limits
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2">
                Remaining: {rateLimits.remaining}/{rateLimits.limit}
              </Typography>
              <Typography variant="body2">
                Resets: {new Date(rateLimits.resetTime).toLocaleTimeString()}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={(rateLimits.remaining / rateLimits.limit) * 100}
                sx={{ 
                  width: 100,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: rateLimits.remaining < 1000 ? '#ff9800' : '#4caf50',
                    borderRadius: 4
                  }
                }}
              />
            </Box>
          </Box>
        )}

        <Stack spacing={3}>
          <FormControl fullWidth>
            <InputLabel id="org-select-label">Organization</InputLabel>
            <Select
              labelId="org-select-label"
              value={selectedInstallation}
              label="Organization"
              onChange={(e) => setSelectedInstallation(e.target.value)}
              disabled={syncing}
            >
              {organizations.map((org) => (
                <MenuItem key={org.id} value={org.id}>
                  {org.account.login} ({org.account.type})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="run-limit-label">Workflow Runs Limit</InputLabel>
            <Select
              labelId="run-limit-label"
              value={maxWorkflowRuns}
              label="Workflow Runs Limit"
              onChange={(e) => setMaxWorkflowRuns(e.target.value)}
              disabled={syncing}
            >
              <MenuItem value={10}>Last 10 runs</MenuItem>
              <MenuItem value={50}>Last 50 runs</MenuItem>
              <MenuItem value={100}>Last 100 runs</MenuItem>
              <MenuItem value={500}>Last 500 runs</MenuItem>
              <MenuItem value={1000}>Last 1000 runs</MenuItem>
            </Select>
            <FormHelperText>
              Limit the number of workflow runs to import per workflow
            </FormHelperText>
          </FormControl>

          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
            onClick={handleSync}
            disabled={syncing || !selectedInstallation}
          >
            {syncing ? 'Syncing...' : 'Sync GitHub Data'}
          </Button>
        </Stack>

        {syncing && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                {progress}% Complete
              </Typography>
              {currentOperation && (
                <Typography variant="body2" color="text.secondary">
                  Processing: {currentOperation.repo} - {currentOperation.workflow}
                </Typography>
              )}
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(88, 166, 255, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: '#58A6FF',
                  borderRadius: 4
                }
              }}
            />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        {results && (
          <Box sx={{ mt: 3 }}>
            <Alert severity="success" sx={{ mb: 2 }}>
              Synchronization completed successfully!
            </Alert>
            
            <List>
              <ListItem>
                <ListItemText 
                  primary="Organization"
                  secondary={results.organization}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary="Repositories Processed"
                  secondary={results.repositories}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary="Workflows Found"
                  secondary={results.workflows}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary="Workflow Runs Synced"
                  secondary={results.runs}
                />
              </ListItem>
            </List>

            {results.errors && results.errors.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Some items failed to sync:
                </Typography>
                <List dense>
                  {results.errors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={`${error.type}: ${error.name || error.id}`}
                        secondary={error.error}
                      />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Sync History */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Sync History
        </Typography>
        <List>
          {syncHistory.map((sync) => (
            <Card key={sync._id} sx={{ mb: 2, bgcolor: 'rgba(13, 17, 23, 0.3)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1">
                    {sync.organization.name}
                  </Typography>
                  <Chip
                    label={sync.status}
                    color={
                      sync.status === 'completed' ? 'success' :
                      sync.status === 'failed' ? 'error' :
                      'warning'
                    }
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {formatDistanceToNow(new Date(sync.startedAt))} ago
                </Typography>
                {sync.status === 'completed' && sync.results && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      Processed: {sync.results.repositories} repositories, {sync.results.workflows} workflows, {sync.results.runs} runs
                    </Typography>
                    {sync.results.errors?.length > 0 && (
                      <Typography variant="body2" color="error">
                        Errors: {sync.results.errors.length}
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
          {syncHistory.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No sync history available
            </Typography>
          )}
        </List>
      </Paper>
    </Box>
  );
};

export default Settings;