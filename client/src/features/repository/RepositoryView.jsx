import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Link,
  Button,
  Stack,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  GitHub as GitHubIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  BugReport as BugIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { Line, Bar } from 'react-chartjs-2';
import { formatDuration, formatDate } from '../../common/utils/statusHelpers';
import apiService from '../../api/apiService';

const RepositoryView = () => {
  const { repoName } = useParams();
  const navigate = useNavigate();
  const [repository, setRepository] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const calculateRepoStats = (runs) => {
    if (!runs.length) return null;

    // Group runs by workflow
    const workflowStats = {};
    runs.forEach(run => {
      const workflowName = run.workflow.name;
      if (!workflowStats[workflowName]) {
        workflowStats[workflowName] = {
          total: 0,
          successful: 0,
          failed: 0,
          durations: [],
          lastRun: null,
        };
      }

      const stats = workflowStats[workflowName];
      stats.total++;
      if (run.run.conclusion === 'success') stats.successful++;
      if (run.run.conclusion === 'failure') stats.failed++;
      
      const start = new Date(run.run.created_at);
      const end = new Date(run.run.updated_at);
      const duration = end - start;
      if (duration >= 0) stats.durations.push(duration);

      if (!stats.lastRun || new Date(run.run.created_at) > new Date(stats.lastRun)) {
        stats.lastRun = run.run.created_at;
      }
    });

    // Calculate overall stats
    const totalRuns = runs.length;
    const successfulRuns = runs.filter(run => run.run.conclusion === 'success').length;
    const failedRuns = runs.filter(run => run.run.conclusion === 'failure').length;
    const allDurations = runs
      .map(run => {
        const start = new Date(run.run.created_at);
        const end = new Date(run.run.updated_at);
        const duration = end - start;
        return duration >= 0 ? duration : null;
      })
      .filter(Boolean); // Remove any null durations

    const avgDuration = allDurations.length
      ? Math.floor(allDurations.reduce((acc, curr) => acc + curr, 0) / allDurations.length)
      : 0;

    // Calculate activity trends
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split('T')[0];
    });

    const dailyStats = last30Days.map(date => {
      const dayRuns = runs.filter(run => 
        run.run.created_at.startsWith(date)
      );
      
      return {
        date,
        total: dayRuns.length,
        successful: dayRuns.filter(run => run.run.conclusion === 'success').length,
        failed: dayRuns.filter(run => run.run.conclusion === 'failure').length,
      };
    });

    const activityTrends = {
      labels: dailyStats.map(stat => new Date(stat.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })),
      datasets: [
        {
          label: 'Total Runs',
          data: dailyStats.map(stat => stat.total),
          borderColor: 'rgba(88, 166, 255, 1)',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Successful',
          data: dailyStats.map(stat => stat.successful),
          borderColor: 'rgba(35, 197, 98, 1)',
          backgroundColor: 'rgba(35, 197, 98, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Failed',
          data: dailyStats.map(stat => stat.failed),
          borderColor: 'rgba(248, 81, 73, 1)',
          backgroundColor: 'rgba(248, 81, 73, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };

    // Prepare workflow comparison data
    const workflowNames = Object.keys(workflowStats);
    const workflowComparison = {
      labels: workflowNames,
      datasets: [
        {
          label: 'Success Rate (%)',
          data: workflowNames.map(name => {
            const stats = workflowStats[name];
            return stats.total ? (stats.successful / stats.total * 100).toFixed(1) : 0;
          }),
          backgroundColor: 'rgba(35, 197, 98, 0.6)',
          borderColor: 'rgba(35, 197, 98, 1)',
          borderWidth: 1,
        },
        {
          label: 'Average Duration (minutes)',
          data: workflowNames.map(name => {
            const stats = workflowStats[name];
            const avgDuration = stats.durations.length
              ? stats.durations.reduce((acc, curr) => acc + curr, 0) / stats.durations.length
              : 0;
            return (avgDuration / (1000 * 60)).toFixed(1); // Convert to minutes
          }),
          backgroundColor: 'rgba(88, 166, 255, 0.6)',
          borderColor: 'rgba(88, 166, 255, 1)',
          borderWidth: 1,
        },
      ],
    };

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      avgDuration,
      successRate: totalRuns ? (successfulRuns / totalRuns * 100) : 0,
      workflowStats,
      activityTrends,
      workflowComparison,
    };
  };

  useEffect(() => {
    const fetchRepositoryData = async () => {
      try {
        setLoading(true);
        const allWorkflows = await apiService.getWorkflowRuns();
        const repoWorkflows = allWorkflows.filter(wf => 
          wf.repository.fullName === decodeURIComponent(repoName)
        );

        if (repoWorkflows.length > 0) {
          const repoInfo = repoWorkflows[0].repository;
          setRepository(repoInfo);
          setStats(calculateRepoStats(repoWorkflows));
        } else {
          setError('Repository not found');
        }
      } catch (err) {
        setError('Failed to fetch repository data. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRepositoryData();
  }, [repoName]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !repository) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
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
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" sx={{
            fontWeight: 600,
            fontSize: '1.75rem',
            color: '#E6EDF3',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <GitHubIcon sx={{ fontSize: '1.75rem' }} />
            {repository.fullName}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<GitHubIcon />}
          onClick={() => window.open(repository.url, '_blank', 'noopener,noreferrer')}
          sx={{ 
            borderColor: 'rgba(88, 166, 255, 0.2)',
            color: '#58A6FF',
            '&:hover': {
              borderColor: 'rgba(88, 166, 255, 0.5)',
              bgcolor: 'rgba(88, 166, 255, 0.1)'
            }
          }}
        >
          View Repository
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Overview Stats */}
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#161B22', border: '1px solid rgba(240, 246, 252, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AssessmentIcon sx={{ color: '#58A6FF', mr: 1 }} />
                <Typography sx={{ color: '#8B949E' }}>Total Runs</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#E6EDF3' }}>
                {stats.totalRuns}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#161B22', border: '1px solid rgba(240, 246, 252, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUpIcon sx={{ color: '#23C562', mr: 1 }} />
                <Typography sx={{ color: '#8B949E' }}>Success Rate</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#E6EDF3' }}>
                {stats.successRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#161B22', border: '1px solid rgba(240, 246, 252, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BugIcon sx={{ color: '#F85149', mr: 1 }} />
                <Typography sx={{ color: '#8B949E' }}>Failed Runs</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#E6EDF3' }}>
                {stats.failedRuns}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#161B22', border: '1px solid rgba(240, 246, 252, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TimeIcon sx={{ color: '#58A6FF', mr: 1 }} />
                <Typography sx={{ color: '#8B949E' }}>Avg. Duration</Typography>
              </Box>
              <Typography variant="h6" sx={{ color: '#E6EDF3' }}>
                {formatDuration(stats.avgDuration)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Activity Trends Chart */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ 
            p: 3,
            bgcolor: '#161B22',
            borderRadius: '12px',
            border: '1px solid rgba(240, 246, 252, 0.1)'
          }}>
            <Typography variant="h6" sx={{ color: '#E6EDF3', mb: 3 }}>
              30-Day Activity Trends
            </Typography>
            <Box sx={{ height: 300 }}>
              <Line
                data={stats.activityTrends}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    intersect: false,
                    mode: 'index'
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: { color: '#8B949E' }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(240, 246, 252, 0.1)' },
                      ticks: { color: '#8B949E' }
                    },
                    x: {
                      grid: { color: 'rgba(240, 246, 252, 0.1)' },
                      ticks: { 
                        color: '#8B949E',
                        maxTicksLimit: 10
                      }
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Workflow Comparison */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ 
            p: 3,
            bgcolor: '#161B22',
            borderRadius: '12px',
            border: '1px solid rgba(240, 246, 252, 0.1)'
          }}>
            <Typography variant="h6" sx={{ color: '#E6EDF3', mb: 3 }}>
              Workflow Comparison
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar
                data={stats.workflowComparison}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: { color: '#8B949E' }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(240, 246, 252, 0.1)' },
                      ticks: { color: '#8B949E' }
                    },
                    x: {
                      grid: { color: 'rgba(240, 246, 252, 0.1)' },
                      ticks: { color: '#8B949E' }
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Workflow Details */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ 
            p: 3,
            bgcolor: '#161B22',
            borderRadius: '12px',
            border: '1px solid rgba(240, 246, 252, 0.1)'
          }}>
            <Typography variant="h6" sx={{ color: '#E6EDF3', mb: 3 }}>
              Workflows
            </Typography>
            <Stack spacing={2}>
              {Object.entries(stats.workflowStats).map(([name, workflowStat]) => (
                <Paper
                  key={name}
                  elevation={0}
                  sx={{
                    p: 2.5,
                    bgcolor: 'rgba(13, 17, 23, 0.3)',
                    border: '1px solid rgba(240, 246, 252, 0.1)',
                    borderRadius: '8px',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography 
                        onClick={() => navigate(`/workflow-history/${encodeURIComponent(repoName)}/${encodeURIComponent(name)}`)}
                        sx={{ 
                          color: '#E6EDF3',
                          fontWeight: 500,
                          cursor: 'pointer',
                          '&:hover': {
                            color: '#58A6FF',
                          }
                        }}
                      >
                        {name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#8B949E', mt: 0.5 }}>
                        Last run: {formatDate(workflowStat.lastRun)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Box>
                        <Typography variant="body2" sx={{ color: '#8B949E' }}>Success Rate</Typography>
                        <Typography sx={{ color: '#23C562' }}>
                          {workflowStat.total ? (workflowStat.successful / workflowStat.total * 100).toFixed(1) : 0}%
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ color: '#8B949E' }}>Total Runs</Typography>
                        <Typography sx={{ color: '#E6EDF3' }}>
                          {workflowStat.total}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ color: '#8B949E' }}>Avg. Duration</Typography>
                        <Typography sx={{ color: '#E6EDF3' }}>
                          {formatDuration(workflowStat.durations.length ? workflowStat.durations.reduce((acc, curr) => acc + curr, 0) / workflowStat.durations.length : 0)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RepositoryView;