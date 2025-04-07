#!/usr/bin/env node

/**
 * This script builds the application with bundle analyzer enabled
 * Run with: node analyze-bundle.js
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set environment variables for the build
process.env.ANALYZE = 'true';

console.log('Building application with bundle analyzer...');
console.log('This will open a visualization of the bundle in your browser after build completes.');

try {
  // Run the build command with additional environment variable
  execSync('vite build --mode=production', {
    stdio: 'inherit',
    env: {
      ...process.env,
      ANALYZE: 'true'
    }
  });
  
  console.log('\n✅ Bundle analysis complete!');
  console.log('The analyzer should have opened in your browser.');
  console.log('If it didn\'t, check the stats.html file in the dist directory.');
  
} catch (error) {
  console.error('❌ Bundle analysis failed:', error);
  process.exit(1);
}