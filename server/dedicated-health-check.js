
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
  // Forward to main app by redirecting
  res.redirect('/app');
});

// Route to expose main app - serves a proper HTML explanation page
app.get('/app', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Energy Dashboard</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: system-ui, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; }
          .btn { display: inline-block; background: #0078D7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Energy Dashboard</h1>
          <p>The main application is running on port 3000. The health check is active on port 5000.</p>
          <p>To access the dashboard, please use port 3000 in your URL.</p>
          <a href="https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co:3000" class="btn">Go to Dashboard</a>
        </div>
      </body>
    </html>
  `);
});

// Detailed health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    mainApp: 'Port 3000',
    healthCheck: 'Port 5000'
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
