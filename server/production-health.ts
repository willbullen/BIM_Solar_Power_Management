/**
 * Simple standalone health check server for production
 * 
 * This file creates a minimal Express server that only handles health checks.
 * It's designed to be extremely lightweight and fast to respond.
 */

import express from 'express';
import http from 'http';

// Create a separate app just for health checks
const app = express();

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Start the health check server on port 5000
const server = http.createServer(app);
server.listen(5000, '0.0.0.0', () => {
  console.log('Health check server running on port 5000');
});

export { server };