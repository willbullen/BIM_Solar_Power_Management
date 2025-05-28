#!/usr/bin/env node

/**
 * Production build script that ensures only the main application is built
 * This fixes the deployment port conflict issue
 */

const { execSync } = require('child_process');

console.log('Building application for production deployment...');

try {
  // Build frontend
  console.log('Building frontend with Vite...');
  execSync('vite build', { stdio: 'inherit' });

  // Build backend (main application only)
  console.log('Building backend server...');
  execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'inherit' });

  console.log('Production build completed successfully!');
  console.log('Built files:');
  console.log('- Frontend: dist/public/');
  console.log('- Backend: dist/index.js');
  
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}