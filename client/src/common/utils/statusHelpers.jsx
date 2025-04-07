import React from 'react';
import QueuedIcon from '@mui/icons-material/PlayArrow';
import InProgressIcon from '@mui/icons-material/Pending';
import SuccessIcon from '@mui/icons-material/Check';
import FailureIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';

/**
 * Returns the appropriate icon component based on workflow status and conclusion
 */
export const getStatusIcon = (status, conclusion) => {
  if (status === 'completed') {
    switch (conclusion) {
      case 'success':
        return <SuccessIcon color="success" />;
      case 'failure':
        return <FailureIcon color="error" />;
      case 'cancelled':
      case 'skipped':
      case 'timed_out':
      case 'action_required':
        return <WarningIcon color="warning" />;
      default:
        return null;
    }
  }
  
  switch (status) {
    case 'queued':
      return <QueuedIcon color="info" />;
    case 'in_progress':
      return <InProgressIcon color="warning" />;  // Changed to warning for better visibility
    default:
      return null;
  }
};

/**
 * Returns the appropriate color for status indicators based on workflow status and conclusion
 */
export const getStatusColor = (status, conclusion) => {
  if (status === 'completed') {
    switch (conclusion) {
      case 'success':
        return 'success';
      case 'failure':
        return 'error';
      case 'cancelled':
      case 'skipped':
        return 'default';
      case 'timed_out':
        return 'error';
      case 'action_required':
        return 'warning';
      default:
        return 'default';
    }
  }
  
  switch (status) {
    case 'queued':
      return 'info';
    case 'in_progress':
      return 'warning';  // Changed to warning for better visibility
    default:
      return 'default';
  }
};

/**
 * Format duration between two dates in a human-readable format
 */
export const formatDuration = (start, end) => {
  // Handle direct millisecond duration input
  if (typeof start === 'number') {
    if (start === 0) return '0s';
    const duration = start;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Handle date string inputs
  if (!start || !end) return 'N/A';
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  const duration = endDate - startDate;

  if (duration < 0) return 'N/A';
  if (duration === 0) return '0s';

  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Format date to localized string
 */
export const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};