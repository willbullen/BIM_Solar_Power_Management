import { useState, useEffect, useCallback, useRef } from 'react';

// Define message types for type safety
export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface WebSocketHookOptions {
  reconnectDelay?: number;
  reconnectAttempts?: number;
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
  
  const {
    reconnectDelay = 3000,
    reconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;
  
  // Initialize WebSocket connection
  const connect = useCallback(() => {
    // Determine the WebSocket URL based on the current protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    
    // Create a new WebSocket connection
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    
    // Set up event handlers
    socket.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
      setReconnectCount(0);
      onConnect?.();
    };
    
    socket.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
      setIsConnected(false);
      onDisconnect?.();
      
      // Attempt to reconnect if not at max attempts
      if (reconnectCount < reconnectAttempts) {
        console.log(`Attempting to reconnect (${reconnectCount + 1}/${reconnectAttempts})...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectCount(prev => prev + 1);
          connect();
        }, reconnectDelay);
      } else {
        console.error('Maximum reconnection attempts reached');
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };
    
    socket.onmessage = (event) => {
      try {
        const parsedMessage = JSON.parse(event.data) as WebSocketMessage;
        console.log('WebSocket message received:', parsedMessage);
        setLastMessage(parsedMessage);
        onMessage?.(parsedMessage);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }, [reconnectCount, reconnectAttempts, reconnectDelay, onConnect, onDisconnect, onError, onMessage]);
  
  // Send a message through the WebSocket
  const sendMessage: WebSocketSendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected, cannot send message');
    }
  }, []);
  
  // Subscribe to a specific data channel
  const subscribe = useCallback((channel: string) => {
    sendMessage({
      type: 'subscribe',
      data: { channel }
    });
  }, [sendMessage]);
  
  // Unsubscribe from a specific data channel
  const unsubscribe = useCallback((channel: string) => {
    sendMessage({
      type: 'unsubscribe',
      data: { channel }
    });
  }, [sendMessage]);
  
  // Connect when the component mounts and disconnect when it unmounts
  useEffect(() => {
    connect();
    
    return () => {
      // Clean up WebSocket connection and any timers
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
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
    reconnectCount
  };
}