import { useState, useEffect, useCallback, useRef } from 'react';

// Define a global variable to track if we have an active WebSocket connection
declare global {
  interface Window {
    _webSocketInitialized?: boolean;
    _activeWebSocketInstance?: WebSocket | null;
  }
}

// Define message types for type safety
export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface WebSocketHookOptions {
  reconnectDelay?: number;
  reconnectAttempts?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export type WebSocketSendMessage = (message: WebSocketMessage) => void;

export function useWebSocket(options: WebSocketHookOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manuallyClosedRef = useRef(false);
  
  const {
    reconnectDelay = 3000,
    reconnectAttempts = 5,
    maxReconnectAttempts = 10,  // Maximum reconnect attempts overall
    pingInterval = 30000,  // Send a ping every 30 seconds to keep connection alive
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;
  
  // Ping function to keep connection alive
  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        console.log('Sending WebSocket ping');
        wsRef.current.send(JSON.stringify({ type: 'ping', data: { timestamp: new Date().toISOString() } }));
      } catch (err) {
        console.error('Error sending WebSocket ping:', err);
        // If ping fails, the connection might be dead but not detected yet
        // Force close and reconnect
        try {
          wsRef.current.close();
        } catch (closeErr) {
          console.error('Error closing WebSocket after ping failure:', closeErr);
        }
      }
    }
  }, []);
  
  // Initialize WebSocket connection
  const connect = useCallback(() => {
    // Check if we already have an active WebSocket connection globally
    if (typeof window !== 'undefined' && window._webSocketInitialized) {
      console.warn('WebSocket singleton already initialized - ignoring additional connection attempt');
      
      // If there's an existing global socket, use it instead of creating a new one
      if (window._activeWebSocketInstance &&
          window._activeWebSocketInstance.readyState === WebSocket.OPEN) {
        console.log('Reusing existing WebSocket connection');
        wsRef.current = window._activeWebSocketInstance;
        setIsConnected(true);
        return;
      }
    }
    
    // If we've exceeded the maximum overall reconnection attempts, give up
    if (reconnectCount >= maxReconnectAttempts) {
      console.error(`Exceeded maximum reconnection attempts (${maxReconnectAttempts}), giving up`);
      return;
    }
    
    // If we've reached max attempts for this session, give up on this session
    if (reconnectCount >= reconnectAttempts) {
      console.error(`Maximum reconnection attempts reached for this session (${reconnectAttempts})`);
      return;
    }
    
    // Determine the WebSocket URL based on the current location
    // Get the URL from the window location to ensure same-origin connection
    // Note: We need to handle both http/https and development/production environments
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    // Reset manual closure flag when attempting new connection
    manuallyClosedRef.current = false;
    
    console.log(`Connecting to WebSocket at ${wsUrl} (attempt ${reconnectCount + 1})`);
    
    // Clean up any existing socket before creating a new one
    if (wsRef.current) {
      // Remove event handlers to prevent any callbacks during transition
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      
      // Only close if it's not already closed
      if (wsRef.current.readyState !== WebSocket.CLOSED && 
          wsRef.current.readyState !== WebSocket.CLOSING) {
        wsRef.current.close();
      }
    }
    
    try {
      // Check if we can reuse the global WebSocket instance
      if (typeof window !== 'undefined' && 
          window._activeWebSocketInstance && 
          window._activeWebSocketInstance.readyState === WebSocket.OPEN) {
        console.log('Reusing existing global WebSocket instance');
        wsRef.current = window._activeWebSocketInstance;
      } else {
        // Create a new WebSocket connection
        console.log('Creating new WebSocket connection as singleton');
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;
        
        // Set global instance
        if (typeof window !== 'undefined') {
          window._webSocketInitialized = true;
          window._activeWebSocketInstance = socket;
        }
      }
      
      // Set up event handlers for the WebSocket instance
      wsRef.current.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setReconnectCount(0); // Reset reconnect count on successful connection
        
        // Set up ping interval to keep connection alive
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(sendPing, pingInterval);
        
        onConnect?.();
      };
      wsRef.current.addEventListener('error', (event: Event) => {
        console.error('Error during WebSocket connection setup:', event);
        onError?.(event);
      }, { once: true }); // Only handle the initial connection error once
      
      wsRef.current.onclose = (event: CloseEvent) => {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        setIsConnected(false);
        
        // Clear ping interval when connection closes
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        onDisconnect?.();
        
        // Only attempt to reconnect if the connection wasn't manually closed
        if (!manuallyClosedRef.current) {
          // Increment reconnect count
          const newReconnectCount = reconnectCount + 1;
          setReconnectCount(newReconnectCount);
          
          // Attempt to reconnect with exponential backoff
          const delay = Math.min(reconnectDelay * Math.pow(1.5, newReconnectCount), 30000); // Max 30s
          
          console.log(`Scheduling reconnect in ${delay}ms (attempt ${newReconnectCount + 1}/${reconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
      
      wsRef.current.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };
      
      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const parsedMessage = JSON.parse(event.data) as WebSocketMessage;
          
          // Don't log pong messages to avoid console spam
          if (parsedMessage.type !== 'pong') {
            console.log('WebSocket message received:', parsedMessage);
          }
          
          setLastMessage(parsedMessage);
          onMessage?.(parsedMessage);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      onError?.(error as Event);
      
      // Schedule reconnection attempt after delay
      const newReconnectCount = reconnectCount + 1;
      setReconnectCount(newReconnectCount);
      
      // Use exponential backoff for reconnection
      const delay = Math.min(reconnectDelay * Math.pow(1.5, newReconnectCount), 30000); // Max 30s
      
      console.log(`WebSocket creation failed. Scheduling reconnect in ${delay}ms (attempt ${newReconnectCount + 1}/${reconnectAttempts})`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [
    reconnectCount, 
    reconnectAttempts, 
    maxReconnectAttempts,
    reconnectDelay, 
    pingInterval,
    sendPing,
    onConnect, 
    onDisconnect, 
    onError, 
    onMessage
  ]);
  
  // Send a message through the WebSocket
  const sendMessage: WebSocketSendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (err) {
        console.error('Error sending WebSocket message:', err);
        
        // The connection might be dead but not detected yet
        if (wsRef.current) {
          try {
            wsRef.current.close();
          } catch (closeErr) {
            console.error('Error closing WebSocket after send failure:', closeErr);
          }
        }
        
        // Attempt to reconnect
        if (reconnectCount < maxReconnectAttempts && !reconnectTimeoutRef.current) {
          console.log('Attempting to reconnect WebSocket after send failure');
          setTimeout(connect, 1000); // Short delay before reconnecting
        }
      }
    } else {
      console.warn(`WebSocket is not connected (readyState: ${wsRef.current ? wsRef.current.readyState : 'no socket'}), cannot send message`);
      
      // Attempt to reconnect if we're not already in the process
      if (!isConnected && reconnectCount < maxReconnectAttempts && !reconnectTimeoutRef.current) {
        console.log('Attempting to reconnect WebSocket before sending message');
        connect();
      }
    }
  }, [isConnected, reconnectCount, maxReconnectAttempts, connect]);
  
  // Subscribe to a specific data channel
  const subscribe = useCallback((channel: string) => {
    console.log(`Subscribing to ${channel} channel`);
    sendMessage({
      type: 'subscribe',
      data: { channel }
    });
  }, [sendMessage]);
  
  // Unsubscribe from a specific data channel
  const unsubscribe = useCallback((channel: string) => {
    console.log(`Unsubscribing from ${channel} channel`);
    sendMessage({
      type: 'unsubscribe',
      data: { channel }
    });
  }, [sendMessage]);
  
  // Manually close the connection
  const disconnect = useCallback(() => {
    console.log('Manually closing WebSocket connection');
    manuallyClosedRef.current = true;
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);
  
  // Connect when the component mounts and disconnect when it unmounts
  useEffect(() => {
    connect();
    
    return () => {
      // Clean up WebSocket connection and any timers
      manuallyClosedRef.current = true;
      
      if (wsRef.current) {
        wsRef.current.onclose = null; // Remove event handler to prevent reconnection
        wsRef.current.close();
        wsRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [connect]);
  
  return {
    isConnected,
    lastMessage,
    sendMessage,
    subscribe,
    unsubscribe,
    reconnect: connect,
    disconnect,
    reconnectCount
  };
}