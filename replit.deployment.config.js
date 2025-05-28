/**
 * Replit Deployment Configuration
 * 
 * This file provides deployment-specific configuration for Replit.
 */

module.exports = {
  // Deployment configuration
  deployment: {
    // Use autoscale for production deployment
    target: "autoscale",
    
    // Build command
    build: "npm run build",
    
    // Run command - single process on port 80
    run: "NODE_ENV=production node dist/index.js",
    
    // Port configuration
    port: 80,
    
    // Health check configuration
    healthCheck: {
      path: "/",
      interval: 30,
      timeout: 10
    }
  }
};