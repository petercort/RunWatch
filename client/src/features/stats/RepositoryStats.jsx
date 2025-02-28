import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Check as SuccessIcon,
  Close as FailureIcon,
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import apiService from '../../api/apiService';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const RepositoryStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await apiService.getWorkflowStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch workflow statistics. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !stats) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography color="error">{error || 'Statistics not available'}</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          sx={{ mt: 2 }} 
          onClick={fetchStats}
          startIcon={<RefreshIcon />}
        >
          Retry
        </Button>
      </Box>
    );
  }

  // Prepare chart data
  const successRateData = {
    labels: ['Successful', 'Failed'],
    datasets: [
      {
        data: [stats.successfulRuns, stats.failedRuns],
        backgroundColor: [
          'rgba(35, 197, 98, 0.6)',
          'rgba(248, 81, 73, 0.6)',
        ],
        borderColor: [
          'rgba(35, 197, 98, 1)',
          'rgba(248, 81, 73, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Repository stats chart data
  const repoLabels = stats.repoStats?.map(repo => repo._id) || [];
  const repoSuccessData = stats.repoStats?.map(repo => repo.successfulRuns) || [];
  const repoFailureData = stats.repoStats?.map(repo => repo.failedRuns) || [];

  const repoStatsData = {
    labels: repoLabels,
    datasets: [
      {
        label: 'Successful Runs',
        data: repoSuccessData,
        backgroundColor: 'rgba(35, 197, 98, 0.6)',
        borderColor: 'rgba(35, 197, 98, 1)',
        borderWidth: 1,
      },
      {
        label: 'Failed Runs',
        data: repoFailureData,
        backgroundColor: 'rgba(248, 81, 73, 0.6)',
        borderColor: 'rgba(248, 81, 73, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Recent activity trend simulation
  const today = new Date();
  const timeLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  });

  const trendData = {
    labels: timeLabels,
    datasets: [
      {
        label: 'Workflow Activity',
        data: timeLabels.map(() => Math.floor(Math.random() * (stats.totalRuns / 7)) + 1),
        borderColor: 'rgba(88, 166, 255, 1)',
        backgroundColor: 'rgba(88, 166, 255, 0.5)',
        tension: 0.4,
        fill: true,
      }
    ],
  };

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
          Workflow Statistics
        </Typography>
        <Tooltip title="Refresh">
          <IconButton 
            onClick={fetchStats}
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

      <Grid container spacing={3}>
        {/* Overview Cards */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#161B22', border: '1px solid rgba(240, 246, 252, 0.1)' }}>
            <CardContent>
              <Typography sx={{ color: '#8B949E' }} gutterBottom>
                Total Workflow Runs
              </Typography>
              <Typography variant="h3" sx={{ color: '#E6EDF3' }}>
                {stats.totalRuns}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#161B22', border: '1px solid rgba(240, 246, 252, 0.1)' }}>
            <CardContent>
              <Typography sx={{ color: '#8B949E' }} gutterBottom>
                Successful Runs
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SuccessIcon sx={{ color: '#23C562', mr: 1 }} />
                <Typography variant="h3" sx={{ color: '#E6EDF3' }}>
                  {stats.successfulRuns}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#161B22', border: '1px solid rgba(240, 246, 252, 0.1)' }}>
            <CardContent>
              <Typography sx={{ color: '#8B949E' }} gutterBottom>
                Failed Runs
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FailureIcon sx={{ color: '#F85149', mr: 1 }} />
                <Typography variant="h3" sx={{ color: '#E6EDF3' }}>
                  {stats.failedRuns}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Success Rate Chart */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ 
            p: 3, 
            height: '100%',
            bgcolor: '#161B22',
            borderRadius: '12px',
            border: '1px solid rgba(240, 246, 252, 0.1)'
          }}>
            <Typography variant="h6" sx={{ color: '#E6EDF3', mb: 2 }}>
              Success Rate
            </Typography>
            <Typography variant="subtitle1" sx={{ color: '#8B949E', mb: 3 }}>
              {parseFloat(stats.successRate).toFixed(1)}% Success Rate
            </Typography>
            <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
              <Pie data={successRateData} options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      color: '#8B949E'
                    }
                  }
                }
              }} />
            </Box>
          </Paper>
        </Grid>

        {/* Activity Trend Chart */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ 
            p: 3, 
            height: '100%',
            bgcolor: '#161B22',
            borderRadius: '12px',
            border: '1px solid rgba(240, 246, 252, 0.1)'
          }}>
            <Typography variant="h6" sx={{ color: '#E6EDF3', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon sx={{ mr: 1 }} />
                Weekly Activity
              </Box>
            </Typography>
            <Box sx={{ height: 300 }}>
              <Line
                data={trendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: {
                        color: 'rgba(240, 246, 252, 0.1)'
                      },
                      ticks: {
                        color: '#8B949E'
                      }
                    },
                    x: {
                      grid: {
                        color: 'rgba(240, 246, 252, 0.1)'
                      },
                      ticks: {
                        color: '#8B949E'
                      }
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Repository Stats */}
        {stats.repoStats && stats.repoStats.length > 0 && (
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ 
              p: 3,
              bgcolor: '#161B22',
              borderRadius: '12px',
              border: '1px solid rgba(240, 246, 252, 0.1)'
            }}>
              <Typography variant="h6" sx={{ color: '#E6EDF3', mb: 3 }}>
                Repository Statistics
              </Typography>
              <Box sx={{ height: 400 }}>
                <Bar
                  data={repoStatsData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: {
                          color: '#8B949E'
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: {
                          color: 'rgba(240, 246, 252, 0.1)'
                        },
                        ticks: {
                          color: '#8B949E'
                        }
                      },
                      x: {
                        grid: {
                          color: 'rgba(240, 246, 252, 0.1)'
                        },
                        ticks: {
                          color: '#8B949E'
                        }
                      }
                    }
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default RepositoryStats;