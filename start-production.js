#!/usr/bin/env node

/**
 * Production startup script for Replit deployment
 * This ensures the application starts properly on port 80
 */

const { spawn } = require('child_process');

console.log('Starting production server...');
console.log('NODE_ENV=production');
console.log('Target port: 80');

// Start the main application
const server = spawn('node', ['dist/index.js'], {
  env: { 
    ...process.env, 
    NODE_ENV: 'production',
    PORT: '80'
  },
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.kill('SIGINT');
});