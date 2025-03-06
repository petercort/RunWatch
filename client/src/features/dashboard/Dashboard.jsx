import React, { useState, useEffect, useMemo } from 'react';
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
  Link,
  SvgIcon,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  Schedule as ScheduleIcon,
  GitHub as GitHubIcon,
  RocketLaunch as RocketLaunchIcon,
  Book as BookIcon,
  Search as SearchIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
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
        padding: '2px',
        margin: '2px',
        flexShrink: 0, // Prevent shrinking
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '14px',  // Fixed width
        height: '14px',  // Fixed height
        position: 'relative', // Establish a stacking context
        overflow: 'hidden' // Contain the badge effects
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
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
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
              transform: 'translate(-50%, -50%) scale(1.2)', // Keep centered while scaling
              boxShadow: `0 0 3px ${getColor()}`, // Smaller shadow
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

const RepositoryIcon = BookIcon;

const Dashboard = () => {
  const [workflowRuns, setWorkflowRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState(() => {
    const saved = localStorage.getItem('dashboardSearchQuery');
    return saved || '';
  });
  const navigate = useNavigate();

  // Save search query to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboardSearchQuery', searchQuery);
  }, [searchQuery]);

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

  // Group workflows by organization and repository
  const groupedWorkflows = React.useMemo(() => {
    const groups = {};
    workflowRuns.forEach(workflow => {
      // Extract organization name from repository full name (org/repo)
      const [orgName, repoShortName] = workflow.repository.fullName.split('/');
      const repoKey = workflow.repository.fullName;
      const workflowKey = workflow.workflow.name;
      
      if (!groups[orgName]) {
        groups[orgName] = {
          repositories: {}
        };
      }
      
      if (!groups[orgName].repositories[repoKey]) {
        groups[orgName].repositories[repoKey] = {
          workflows: {},
          repoShortName // Store the short name for display
        };
      }
      
      if (!groups[orgName].repositories[repoKey].workflows[workflowKey]) {
        groups[orgName].repositories[repoKey].workflows[workflowKey] = {
          runs: [],
          history: []
        };
      }
      
      const workflowGroup = groups[orgName].repositories[repoKey].workflows[workflowKey];
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
    Object.values(groups).forEach(org => {
      Object.values(org.repositories).forEach(repo => {
        Object.values(repo.workflows).forEach(workflow => {
          workflow.runs.sort((a, b) => new Date(b.run.created_at) - new Date(a.run.created_at));
        });
      });
    });

    return groups;
  }, [workflowRuns]);

  // Filter repositories based on search query
  const filteredGroupedWorkflows = useMemo(() => {
    const groups = {};
    workflowRuns.forEach(workflow => {
      const [orgName, repoShortName] = workflow.repository.fullName.split('/');
      const repoKey = workflow.repository.fullName;
      const workflowKey = workflow.workflow.name;
      
      // Only include repositories that match the search query
      if (searchQuery && !repoKey.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }

      if (!groups[orgName]) {
        groups[orgName] = {
          repositories: {}
        };
      }
      
      if (!groups[orgName].repositories[repoKey]) {
        groups[orgName].repositories[repoKey] = {
          workflows: {},
          repoShortName
        };
      }
      
      if (!groups[orgName].repositories[repoKey].workflows[workflowKey]) {
        groups[orgName].repositories[repoKey].workflows[workflowKey] = {
          runs: [],
          history: []
        };
      }
      
      const workflowGroup = groups[orgName].repositories[repoKey].workflows[workflowKey];
      workflowGroup.runs.push(workflow);
      
      if (workflow.run.status === 'completed' && 
          !workflowGroup.history.some(h => h.id === workflow.run.id)) {
        workflowGroup.history.unshift({
          id: workflow.run.id,
          conclusion: workflow.run.conclusion
        });
        if (workflowGroup.history.length > 5) {
          workflowGroup.history.pop();
        }
      }
    });
    return groups;
  }, [workflowRuns, searchQuery]);

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

  const handleClearSearch = () => {
    setSearchQuery('');
    localStorage.removeItem('dashboardSearchQuery');
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
          Organizations
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ width: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={handleClearSearch}
                      sx={{ color: '#8B949E' }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>
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
      </Box>

      {Object.entries(filteredGroupedWorkflows).length === 0 ? (
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
        <Stack spacing={4}>
          {Object.entries(filteredGroupedWorkflows).map(([orgName, orgData]) => (
            <Paper 
              key={orgName} 
              elevation={0}
              sx={{ 
                overflow: 'hidden',
                bgcolor: '#161B22',
                borderRadius: '12px',
                border: '1px solid rgba(240, 246, 252, 0.1)'
              }}
            >
              {/* Organization Header */}
              <Box sx={{
                p: 3,
                borderBottom: '1px solid rgba(240, 246, 252, 0.1)',
                background: 'linear-gradient(90deg, rgba(88, 166, 255, 0.1) 0%, rgba(88, 166, 255, 0.05) 100%)',
              }}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    color: '#E6EDF3',
                    fontWeight: 600,
                    fontSize: '1.25rem'
                  }}
                >
                  {orgName}
                </Typography>
              </Box>

              {/* Repositories Section */}
              <Box sx={{ p: 3 }}>
                <Stack spacing={3}>
                  {Object.entries(orgData.repositories).map(([repoKey, repoData]) => (
                    <Paper
                      key={repoKey}
                      elevation={0}
                      sx={{
                        bgcolor: 'rgba(13, 17, 23, 0.3)',
                        borderRadius: '12px',
                        border: '1px solid rgba(240, 246, 252, 0.1)',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Repository Header */}
                      <Box sx={{
                        p: 2.5,
                        borderBottom: '1px solid rgba(240, 246, 252, 0.1)',
                      }}>
                        <Typography 
                          onClick={() => navigate(`/repository/${encodeURIComponent(repoKey)}`)}
                          sx={{ 
                            color: '#E6EDF3',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            '&:hover': {
                              color: '#58A6FF'
                            }
                          }}
                        >
                          <RepositoryIcon sx={{ fontSize: '1.2rem', color: '#58A6FF' }} />
                          {repoData.repoShortName}
                        </Typography>
                      </Box>

                      {/* Workflows */}
                      <Box sx={{ p: 2.5 }}>
                        <Grid 
                          container 
                          spacing={2}
                          columns={{ xs: 4, sm: 8, md: 12, lg: 16, xl: 40 }}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: 'repeat(1, 1fr)',
                              sm: 'repeat(2, 1fr)',
                              md: 'repeat(3, 1fr)',
                              lg: 'repeat(4, 1fr)',
                              xl: 'repeat(10, 1fr)'
                            },
                            gap: 2,
                          }}
                        > 
                          {Object.entries(repoData.workflows).map(([workflowKey, workflowData]) => (
                            <Box
                              key={workflowKey}
                              sx={{ 
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                p: 2,
                                borderRadius: 1,
                                bgcolor: 'rgba(13, 17, 23, 0.5)',
                                border: '1px solid rgba(240, 246, 252, 0.05)',
                                height: '140px',
                                width: '100%',
                                minWidth: '200px',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                                mb: 1
                              }}>
                                <Typography 
                                  onClick={() => navigate(`/workflow-history/${encodeURIComponent(repoKey)}/${encodeURIComponent(workflowKey)}`)}
                                  sx={{ 
                                    color: '#E6EDF3', 
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1,
                                    minWidth: 0,
                                    '&:hover': {
                                      color: '#58A6FF',
                                    }
                                  }}
                                >
                                  {workflowKey}
                                </Typography>

                                <Stack 
                                  direction="row" 
                                  spacing={2} 
                                  sx={{ 
                                    ml: 2,
                                    alignItems: 'center'
                                  }}
                                >
                                  <Tooltip title="Total builds">
                                    <Box sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center',
                                      color: '#8B949E',
                                      fontSize: '0.75rem',
                                      '& svg': { fontSize: '0.875rem', mr: 0.5 }
                                    }}>
                                      <RocketLaunchIcon />
                                      {workflowData.runs.length}
                                    </Box>
                                  </Tooltip>

                                  <Tooltip title="Average duration">
                                    <Box sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center',
                                      color: '#8B949E',
                                      fontSize: '0.75rem',
                                      '& svg': { fontSize: '0.875rem', mr: 0.5 }
                                    }}>
                                      <ScheduleIcon />
                                      {(() => {
                                        const completedRuns = workflowData.runs.filter(w => w.run.status === 'completed');
                                        if (completedRuns.length === 0) return '-';
                                        const totalDuration = completedRuns.reduce((acc, w) => {
                                          const start = new Date(w.run.created_at);
                                          const end = new Date(w.run.updated_at);
                                          return acc + (end - start);
                                        }, 0);
                                        const avgDuration = totalDuration / completedRuns.length;
                                        return formatDuration(new Date(), new Date(new Date().getTime() + avgDuration));
                                      })()}
                                    </Box>
                                  </Tooltip>
                                </Stack>
                              </Box>
                              
                              <Box sx={{ 
                                display: 'flex', 
                                flexWrap: 'nowrap',
                                alignItems: 'center',
                                gap: 0.5,
                                py: 0.5,
                                px: 1,
                                borderRadius: '8px',
                                border: '1px solid rgba(240, 246, 252, 0.05)',
                                minHeight: '36px',
                                height: '36px',
                                flex: 1,
                                position: 'relative',
                                boxSizing: 'border-box',
                                overflow: 'hidden',
                                '&:hover': {
                                  borderColor: 'rgba(240, 246, 252, 0.1)'
                                }
                              }}>
                                {workflowData.runs.slice(0, 10).reverse().map((workflow, index) => {
                                  const run = {
                                    ...workflow.run,
                                    id: workflow.run.id.toString()
                                  };
                                  return (
                                    <Box
                                      key={workflow.run.id}
                                      sx={{
                                        position: 'relative',
                                        '&::after': index === 0 ? {
                                          content: '""',
                                          position: 'absolute',
                                          top: -12,
                                          left: '50%',
                                          transform: 'translateX(-50%)',
                                          width: 0,
                                          height: 0,
                                          borderLeft: '4px solid transparent',
                                          borderRight: '4px solid transparent',
                                          borderTop: '4px solid #58A6FF',
                                        } : undefined
                                      }}
                                    >
                                      <BuildHistoryBadge
                                        run={run}
                                      />
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Box>
                          ))}
                        </Grid>
                      </Box>
                    </Paper>
                  ))}
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