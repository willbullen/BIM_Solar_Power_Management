import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export interface AgentWebSocketMessage {
  type: string;
  conversationId?: number;
  messageId?: number;
  data: any;
}

export interface AgentWebSocketOptions {
  onMessage?: (message: AgentWebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

// Singleton pattern to ensure only one WebSocket connection
let socketInstance: WebSocket | null = null;
let authenticated = false;
const subscribers = new Set<(message: AgentWebSocketMessage) => void>();

export function useAgentWebSocket(options: AgentWebSocketOptions = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  
  const maxReconnectAttempts = options.maxReconnectAttempts || 10;
  const reconnectDelay = options.reconnectDelay || 3000;
  
  // Initialize the socket
  const initSocket = useCallback(() => {
    // If already connected, don't create a new socket
    if (socketInstance?.readyState === WebSocket.OPEN) {
      console.log('WebSocket connection already established, reusing');
      setIsConnected(true);
      if (options.onConnect) options.onConnect();
      return;
    }
    
    // If connecting, wait
    if (socketInstance?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting, waiting...');
      return;
    }
    
    // Clean up existing socket if needed
    if (socketInstance) {
      console.log('Closing existing socket before creating a new one');
      socketInstance.close();
      socketInstance = null;
    }
    
    // Determine WebSocket URL based on current protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Creating new WebSocket connection to ${wsUrl}`);
    socketInstance = new WebSocket(wsUrl);
    
    socketInstance.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;
      
      // Authenticate once connected
      if (user?.id && !authenticated) {
        console.log('Authenticating WebSocket connection');
        const authMessage: AgentWebSocketMessage = {
          type: 'authenticate',
          data: {
            userId: user.id,
            username: user.username || 'anonymous'
          }
        };
        
        socketInstance?.send(JSON.stringify(authMessage));
      }
      
      // Resubscribe to channels
      subscribedChannelsRef.current.forEach(channel => {
        console.log(`Resubscribing to channel: ${channel}`);
        const subscribeMessage: AgentWebSocketMessage = {
          type: 'subscribe',
          data: {
            channel
          }
        };
        socketInstance?.send(JSON.stringify(subscribeMessage));
      });
      
      if (options.onConnect) options.onConnect();
    };
    
    socketInstance.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
      setIsConnected(false);
      authenticated = false;
      
      if (options.onDisconnect) options.onDisconnect();
      
      // Handle reconnection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        setIsReconnecting(true);
        reconnectAttemptsRef.current += 1;
        console.log(`Reconnect attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${reconnectDelay}ms`);
        
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        
        reconnectTimerRef.current = window.setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          initSocket();
        }, reconnectDelay);
      } else {
        console.error('Maximum WebSocket reconnection attempts reached');
        setIsReconnecting(false);
        toast({
          title: 'Connection Lost',
          description: 'Could not reconnect to the server after multiple attempts. Please refresh the page.',
          variant: 'destructive'
        });
      }
    };
    
    socketInstance.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as AgentWebSocketMessage;
        console.log('WebSocket message received:', message);
        
        // Handle authentication confirmation
        if (message.type === 'auth-success') {
          console.log('WebSocket authentication successful');
          authenticated = true;
        }
        
        // Handle auth failure
        if (message.type === 'auth-failed') {
          console.error('WebSocket authentication failed:', message.data);
          authenticated = false;
        }
        
        // Notify individual subscriber
        if (options.onMessage) {
          options.onMessage(message);
        }
        
        // Broadcast to all subscribers
        subscribers.forEach(subscriber => {
          subscriber(message);
        });
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socketInstance.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (options.onError) options.onError(error);
    };
    
  }, [
    user, 
    options.onConnect, 
    options.onDisconnect, 
    options.onError, 
    options.onMessage, 
    maxReconnectAttempts, 
    reconnectDelay, 
    toast
  ]);
  
  // Send a message through the WebSocket
  const sendMessage = useCallback((message: AgentWebSocketMessage) => {
    if (!socketInstance || socketInstance.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected, cannot send message');
      return false;
    }
    
    try {
      console.log('Sending WebSocket message:', message);
      socketInstance.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }, []);
  
  // Subscribe to a specific conversation
  const subscribeToConversation = useCallback((conversationId: number) => {
    const channel = `conversation-${conversationId}`;
    subscribedChannelsRef.current.add(channel);
    
    if (socketInstance?.readyState === WebSocket.OPEN) {
      console.log(`Subscribing to conversation channel: ${channel}`);
      const subscribeMessage: AgentWebSocketMessage = {
        type: 'subscribe',
        data: {
          channel
        }
      };
      socketInstance.send(JSON.stringify(subscribeMessage));
    } else {
      console.warn(`WebSocket not ready, will subscribe to ${channel} when connected`);
    }
    
    return () => {
      // Unsubscribe function
      subscribedChannelsRef.current.delete(channel);
      
      if (socketInstance?.readyState === WebSocket.OPEN) {
        console.log(`Unsubscribing from conversation channel: ${channel}`);
        const unsubscribeMessage: AgentWebSocketMessage = {
          type: 'unsubscribe',
          data: {
            channel
          }
        };
        socketInstance.send(JSON.stringify(unsubscribeMessage));
      }
    };
  }, []);
  
  // Subscribe to agent messages channel
  const subscribeToAgentMessages = useCallback(() => {
    const channel = 'agent-messages';
    subscribedChannelsRef.current.add(channel);
    
    if (socketInstance?.readyState === WebSocket.OPEN) {
      console.log(`Subscribing to channel: ${channel}`);
      const subscribeMessage: AgentWebSocketMessage = {
        type: 'subscribe',
        data: {
          channel
        }
      };
      socketInstance.send(JSON.stringify(subscribeMessage));
    } else {
      console.warn(`WebSocket not ready, will subscribe to ${channel} when connected`);
    }
    
    return () => {
      // Unsubscribe function
      subscribedChannelsRef.current.delete(channel);
      
      if (socketInstance?.readyState === WebSocket.OPEN) {
        console.log(`Unsubscribing from channel: ${channel}`);
        const unsubscribeMessage: AgentWebSocketMessage = {
          type: 'unsubscribe',
          data: {
            channel
          }
        };
        socketInstance.send(JSON.stringify(unsubscribeMessage));
      }
    };
  }, []);
  
  // Add a global message subscriber
  const addGlobalSubscriber = useCallback((subscriber: (message: AgentWebSocketMessage) => void) => {
    subscribers.add(subscriber);
    
    return () => {
      subscribers.delete(subscriber);
    };
  }, []);
  
  // Initialize connection on mount
  useEffect(() => {
    initSocket();
    
    // Clean up on unmount
    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [initSocket]);
  
  // Handle user changes (re-authenticate when user changes)
  useEffect(() => {
    if (isConnected && user?.id && !authenticated) {
      console.log('User changed, re-authenticating WebSocket connection');
      const authMessage: AgentWebSocketMessage = {
        type: 'authenticate',
        data: {
          userId: user.id,
          username: user.username || 'anonymous'
        }
      };
      
      sendMessage(authMessage);
    }
  }, [isConnected, user, sendMessage]);
  
  // Return the WebSocket interface
  return {
    isConnected,
    isReconnecting,
    sendMessage,
    subscribeToConversation,
    subscribeToAgentMessages,
    addGlobalSubscriber,
  };
}