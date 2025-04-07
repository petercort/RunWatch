import { createTheme } from '@mui/material';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#58A6FF',
      light: '#88CFFF',
      dark: '#1F6FEB',
      contrastText: '#FFFFFF'
    },
    error: {
      main: '#F85149',
      light: '#FF6B64',
      dark: '#DA3633',
    },
    warning: {
      main: '#F5A623',
      light: '#FFB938',
      dark: '#D18D1F',
    },
    success: {
      main: '#23C562',
      light: '#3BDC7B',
      dark: '#1B9E4F',
    },
    info: {
      main: '#58A6FF',
      light: '#79B8FF',
      dark: '#3B7BC0',
    },
    background: {
      default: '#0D1117',
      paper: '#161B22',
    },
    text: {
      primary: '#E6EDF3',
      secondary: '#8B949E',
    },
    divider: 'rgba(240, 246, 252, 0.1)',
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
    subtitle1: {
      fontSize: '0.95rem',
      fontWeight: 500,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0D1117',
          color: '#E6EDF3',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});