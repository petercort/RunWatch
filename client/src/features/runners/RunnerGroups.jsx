import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import { 
  Computer as ComputerIcon, 
  Groups as GroupsIcon, 
  Business as BusinessIcon,
  Description as DescriptionIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Hub as HubIcon,
  Engineering as EngineeringIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import apiService from '../../api/apiService';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

const ALL_ORGS_VALUE = '__all_organizations__';

const RunnerGroups = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(ALL_ORGS_VALUE);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [runnerGroups, setRunnerGroups] = useState({
    enterprise: {},
    organization: {},
  });
  // State for all organizations' runner groups from database
  const [allRunnerGroups, setAllRunnerGroups] = useState({
    enterprise: {},
    organization: {}
  });
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // New state for repository runners
  const [selfHostedRunners, setSelfHostedRunners] = useState([]);
  const [githubHostedRunners, setGithubHostedRunners] = useState([]);
  const [isLoadingRepoRunners, setIsLoadingRepoRunners] = useState(false);
  
  // Add new state to store repositories (needed for group details)
  const [allRepositories, setAllRepositories] = useState([]);

  // Add state to track expanded rows
  const [expandedGroups, setExpandedGroups] = useState({});

  // Add new state to store all preloaded runner details
  const [preloadedRunnerDetails, setPreloadedRunnerDetails] = useState({});
  const [isPreloadingRunners, setIsPreloadingRunners] = useState(false);

  // Replace single groupDetails with a map of all expanded group details
  const [groupDetailsMap, setGroupDetailsMap] = useState({});
  // Keep detailsLoading as a map as well to track loading status for each group
  const [detailsLoadingMap, setDetailsLoadingMap] = useState({});

  // Fetch organizations on component mount
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setLoading(true);
        const response = await apiService.getOrganizations();

        if (!response || !response.data || response.data.length === 0) {
          console.warn('No organizations found or invalid response format');
          setError('No GitHub organizations found. Please check your GitHub App configuration.');
          setOrganizations([]);
          setLoading(false);
          return;
        }

        setOrganizations(response.data);
        setError(null);

        // Fetch all runner groups by default
        await fetchAllRunnerGroups();
      } catch (err) {
        console.error('Error fetching organizations:', err);
        setError('Failed to fetch organizations. Please check your GitHub App configuration.');
        setOrganizations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  // Fetch runner groups when org/repo selection changes
  useEffect(() => {
    if (selectedOrg === ALL_ORGS_VALUE) {
      fetchAllRunnerGroups();
    } else if (selectedOrg) {
      fetchRunnerGroups();
    } 
  }, [selectedOrg]);

  useEffect(() => {
    if (selectedRepo) {
      fetchRepoRunners();
    }
  }, [selectedRepo]);

  // Fetch all runner groups from database
  const fetchAllRunnerGroups = async () => {
    try {
      setIsLoadingGroups(true);
      setError(null);
      
      const runnerGroups = await apiService.getAllRunnerGroups();
      
      // Format the data for display
      const formattedGroups = {
        enterprise: {},
        organization: {}
      };
      
      // Group enterprise runner groups by enterprise
      runnerGroups.enterprise.forEach(group => {
        const enterpriseName = group.enterprise || 'Unknown Enterprise';
        if (!formattedGroups.enterprise[enterpriseName]) {
          formattedGroups.enterprise[enterpriseName] = [];
        }
        formattedGroups.enterprise[enterpriseName].push(group);
      });
      
      // Group organization runner groups by organization, filtering out inherited ones
      runnerGroups.organization.forEach(group => {
        // Skip inherited groups if we're displaying by organization
        if (group.inherited) return;
        
        const orgName = group.organization || 'Unknown Organization';
        if (!formattedGroups.organization[orgName]) {
          formattedGroups.organization[orgName] = [];
        }
        formattedGroups.organization[orgName].push(group);
      });
      
      setAllRunnerGroups(formattedGroups);
    } catch (err) {
      setError(`Failed to fetch runner groups: ${err.message}`);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const fetchRunnerGroups = async () => {
    try {
      setIsLoadingGroups(true);
      setError(null);
      let orgGroups = allRunnerGroups.organization[selectedOrg] || [];
      
      // Filter out inherited groups from enterprise for organization display
      orgGroups = orgGroups.filter(group => !group.inherited);
      
      // Set the filtered groups in the state for rendering
      setRunnerGroups({
        enterprise: {},
        organization: {[selectedOrg]: orgGroups}
      });
      // Also fetch runners for this organization (keep this part)
      await fetchOrganizationRunners(selectedOrg);
    } catch (err) {
      setError(`Failed to filter runner groups: ${err.message}`);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // Fetch repository runners with improved data linkage to groups
  const fetchRepoRunners = async () => {
    try {
      setIsLoadingRepoRunners(true);
      setError(null); 
      const options = {};
      if (selectedRepo) {
        options.repository = selectedRepo;
        options.level = 'repository';
        options.organization = selectedOrg; // Add organization context for better filtering
      }
      
      // Fetch both types of runners for this repository
      const [selfHostedRunnerData, githubHostedRunnersData] = await Promise.all([
        apiService.getSelfHostedRunners(options),
        apiService.getGitHubHostedRunners(options)
      ]);
      
      // Clear preloaded runner details when repository changes
      setPreloadedRunnerDetails({});
      
      // Store runners in state
      setSelfHostedRunners(selfHostedRunnerData);
      setGithubHostedRunners(githubHostedRunnersData);
      
    } catch (err) {
      setError(`Failed to fetch repository runners: ${err.message}`);
    } finally {
      setIsLoadingRepoRunners(false);
    }
  };

  // Handle org selection change
  const handleOrgChange = (event) => {
    const orgName = event.target.value;
    setSelectedOrg(orgName);
    setSelectedRepo(''); // Reset repository selection
    
    if (orgName && orgName !== ALL_ORGS_VALUE) {
      // Fetch repositories for a specific organization
      const orgInstallation = organizations.find(org => org.account.login === orgName);
      if (orgInstallation) {
        setLoading(true);
        apiService.getRepositories(orgName, orgInstallation.id)
          .then(repos => {
            setRepositories(repos);
            setAllRepositories(repos); // Store repositories for group details
            fetchOrganizationRunners(orgName); // Also fetch runners for this organization
            setLoading(false);
          })
          .catch(err => {
            console.error(`Failed to fetch repositories for ${orgName}:`, err);
            setError(`Failed to fetch repositories: ${err.message}`);
            setRepositories([]);
            setAllRepositories([]);
            setLoading(false);
          });
      }
    } else {
      setRepositories([]); // Reset repositories list
      setAllRepositories([]);
      setSelfHostedRunners([]); // Clear runner lists
      setGithubHostedRunners([]);
    }
  };

  // Fetch all runners for an organization
  const fetchOrganizationRunners = async (orgName) => {
    try {
      setIsLoadingRepoRunners(true);
      setPreloadedRunnerDetails({}); // Clear preloaded data when org changes
      
      // Fetch self-hosted runners
      const selfHostedResponse = await apiService.getSelfHostedRunners({
        organization: orgName
      });
      setSelfHostedRunners(selfHostedResponse || []);
      
      // Fetch GitHub-hosted runners
      const githubHostedResponse = await apiService.getGitHubHostedRunners({
        organization: orgName
      });
      setGithubHostedRunners(githubHostedResponse || []);
      
      setError(null);
    } catch (err) {
      console.error(`Failed to fetch runners for ${orgName}:`, err);
      setError(`Failed to fetch runners: ${err.message}`);
    } finally {
      setIsLoadingRepoRunners(false);
    }
  };

  // Enhanced function to find runners for a specific group, optimized for repo context
  const getRunnersForGroup = (groupId, categoryName) => {
    const groupKey = `${categoryName}-${groupId}`;
    
    // Try to get from preloaded data first
    if (preloadedRunnerDetails[groupKey]) {
      return preloadedRunnerDetails[groupKey].runners || [];
    }
    
    // Convert groupId to string for consistent comparison
    const groupIdString = String(groupId);
    
    // Get group details to help with matching
    const groupDetails = findGroupById(groupIdString);
    const groupName = groupDetails?.name;
    
    // Filter self-hosted runners
    const groupSelfHostedRunners = selfHostedRunners.filter(runner => {
      // Improved matching logic with multiple fallbacks
      const runnerGroupId = runner.runner_group_id || runner.group_id || runner.runner_group;
      const runnerGroupName = runner.runner_group_name;
      
      // Direct ID match
      if (runnerGroupId && String(runnerGroupId) === groupIdString) {
        return true;
      }
      
      // Name match as fallback (especially for repository context)
      if (runnerGroupName && groupName && runnerGroupName === groupName) {
        return true;
      }
      
      // If we're in a repository context and the group is default or has 'all' visibility
      if (selectedRepo && 
          groupDetails && 
         (groupDetails.default === true || groupDetails.visibility === 'all')) {
        // Default group might contain runners without explicit group assignment
        return !runner.runner_group_id && !runner.group_id && !runner.runner_group;
      }
      
      return false;
    });
    
    // Filter GitHub-hosted runners with similar logic
    const groupGitHubHostedRunners = githubHostedRunners.filter(runner => {
      const runnerGroupId = runner.runner_group_id || runner.group_id || runner.runner_group;
      const runnerGroupName = runner.runner_group_name;
      
      if (runnerGroupId && String(runnerGroupId) === groupIdString) {
        return true;
      }
      
      if (runnerGroupName && groupName && runnerGroupName === groupName) {
        return true;
      }
      
      if (selectedRepo && 
          groupDetails && 
         (groupDetails.default === true || groupDetails.visibility === 'all')) {
        return !runner.runner_group_id && !runner.group_id && !runner.runner_group;
      }
      
      return false;
    });
    
    return [...groupSelfHostedRunners, ...groupGitHubHostedRunners];
  };

  // Helper function to find a group by its ID
  const findGroupById = (groupId) => {
    // Search in both enterprise and organization groups
    for (const [enterpriseName, groups] of Object.entries(allRunnerGroups.enterprise)) {
      const found = groups.find(g => String(g.id) === String(groupId));
      if (found) return found;
    }
    
    for (const [orgName, groups] of Object.entries(allRunnerGroups.organization)) {
      const found = groups.find(g => String(g.id) === String(groupId));
      if (found) return found;
    }
    
    return null;
  };

  // Get repositories for a runner group based on visibility setting
  const getRepositoriesForGroup = (group, organizationName) => {
    // If visibility is "all", the group applies to all repositories in the organization
    if (group.visibility === 'all') {
      return allRepositories;
    }
    
    // If visibility is "selected", filter to repositories that match the group's allowed_repositories IDs
    // This is a simplified approach - in a real app, you might need to make an API call for this
    // if the allowed_repositories IDs aren't available locally
    if (group.allowed_repositories && group.allowed_repositories.length > 0) {
      return allRepositories.filter(repo => 
        group.allowed_repositories.includes(repo.id)
      );
    }
    
    // Default to empty array if no matches or data not available
    return [];
  };

  // Toggle expansion for a specific group
  const toggleGroupExpansion = (categoryName, groupId, ownerName = null) => {
    const groupKey = `${categoryName}-${groupId}`;
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));

    // Only proceed if we're expanding and don't already have details
    if (!expandedGroups[groupKey]) {
      try {
        if (preloadedRunnerDetails[groupKey]) {
          // Use preloaded data if available
          setGroupDetailsMap(prev => ({
            ...prev,
            [groupKey]: preloadedRunnerDetails[groupKey]
          }));
        } else {
          // For repository context, ensure we get the most up-to-date data
          if (selectedRepo) {
            // Force fresh data load for repository context
            setDetailsLoadingMap(prev => ({ ...prev, [groupKey]: true }));
            
            // Find the group
            const group = findGroupById(groupId);
            if (group) {
              // Get runners with enhanced detection
              const runners = getRunnersForGroup(groupId, categoryName);
              const repositories = getRepositoriesForGroup(group, selectedOrg);
              
              // Create details object
              const details = {
                ...group,
                runners,
                repositories,
                level: categoryName,
                groupId,
                organization: selectedOrg
              };
              
              // Update state
              setPreloadedRunnerDetails(prev => ({
                ...prev,
                [groupKey]: details
              }));
              
              setGroupDetailsMap(prev => ({
                ...prev,
                [groupKey]: details
              }));
              
              // Set loading to false when done
              setDetailsLoadingMap(prev => ({ ...prev, [groupKey]: false }));
            } else {
              // Fallback to standard handler if group not found locally
              handleViewDetails(categoryName, groupId, ownerName || 
                (categoryName === 'organization' && selectedOrg !== ALL_ORGS_VALUE ? selectedOrg : null));
            }
          } else {
            // Use standard handler for non-repository context
            handleViewDetails(categoryName, groupId, ownerName || 
              (categoryName === 'organization' && selectedOrg !== ALL_ORGS_VALUE ? selectedOrg : null));
          }
        }
      } catch (err) {
        console.error('Error in toggleGroupExpansion:', err);
        // Ensure loading indicator is removed on error
        setDetailsLoadingMap(prev => ({ ...prev, [groupKey]: false }));
      }
    }
  };

  // View group details - updated to store multiple group details
  const handleViewDetails = async (categoryName, groupId, specificOrg = null) => {
    const groupKey = `${categoryName}-${groupId}`;
    
    try {
      // Set loading state for this specific group
      setDetailsLoadingMap(prev => ({
        ...prev,
        [groupKey]: true
      }));
      setError(null);
      
      // Check if we already have preloaded data
      if (preloadedRunnerDetails[groupKey]) {
        setGroupDetailsMap(prev => ({
          ...prev,
          [groupKey]: preloadedRunnerDetails[groupKey]
        }));
        setDetailsLoadingMap(prev => ({
          ...prev,
          [groupKey]: false
        }));
        return;
      }
      
      let group = null;
      
      // When viewing details from "All Organizations" view, we need to handle differently
      if (selectedOrg === ALL_ORGS_VALUE) {
        // Search in enterprise groups
        if (categoryName === 'enterprise') {
          for (const [enterpriseName, groups] of Object.entries(allRunnerGroups.enterprise)) {
            const found = groups.find(g => g.id === groupId);
            if (found) {
              group = found;
              break;
            }
          }
        } 
        // Search in organization groups
        else if (categoryName === 'organization') {
          // If specificOrg is provided, look only in that organization
          if (specificOrg) {
            const orgGroups = allRunnerGroups.organization[specificOrg] || [];
            group = orgGroups.find(g => g.id === groupId);
          } 
          // Otherwise search all organizations
          else {
            for (const [orgName, groups] of Object.entries(allRunnerGroups.organization)) {
              const found = groups.find(g => g.id === groupId);
              if (found) {
                group = found;
                specificOrg = orgName; // Set the organization name for later use
                break;
              }
            }
          }
        }
      } 
      // For specific organization view
      else {
        const orgName = specificOrg || selectedOrg;
        
        if (categoryName === 'enterprise') {
          // Find in enterprise runner groups
          const enterpriseGroups = allRunnerGroups.enterprise;
          for (const [enterpriseName, groups] of Object.entries(enterpriseGroups)) {
            const found = groups.find(g => g.id === groupId);
            if (found) {
              group = found;
              break;
            }
          }
        } else {
          // Find in organization runner groups
          const orgGroups = allRunnerGroups.organization[orgName] || [];
          group = orgGroups.find(g => g.id === groupId);
        }
      }
      
      if (!group) {
        console.error(`Runner group not found. Category: ${categoryName}, ID: ${groupId}, Org: ${specificOrg || 'not specified'}`);
        throw new Error(`Runner group with ID ${groupId} not found.`);
      }
      
      // Fetch all runners for this organization if we're in "All Organizations" view
      // to ensure we have the complete data set for filtering
      if (selectedOrg === ALL_ORGS_VALUE && specificOrg) {
        // Temporarily fetch the organization's runners
        const fetchRunnersPromise = Promise.all([
          apiService.getSelfHostedRunners({ organization: specificOrg }),
          apiService.getGitHubHostedRunners({ organization: specificOrg })
        ])
          .then(([selfHosted, githubHosted]) => {
            // Temporarily store these runners for filtering
            const allSelfHosted = [...(selfHosted || []), ...selfHostedRunners];
            const allGithubHosted = [...(githubHosted || []), ...githubHostedRunners];
            
            // Get runners for this group using the combined data
            const groupSelfHostedRunners = allSelfHosted.filter(runner => {
              const runnerGroupId = runner.runner_group_id || runner.group_id || runner.runner_group;
              const matchesId = runnerGroupId && String(runnerGroupId) === String(groupId);
              
              // Also check by name if ID doesn't match
              if (!matchesId && runner.runner_group_name && group.name) {
                return runner.runner_group_name === group.name;
              }
              
              return matchesId;
            });
            
            const groupGithubHostedRunners = allGithubHosted.filter(runner => {
              const runnerGroupId = runner.runner_group_id || runner.group_id || runner.runner_group;
              const matchesId = runnerGroupId && String(runnerGroupId) === String(groupId);
              
              // Also check by name if ID doesn't match
              if (!matchesId && runner.runner_group_name && group.name) {
                return runner.runner_group_name === group.name;
              }
              
              return matchesId;
            });
            
            // Set group details for display
            const details = {
              ...group,
              runners: [...groupSelfHostedRunners, ...groupGithubHostedRunners],
              repositories: getRepositoriesForGroup(group, specificOrg),
              level: categoryName,
              groupId,
              organization: specificOrg
            };
            
            // Store in preloaded data for future use
            setPreloadedRunnerDetails(prev => ({
              ...prev,
              [groupKey]: details
            }));
            
            setGroupDetailsMap(prev => ({
              ...prev,
              [groupKey]: details
            }));
            setDetailsLoadingMap(prev => ({
              ...prev,
              [groupKey]: false
            }));
          })
          .catch(err => {
            console.error("Error fetching organization runners:", err);
            // Continue with existing data
            const runners = getRunnersForGroup(groupId);
            const details = {
              ...group,
              runners,
              repositories: getRepositoriesForGroup(group, specificOrg),
              level: categoryName,
              groupId,
              organization: specificOrg
            };
            
            // Store in preloaded data for future use
            setPreloadedRunnerDetails(prev => ({
              ...prev,
              [groupKey]: details
            }));
            
            setGroupDetailsMap(prev => ({
              ...prev,
              [groupKey]: details
            }));
            setDetailsLoadingMap(prev => ({
              ...prev,
              [groupKey]: false
            }));
          });
          
        return; // Exit early as we're handling this asynchronously
      }
      
      // For normal case when not in "All Organizations" view
      const runners = getRunnersForGroup(groupId, categoryName);
      
      // Get repositories for this group
      const repositories = getRepositoriesForGroup(group, specificOrg || selectedOrg);
      
      // Set group details for display
      const details = {
        ...group,
        runners,
        repositories,
        level: categoryName,
        groupId,
        organization: specificOrg || selectedOrg
      };
      
      // Store in preloaded data for future use
      setPreloadedRunnerDetails(prev => ({
        ...prev,
        [groupKey]: details
      }));
      
      setGroupDetailsMap(prev => ({
        ...prev,
        [groupKey]: details
      }));
    } catch (err) {
      console.error('Error in handleViewDetails:', err);
      setError(`Failed to fetch runner group details: ${err.message}`);
    } finally {
      // Update loading state for only this group
      setDetailsLoadingMap(prev => ({
        ...prev,
        [groupKey]: false
      }));
    }
  };

  // New function to preload all runner groups and their runners
  const preloadAllRunnerData = async () => {
    if (isPreloadingRunners) return;
    
    try {
      setIsPreloadingRunners(true);
      const details = {};
      
      // Function to process organization runner groups
      const processOrgGroups = async (orgName, groups) => {
        // Fetch all runners for this organization if not already loaded
        let orgSelfHostedRunners = selfHostedRunners;
        let orgGitHubHostedRunners = githubHostedRunners;
        
        // Only fetch runners if we're in All Organizations view or 
        // if this is not the currently selected organization
        if ((selectedOrg === ALL_ORGS_VALUE || orgName !== selectedOrg)) {
          try {
            [orgSelfHostedRunners, orgGitHubHostedRunners] = await Promise.all([
              apiService.getSelfHostedRunners({ organization: orgName }),
              apiService.getGitHubHostedRunners({ organization: orgName })
            ]);
          } catch (error) {
            console.error(`Failed to fetch runners for ${orgName}:`, error);
          }
        }
        
        // Process each group in this organization
        for (const group of groups) {
          const groupId = group.id;
          const groupKey = `organization-${groupId}`;
          
          // Skip if we already processed this group
          if (details[groupKey]) continue;
          
          // Get runners for this group
          const allOrgRunners = [...(orgSelfHostedRunners || []), ...(orgGitHubHostedRunners || [])];
          const runnersForGroup = filterRunnersForGroup(allOrgRunners, groupId, group);
          const repositories = getRepositoriesForGroup(group, orgName);
          
          // Store group details
          details[groupKey] = {
            ...group,
            runners: runnersForGroup,
            repositories,
            level: 'organization',
            groupId,
            organization: orgName
          };
        }
      };
      
      // Function to process enterprise runner groups
      const processEnterpriseGroups = async (enterpriseName, groups) => {
        for (const group of groups) {
          const groupId = group.id;
          const groupKey = `enterprise-${groupId}`;
          
          // Skip if we already processed this group
          if (details[groupKey]) continue;
          
          // For enterprise groups, we can't easily know which runners belong to them
          // So we'll use an empty array for now
          details[groupKey] = {
            ...group,
            runners: [],
            repositories: [],
            level: 'enterprise',
            groupId,
            enterprise: enterpriseName
          };
        }
      };
      
      // Process all organization groups
      const orgProcessPromises = Object.entries(allRunnerGroups.organization).map(
        ([orgName, groups]) => processOrgGroups(orgName, groups)
      );
      
      // Process all enterprise groups
      const enterpriseProcessPromises = Object.entries(allRunnerGroups.enterprise).map(
        ([enterpriseName, groups]) => processEnterpriseGroups(enterpriseName, groups)
      );
      
      // Wait for all processing to complete
      await Promise.all([...orgProcessPromises, ...enterpriseProcessPromises]);
      
      // Update state with all preloaded runner details
      setPreloadedRunnerDetails(details);
    } catch (error) {
      console.error('Error preloading runner data:', error);
    } finally {
      setIsPreloadingRunners(false);
    }
  };
  
  // Preload runner data whenever runner groups or organization selection changes
  useEffect(() => {
    if (Object.keys(allRunnerGroups.organization).length > 0 || 
        Object.keys(allRunnerGroups.enterprise).length > 0) {
      preloadAllRunnerData();
    }
  }, [allRunnerGroups, selectedOrg, selfHostedRunners.length, githubHostedRunners.length]);

  // Helper function to filter runners that belong to a specific group
  const filterRunnersForGroup = (runners, groupId, groupData) => {
    const groupIdString = String(groupId);
    
    return runners.filter(runner => {
      // Check various possible ID fields
      const runnerGroupId = runner.runner_group_id || runner.group_id || runner.runner_group;
      
      // Check by ID
      if (runnerGroupId && String(runnerGroupId) === groupIdString) {
        return true;
      }
      
      // Check by name match
      const runnerGroupName = runner.runner_group_name;
      if (runnerGroupName && groupData && groupData.name === runnerGroupName) {
        return true;
      }
      
      return false;
    });
  };

  // Render runner groups for a category (enterprise/organization)
  const renderRunnerGroups = (categoryName, categoryGroups) => {
    if (Object.keys(categoryGroups).length === 0) {
      return (
        <Alert severity="info" sx={{ my: 2 }}>
          No {categoryName} runner groups found.
        </Alert>
      );
    }
    
    return (
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" gutterBottom sx={{ 
          mt: 4,
          borderLeft: '4px solid #1976d2',
          pl: 2,
          py: 1,
          bgcolor: 'rgba(25, 118, 210, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {categoryName === 'enterprise' ? <BusinessIcon sx={{ mr: 1, color: '#1976d2' }} /> : <HubIcon sx={{ mr: 1, color: '#1976d2' }} />}
            {categoryName === 'enterprise' ? 'Enterprise Runner Groups' : 'Organization Runner Groups'}
          </Box>
          
          {/* Add "inherited groups hidden" indicator when viewing organization groups */}
          {categoryName === 'organization' && selectedOrg !== ALL_ORGS_VALUE && (
            <Chip
              size="small"
              label="Inherited groups hidden"
              variant="outlined"
              sx={{ 
                fontSize: '0.75rem',
                bgcolor: 'rgba(245, 166, 35, 0.05)',
                borderColor: 'rgba(245, 166, 35, 0.2)',
                color: '#F5A623',
                ml: 2
              }}
            />
          )}
        </Typography>
        
        {Object.entries(categoryGroups).map(([name, groups]) => (
          <Box sx={{ mb: 4 }} key={name}>
            <Typography variant="h6" gutterBottom sx={{ 
              mt: 2,
              borderLeft: '4px solid #58A6FF',
              pl: 2, 
              py: 1,
              bgcolor: 'rgba(88, 166, 255, 0.05)',
            }}>
              {name}
            </Typography>
            
            <TableContainer>
              <Table sx={{ minWidth: 650 }} size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Visibility</TableCell>
                    <TableCell>Default</TableCell>
                    <TableCell>Runners</TableCell>
                    <TableCell>Allows Public Repos</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((group) => {
                    const groupKey = `${categoryName}-${group.id}`;
                    const isExpanded = expandedGroups[groupKey] || false;
                    const isLoading = detailsLoadingMap[groupKey] || false;
                    const groupData = groupDetailsMap[groupKey];
                    
                    return (
                      <React.Fragment key={group.id}>
                        <TableRow sx={{ 
                          '&:hover': { bgcolor: 'rgba(88, 166, 255, 0.05)' },
                          ...(group.default && { bgcolor: 'rgba(88, 166, 255, 0.03)' }),
                          ...(isExpanded && { 
                            borderBottom: 'none',
                            bgcolor: 'rgba(88, 166, 255, 0.08)' 
                          })
                        }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <GroupsIcon sx={{ fontSize: '1rem', color: '#58A6FF' }} />
                              <Typography>
                                {group.name}
                                {group.default && 
                                  <Typography component="span" sx={{ ml: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
                                    (Default)
                                  </Typography>
                                }
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              icon={group.visibility === 'selected' ? <LockIcon fontSize="small" /> : <PublicIcon fontSize="small" />}
                              label={group.visibility === 'selected' ? 'Selected repositories' : 'All repositories'} 
                              variant="outlined"
                              sx={{ 
                                bgcolor: group.visibility === 'selected' ? 'rgba(245, 166, 35, 0.08)' : 'rgba(88, 166, 255, 0.08)',
                                borderColor: group.visibility === 'selected' ? 'rgba(245, 166, 35, 0.3)' : 'rgba(88, 166, 255, 0.3)',
                                color: group.visibility === 'selected' ? '#F5A623' : '#58A6FF'
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {group.default ? 
                              <Chip size="small" label="Yes" color="success" variant="outlined" /> : 
                              <Chip size="small" label="No" color="default" variant="outlined" />
                            }
                          </TableCell>
                          <TableCell>{group.runners_count || 0}</TableCell>
                          <TableCell>
                            {group.allows_public_repositories ? 
                              <Chip size="small" label="Yes" color="success" variant="outlined" /> : 
                              <Chip size="small" label="No" color="default" variant="outlined" />
                            }
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              endIcon={isExpanded ? <ExpandMoreIcon /> : <ExpandMoreIcon style={{ transform: 'rotate(-90deg)' }} />}
                              onClick={() => toggleGroupExpansion(categoryName, group.id, name)}
                              sx={{
                                bgcolor: isExpanded ? 'rgba(88, 166, 255, 0.15)' : 'rgba(88, 166, 255, 0.05)',
                                borderColor: 'rgba(88, 166, 255, 0.3)',
                                color: '#58A6FF',
                                '&:hover': {
                                  bgcolor: 'rgba(88, 166, 255, 0.2)',
                                  borderColor: 'rgba(88, 166, 255, 0.5)',
                                }
                              }}
                            >
                              {isExpanded ? 'Hide Details' : 'View Details'}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} sx={{ 
                              p: 0, 
                              borderTop: 'none',
                              bgcolor: 'rgba(88, 166, 255, 0.02)' 
                            }}>
                              {isLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                  <CircularProgress size={30} />
                                </Box>
                              ) : groupData ? (
                                <Box sx={{ p: 3, borderTop: '1px dashed rgba(88, 166, 255, 0.2)' }}>
                                  {/* Group Information */}
                                  <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(88, 166, 255, 0.05)', borderRadius: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Group Information</Typography>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                                      <Typography variant="body2">
                                        <strong>Name:</strong> {groupData.name}
                                      </Typography>
                                      <Typography variant="body2">
                                        <strong>Visibility:</strong> {groupData.visibility || 'Unknown'}
                                      </Typography>
                                      <Typography variant="body2">
                                        <strong>Default:</strong> {groupData.default ? 'Yes' : 'No'}
                                      </Typography>
                                      <Typography variant="body2">
                                        <strong>Allows Public Repositories:</strong> {groupData.allows_public_repositories ? 'Yes' : 'No'}
                                      </Typography>
                                      <Typography variant="body2">
                                        <strong>Organization:</strong> {groupData.organization || 'N/A'}
                                      </Typography>
                                      <Typography variant="body2">
                                        <strong>Runners Count:</strong> {groupData.runners?.length || 0}
                                      </Typography>
                                    </Box>
                                  </Box>
                                  
                                  {/* Runners Accordion */}
                                  <Accordion 
                                    sx={{ 
                                      mb: 2, 
                                      bgcolor: 'rgba(13, 17, 23, 0.02)', 
                                      '&:before': { display: 'none' },
                                      boxShadow: '0 0 0 1px rgba(88, 166, 255, 0.15)'
                                    }}
                                    defaultExpanded
                                  >
                                    <AccordionSummary
                                      expandIcon={<ExpandMoreIcon />}
                                      sx={{ 
                                        bgcolor: 'rgba(88, 166, 255, 0.1)',
                                        '&:hover': { bgcolor: 'rgba(88, 166, 255, 0.15)' }
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <ComputerIcon sx={{ mr: 1, color: '#58A6FF' }} />
                                        <Typography>Runners ({groupData.runners?.length || 0})</Typography>
                                      </Box>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ p: 0 }}>
                                      {!groupData.runners || groupData.runners.length === 0 ? (
                                        <Alert severity="info" sx={{ m: 2 }}>No runners found in this group.</Alert>
                                      ) : (
                                        <List sx={{ width: '100%', p: 0 }}>
                                          {groupData.runners.map((runner) => (
                                            <React.Fragment key={runner.id}>
                                              <ListItem sx={{ 
                                                py: 1.5, 
                                                '&:hover': { bgcolor: 'rgba(88, 166, 255, 0.05)' }
                                              }}>
                                                <ListItemAvatar>
                                                  <Avatar sx={{ 
                                                    bgcolor: runner.status === 'online' || runner.status === 'Ready' 
                                                      ? 'rgb(35, 197, 98, 0.1)' 
                                                      : 'rgba(245, 166, 35, 0.1)' 
                                                  }}>
                                                    <ComputerIcon sx={{ 
                                                      color: runner.status === 'online' || runner.status === 'Ready' 
                                                        ? '#23C562' 
                                                        : '#F5A623' 
                                                    }} />
                                                  </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                  disableTypography
                                                  primary={
                                                    <Typography variant="body1" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                      {runner.name}
                                                      <Chip 
                                                        size="small" 
                                                        label={runner.status} 
                                                        color={runner.status === 'online' || runner.status === 'Ready' 
                                                          ? 'success' 
                                                          : 'warning'
                                                        } 
                                                        variant="outlined"
                                                        sx={{ ml: 1 }}
                                                      />
                                                    </Typography>
                                                  }
                                                  secondary={
                                                    <Typography variant="body2" component="div">
                                                      <Typography variant="body2" component="span" sx={{ mr: 2 }}>
                                                        OS: {runner.os || runner.platform || 'Unknown'}
                                                      </Typography>
                                                      <Typography variant="body2" component="span">
                                                        {runner.labels ? 
                                                          `Labels: ${runner.labels.map(label => 
                                                            typeof label === 'string' ? label : label.name
                                                          ).join(', ')}` : 
                                                          ''
                                                        }
                                                      </Typography>
                                                    </Typography>
                                                  }
                                                />
                                              </ListItem>
                                              <Divider component="li" />
                                            </React.Fragment>
                                          ))}
                                        </List>
                                      )}
                                    </AccordionDetails>
                                  </Accordion>
                                </Box>
                              ) : (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                  <Typography color="text.secondary">Details not available</Typography>
                                </Box>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
      </Box>
    );
  };

  if (loading && !organizations.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4 }}>
      {/* Header section */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
          GitHub Actions Runner Groups
        </Typography>
        
        {/* Organization selector */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="org-name-label">Organization</InputLabel>
            <Select
              labelId="org-name-label"
              value={selectedOrg}
              label="Organization"
              onChange={handleOrgChange}
            >
              <MenuItem value={ALL_ORGS_VALUE}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <HubIcon sx={{ mr: 1, fontSize: '1rem' }} />
                  All Organizations
                </Box>
              </MenuItem>
              {organizations.map((org) => (
                <MenuItem key={org.id} value={org.account.login}>
                  {org.account.login}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        
        {/* Repository selector (visible only when specific org is selected) */}
        {selectedOrg && selectedOrg !== ALL_ORGS_VALUE && (
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="repo-select-label">Repository</InputLabel>
              <Select
                labelId="repo-select-label"
                value={selectedRepo}
                label="Repository"
                onChange={(e) => setSelectedRepo(e.target.value)}
                disabled={!selectedOrg || repositories.length === 0}
              >
                {repositories.map((repo) => (
                  <MenuItem key={repo.id} value={repo.name}>
                    {repo.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>
      
      {/* Runner groups content */}
      <Paper sx={{ p: 3 }}>
        {loading || isLoadingGroups || isPreloadingRunners ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
            <CircularProgress />
            {isPreloadingRunners && <Typography sx={{ mt: 2 }}>Preloading runner data...</Typography>}
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            {selectedOrg === ALL_ORGS_VALUE ? (
              <>
                <Typography variant="h6" gutterBottom>
                  All Runner Groups
                </Typography>
                {Object.keys(allRunnerGroups.enterprise).length === 0 && 
                 Object.keys(allRunnerGroups.organization).length === 0 ? (
                  <Alert severity="info" sx={{ my: 2 }}>
                    No runner groups found. Try synchronizing data first.
                  </Alert>
                ) : (
                  <>
                    {renderRunnerGroups('enterprise', allRunnerGroups.enterprise)}
                    {renderRunnerGroups('organization', allRunnerGroups.organization)}
                  </>
                )}
              </>
            ) : (
              <>
                {runnerGroups.enterprise && Object.keys(runnerGroups.enterprise).length > 0 && (
                  <Box sx={{ mb: 4 }}>
                    {renderRunnerGroups('enterprise', runnerGroups.enterprise)}
                  </Box>
                )}

                {runnerGroups.organization && Object.keys(runnerGroups.organization).length > 0 && (
                  <Box sx={{ mb: 4 }}>
                    {renderRunnerGroups('organization', runnerGroups.organization)}
                  </Box>
                )}

                {Object.keys(runnerGroups.enterprise).length === 0 && 
                  Object.keys(runnerGroups.organization).length === 0 && (
                  <Alert severity="info" sx={{ my: 2 }}>
                    No runner groups found. Try selecting a different organization.
                  </Alert>
                )}
                
                {/* Only show standalone runners sections when a repository is selected */}
                {selectedRepo && (
                  <>
                    {/* Self-hosted Runners */}
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h6" gutterBottom sx={{ 
                        borderLeft: '4px solid #23C562',
                        pl: 2,
                        py: 1,
                        bgcolor: 'rgba(35, 197, 98, 0.05)',
                      }}>
                        <EngineeringIcon sx={{ mr: 1, color: '#23C562', verticalAlign: 'middle' }} />
                        Self-Hosted Runners for {selectedRepo} ({selfHostedRunners.length})
                      </Typography>
                      
                      {isLoadingRepoRunners ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                          <CircularProgress size={30} />
                        </Box>
                      ) : selfHostedRunners.length > 0 ? (
                        <TableContainer>
                          <Table sx={{ minWidth: 650 }} size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>OS</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Repository</TableCell>
                                <TableCell>Labels</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {selfHostedRunners.map((runner) => (
                                <TableRow key={runner.id} sx={{ 
                                  '&:hover': { bgcolor: 'rgba(88, 166, 255, 0.05)' }
                                }}>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <ComputerIcon sx={{ fontSize: '1rem', color: '#23C562' }} />
                                      {runner.name}
                                    </Box>
                                  </TableCell>
                                  <TableCell>{runner.os}</TableCell>
                                  <TableCell>
                                    <Chip 
                                      size="small" 
                                      label={runner.status} 
                                      color={runner.status === 'online' || runner.status === 'Ready' ? 'success' : 'warning'} 
                                      variant="outlined"
                                      sx={{ ml: 1 }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {runner.repository || '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                      {runner.labels && runner.labels.map((label, index) => (
                                        <Chip
                                          key={index}
                                          label={label.name}
                                          size="small"
                                          variant="outlined"
                                          sx={{ 
                                            fontSize: '0.7rem', 
                                            height: 20,
                                            bgcolor: 'rgba(88, 166, 255, 0.08)',
                                            borderColor: 'rgba(88, 166, 255, 0.3)',
                                          }}
                                        />
                                      ))}
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Alert severity="info" sx={{ my: 2 }}>
                          No self-hosted runners found.
                        </Alert>
                      )}
                    </Box>
                    
                    {/* GitHub-hosted Runners */}
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h6" gutterBottom sx={{ 
                        borderLeft: '4px solid #6E40C9',
                        pl: 2,
                        py: 1,
                        bgcolor: 'rgba(110, 64, 201, 0.05)',
                      }}>
                        <HubIcon sx={{ mr: 1, color: '#6E40C9', verticalAlign: 'middle' }} />
                        GitHub-Hosted Runners ({githubHostedRunners.length})
                      </Typography>
                      
                      {githubHostedRunners.length > 0 ? (
                        <TableContainer>
                          <Table sx={{ minWidth: 650 }} size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Platform</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Repository</TableCell>
                                <TableCell>Machine Size</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {githubHostedRunners.map((runner) => (
                                <TableRow key={runner.id} sx={{ 
                                  '&:hover': { bgcolor: 'rgba(88, 166, 255, 0.05)' }
                                }}>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <ComputerIcon sx={{ fontSize: '1rem', color: '#6E40C9' }} />
                                      {runner.name}
                                    </Box>
                                  </TableCell>
                                  <TableCell>{runner.platform || '-'}</TableCell>
                                  <TableCell>
                                    <Chip 
                                      size="small" 
                                      label={runner.status} 
                                      color={runner.status === 'Ready' || runner.status === 'online' ? 'success' : 'warning'} 
                                      variant="outlined"
                                      sx={{ ml: 1 }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {runner.repository || '-'}
                                  </TableCell>
                                  <TableCell>
                                    {runner.machine_size_details ? 
                                      `${runner.machine_size_details.cpu_cores} cores, ${runner.machine_size_details.memory_gb}GB RAM` : 
                                      '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Alert severity="info" sx={{ my: 2 }}>
                          No GitHub-hosted runners found.
                        </Alert>
                      )}
                    </Box>
                  </>
                )}
              </>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default RunnerGroups;