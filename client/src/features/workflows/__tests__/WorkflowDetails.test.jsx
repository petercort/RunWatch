import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowDetails from '../WorkflowDetails';
import apiService from '../../../api/apiService';
import { setupSocketListeners } from '../../../api/socketService';
import { mockNavigate } from 'react-router-dom';

// Mock the API service and socket service
jest.mock('../../../api/apiService', () => ({
  getWorkflowRunById: jest.fn()
}));

jest.mock('../../../api/socketService', () => ({
  setupSocketListeners: jest.fn()
}));

// react-router-dom is mocked in the __mocks__ directory
// No need to manually mock it here

describe('WorkflowDetails Component', () => {
  // Sample test data
  const mockWorkflow = {
    workflow: {
      id: 1,
      name: 'Test Workflow'
    },
    run: {
      id: 100,
      status: 'completed',
      conclusion: 'success',
      number: 42,
      created_at: '2025-04-01T10:00:00Z',
      updated_at: '2025-04-01T10:30:00Z',
      url: 'https://github.com/test-org/test-repo/actions/runs/100'
    },
    repository: {
      id: 201,
      fullName: 'test-org/test-repo',
      url: 'https://github.com/test-org/test-repo'
    },
    jobs: [
      {
        id: 1001,
        name: 'Build',
        status: 'completed',
        conclusion: 'success',
        started_at: '2025-04-01T10:05:00Z',
        completed_at: '2025-04-01T10:15:00Z',
        runner_name: 'ubuntu-latest',
        runner_group_name: 'GitHub Actions',
        runner_os: 'Linux',
        runner_image_version: '20.04',
        steps: [
          {
            number: 1,
            name: 'Set up repository',
            status: 'completed',
            conclusion: 'success',
            started_at: '2025-04-01T10:05:00Z',
            completed_at: '2025-04-01T10:06:00Z'
          },
          {
            number: 2,
            name: 'Install dependencies',
            status: 'completed',
            conclusion: 'success',
            started_at: '2025-04-01T10:06:00Z',
            completed_at: '2025-04-01T10:10:00Z'
          }
        ]
      },
      {
        id: 1002,
        name: 'Test',
        status: 'completed',
        conclusion: 'success',
        started_at: '2025-04-01T10:16:00Z',
        completed_at: '2025-04-01T10:25:00Z',
        runner_name: 'ubuntu-latest',
        runner_group_name: 'GitHub Actions',
        runner_os: 'Linux',
        runner_image_version: '20.04',
        steps: [
          {
            number: 1,
            name: 'Run tests',
            status: 'completed',
            conclusion: 'success',
            started_at: '2025-04-01T10:16:00Z',
            completed_at: '2025-04-01T10:25:00Z'
          }
        ]
      }
    ]
  };

  // Setup for each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock navigate
    mockNavigate.mockClear();
    
    // Mock API response
    apiService.getWorkflowRunById.mockResolvedValue(mockWorkflow);
    
    // Mock socket listener setup
    setupSocketListeners.mockReturnValue(jest.fn());
  });

  test('renders loading state initially', async () => {
    render(<WorkflowDetails />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiService.getWorkflowRunById).toHaveBeenCalledWith('100');
    });
  });

  test('displays workflow details after loading', async () => {
    render(<WorkflowDetails />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check workflow header
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText(/test-org\/test-repo.*Run #42/)).toBeInTheDocument();
    
    // Check status and metadata
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    
    // Check action buttons - using partial matching for flexibility
    expect(screen.getByRole('link', { name: /View on GitHub/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Repository/i })).toBeInTheDocument();
  });

  test('displays jobs section with job information', async () => {
    render(<WorkflowDetails />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check jobs section
    expect(screen.getByText('Jobs')).toBeInTheDocument();
    
    // Check job names - using findByRole to make sure jobs section is fully rendered
    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    
    // Check runner information using regex pattern to be more flexible
    const runnerTexts = screen.getAllByText(/Runner:/i);
    expect(runnerTexts.length).toBe(2);
  });

  test('expands job details when job row is clicked', async () => {
    render(<WorkflowDetails />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if job row exists
    const jobSection = screen.getByText('Build');
    expect(jobSection).toBeInTheDocument();
    
    // After clicking, we should see steps
    fireEvent.click(jobSection);
    
    // Verify steps are visible
    expect(screen.getByText('Set up repository')).toBeInTheDocument();
    expect(screen.getByText('Install dependencies')).toBeInTheDocument();
  });

  test('navigates back when back button is clicked', async () => {
    render(<WorkflowDetails />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Click the back button (icon button with tooltip "Back to Workflow History")
    // Use a more reliable selector since aria-label might not be explicitly set
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);
    
    // Verify navigation was called
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  test('handles error state when API call fails', async () => {
    // Mock API failure
    apiService.getWorkflowRunById.mockRejectedValue(new Error('Failed to fetch workflow'));
    
    render(<WorkflowDetails />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if error message is displayed
    expect(screen.getByText(/Failed to fetch workflow details/i)).toBeInTheDocument();
    
    // Check if back button is available
    const backButton = screen.getByText('Back');
    expect(backButton).toBeInTheDocument();
  });

  test('handles missing workflow data', async () => {
    // Mock API returning null
    apiService.getWorkflowRunById.mockResolvedValue(null);
    
    render(<WorkflowDetails />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if error message is displayed
    expect(screen.getByText('Workflow not found')).toBeInTheDocument();
  });
});