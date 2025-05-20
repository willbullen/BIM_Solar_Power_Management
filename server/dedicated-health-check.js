
/**
 * Dedicated health check server for Replit deployments
 * This runs as a separate process to ensure health checks always respond
 */

const express = require('express');
const http = require('http');

// Create a dedicated Express app just for health checks
const app = express();

// Simple health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Detailed health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Start the server on port 5000 for health checks
const server = http.createServer(app);
server.listen(5000, '0.0.0.0', () => {
  console.log('Dedicated health check server running on port 5000');
});

// Keep the process running indefinitely
setInterval(() => {
  console.log('Health check server still alive: ' + new Date().toISOString());
}, 60000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Health check server shutting down');
  server.close();
  process.exit(0);
});
