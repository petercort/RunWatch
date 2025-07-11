import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../common/theme/theme';
import RepositoryView from '../RepositoryView';
import apiService from '../../../api/apiService';
import { vi } from 'vitest';

// Mock the API service
vi.mock('../../../api/apiService', () => {
  return {
    default: {
      getRepoWorkflowRuns: vi.fn(),
      getQueuedWorkflows: vi.fn(),
      cancelAllQueuedWorkflowRuns: vi.fn()
    }
  };
});

// Mock socket service
vi.mock('../../../api/socketService', () => {
  return {
    setupSocketListeners: vi.fn(() => () => {})
  };
});

// Mock react-router-dom useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({
      repoName: 'test-owner%2Ftest-repo'
    }),
    useNavigate: () => vi.fn()
  };
});

// Mock chart.js
vi.mock('react-chartjs-2', () => ({
  Line: () => <div>Line Chart</div>,
  Bar: () => <div>Bar Chart</div>
}));

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

describe('Cancel All Queued Workflows Feature', () => {
  const mockRepository = {
    id: 1,
    name: 'test-repo',
    fullName: 'test-owner/test-repo',
    owner: {
      login: 'test-owner',
      url: 'https://github.com/test-owner'
    },
    url: 'https://github.com/test-owner/test-repo',
    workflows: []
  };

  const mockWorkflowRuns = [
    {
      repository: mockRepository,
      workflow: { id: 1, name: 'test-workflow', path: '.github/workflows/test.yml' },
      run: {
        id: 1,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        status: 'completed',
        conclusion: 'success'
      }
    }
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Mock the initial API calls
    apiService.getRepoWorkflowRuns.mockResolvedValue({
      data: mockWorkflowRuns,
      pagination: { total: 1, page: 1, pageSize: 1, totalPages: 1 }
    });
  });

  test('should render Cancel All Queued button', async () => {
    render(
      <TestWrapper>
        <RepositoryView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel All Queued')).toBeInTheDocument();
    });
  });

  test('should show confirmation dialog when Cancel All Queued is clicked', async () => {
    const mockQueuedWorkflows = [
      {
        repository: { fullName: 'test-owner/test-repo' },
        run: { id: 1, status: 'queued' }
      },
      {
        repository: { fullName: 'test-owner/test-repo' },
        run: { id: 2, status: 'queued' }
      }
    ];

    apiService.getQueuedWorkflows.mockResolvedValue(mockQueuedWorkflows);

    render(
      <TestWrapper>
        <RepositoryView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel All Queued')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel All Queued');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText('Cancel All Queued Workflow Runs')).toBeInTheDocument();
      expect(screen.getByText('This will cancel 2 queued runs, this cannot be undone!')).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  test('should handle case when no queued workflows exist', async () => {
    apiService.getQueuedWorkflows.mockResolvedValue([]);

    render(
      <TestWrapper>
        <RepositoryView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel All Queued')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel All Queued');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText('No queued workflow runs found for this repository.')).toBeInTheDocument();
    });
  });

  test('should close dialog when Back button is clicked', async () => {
    const mockQueuedWorkflows = [
      {
        repository: { fullName: 'test-owner/test-repo' },
        run: { id: 1, status: 'queued' }
      }
    ];

    apiService.getQueuedWorkflows.mockResolvedValue(mockQueuedWorkflows);

    render(
      <TestWrapper>
        <RepositoryView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel All Queued')).toBeInTheDocument();
    });

    // Open dialog
    const cancelButton = screen.getByText('Cancel All Queued');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText('Cancel All Queued Workflow Runs')).toBeInTheDocument();
    });

    // Click Back button
    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.queryByText('Cancel All Queued Workflow Runs')).not.toBeInTheDocument();
    });
  });

  test('should call API to cancel workflows when Confirm is clicked', async () => {
    const mockQueuedWorkflows = [
      {
        repository: { fullName: 'test-owner/test-repo' },
        run: { id: 1, status: 'queued' }
      }
    ];

    const mockCancelResult = {
      totalQueued: 1,
      cancelled: 1,
      failed: 0,
      cancelledRuns: [],
      failedRuns: []
    };

    apiService.getQueuedWorkflows.mockResolvedValue(mockQueuedWorkflows);
    apiService.cancelAllQueuedWorkflowRuns.mockResolvedValue(mockCancelResult);

    render(
      <TestWrapper>
        <RepositoryView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel All Queued')).toBeInTheDocument();
    });

    // Open dialog
    const cancelButton = screen.getByText('Cancel All Queued');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText('Cancel All Queued Workflow Runs')).toBeInTheDocument();
    });

    // Click Confirm button
    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiService.cancelAllQueuedWorkflowRuns).toHaveBeenCalledWith('test-owner/test-repo');
    });
  });
});