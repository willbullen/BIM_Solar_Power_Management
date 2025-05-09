import { useState, useEffect, useCallback, useRef } from 'react';

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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Sending WebSocket ping');
      wsRef.current.send(JSON.stringify({ type: 'ping', data: { timestamp: new Date().toISOString() } }));
    }
  }, []);
  
  // Initialize WebSocket connection
  const connect = useCallback(() => {
    // Don't attempt to reconnect if we've exceeded the maximum reconnection attempts
    if (reconnectCount >= maxReconnectAttempts) {
      console.error(`Exceeded maximum reconnection attempts (${maxReconnectAttempts}), giving up`);
      return;
    }
    
    // Determine the WebSocket URL based on the current protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    // Don't attempt to reconnect if we've already reached max attempts for this session
    if (reconnectCount >= reconnectAttempts) {
      console.error(`Maximum reconnection attempts reached for this session (${reconnectAttempts})`);
      return;
    }
    
    // Reset manual closure flag when attempting new connection
    manuallyClosedRef.current = false;
    
    console.log(`Connecting to WebSocket at ${wsUrl} (attempt ${reconnectCount + 1})`);
    
    // Clean up any existing socket before creating a new one
    if (wsRef.current) {
      wsRef.current.onclose = null; // Remove event handler to prevent reconnection loop
      wsRef.current.close();
    }
    
    // Create a new WebSocket connection
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    
    // Set up event handlers
    socket.onopen = () => {
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
    
    socket.onclose = (event) => {
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
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };
    
    socket.onmessage = (event) => {
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected, cannot send message');
      // Attempt to reconnect if we're not already in the process
      if (!isConnected && reconnectCount < reconnectAttempts && !reconnectTimeoutRef.current) {
        console.log('Attempting to reconnect WebSocket before sending message');
        connect();
      }
    }
  }, [isConnected, reconnectCount, reconnectAttempts, connect]);
  
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