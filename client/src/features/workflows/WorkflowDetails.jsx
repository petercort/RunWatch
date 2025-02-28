import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Tooltip,
  Stack,
  Collapse,
  Link
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import apiService from '../../api/apiService';
import { setupSocketListeners } from '../../api/socketService';
import StatusChip from '../../common/components/StatusChip';
import { formatDuration, formatDate } from '../../common/utils/statusHelpers';

const WorkflowDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedJobs, setExpandedJobs] = useState(new Set());

  useEffect(() => {
    const fetchWorkflowDetails = async () => {
      try {
        setLoading(true);
        const allWorkflows = await apiService.getWorkflowRuns();
        const workflowRun = allWorkflows.find(wf => wf.run.id.toString() === id.toString());
        
        if (workflowRun) {
          console.log('GitHub URLs:', {
            runUrl: workflowRun.run.url,
            repoUrl: workflowRun.repository.url
          });
          setWorkflow(workflowRun);
          setError(null);
        } else {
          setError('Workflow run not found');
        }
      } catch (err) {
        setError('Failed to fetch workflow details. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflowDetails();

    // Set up socket listeners for real-time updates
    const cleanupListeners = setupSocketListeners({
      onWorkflowUpdate: (updatedWorkflow) => {
        if (updatedWorkflow.run.id.toString() === id.toString()) {
          setWorkflow(prevWorkflow => {
            // Only update if the workflow exists and the update is newer
            if (!prevWorkflow || new Date(updatedWorkflow.run.updated_at) > new Date(prevWorkflow.run.updated_at)) {
              return updatedWorkflow;
            }
            return prevWorkflow;
          });
        }
      },
      onJobsUpdate: (workflowWithJobs) => {
        if (workflowWithJobs.run.id.toString() === id.toString()) {
          setWorkflow(prevWorkflow => {
            // Only update if the workflow exists and the update is newer
            if (!prevWorkflow || new Date(workflowWithJobs.run.updated_at) > new Date(prevWorkflow.run.updated_at)) {
              return workflowWithJobs;
            }
            return prevWorkflow;
          });
        }
      }
    });

    return () => {
      cleanupListeners();
    };
  }, [id]);

  const toggleJobSteps = (jobId) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !workflow) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography color="error">{error || 'Workflow not found'}</Typography>
        <Button 
          variant="contained" 
          sx={{ mt: 2 }} 
          onClick={() => navigate('/')}
          startIcon={<BackIcon />}
        >
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  // Format GitHub URL to ensure it starts with https://
  const formatGitHubUrl = (url) => {
    if (!url) return '#';
    if (url.startsWith('http')) return url;
    return `https://github.com${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleOpenLink = (url) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        mb: 4,
        background: 'linear-gradient(90deg, rgba(88, 166, 255, 0.1) 0%, rgba(88, 166, 255, 0.05) 100%)',
        p: 3,
        borderRadius: '12px',
        border: '1px solid rgba(88, 166, 255, 0.2)'
      }}>
        <Tooltip title="Back to Dashboard">
          <IconButton onClick={() => navigate('/')} sx={{ mr: 2, color: '#E6EDF3' }}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h4" component="h1" sx={{
            fontWeight: 600,
            fontSize: '1.75rem',
            color: '#E6EDF3'
          }}>
            {workflow.workflow.name}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: '#8B949E' }}>
            {workflow.repository.fullName} • Run #{workflow.run.number}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ 
            p: 3, 
            mb: 3,
            bgcolor: '#161B22',
            borderRadius: '12px',
            border: '1px solid rgba(240, 246, 252, 0.1)'
          }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" sx={{ color: '#8B949E', mb: 1 }}>Status</Typography>
                <StatusChip 
                  status={workflow.run.status} 
                  conclusion={workflow.run.conclusion}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ScheduleIcon sx={{ fontSize: '1.2rem', mr: 1, color: '#8B949E' }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: '#8B949E' }}>Duration</Typography>
                    <Typography variant="body1" sx={{ color: '#E6EDF3' }}>
                      {formatDuration(workflow.run.created_at, workflow.run.updated_at)}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <HistoryIcon sx={{ fontSize: '1.2rem', mr: 1, color: '#8B949E' }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: '#8B949E' }}>Last Updated</Typography>
                    <Typography variant="body1" sx={{ color: '#E6EDF3' }}>
                      {formatDate(workflow.run.updated_at)}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Link
                href={workflow.run.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textDecoration: 'none' }}
              >
                <Button 
                  variant="outlined"
                  sx={{ 
                    borderColor: 'rgba(88, 166, 255, 0.2)',
                    color: '#58A6FF',
                    '&:hover': {
                      borderColor: 'rgba(88, 166, 255, 0.5)',
                      bgcolor: 'rgba(88, 166, 255, 0.1)'
                    }
                  }}
                >
                  View on GitHub
                </Button>
              </Link>
              <Link
                href={workflow.repository.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textDecoration: 'none' }}
              >
                <Button 
                  variant="outlined"
                  sx={{ 
                    borderColor: 'rgba(139, 148, 158, 0.2)',
                    color: '#8B949E',
                    '&:hover': {
                      borderColor: 'rgba(139, 148, 158, 0.5)',
                      bgcolor: 'rgba(139, 148, 158, 0.1)'
                    }
                  }}
                >
                  Repository
                </Button>
              </Link>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h5" sx={{ 
            mb: 2, 
            color: '#E6EDF3',
            fontWeight: 600
          }}>
            Jobs
          </Typography>
          
          {!workflow.jobs || workflow.jobs.length === 0 ? (
            <Paper elevation={0} sx={{
              p: 3,
              bgcolor: '#161B22',
              borderRadius: '12px',
              border: '1px solid rgba(240, 246, 252, 0.1)'
            }}>
              <Typography sx={{ color: '#8B949E' }}>No job information available</Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {workflow.jobs.map((job) => (
                <Paper 
                  key={job.id} 
                  elevation={0}
                  sx={{
                    bgcolor: '#161B22',
                    borderRadius: '12px',
                    border: '1px solid rgba(240, 246, 252, 0.1)',
                    overflow: 'hidden'
                  }}
                >
                  <Box 
                    onClick={() => toggleJobSteps(job.id)}
                    sx={{
                      p: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(88, 166, 255, 0.05)' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <StatusChip 
                        status={job.status} 
                        conclusion={job.conclusion}
                      />
                      <Typography sx={{ color: '#E6EDF3', fontWeight: 500 }}>
                        {job.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" sx={{ color: '#8B949E' }}>
                        {formatDuration(job.started_at, job.completed_at)}
                      </Typography>
                      <ExpandMoreIcon sx={{ 
                        color: '#8B949E',
                        transform: expandedJobs.has(job.id) ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s'
                      }} />
                    </Box>
                  </Box>

                  <Collapse in={expandedJobs.has(job.id)}>
                    <Divider sx={{ borderColor: 'rgba(240, 246, 252, 0.1)' }} />
                    <Box sx={{ p: 2.5, bgcolor: 'rgba(13, 17, 23, 0.5)' }}>
                      <Stack spacing={1.5}>
                        {job.steps?.map((step) => (
                          <Box
                            key={step.number}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor: '#0D1117',
                              border: '1px solid rgba(240, 246, 252, 0.05)'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <StatusChip 
                                status={step.status} 
                                conclusion={step.conclusion}
                              />
                              <Typography sx={{ color: '#E6EDF3' }}>
                                {step.name}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Typography variant="body2" sx={{ color: '#8B949E' }}>
                                {formatDuration(step.started_at, step.completed_at)}
                              </Typography>
                              <Button 
                                variant="outlined"
                                size="small"
                                onClick={() => window.open(workflow.run.url, '_blank', 'noopener,noreferrer')}
                                sx={{ 
                                  borderColor: 'rgba(88, 166, 255, 0.2)',
                                  color: '#58A6FF',
                                  '&:hover': {
                                    borderColor: 'rgba(88, 166, 255, 0.5)',
                                    bgcolor: 'rgba(88, 166, 255, 0.1)'
                                  }
                                }}
                              >
                                View on GitHub
                              </Button>
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </Collapse>
                </Paper>
              ))}
            </Stack>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default WorkflowDetails;