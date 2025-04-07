import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Stack,
  Alert,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { format } from 'date-fns';
import { socket } from '../../api/socketService';
import apiService from '../../api/apiService';

const SyncHistoryDetails = ({ sync: initialSync, onClose }) => {
  const [sync, setSync] = useState(initialSync);

  useEffect(() => {
    setSync(initialSync);
  }, [initialSync]);

  useEffect(() => {
    if (!sync || !sync._id) return;

    const updateSyncDetails = async () => {
      try {
        const response = await apiService.getSyncHistory();
        const updatedSync = response.data.find(s => s._id === sync._id);
        if (updatedSync) {
          setSync(updatedSync);
        }
      } catch (error) {
        console.error('Failed to fetch sync details:', error);
      }
    };

    // Set up socket listeners for real-time updates
    socket.on('syncProgress', async (data) => {
      if (sync.status === 'in_progress') {
        await updateSyncDetails();
      }
    });

    socket.on('rateLimitUpdate', async () => {
      if (sync.status === 'in_progress') {
        await updateSyncDetails();
      }
    });

    socket.on('syncStatus', async () => {
      await updateSyncDetails();
    });

    // Cleanup function
    return () => {
      socket.off('syncProgress');
      socket.off('rateLimitUpdate');
      socket.off('syncStatus');
    };
  }, [sync?._id, sync?.status]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'in_progress': return 'info';
      case 'paused': return 'warning';
      case 'interrupted': return 'error';
      default: return 'default';
    }
  };

  // Get the progress to display - either current progress or last progress before interruption
  const getProgressDetails = () => {
    if (sync.status === 'interrupted' && sync.results?.lastProgress) {
      return sync.results.lastProgress;
    }
    return sync.results?.progress;
  };

  // Get the results summary including total repositories
  const getResultsSummary = () => {
    const progress = getProgressDetails();
    const total = sync.results?.totalRepositories || progress?.totalRepos || 0;
    if (sync.status === 'completed') {
      return {
        totalRepositories: total,
        repositories: sync.results?.repositories || 0,
        workflows: sync.results?.workflows || 0,
        runs: sync.results?.runs || 0
      };
    }
    return {
      totalRepositories: total,
      repositories: progress?.processedRepos || 0,
      workflows: progress?.processedWorkflows || 0,
      runs: progress?.processedRuns || 0
    };
  };

  return (
    <Dialog 
      open={Boolean(sync)} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      aria-labelledby="sync-details-dialog-title"
    >
      {sync && (
        <>
          <DialogTitle id="sync-details-dialog-title" sx={{ pr: 6 }}>
            Sync Details - {format(new Date(sync.startedAt), 'PPpp')}
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: (theme) => theme.palette.grey[500],
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Status: <Chip label={sync.status} color={getStatusColor(sync.status)} />
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Organization: {sync.organization.name} ({sync.organization.type})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Workflow Run Limit: {sync.config?.maxWorkflowRuns || 'Not set'} runs per workflow
                </Typography>
                {sync.completedAt && (
                  <Typography variant="body2" color="text.secondary">
                    Completed: {format(new Date(sync.completedAt), 'PPpp')}
                  </Typography>
                )}
              </Box>

              {(sync.status === 'in_progress' || sync.status === 'paused' || 
                (sync.status === 'interrupted' && sync.results?.lastProgress)) && (
                <>
                  {getProgressDetails() && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Progress: {getProgressDetails().current}%
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={getProgressDetails().current} 
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: 'rgba(88, 166, 255, 0.1)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: sync.status === 'interrupted' ? '#f44336' : '#58A6FF',
                            borderRadius: 4
                          }
                        }}
                      />
                      {getProgressDetails().currentRepo && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            Processing: {getProgressDetails().currentRepo}
                            {getProgressDetails().currentWorkflow && ` - ${getProgressDetails().currentWorkflow}`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Repository {getProgressDetails().repoIndex + 1}/{getProgressDetails().totalRepos}
                            {getProgressDetails().workflowIndex !== null && 
                             getProgressDetails().totalWorkflows && 
                             ` • Workflow ${getProgressDetails().workflowIndex + 1}/${getProgressDetails().totalWorkflows}`}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {sync.results?.rateLimits && (
                    <Box sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.1)', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        GitHub API Rate Limits
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Typography variant="body2">
                          Remaining: {sync.results.rateLimits.remaining}/{sync.results.rateLimits.limit}
                        </Typography>
                        <Typography variant="body2">
                          Resets: {new Date(sync.results.rateLimits.resetTime).toLocaleTimeString()}
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={(sync.results.rateLimits.remaining / sync.results.rateLimits.limit) * 100}
                          sx={{ 
                            width: 100,
                            height: 8,
                            borderRadius: 4,
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: sync.results.rateLimits.remaining < 1000 ? '#ff9800' : '#4caf50',
                              borderRadius: 4
                            }
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                </>
              )}

              <Box>
                <Typography variant="subtitle1" gutterBottom component="div">
                  Results Summary
                </Typography>
                {(() => {
                  const summary = getResultsSummary();
                  return (
                    <>
                      <Typography variant="body2" sx={{ mb: 0.5 }} component="div">
                        Repositories Processed: {summary.repositories}/{summary.totalRepositories}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 0.5 }} component="div">
                        Workflows Processed: {summary.workflows}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 0.5 }} component="div">
                        Runs Processed: {summary.runs}
                      </Typography>
                    </>
                  );
                })()}
              </Box>

              {sync.results?.errors?.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom color="error">
                    Errors
                  </Typography>
                  {sync.results.errors.map((error, index) => (
                    <Alert key={index} severity="error" sx={{ mb: 1 }}>
                      {error.type}: {error.error}
                      {error.name && ` (${error.name})`}
                    </Alert>
                  ))}
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default SyncHistoryDetails;