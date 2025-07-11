import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      react(),
      // Add visualizer in build mode
      mode === 'production' && 
        visualizer({
          open: true,
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
        }),
      // Add compression for production builds
      isProduction && compression({
        algorithm: 'gzip',
        ext: '.gz',
      }),
      isProduction && compression({
        algorithm: 'brotliCompress',
        ext: '.br',
      }),
    ].filter(Boolean),
    
    resolve: {
      alias: {
        // Set up path aliases if needed
        '@': path.resolve(__dirname, 'src'),
      },
      extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'], // Add support for various file extensions
    },
    
    server: {
      port: 3000, // Match the default CRA port
      open: true, // Open browser on start
      proxy: {
        // Proxy API requests to local backend
        '/api': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          secure: false,
        },
        // Proxy WebSocket connections
        '/socket.io': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    
    build: {
      outDir: 'build', // Match CRA's output directory
      sourcemap: !isProduction, // Only generate sourcemaps in development
      minify: isProduction, // Minify in production
      target: 'es2015', // Target modern browsers
      
      // Chunk strategy for better caching and smaller bundles
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor chunks for better caching
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            'chart-vendor': ['chart.js', 'react-chartjs-2'],
            'utils': ['axios', 'date-fns', 'socket.io-client'],
          },
          // Ensure chunk file names include content hash for browser caching
          chunkFileNames: isProduction 
            ? 'assets/[name]-[hash].js' 
            : 'assets/[name].js',
        },
      },
      
      // Enable build cache for faster rebuilds
      cache: true,
      
      // Chunk size warnings
      chunkSizeWarningLimit: 1000, // Warn for chunks larger than 1MB
      
      // CSS optimization
      cssCodeSplit: true,
      
      // Enable brotli compression for smaller assets
      reportCompressedSize: true,
    },
    
    // Handle environment variables similar to CRA
    define: {
      'process.env': process.env,
    },
    
    // Configure esbuild to handle JSX in .js files
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
      // Add tree shaking
      treeShaking: true,
    },
    
    // Optimize dependencies during dev
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'react-router-dom',
        '@mui/material',
        '@mui/icons-material',
        'chart.js',
        'react-chartjs-2',
        'axios',
        'socket.io-client'
      ],
    },
  };
});