import React from 'react';
import { Chip, keyframes } from '@mui/material';
import {
  PlayCircle as QueuedIcon,
  RotateRight as InProgressIcon,
  CheckCircle as SuccessIcon,
  Cancel as FailureIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
`;

const StatusChip = ({ status, conclusion }) => {
  const commonStyles = {
    height: '24px',
    '& .MuiChip-label': {
      px: 1.5,
      py: 0.5,
      fontWeight: 500,
      fontSize: '0.75rem',
      lineHeight: 1
    },
    '& .MuiChip-icon': {
      ml: 0.5,
      fontSize: '1rem'
    }
  };

  // Handle active states first
  if (['in_progress', 'queued', 'waiting', 'pending', 'requested'].includes(status)) {
    const label = status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const icon = status === 'in_progress' ? <InProgressIcon /> :
                 status === 'queued' ? <QueuedIcon /> : 
                 <WarningIcon />;

    return (
      <Chip 
        icon={icon}
        label={label}
        size="small"
        sx={{
          ...commonStyles,
          bgcolor: 'rgba(245, 159, 0, 0.15)',
          color: '#F5A623',
          border: '1px solid rgba(245, 159, 0, 0.2)',
          '& .MuiChip-icon': {
            color: '#F5A623',
            ...(status === 'in_progress' && {
              animation: `${rotate} 2s linear infinite`
            })
          },
          '& .MuiChip-label': {
            ...commonStyles['& .MuiChip-label'],
            ...(status === 'in_progress' && {
              animation: `${pulse} 2s ease-in-out infinite`
            })
          }
        }}
      />
    );
  }

  if (status === 'completed') {
    switch (conclusion) {
      case 'success':
        return (
          <Chip 
            icon={<SuccessIcon />} 
            label="Success" 
            size="small"
            sx={{
              ...commonStyles,
              bgcolor: 'rgba(35, 197, 98, 0.15)',
              color: '#23C562',
              border: '1px solid rgba(35, 197, 98, 0.2)',
              '& .MuiChip-icon': {
                color: '#23C562'
              }
            }}
          />
        );
      case 'failure':
        return (
          <Chip 
            icon={<FailureIcon />} 
            label="Failed" 
            size="small"
            sx={{
              ...commonStyles,
              bgcolor: 'rgba(248, 81, 73, 0.15)',
              color: '#F85149',
              border: '1px solid rgba(248, 81, 73, 0.2)',
              '& .MuiChip-icon': {
                color: '#F85149'
              }
            }}
          />
        );
      case 'cancelled':
      case 'skipped':
        return (
          <Chip 
            icon={<WarningIcon />} 
            label={conclusion === 'cancelled' ? 'Cancelled' : 'Skipped'} 
            size="small"
            sx={{
              ...commonStyles,
              bgcolor: 'rgba(139, 148, 158, 0.15)',
              color: '#8B949E',
              border: '1px solid rgba(139, 148, 158, 0.2)',
              '& .MuiChip-icon': {
                color: '#8B949E'
              }
            }}
          />
        );
      case 'timed_out':
      case 'action_required':
        return (
          <Chip 
            icon={<WarningIcon />} 
            label={conclusion === 'timed_out' ? 'Timed Out' : 'Action Required'} 
            size="small"
            sx={{
              ...commonStyles,
              bgcolor: 'rgba(245, 159, 0, 0.15)',
              color: '#F5A623',
              border: '1px solid rgba(245, 159, 0, 0.2)',
              '& .MuiChip-icon': {
                color: '#F5A623'
              }
            }}
          />
        );
      default:
        return (
          <Chip 
            label={conclusion || 'Unknown'} 
            size="small"
            sx={{
              ...commonStyles,
              bgcolor: 'rgba(139, 148, 158, 0.15)',
              color: '#8B949E',
              border: '1px solid rgba(139, 148, 158, 0.2)'
            }}
          />
        );
    }
  }

  // Default case for any other status
  return (
    <Chip 
      label={status || 'Pending'}
      size="small"
      sx={{
        ...commonStyles,
        bgcolor: 'rgba(139, 148, 158, 0.15)',
        color: '#8B949E',
        border: '1px solid rgba(139, 148, 158, 0.2)'
      }}
    />
  );
};

export default StatusChip;