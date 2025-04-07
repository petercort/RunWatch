import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
  },
  build: {
    outDir: 'build', // Match CRA's output directory
    sourcemap: true,
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
  },
});