import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';

// Message types for agent chat
export interface AgentWebSocketMessage {
  type: string;
  conversationId?: number;
  messageId?: number;
  data: any;
}

// WebSocket hook options
export interface AgentWebSocketOptions {
  onMessage?: (message: AgentWebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

// Custom hook for WebSocket connection to agent chat
export function useAgentWebSocket(options: AgentWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<AgentWebSocketMessage | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const webSocketRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();
  
  // Default options
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectDelay = 2000,
    maxReconnectAttempts = 5
  } = options;
  
  // Function to create the WebSocket connection
  const connect = useCallback(() => {
    if (!user) {
      console.log('Cannot connect WebSocket - no user logged in');
      return;
    }
    
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    
    // If already connecting, don't attempt to connect again
    if (isConnecting) return;
    
    setIsConnecting(true);
    
    // Clean up any existing connections
    if (webSocketRef.current) {
      webSocketRef.current.close();
    }
    
    // Detect if we're in a Replit environment to handle protocol differences
    const isReplitEnvironment = window.location.host.includes('.replit.dev') || 
                               window.location.host.includes('.repl.co');
    
    // In Replit, use ws:// protocol for more reliable connections
    // Otherwise, match current page protocol (wss:// for https, ws:// for http)
    const protocol = isReplitEnvironment ? 'ws:' : 
                    (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    console.log(`Creating WebSocket connection to ${wsUrl}`);
    
    try {
      const socket = new WebSocket(wsUrl);
      webSocketRef.current = socket;
      
      socket.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        
        // Send authentication message immediately after connection
        if (user) {
          const authMessage: AgentWebSocketMessage = {
            type: 'authenticate',
            data: {
              userId: user.id,
              username: user.username
            }
          };
          socket.send(JSON.stringify(authMessage));
          
          // Subscribe to agent messages channel
          const subscribeMessage: AgentWebSocketMessage = {
            type: 'subscribe',
            data: {
              channel: 'agent-messages'
            }
          };
          socket.send(JSON.stringify(subscribeMessage));
        }
        
        if (onConnect) onConnect();
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as AgentWebSocketMessage;
          console.log('WebSocket message received:', message);
          setLastMessage(message);
          if (onMessage) onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        if (onDisconnect) onDisconnect();
        
        // Attempt to reconnect if not closed intentionally
        if (event.code !== 1000 && event.code !== 1001) {
          if (reconnectAttempts < maxReconnectAttempts) {
            console.log(`Attempting to reconnect (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
            setTimeout(() => {
              setReconnectAttempts(prev => prev + 1);
              connect();
            }, reconnectDelay);
          } else {
            console.log('Max reconnect attempts reached, giving up');
          }
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) onError(error);
      };
      
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setIsConnecting(false);
    }
  }, [user, isConnecting, reconnectDelay, reconnectAttempts, maxReconnectAttempts, onConnect, onDisconnect, onMessage, onError]);
  
  // Function to disconnect
  const disconnect = useCallback(() => {
    if (webSocketRef.current) {
      console.log('Manually closing WebSocket connection');
      webSocketRef.current.close(1000, 'Closed by client');
      webSocketRef.current = null;
      setIsConnected(false);
    }
  }, []);
  
  // Function to send a message
  const sendMessage = useCallback((message: AgentWebSocketMessage) => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      console.log('Sending WebSocket message:', message);
      webSocketRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('Cannot send message, WebSocket not connected');
      return false;
    }
  }, []);
  
  // Function to subscribe to a conversation's messages
  const subscribeToConversation = useCallback((conversationId: number) => {
    if (!isConnected) {
      console.log('Not connected, attempting to connect first');
      connect();
      // The subscription will be attempted after connection in the next effect
      return;
    }
    
    const subscribeMessage: AgentWebSocketMessage = {
      type: 'subscribe',
      conversationId,
      data: {
        channel: `conversation-${conversationId}`
      }
    };
    
    return sendMessage(subscribeMessage);
  }, [isConnected, connect, sendMessage]);
  
  // Function to unsubscribe from a conversation's messages
  const unsubscribeFromConversation = useCallback((conversationId: number) => {
    if (!isConnected) return false;
    
    const unsubscribeMessage: AgentWebSocketMessage = {
      type: 'unsubscribe',
      conversationId,
      data: {
        channel: `conversation-${conversationId}`
      }
    };
    
    return sendMessage(unsubscribeMessage);
  }, [isConnected, sendMessage]);
  
  // Connect when the component mounts or user changes
  useEffect(() => {
    if (user) {
      connect();
    }
    
    // Clean up on unmount
    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close(1000, 'Component unmounted');
        webSocketRef.current = null;
      }
    };
  }, [user, connect]);
  
  return {
    isConnected,
    isConnecting,
    lastMessage,
    reconnectAttempts,
    connect,
    disconnect,
    sendMessage,
    subscribeToConversation,
    unsubscribeFromConversation
  };
}