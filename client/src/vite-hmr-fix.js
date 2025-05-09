/**
 * This script patches the Vite HMR WebSocket connection to work correctly in Replit
 * by ensuring proper host/port values are used for WebSocket connections.
 * 
 * This addresses the "localhost:undefined" WebSocket connection error in Replit.
 */

// Run this code in browser (client) environment only
if (typeof window !== 'undefined') {
  // Check if we're in Replit environment
  const isReplit = window.location.host.includes('.replit.dev') || 
                   window.location.host.includes('.repl.co');
  
  if (isReplit) {
    console.log('[Vite HMR Fix] Detected Replit environment, applying WebSocket connection fix');
    
    // Store original WebSocket constructor
    const OriginalWebSocket = window.WebSocket;
    
    // Replace WebSocket constructor with our patched version
    window.WebSocket = function(url, protocols) {
      // Fix for Vite HMR WebSockets that try to connect to localhost:undefined
      if (url.includes('localhost:undefined') || url.includes('localhost:null')) {
        // Extract the token from the original URL
        const tokenMatch = url.match(/[?&]token=([^&]+)/);
        const token = tokenMatch ? tokenMatch[1] : '';
        
        // Use the current host for WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const correctedUrl = `${protocol}//${window.location.host}/?token=${token}`;
        
        console.log(`[Vite HMR Fix] Correcting invalid WebSocket URL: ${url} -> ${correctedUrl}`);
        url = correctedUrl;
      }
      
      // For application WebSockets (non-Vite), ensure we use the correct host
      if (url.includes('/ws') && (url.includes('localhost') || url.includes('127.0.0.1'))) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const correctedUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log(`[Vite HMR Fix] Correcting application WebSocket URL: ${url} -> ${correctedUrl}`);
        url = correctedUrl;
      }
      
      // Call original WebSocket constructor with corrected URL
      return new OriginalWebSocket(url, protocols);
    };
    
    // Copy prototype and static properties
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
    
    console.log('[Vite HMR Fix] WebSocket constructor patched for Replit compatibility');
  }
}