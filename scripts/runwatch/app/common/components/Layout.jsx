import React, { Fragment, useState, useEffect } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Assessment as AssessmentIcon,
  GitHub as GitHubIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

const expandedWidth = 280;
const collapsedWidth = 72;

const Layout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('menuExpanded');
    return saved !== null ? JSON.parse(saved) : !isMobile;
  });
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('menuExpanded', JSON.stringify(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    if (isMobile) {
      setIsExpanded(false);
    }
  }, [isMobile]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Statistics', icon: <AssessmentIcon />, path: '/stats' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const drawer = (
    <Box sx={{ 
      background: 'linear-gradient(180deg, #0D1117 0%, #161B22 100%)',
      height: '100%',
      color: '#E6EDF3',
      position: 'relative',
      overflow: 'visible'
    }}>
      <Toolbar sx={{ 
        minHeight: '80px !important',
        bgcolor: 'transparent',
        px: isExpanded ? 3 : 2,
        '& .MuiSvgIcon-root': { color: '#58A6FF' },
        transition: theme.transitions.create(['padding'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}>
        <GitHubIcon sx={{ 
          mr: isExpanded ? 2 : 0, 
          fontSize: '2rem',
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }} />
        {isExpanded && (
          <Typography variant="h5" noWrap sx={{ 
            fontWeight: 600,
            background: 'linear-gradient(90deg, #58A6FF 0%, #88CFFF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            opacity: isExpanded ? 1 : 0,
            transition: theme.transitions.create(['opacity'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }}>
            RunWatch
          </Typography>
        )}
      </Toolbar>
      {!isMobile && (
        <IconButton
          onClick={toggleExpanded}
          sx={{
            position: 'absolute',
            right: '-12px',
            top: '90px',
            bgcolor: '#161B22',
            border: '1px solid rgba(240, 246, 252, 0.1)',
            width: '24px',
            height: '24px',
            zIndex: 1,
            '&:hover': {
              bgcolor: '#21262D'
            },
            '& .MuiSvgIcon-root': {
              fontSize: '1rem',
              color: '#8B949E',
              transition: theme.transitions.create(['transform'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            }
          }}
        >
          {isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      )}
      <Divider sx={{ borderColor: 'rgba(240, 246, 252, 0.1)' }} />
      <List sx={{ mt: 2, px: 1 }}>
        {menuItems.map((item) => (
          <ListItem 
            button 
            key={item.text} 
            component={RouterLink} 
            to={item.path}
            onClick={() => setMobileOpen(false)}
            selected={location.pathname === item.path}
            sx={{
              borderRadius: '8px',
              mb: 1,
              height: 48,
              justifyContent: isExpanded ? 'initial' : 'center',
              px: isExpanded ? 2 : 1,
              color: location.pathname === item.path ? '#E6EDF3' : '#8B949E',
              transition: theme.transitions.create(['padding', 'min-width', 'color'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              '&.Mui-selected': {
                bgcolor: 'rgba(88, 166, 255, 0.15)',
                '&:hover': {
                  bgcolor: 'rgba(88, 166, 255, 0.25)',
                },
                '& .MuiListItemIcon-root': {
                  color: '#58A6FF',
                }
              },
              '&:hover': {
                bgcolor: 'rgba(88, 166, 255, 0.1)',
                '& .MuiListItemIcon-root': {
                  color: '#58A6FF',
                }
              }
            }}
          >
            <Tooltip title={!isExpanded ? item.text : ''} placement="right">
              <ListItemIcon sx={{
                color: location.pathname === item.path ? '#58A6FF' : '#8B949E',
                minWidth: isExpanded ? 40 : 'auto',
                mr: isExpanded ? 2 : 'auto',
                justifyContent: 'center',
                transition: theme.transitions.create(['margin', 'min-width', 'color'], {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
              }}>
                {item.icon}
              </ListItemIcon>
            </Tooltip>
            {isExpanded && (
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{
                  fontSize: '0.95rem',
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  opacity: isExpanded ? 1 : 0,
                  transition: theme.transitions.create(['opacity'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                  }),
                }}
              />
            )}
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', bgcolor: '#0D1117', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${isExpanded ? expandedWidth : collapsedWidth}px)` },
          ml: { sm: `${isExpanded ? expandedWidth : collapsedWidth}px` },
          bgcolor: '#161B22',
          borderBottom: '1px solid rgba(240, 246, 252, 0.1)',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          })
        }}
      >
        <Toolbar sx={{ minHeight: '80px !important' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' }, color: '#E6EDF3' }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ 
          width: { sm: isExpanded ? expandedWidth : collapsedWidth }, 
          flexShrink: { sm: 0 },
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: expandedWidth,
              borderRight: '1px solid rgba(240, 246, 252, 0.1)',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: isExpanded ? expandedWidth : collapsedWidth,
              borderRight: '1px solid rgba(240, 246, 252, 0.1)',
              overflowX: 'hidden',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 4, 
          width: { sm: `calc(100% - ${isExpanded ? expandedWidth : collapsedWidth}px)` },
          mt: '80px',
          bgcolor: '#0D1117',
          color: '#E6EDF3',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          })
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;