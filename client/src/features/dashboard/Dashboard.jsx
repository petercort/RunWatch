import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  Collapse,
  Stack,
  Link
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import GitHubIcon from '@mui/icons-material/GitHub';
import apiService from '../../api/apiService';
import { setupSocketListeners } from '../../api/socketService';
import StatusChip from '../../common/components/StatusChip';
import { formatDuration, formatDate } from '../../common/utils/statusHelpers';
import { keyframes } from '@emotion/react';

const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const pulse = keyframes`
  0% { opacity: 0.7; }
  50% { opacity: 1; }
  100% { opacity: 0.7; }
`;

const BuildHistoryBadge = ({ run }) => {
  const getColor = () => {
    if (run.status === 'in_progress' || run.status === 'queued' || run.status === 'waiting' || run.status === 'pending') {
      return '#F5A623'; // Orange for active states
    }

    switch (run.conclusion) {
      case 'success':
        return '#23C562';
      case 'failure':
        return '#F85149';
      case 'cancelled':
      case 'skipped':
        return '#8B949E';
      case 'timed_out':
      case 'action_required':
        return '#F5A623';
      case 'neutral':
        return '#58A6FF';
      case 'stale':
        return '#6E7681';
      default:
        // For any other status, show a neutral color
        return '#8B949E';
    }
  };

  const getStatusText = () => {
    // First check the active states
    if (run.status && ['in_progress', 'queued', 'waiting', 'pending', 'requested'].includes(run.status)) {
      return run.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    
    // Then check conclusion for completed states
    if (run.conclusion) {
      return run.conclusion.charAt(0).toUpperCase() + run.conclusion.slice(1);
    }

    // If neither is available, return the current status
    return run.status ? run.status.charAt(0).toUpperCase() + run.status.slice(1) : 'Pending';
  };

  const tooltipContent = (
    <Box>
      <Typography variant="caption" component="div">
        Status: {getStatusText()}
      </Typography>
      <Typography variant="caption" component="div">
        Duration: {formatDuration(run.created_at, run.updated_at)}
      </Typography>
      <Typography variant="caption" component="div">
        {formatDate(run.updated_at)}
      </Typography>
    </Box>
  );

  return (
    <Box 
      sx={{ 
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Tooltip 
        title={tooltipContent} 
        arrow 
        placement="top"
      >
        <Box
          onClick={() => window.open(run.url, '_blank', 'noopener,noreferrer')}
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: getColor(),
            cursor: 'pointer',
            position: 'relative',
            zIndex: 1,
            transition: 'all 0.2s ease',
            ...(run.status === 'in_progress' && {
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-3px',
                left: '-3px',
                right: '-3px',
                bottom: '-3px',
                border: '2px solid',
                borderColor: 'inherit',
                opacity: 0.6,
                borderRadius: '50%',
                animation: `${rotate} 2s linear infinite, ${pulse} 2s ease-in-out infinite`
              }
            }),
            '&:hover': {
              transform: 'scale(1.5)',
              boxShadow: `0 0 8px ${getColor()}`,
              zIndex: 2
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              bottom: '-4px',
              left: '-4px',
              border: '1px solid transparent',
              borderRadius: '50%',
              transition: 'all 0.2s ease',
            },
            '&:hover::after': {
              borderColor: getColor(),
              opacity: 0.4,
            }
          }}
        />
      </Tooltip>
    </Box>
  );
};

const Dashboard = () => {
  const [workflowRuns, setWorkflowRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState(new Set());
  const navigate = useNavigate();

  const fetchWorkflowRuns = async () => {
    try {
      setLoading(true);
      const data = await apiService.getWorkflowRuns();
      setWorkflowRuns(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch workflow runs. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflowRuns();

    // Set up real-time updates with socket.io
    const cleanupListeners = setupSocketListeners({
      onNewWorkflow: (newWorkflow) => {
        setWorkflowRuns(prev => {
          // Check if workflow already exists
          const exists = prev.some(workflow => workflow.run.id === newWorkflow.run.id);
          if (exists) {
            // Update existing workflow
            return prev.map(workflow =>
              workflow.run.id === newWorkflow.run.id ? newWorkflow : workflow
            );
          }
          // Add new workflow if it doesn't exist
          return [newWorkflow, ...prev];
        });
      },
      onWorkflowUpdate: (updatedWorkflow) => {
        setWorkflowRuns(prev => {
          // If workflow doesn't exist in list, don't add it
          if (!prev.some(workflow => workflow.run.id === updatedWorkflow.run.id)) {
            return prev;
          }
          // Update existing workflow
          return prev.map(workflow =>
            workflow.run.id === updatedWorkflow.run.id ? updatedWorkflow : workflow
          );
        });
      },
      onJobsUpdate: (workflowWithJobs) => {
        setWorkflowRuns(prev => {
          // If workflow doesn't exist in list, don't add it
          if (!prev.some(workflow => workflow.run.id === workflowWithJobs.run.id)) {
            return prev;
          }
          // Update existing workflow
          return prev.map(workflow =>
            workflow.run.id === workflowWithJobs.run.id ? workflowWithJobs : workflow
          );
        });
      }
    });

    return () => {
      cleanupListeners();
    };
  }, []);

  // Group workflows by repository and workflow name
  const groupedWorkflows = React.useMemo(() => {
    const groups = {};
    workflowRuns.forEach(workflow => {
      const repoKey = workflow.repository.fullName;
      const workflowKey = workflow.workflow.name;
      
      if (!groups[repoKey]) {
        groups[repoKey] = {
          workflows: {}
        };
      }
      
      if (!groups[repoKey].workflows[workflowKey]) {
        groups[repoKey].workflows[workflowKey] = {
          runs: [],
          history: [] // Store last 5 completed runs
        };
      }
      
      const workflowGroup = groups[repoKey].workflows[workflowKey];
      workflowGroup.runs.push(workflow);
      
      // Add to history if completed and not already there
      if (workflow.run.status === 'completed' && 
          !workflowGroup.history.some(h => h.id === workflow.run.id)) {
        workflowGroup.history.unshift({
          id: workflow.run.id,
          conclusion: workflow.run.conclusion
        });
        // Keep only last 5
        if (workflowGroup.history.length > 5) {
          workflowGroup.history.pop();
        }
      }
    });

    // Sort runs within each workflow by date
    Object.values(groups).forEach(repo => {
      Object.values(repo.workflows).forEach(workflow => {
        workflow.runs.sort((a, b) => new Date(b.run.created_at) - new Date(a.run.created_at));
      });
    });

    return groups;
  }, [workflowRuns]);

  const toggleWorkflowHistory = (workflowKey) => {
    setExpandedWorkflows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workflowKey)) {
        newSet.delete(workflowKey);
      } else {
        newSet.add(workflowKey);
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

  if (error) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
        <Button 
          variant="contained" 
          sx={{ mt: 2 }} 
          onClick={fetchWorkflowRuns}
          startIcon={<RefreshIcon />}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        mb: 4, 
        alignItems: 'center',
        background: 'linear-gradient(90deg, rgba(88, 166, 255, 0.1) 0%, rgba(88, 166, 255, 0.05) 100%)',
        p: 3,
        borderRadius: '12px',
        border: '1px solid rgba(88, 166, 255, 0.2)'
      }}>
        <Typography variant="h4" component="h1" sx={{
          fontWeight: 600,
          fontSize: '1.75rem',
          color: '#E6EDF3'
        }}>
          Repository Workflows
        </Typography>
        <Tooltip title="Refresh">
          <IconButton 
            onClick={fetchWorkflowRuns}
            sx={{ 
              color: '#58A6FF',
              '&:hover': {
                bgcolor: 'rgba(88, 166, 255, 0.1)'
              }
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {Object.entries(groupedWorkflows).length === 0 ? (
        <Box sx={{
          textAlign: 'center',
          py: 8,
          background: 'rgba(88, 166, 255, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(88, 166, 255, 0.1)'
        }}>
          <Typography variant="body1" color="#8B949E">
            No workflow runs found. Waiting for GitHub webhook events...
          </Typography>
        </Box>
      ) : (
        <Stack spacing={3}>
          {Object.entries(groupedWorkflows).map(([repoName, repoData]) => (
            <Paper 
              key={repoName} 
              elevation={0}
              sx={{ 
                overflow: 'hidden',
                bgcolor: '#161B22',
                borderRadius: '12px',
                border: '1px solid rgba(240, 246, 252, 0.1)'
              }}
            >
              <Box sx={{
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid rgba(240, 246, 252, 0.1)',
              }}>
                <GitHubIcon sx={{ mr: 2, color: '#58A6FF' }} />
                <Typography 
                  variant="h6" 
                  onClick={() => navigate(`/repository/${encodeURIComponent(repoName)}`)}
                  sx={{ 
                    color: '#E6EDF3',
                    fontWeight: 600,
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    '&:hover': {
                      color: '#58A6FF'
                    }
                  }}
                >
                  {repoName}
                </Typography>
              </Box>

              <Box sx={{ p: 3 }}>
                <Stack spacing={2.5}>
                  {Object.entries(repoData.workflows).map(([workflowKey, workflowData]) => {
                    const latestRun = workflowData.runs[0];
                    const hasHistory = workflowData.runs.length > 1;

                    return (
                      <Box
                        key={workflowKey}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 2,
                          borderRadius: 1,
                          bgcolor: 'rgba(13, 17, 23, 0.3)',
                          border: '1px solid rgba(240, 246, 252, 0.1)',
                        }}
                      >
                        <Box>
                          <Typography 
                            onClick={() => navigate(`/workflow-history/${encodeURIComponent(repoName)}/${encodeURIComponent(workflowKey)}`)}
                            sx={{ 
                              color: '#E6EDF3', 
                              fontWeight: 500,
                              cursor: 'pointer',
                              '&:hover': {
                                color: '#58A6FF',
                              }
                            }}
                          >
                            {workflowKey}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#8B949E' }}>
                            Last run: {formatDate(latestRun.run.updated_at)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            py: 0.75,
                            px: 1.5,
                            gap: 1,
                            borderRadius: '12px',
                            border: '1px solid rgba(240, 246, 252, 0.05)',
                            position: 'relative',
                            '&:hover': {
                              borderColor: 'rgba(240, 246, 252, 0.1)'
                            }
                          }}>
                            {workflowData.runs.slice(0, 5).reverse().map((workflow) => {
                              const run = {
                                ...workflow.run,
                                id: workflow.run.id.toString()
                              };
                              return (
                                <BuildHistoryBadge
                                  key={workflow.run.id}
                                  run={run}
                                />
                              );
                            })}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default Dashboard;