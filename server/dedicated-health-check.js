
/**
 * Dedicated health check server for Replit deployments
 * This runs as a separate process to ensure health checks always respond
 */

import express from 'express';
import http from 'http';

// Create a dedicated Express app just for health checks
const app = express();

// Simple health check endpoint
app.get('/', (req, res) => {
  // Return a simple 200 OK response for health checks
  res.status(200).send('Health check OK');
});

// Simple redirect to main application (now on same domain)
app.get('/app', (req, res) => {
  res.redirect('/');
});

// Detailed health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    mainApp: 'Port 80',
    healthCheck: 'Port 5000'
  });
});

// Use port 8080 for health checks to avoid conflict with main app (port 80)
const healthPort = process.env.HEALTH_PORT || 8080;
const server = http.createServer(app);
server.listen(healthPort, '0.0.0.0', () => {
  console.log(`Dedicated health check server running on port ${healthPort}`);
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
