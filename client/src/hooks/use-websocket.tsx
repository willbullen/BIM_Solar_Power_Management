import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

// Define a global variable to track if we have an active WebSocket connection
// Keep this for compatibility with existing code
declare global {
  interface Window {
    _webSocketInitialized?: boolean;
    _activeWebSocketInstance?: WebSocket | null;
    _activePollingInstance?: any;
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
  pollingInterval?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event | Error) => void;
}

export type WebSocketSendMessage = (message: WebSocketMessage) => Promise<void>;

// Define subscription type for the REST API
interface Subscription {
  channel: string;
  lastPolled: number;
}

export function useWebSocket(options: WebSocketHookOptions = {}) {
  const [isConnected, setIsConnected] = useState(true); // Default to true for REST API
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  
  // Store subscriptions for polling
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  
  // Refs for polling and intervals
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  
  const {
    reconnectDelay = 2000,        // Keep for compatibility
    reconnectAttempts = 5,        // Keep for compatibility
    maxReconnectAttempts = 6,     // Keep for compatibility
    pingInterval = 15000,         // Now used for data refresh rate
    pollingInterval = 10000,      // Default polling interval
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;
  
  // Function to poll data based on subscriptions
  const pollSubscriptions = useCallback(async () => {
    if (subscriptions.length === 0) {
      return; // No subscriptions to poll
    }
    
    if (isFetchingRef.current) {
      console.log('Already fetching data, skipping this poll cycle');
      return;
    }
    
    isFetchingRef.current = true;
    
    try {
      // Poll each subscription
      for (const subscription of subscriptions) {
        const now = Date.now();
        const timeSinceLastPoll = now - subscription.lastPolled;
        
        // Only poll if it's been at least half the polling interval since the last poll
        if (subscription.lastPolled === 0 || timeSinceLastPoll >= pollingInterval / 2) {
          console.log(`Polling channel: ${subscription.channel}`);
          
          try {
            // Make API request based on channel type
            let data;
            switch (subscription.channel) {
              case 'power-data':
                data = await apiRequest('/api/power-data/latest', 'GET');
                break;
              case 'environmental-data':
                data = await apiRequest('/api/environmental-data/latest', 'GET');
                break;
              case 'settings':
                data = await apiRequest('/api/settings', 'GET');
                break;
              case 'agent-notifications':
                try {
                  // Use apiRequest helper from the queryClient
                  data = await apiRequest('/api/agent/notifications', 'GET');
                } catch (err) {
                  console.error('Error fetching notifications:', err);
                }
                break;
              case 'agent-tasks':
                try {
                  data = await apiRequest('/api/agent/tasks', 'GET');
                } catch (err) {
                  console.error('Error fetching agent tasks:', err);
                }
                break;
              default:
                // Try a generic endpoint based on channel name
                try {
                  data = await apiRequest(`/api/${subscription.channel}/latest`, 'GET');
                } catch (err) {
                  console.error(`Error fetching data from generic endpoint for ${subscription.channel}:`, err);
                }
            }
            
            // Update subscription's last polled time
            const updatedSubscriptions = subscriptions.map(sub => 
              sub.channel === subscription.channel 
                ? { ...sub, lastPolled: now } 
                : sub
            );
            setSubscriptions(updatedSubscriptions);
            
            // Send the data to handlers
            const message: WebSocketMessage = {
              type: subscription.channel,
              data: data
            };
            
            setLastMessage(message);
            onMessage?.(message);
          } catch (error) {
            console.error(`Error polling channel ${subscription.channel}:`, error);
            if (onError) {
              onError(error as Error);
            }
          }
        }
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [subscriptions, pollingInterval, onMessage, onError]);
  
  // Send a message through REST API
  const sendMessage: WebSocketSendMessage = useCallback(async (message) => {
    try {
      console.log('Sending message via REST API:', message);
      
      // Handle different message types
      switch (message.type) {
        case 'subscribe':
          // Handle subscription request (processed in subscribe method)
          break;
        case 'unsubscribe':
          // Handle unsubscription request (processed in unsubscribe method)
          break;
        case 'ping':
          // No need to handle ping in REST implementation
          break;
        default:
          // For any other message type, send to appropriate API endpoint
          const endpoint = `/api/${message.type}`;
          await apiRequest(endpoint, 'POST', message.data);
      }
      
      return Promise.resolve();
    } catch (err) {
      console.error('Error sending message via REST API:', err);
      if (onError) {
        onError(err as Error);
      }
      return Promise.reject(err);
    }
  }, [onError]);
  
  // Subscribe to a specific data channel
  const subscribe = useCallback((channel: string) => {
    console.log(`Subscribing to ${channel} channel via REST polling`);
    
    // Check if already subscribed
    const existing = subscriptions.find(sub => sub.channel === channel);
    if (!existing) {
      setSubscriptions(prev => [...prev, { channel, lastPolled: 0 }]);
    }
  }, [subscriptions]);
  
  // Unsubscribe from a specific data channel
  const unsubscribe = useCallback((channel: string) => {
    console.log(`Unsubscribing from ${channel} channel`);
    setSubscriptions(prev => prev.filter(sub => sub.channel !== channel));
  }, []);
  
  // Start or stop polling
  const disconnect = useCallback(() => {
    console.log('Stopping REST API polling');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setIsConnected(false);
    
    if (onDisconnect) {
      onDisconnect();
    }
  }, [onDisconnect]);
  
  // Manually reconnect the polling
  const reconnect = useCallback(() => {
    console.log('Starting REST API polling');
    
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Start new polling interval
    pollingIntervalRef.current = setInterval(pollSubscriptions, pollingInterval);
    
    // Immediately poll once
    pollSubscriptions();
    
    setIsConnected(true);
    
    if (onConnect) {
      onConnect();
    }
  }, [pollSubscriptions, pollingInterval, onConnect]);
  
  // Initialize polling on component mount or when subscriptions change
  useEffect(() => {
    // Only start polling if we have subscriptions
    if (subscriptions.length > 0 && !pollingIntervalRef.current) {
      console.log(`Starting polling for ${subscriptions.length} channels`);
      reconnect();
    }
    
    // Clean up when component unmounts
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [subscriptions, reconnect]);
  
  useEffect(() => {
    // Set a global reference that can be checked by other components
    if (typeof window !== 'undefined') {
      window._webSocketInitialized = true;
      window._activePollingInstance = {
        subscriptions,
        isConnected,
        pollingInterval
      };
    }
    
    return () => {
      // Clean up global reference
      if (typeof window !== 'undefined') {
        window._webSocketInitialized = false;
        window._activePollingInstance = null;
      }
    };
  }, [subscriptions, isConnected, pollingInterval]);
  
  return {
    isConnected,
    lastMessage,
    sendMessage,
    subscribe,
    unsubscribe,
    disconnect,
    reconnect,
    reconnectCount
  };
}