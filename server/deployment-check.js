/**
 * Special deployment health check handler
 * This is a JavaScript file (not TypeScript) that can be included in the dist folder directly
 */

const express = require('express');
const http = require('http');

// Create a minimal Express app just for the health check
const app = express();

// Simple health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Listen on the expected deployment health check port
const server = http.createServer(app);
server.listen(5000, '0.0.0.0', () => {
  console.log('Health check server listening on port 5000');
});

// Export the server
module.exports = { server };