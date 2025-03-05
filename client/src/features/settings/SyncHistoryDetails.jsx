import React from 'react';
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
import { Close as CloseIcon } from '@mui/icons-material';
import { format } from 'date-fns';

const SyncHistoryDetails = ({ sync, onClose }) => {
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
                {sync.completedAt && (
                  <Typography variant="body2" color="text.secondary">
                    Completed: {format(new Date(sync.completedAt), 'PPpp')}
                  </Typography>
                )}
              </Box>

              {(sync.status === 'in_progress' || sync.status === 'paused') && sync.results?.progress && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Progress: {sync.results.progress.current}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={sync.results.progress.current} 
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
                  {sync.results.progress.currentRepo && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Processing: {sync.results.progress.currentRepo}
                      {sync.results.progress.currentWorkflow && ` - ${sync.results.progress.currentWorkflow}`}
                    </Typography>
                  )}
                </Box>
              )}

              {sync.results?.rateLimits && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Rate Limits
                  </Typography>
                  <Typography variant="body2">
                    Remaining: {sync.results.rateLimits.remaining}/{sync.results.rateLimits.limit}
                  </Typography>
                  <Typography variant="body2">
                    Reset Time: {format(new Date(sync.results.rateLimits.resetTime), 'PPpp')}
                  </Typography>
                </Box>
              )}

              {sync.results && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Results Summary
                  </Typography>
                  <Typography variant="body2">
                    Repositories Processed: {sync.results.repositories || 0}
                  </Typography>
                  <Typography variant="body2">
                    Workflows Processed: {sync.results.workflows || 0}
                  </Typography>
                  <Typography variant="body2">
                    Runs Processed: {sync.results.runs || 0}
                  </Typography>
                </Box>
              )}

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