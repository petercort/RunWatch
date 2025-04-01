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
  ListItemButton,
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
  FormHelperText,
  Grid,
  Slider,
  TextField,
  Switch,
  FormControlLabel
} from '@mui/material';
import { Sync as SyncIcon, ExpandMore as ExpandMoreIcon, Save as SaveIcon, Restore as RestoreIcon, Notifications as NotificationsIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import apiService from '../../api/apiService';
import { socket, defaultAlertConfig } from '../../api/socketService';
import { formatDistanceToNow } from 'date-fns';
import SyncHistoryDetails from './SyncHistoryDetails';

// Define default dashboard settings
const defaultDashboardSettings = {
  refreshEnabled: true,
  refreshInterval: 30 // seconds
};

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
  const [syncDetails, setSyncDetails] = useState(null);
  const [activeSync, setActiveSync] = useState(null);
  const [selectedSync, setSelectedSync] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [restoreMessage, setRestoreMessage] = useState(null);
  const [restoreMessageType, setRestoreMessageType] = useState('success');
  const [alertConfig, setAlertConfig] = useState(() => {
    const savedConfig = localStorage.getItem('alertConfig');
    return savedConfig ? JSON.parse(savedConfig) : defaultAlertConfig;
  });
  const [alertConfigSaved, setAlertConfigSaved] = useState(false);
  
  // Dashboard refresh settings
  const [dashboardSettings, setDashboardSettings] = useState(() => {
    const savedSettings = localStorage.getItem('dashboardSettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultDashboardSettings;
  });
  const [dashboardSettingsSaved, setDashboardSettingsSaved] = useState(false);

  const fetchActiveSync = async () => {
    try {
      const response = await apiService.getActiveSync();
      if (response.data) {
        const sync = response.data;
        setActiveSync(sync);
        setSyncing(sync.status === 'in_progress' || sync.status === 'paused');
        if (sync.results?.progress) {
          setProgress(sync.results.progress.current);
          if (sync.results.progress.currentRepo) {
            setCurrentOperation({
              repo: sync.results.progress.currentRepo,
              workflow: sync.results.progress.currentWorkflow
            });
          }
          setSyncDetails({
            currentRepoIndex: sync.results.progress.repoIndex + 1,
            totalRepos: sync.results.progress.totalRepos,
            currentWorkflowIndex: sync.results.progress.workflowIndex !== null ? 
              sync.results.progress.workflowIndex + 1 : undefined,
            totalWorkflows: sync.results.progress.totalWorkflows
          });
        }
        if (sync.results?.rateLimits) {
          setRateLimits(sync.results.rateLimits);
        }
        if (sync.status === 'paused') {
          setError(`Sync paused: Rate limit reached. Will resume at ${new Date(sync.results.rateLimitPause.resumeAt).toLocaleString()}`);
        }
      }
    } catch (err) {
      console.error('Failed to fetch active sync:', err);
    }
  };

  useEffect(() => {
    fetchOrganizations();
    fetchSyncHistory();
    fetchActiveSync();
    fetchDatabaseStatus();
    
    // Set up socket listeners
    socket.on('connect', () => {
      console.log('Socket connected, fetching active sync...');
      fetchActiveSync();
    });

    socket.on('syncProgress', (data) => {
      setSyncing(true);
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
      if (data.details) {
        setSyncDetails(data.details);
      }
      if (data.completed) {
        setSyncing(false);
        setActiveSync(null);
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
      socket.off('connect');
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

  const fetchDatabaseStatus = async () => {
    try {
      const status = await apiService.getDatabaseStatus();
      setDbStatus(status);
    } catch (err) {
      console.error('Failed to fetch database status:', err);
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

  const handleSyncClick = (sync) => {
    setSelectedSync(sync);
  };

  const handleCreateBackup = async () => {
    try {
      const response = await apiService.createDatabaseBackup();
      const backupData = JSON.stringify(response.data);
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `runwatch-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setRestoreMessage('Database backup created successfully');
      setRestoreMessageType('success');
    } catch (err) {
      setRestoreMessage('Failed to create database backup: ' + err.message);
      setRestoreMessageType('error');
      console.error(err);
    }
  };

  const handleRestoreBackup = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      setRestoreMessage('Restoring database...');
      setRestoreMessageType('info');

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          const response = await apiService.restoreDatabaseBackup(backupData);
          
          // Refresh database status after restore
          await fetchDatabaseStatus();
          
          setRestoreMessage(
            `Database restored successfully:\n` +
            `• ${response.data.stats.collectionsProcessed} collections processed\n` +
            `• ${response.data.stats.documentsRestored.toLocaleString()} documents restored\n` +
            (response.data.stats.errors.length > 0 ? 
              `• ${response.data.stats.errors.length} errors occurred during restore` : '')
          );
          setRestoreMessageType(response.data.stats.errors.length > 0 ? 'warning' : 'success');
          setError(null);
        } catch (err) {
          setRestoreMessage('Failed to restore database: ' + err.message);
          setRestoreMessageType('error');
          console.error(err);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setRestoreMessage('Failed to read backup file');
      setRestoreMessageType('error');
      console.error(err);
    }
  };

  // Function to handle alert threshold changes
  const handleQueuedTimeThresholdChange = (event, newValue) => {
    setAlertConfig(prev => ({
      ...prev,
      queuedTimeAlertThreshold: newValue
    }));
    setAlertConfigSaved(false);
  };

  // Function to save alert configuration
  const saveAlertConfig = () => {
    localStorage.setItem('alertConfig', JSON.stringify(alertConfig));
    setAlertConfigSaved(true);
    
    // Show saved message briefly
    setTimeout(() => {
      setAlertConfigSaved(false);
    }, 3000);
  };

  // Function to handle dashboard refresh settings
  const handleDashboardRefreshChange = (event) => {
    const { checked } = event.target;
    setDashboardSettings(prev => ({
      ...prev,
      refreshEnabled: checked
    }));
    setDashboardSettingsSaved(false);
  };

  // Function to handle dashboard refresh interval changes
  const handleDashboardRefreshIntervalChange = (event, newValue) => {
    setDashboardSettings(prev => ({
      ...prev,
      refreshInterval: newValue
    }));
    setDashboardSettingsSaved(false);
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
      {/* Notifications Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <NotificationsIcon color="primary" fontSize="small" />
          Notification Settings
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <Typography id="queued-time-threshold-slider" gutterBottom variant="subtitle2">
            Queue Time Alert Threshold (minutes)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Slider
              value={alertConfig.queuedTimeAlertThreshold}
              onChange={handleQueuedTimeThresholdChange}
              aria-labelledby="queued-time-threshold-slider"
              valueLabelDisplay="auto"
              step={1}
              marks={[
                { value: 1, label: '1m' },
                { value: 5, label: '5m' },
                { value: 10, label: '10m' },
                { value: 15, label: '15m' },
                { value: 30, label: '30m' }
              ]}
              min={1}
              max={30}
              sx={{
                width: '70%',
                '& .MuiSlider-thumb': {
                  height: 16,
                  width: 16,
                  bgcolor: '#58A6FF',
                },
                '& .MuiSlider-track': {
                  bgcolor: '#58A6FF',
                },
                '& .MuiSlider-rail': {
                  bgcolor: 'rgba(88, 166, 255, 0.2)',
                }
              }}
            />
            <TextField
              value={alertConfig.queuedTimeAlertThreshold}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value > 0 && value <= 60) {
                  handleQueuedTimeThresholdChange(null, value);
                }
              }}
              type="number"
              InputProps={{
                inputProps: { 
                  min: 1, 
                  max: 60,
                  style: { textAlign: 'center' }
                }
              }}
              size="small"
              sx={{ width: '80px' }}
            />
          </Box>
          <FormHelperText>
            Display when a workflow has been queued longer than this threshold
          </FormHelperText>
          
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              variant="contained" 
              size="small"
              startIcon={<SaveIcon />}
              onClick={saveAlertConfig}
              sx={{
                bgcolor: alertConfigSaved ? 'rgba(35, 197, 98, 0.1)' : 'rgba(88, 166, 255, 0.1)',
                color: alertConfigSaved ? '#23C562' : '#58A6FF',
                '&:hover': {
                  bgcolor: alertConfigSaved ? 'rgba(35, 197, 98, 0.2)' : 'rgba(88, 166, 255, 0.2)',
                }
              }}
            >
              {alertConfigSaved ? 'Saved' : 'Save Settings'}
            </Button>
          </Box>
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <RefreshIcon color="primary" fontSize="small" />
          Dashboard Refresh Settings
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={dashboardSettings.refreshEnabled}
                onChange={handleDashboardRefreshChange}
                color="primary"
              />
            }
            label="Enable automatic dashboard refresh"
          />
          
          <Box sx={{ mt: 2 }}>
            <Typography id="refresh-interval-slider" gutterBottom variant="subtitle2">
              Refresh Interval (seconds)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Slider
                value={dashboardSettings.refreshInterval}
                onChange={handleDashboardRefreshIntervalChange}
                aria-labelledby="refresh-interval-slider"
                valueLabelDisplay="auto"
                step={10}
                marks={[
                  { value: 10, label: '10s' },
                  { value: 30, label: '30s' },
                  { value: 60, label: '1m' },
                  { value: 120, label: '2m' },
                  { value: 300, label: '5m' }
                ]}
                min={10}
                max={300}
                disabled={!dashboardSettings.refreshEnabled}
                sx={{
                  width: '70%',
                  opacity: dashboardSettings.refreshEnabled ? 1 : 0.5,
                  '& .MuiSlider-thumb': {
                    height: 16,
                    width: 16,
                    bgcolor: '#58A6FF',
                  },
                  '& .MuiSlider-track': {
                    bgcolor: '#58A6FF',
                  },
                  '& .MuiSlider-rail': {
                    bgcolor: 'rgba(88, 166, 255, 0.2)',
                  }
                }}
              />
              <TextField
                value={dashboardSettings.refreshInterval}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 10 && value <= 600) {
                    handleDashboardRefreshIntervalChange(null, value);
                  }
                }}
                type="number"
                InputProps={{
                  inputProps: { 
                    min: 10, 
                    max: 600,
                    style: { textAlign: 'center' }
                  }
                }}
                size="small"
                sx={{ width: '80px' }}
                disabled={!dashboardSettings.refreshEnabled}
              />
            </Box>
            <FormHelperText>
              How frequently the dashboard will automatically refresh data (10 seconds to 10 minutes)
            </FormHelperText>
          </Box>
          
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              variant="contained" 
              size="small"
              startIcon={<SaveIcon />}
              onClick={() => {
                localStorage.setItem('dashboardSettings', JSON.stringify(dashboardSettings));
                setDashboardSettingsSaved(true);
                setTimeout(() => setDashboardSettingsSaved(false), 3000);
              }}
              sx={{
                bgcolor: dashboardSettingsSaved ? 'rgba(35, 197, 98, 0.1)' : 'rgba(88, 166, 255, 0.1)',
                color: dashboardSettingsSaved ? '#23C562' : '#58A6FF',
                '&:hover': {
                  bgcolor: dashboardSettingsSaved ? 'rgba(35, 197, 98, 0.2)' : 'rgba(88, 166, 255, 0.2)',
                }
              }}
              disabled={!dashboardSettings.refreshEnabled && dashboardSettings.refreshInterval === defaultDashboardSettings.refreshInterval}
            >
              {dashboardSettingsSaved ? 'Saved' : 'Save Settings'}
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Database Health
        </Typography>
        {dbStatus ? (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      Status
                    </Typography>
                    <Chip 
                      label={dbStatus.ok ? "Healthy" : "Unhealthy"}
                      color={dbStatus.ok ? "success" : "error"}
                      size="small"
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      Total Workflows
                    </Typography>
                    <Typography variant="h6">
                      {dbStatus.totalWorkflows?.toLocaleString() || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      Storage Size
                    </Typography>
                    <Typography variant="h6">
                      {`${(dbStatus.storageSize / (1024 * 1024)).toFixed(1)} MB`}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      Data Size
                    </Typography>
                    <Typography variant="h6">
                      {`${(dbStatus.dataSize / (1024 * 1024)).toFixed(1)} MB`}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      Collections
                    </Typography>
                    <Typography variant="h6">
                      {dbStatus.collections || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      Indexes
                    </Typography>
                    <Typography variant="h6">
                      {dbStatus.indexes || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      Avg Object Size
                    </Typography>
                    <Typography variant="h6">
                      {`${(dbStatus.avgObjSize / 1024).toFixed(1)} KB`}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      Last Update
                    </Typography>
                    <Typography variant="body2">
                      {dbStatus.lastUpdated?.run?.run?.updated_at ? 
                        formatDistanceToNow(new Date(dbStatus.lastUpdated.run.run.updated_at), { addSuffix: true }) : 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {restoreMessage && (
              <Alert 
                severity={restoreMessageType} 
                sx={{ 
                  mt: 2,
                  whiteSpace: 'pre-line'  // Allow newlines in the message
                }}
                onClose={() => setRestoreMessage(null)}
              >
                {restoreMessage}
              </Alert>
            )}

            <Box sx={{ mt: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={handleCreateBackup}
                startIcon={<SaveIcon />}
                sx={{
                  bgcolor: 'rgba(88, 166, 255, 0.1)',
                  color: '#58A6FF',
                  '&:hover': {
                    bgcolor: 'rgba(88, 166, 255, 0.2)',
                  }
                }}
              >
                Create Backup
              </Button>

              <Button
                component="label"
                variant="contained"
                startIcon={<RestoreIcon />}
                sx={{
                  bgcolor: 'rgba(88, 166, 255, 0.1)',
                  color: '#58A6FF',
                  '&:hover': {
                    bgcolor: 'rgba(88, 166, 255, 0.2)',
                  }
                }}
              >
                Restore Backup
                <input
                  type="file"
                  hidden
                  accept=".json"
                  onChange={handleRestoreBackup}
                />
              </Button>
            </Box>
          </>
        ) : (
          <Typography color="text.secondary">
            Loading database status...
          </Typography>
        )}
      </Paper>

      {rateLimits && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            GitHub API Rate Limits
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="body1">
              Remaining: {rateLimits.remaining}/{rateLimits.limit}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Resets at: {new Date(rateLimits.resetTime).toLocaleTimeString()}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={(rateLimits.remaining / rateLimits.limit) * 100}
              sx={{ 
                width: 100,
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(0, 0, 0, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: rateLimits.remaining < 1000 ? '#ff9800' : '#4caf50',
                  borderRadius: 4
                }
              }}
            />
          </Box>
        </Paper>
      )}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          GitHub Synchronization
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Sync your GitHub Actions workflow history with RunWatch. This will fetch historical data for all workflows in your organization's repositories.
        </Typography>

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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {progress}% Complete
              </Typography>
              {syncDetails && (
                <Typography variant="body2" color="text.secondary">
                  Repository {syncDetails.currentRepoIndex}/{syncDetails.totalRepos}
                  {syncDetails.currentWorkflowIndex !== undefined && ` • Workflow ${syncDetails.currentWorkflowIndex}/${syncDetails.totalWorkflows}`}
                </Typography>
              )}
              {currentOperation && (
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                  Current: {currentOperation.repo} - {currentOperation.workflow}
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
                  borderRadius: 4,
                  transition: 'transform 0.3s ease'
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
          {syncHistory.map((sync, index) => (
            <React.Fragment key={sync._id}>
              {index > 0 && <Divider />}
              <ListItemButton onClick={() => handleSyncClick(sync)}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>{sync.organization.name}</Typography>
                      <Chip 
                        label={sync.status} 
                        size="small"
                        color={
                          sync.status === 'completed' ? 'success' :
                          sync.status === 'failed' ? 'error' :
                          sync.status === 'in_progress' ? 'info' :
                          sync.status === 'paused' ? 'warning' :
                          sync.status === 'interrupted' ? 'error' : 'default'
                        }
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Started {formatDistanceToNow(new Date(sync.startedAt))} ago
                      </Typography>
                      {sync.status === 'in_progress' && sync.results?.progress && (
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={sync.results.progress.current} 
                            sx={{
                              height: 4,
                              borderRadius: 2,
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {sync.results.progress.current}% Complete
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            </React.Fragment>
          ))}
          {syncHistory.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No sync history available
            </Typography>
          )}
        </List>
      </Paper>

      <SyncHistoryDetails 
        sync={selectedSync} 
        onClose={() => setSelectedSync(null)} 
      />
    </Box>
  );
};

export default Settings;