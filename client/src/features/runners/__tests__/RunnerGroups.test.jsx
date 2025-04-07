import React from 'react';
import { render, screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import RunnerGroups from '../RunnerGroups';
import apiService from '../../../api/apiService';
import { vi } from 'vitest';

// Mock the API service
vi.mock('../../../api/apiService', () => {
  return {
    default: {
      getOrganizations: vi.fn(),
      getAllRunnerGroups: vi.fn(),
      getRepositories: vi.fn(),
      getSelfHostedRunners: vi.fn(),
      getGitHubHostedRunners: vi.fn(),
    }
  };
});

describe('RunnerGroups Component', () => {
  // Sample test data
  const mockOrganizations = [
    { id: 1, account: { login: 'test-org-1' } },
    { id: 2, account: { login: 'test-org-2' } },
  ];

  const mockRunnerGroups = {
    enterprise: [
      { 
        id: 1, 
        name: 'Enterprise Group 1', 
        visibility: 'all', 
        default: true, 
        allows_public_repositories: true,
        runners_count: 5,
        enterprise: 'Test Enterprise'
      }
    ],
    organization: [
      {
        id: 2,
        name: 'Org Group 1',
        visibility: 'selected',
        default: false,
        allows_public_repositories: false,
        runners_count: 3,
        organization: 'test-org-1',
        inherited: false
      },
      {
        id: 3,
        name: 'Org Group 2',
        visibility: 'all',
        default: true,
        allows_public_repositories: true,
        runners_count: 2,
        organization: 'test-org-2',
        inherited: false
      }
    ]
  };

  const mockRepositories = [
    { id: 101, name: 'repo-1' },
    { id: 102, name: 'repo-2' }
  ];

  const mockSelfHostedRunners = [
    { 
      id: '201', 
      name: 'self-hosted-1', 
      status: 'online', 
      os: 'Linux', 
      busy: false,
      ephemeral: false,
      runner_group_id: 2,
      runner_group_name: 'Org Group 1',
      labels: [{ id: 1, name: 'self-hosted', type: 'read-only' }, { id: 2, name: 'linux', type: 'custom' }],
      level: 'repository',
      organization: 'test-org-1',
      repository: 'repo-1'
    }
  ];

  const mockGitHubHostedRunners = [
    { 
      id: '301', 
      name: 'github-hosted-1', 
      status: 'Ready', 
      platform: 'ubuntu-latest', 
      runner_group_id: 3,
      runner_group_name: 'Org Group 2',
      machine_size_details: { cpu_cores: 4, memory_gb: 16 },
      level: 'repository',
      organization: 'test-org-1',
      repository: 'repo-1'
    }
  ];

  // Setup for each test
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Default mock implementations
    apiService.getOrganizations.mockResolvedValue({ data: mockOrganizations });
    
    apiService.getAllRunnerGroups.mockResolvedValue({
      enterprise: mockRunnerGroups.enterprise,
      organization: mockRunnerGroups.organization
    });
    
    apiService.getRepositories.mockResolvedValue(mockRepositories);
    apiService.getSelfHostedRunners.mockResolvedValue(mockSelfHostedRunners);
    apiService.getGitHubHostedRunners.mockResolvedValue(mockGitHubHostedRunners);
  });

  test('renders loading state initially', async () => {
    render(<RunnerGroups />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiService.getOrganizations).toHaveBeenCalledTimes(1);
      expect(apiService.getAllRunnerGroups).toHaveBeenCalledTimes(1);
    });
  });

  test('displays organizations in dropdown after loading', async () => {
    render(<RunnerGroups />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Click on the dropdown
    fireEvent.mouseDown(screen.getByLabelText('Organization'));
    
    // Get the dropdown menu
    const dropdown = screen.getByRole('listbox');
    
    // Check if organizations are displayed within the dropdown
    expect(within(dropdown).getByText(/All Organizations/i)).toBeInTheDocument();
    expect(within(dropdown).getByText('test-org-1')).toBeInTheDocument();
    expect(within(dropdown).getByText('test-org-2')).toBeInTheDocument();
  });

  test('displays enterprise runner groups', async () => {
    render(<RunnerGroups />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check for enterprise group headers
    expect(screen.getByText('Enterprise Runner Groups')).toBeInTheDocument();
    expect(screen.getByText('Test Enterprise')).toBeInTheDocument();
    
    // Check for specific group data
    expect(screen.getByText('Enterprise Group 1')).toBeInTheDocument();
    // Find the chip with "All repositories" text
    expect(screen.getAllByText('All repositories')[0]).toBeInTheDocument();
  });

  test('displays organization runner groups', async () => {
    render(<RunnerGroups />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check for organization group headers
    expect(screen.getByText('Organization Runner Groups')).toBeInTheDocument();
    // For organization names, use queryAllByText and check specific ones
    const orgElements = screen.getAllByText(/test-org-/);
    expect(orgElements.length).toBeGreaterThan(0);
    
    // Check for specific group data
    expect(screen.getByText('Org Group 1')).toBeInTheDocument();
    expect(screen.getByText('Selected repositories')).toBeInTheDocument();
    expect(screen.getByText('Org Group 2')).toBeInTheDocument();
  });

  test('shows repository dropdown when organization is selected', async () => {
    render(<RunnerGroups />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Select an organization
    fireEvent.mouseDown(screen.getByLabelText('Organization'));
    
    // Get the dropdown menu and find the specific org
    const dropdown = screen.getByRole('listbox');
    const orgOption = within(dropdown).getByText('test-org-1');
    fireEvent.click(orgOption);
    
    // Check if repository dropdown appears
    await waitFor(() => {
      expect(screen.getByLabelText('Repository')).toBeInTheDocument();
    });
    
    // Verify API calls
    expect(apiService.getRepositories).toHaveBeenCalledWith('test-org-1', 1);
  });

  test('displays repository runners when repo is selected', async () => {
    render(<RunnerGroups />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Select an organization
    fireEvent.mouseDown(screen.getByLabelText('Organization'));
    
    // Get the dropdown menu and find the specific org
    const dropdown = screen.getByRole('listbox');
    const orgOption = within(dropdown).getByText('test-org-1');
    fireEvent.click(orgOption);
    
    // Wait for repository dropdown to appear
    await waitFor(() => {
      expect(screen.getByLabelText('Repository')).toBeInTheDocument();
    });
    
    // Select a repository
    fireEvent.mouseDown(screen.getByLabelText('Repository'));
    const repoDropdown = screen.getByRole('listbox');
    fireEvent.click(within(repoDropdown).getByText('repo-1'));
    
    // Check if runner sections appear
    await waitFor(() => {
      expect(screen.getByText(/Self-Hosted Runners for repo-1/)).toBeInTheDocument();
      expect(screen.getByText(/GitHub-Hosted Runners/)).toBeInTheDocument();
    });
    
    // Check if specific runner data appears
    expect(screen.getByText('self-hosted-1')).toBeInTheDocument();
    expect(screen.getByText('github-hosted-1')).toBeInTheDocument();
  });

  test('expands group details when view details button is clicked', async () => {
    render(<RunnerGroups />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Find and click the view details button
    const viewDetailsButtons = screen.getAllByText('View Details');
    fireEvent.click(viewDetailsButtons[0]); // Click the first View Details button
    
    // Check if the details are displayed
    await waitFor(() => {
      expect(screen.getByText('Group Information')).toBeInTheDocument();
    });
    
    // Check if runners section is displayed in the accordion header
    const runnersAccordionText = screen.getAllByText(/Runners/i)[0];
    expect(runnersAccordionText).toBeInTheDocument();
  });

  test('handles error state when API calls fail', async () => {
    // Mock API failure
    apiService.getOrganizations.mockRejectedValue(new Error('Failed to fetch organizations'));
    
    render(<RunnerGroups />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if error message is displayed
    expect(screen.getByText(/Failed to fetch organizations/)).toBeInTheDocument();
  });

  test('handles empty runner groups', async () => {
    // Mock empty runner groups
    apiService.getAllRunnerGroups.mockResolvedValue({
      enterprise: [],
      organization: []
    });
    
    render(<RunnerGroups />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if empty state message is displayed
    expect(screen.getByText(/No runner groups found/)).toBeInTheDocument();
  });
});