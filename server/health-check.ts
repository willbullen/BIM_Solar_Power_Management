/**
 * Dedicated health check file for deployment
 * 
 * This file provides a simple health check endpoint that responds with a 200 status code
 * immediately, without any dependency on other services or database connections.
 */

import express from 'express';

export function setupHealthCheck(app: express.Express) {
  // Simple health check endpoint
  app.get('/', (req, res) => {
    // Respond immediately with a 200 status
    res.status(200).json({ status: 'ok', message: 'Server is running' });
  });

  // More detailed health check at another endpoint
  app.get('/health', (req, res) => {
    // Add any additional health metrics here
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now()
    });
  });

  console.log('Health check endpoints registered at / and /health');
}