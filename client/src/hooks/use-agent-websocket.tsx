import { useState, useEffect, useCallback, useRef } from 'react';

interface AgentWebSocketConfig {
  onMessage?: (message: any) => void;
  onNotification?: (notification: any) => void;
  onError?: (error: Event) => void;
}

// Helper function to determine WebSocket URL based on environment
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
};

export function useAgentWebSocket(config: AgentWebSocketConfig = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const maxReconnectAttempts = 15;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to create a new WebSocket connection
  const connect = useCallback(() => {
    // Clean up any existing connection first
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (err) {
        console.error('Error closing existing WebSocket connection:', err);
      }
    }
    
    try {
      console.log('Creating new WebSocket connection as singleton');
      const wsUrl = getWebSocketUrl();
      console.log(`WebSocket URL: ${wsUrl}`);
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.addEventListener('open', () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setConnectionError(null);
        setReconnectAttempt(0);
        
        // Subscribe to agent channels
        socket.send(JSON.stringify({
          type: 'subscribe',
          channels: ['agent-notifications', 'agent-messages']
        }));
      });
      
      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.type === 'agent-message' && config.onMessage) {
            config.onMessage(data.payload);
          } else if (data.type === 'agent-notification' && config.onNotification) {
            config.onNotification(data.payload);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      });
      
      socket.addEventListener('close', (event) => {
        console.log(`WebSocket connection closed (code: ${event.code}, reason: ${event.reason})`);
        setIsConnected(false);
        
        // Attempt to reconnect unless this was a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
          handleReconnect();
        }
      });
      
      socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection error');
        if (config.onError) {
          config.onError(error);
        }
      });
      
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
      setConnectionError(`Failed to connect: ${err}`);
      handleReconnect();
    }
  }, [config]);
  
  // Handle reconnection logic
  const handleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (reconnectAttempt < maxReconnectAttempts) {
      const nextAttempt = reconnectAttempt + 1;
      setReconnectAttempt(nextAttempt);
      
      // Exponential backoff with a maximum of 10 seconds
      const delay = Math.min(1000 * Math.pow(1.5, nextAttempt), 10000);
      console.log(`Attempting to reconnect (attempt ${nextAttempt}/${maxReconnectAttempts}) in ${delay}ms`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    } else {
      console.error(`Exceeded maximum reconnection attempts (${maxReconnectAttempts}), giving up`);
      setConnectionError(`Failed to connect after ${maxReconnectAttempts} attempts`);
    }
  }, [reconnectAttempt, connect]);
  
  // Initial connection
  useEffect(() => {
    connect();
    
    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        // Unsubscribe from channels
        try {
          if (socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: 'unsubscribe',
              channels: ['agent-notifications', 'agent-messages']
            }));
          }
        } catch (err) {
          console.error('Error unsubscribing from channels:', err);
        }
        
        // Close the connection
        try {
          socketRef.current.close();
        } catch (err) {
          console.error('Error closing WebSocket connection:', err);
        }
      }
    };
  }, [connect]);
  
  // Function to manually send a message
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  // Function to manually attempt reconnection
  const reconnect = useCallback(() => {
    setReconnectAttempt(0);
    connect();
  }, [connect]);
  
  return {
    isConnected,
    connectionError,
    reconnectAttempt,
    sendMessage,
    reconnect
  };
}