import { createContext, ReactNode, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { PowerData, EnvironmentalData, Settings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRefreshRate } from "@/hooks/use-refresh-rate";
import { useWebSocket, WebSocketMessage } from "@/hooks/use-websocket";

type PowerDataContextType = {
  powerData: PowerData | null;
  environmentalData: EnvironmentalData | null;
  historicalPowerData: PowerData[];
  historicalEnvironmentalData: EnvironmentalData[];
  settings: Settings | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  dataStatus: 'live' | 'synthetic' | 'offline';
  connectionType: 'websocket' | 'polling';
  isConnected: boolean;
};

export const PowerDataContext = createContext<PowerDataContextType | null>(null);

export function PowerDataProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { refreshInterval } = useRefreshRate();
  const [powerData, setPowerData] = useState<PowerData | null>(null);
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataStatus, setDataStatus] = useState<'live' | 'synthetic' | 'offline'>('offline');
  const [wsEnabled, setWsEnabled] = useState<boolean>(true);
  
  // Set up REST API polling for real-time data (using the WebSocket compatible interface)
  const { 
    isConnected: wsConnected,
    subscribe,
    lastMessage,
    reconnectCount,
    reconnect
  } = useWebSocket({
    pollingInterval: refreshInterval, // Use the global refresh interval for polling
    maxReconnectAttempts: 15, // Increase max reconnection attempts
    reconnectDelay: 2000,     // Shorter initial delay between reconnect attempts
    onConnect: () => {
      console.log('REST API polling started, subscribing to data channels');
      
      // Re-enable connection if it was disabled due to previous connection issues
      if (!wsEnabled) {
        setWsEnabled(true);
      }
      
      // Subscribe to power and environmental data channels
      subscribe('power-data');
      subscribe('environmental-data');
      subscribe('settings');
      
      // Only show toast if we're reconnecting after a failure
      if (reconnectCount > 0) {
        toast({
          title: "Data polling enabled",
          description: "You are now receiving data updates via polling.",
          variant: "default",
        });
      }
    },
    onMessage: (message: WebSocketMessage) => {
      // Handle incoming messages by data type
      if (message.type === 'power-data' && message.data) {
        setPowerData(message.data);
        setLastUpdated(new Date());
      } else if (message.type === 'environmental-data' && message.data) {
        setEnvironmentalData(message.data);
        setLastUpdated(new Date());
      } else if (message.type === 'settings' && message.data) {
        setSettings(message.data);
        setDataStatus(message.data.dataSource === 'synthetic' ? 'synthetic' : 'live');
      }
    },
    onDisconnect: () => {
      console.log('REST API polling stopped, will retry');
      
      // If we disconnected, this means something went wrong with polling
      setWsEnabled(false);
      
      // Show toast only on first disconnection
      if (wsEnabled) {
        toast({
          title: "Polling connection lost",
          description: "Connection to data service unavailable. Will continue retrying.",
          variant: "default",
        });
      }
    },
    onError: (error) => {
      console.error('REST API polling error:', error);
      // On error, try to use more aggressive polling strategy
      setWsEnabled(false);
    }
  });
  
  // Fetch historical power data
  const {
    data: historicalPowerData = [],
    isLoading: isLoadingPowerData,
    error: powerDataError,
  } = useQuery<PowerData[], Error>({
    queryKey: ["/api/power-data"],
  });
  
  // Fetch historical environmental data
  const {
    data: historicalEnvironmentalData = [],
    isLoading: isLoadingEnvironmentalData,
    error: environmentalDataError,
  } = useQuery<EnvironmentalData[], Error>({
    queryKey: ["/api/environmental-data"],
  });
  
  // Fetch settings
  const {
    data: settingsData,
    isLoading: isLoadingSettings,
    error: settingsError,
  } = useQuery<Settings, Error>({
    queryKey: ["/api/settings"],
  });
  
  // Define the fetch function with useCallback to properly handle dependencies and return a Promise
  const fetchLatestData = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Fetching latest data via REST API...');
      
      // Use the apiRequest function with Promise.all for concurrent requests
      const [powerData, environmentalData, settings] = await Promise.all([
        apiRequest('/api/power-data/latest', 'GET'),
        apiRequest('/api/environmental-data/latest', 'GET'),
        apiRequest('/api/settings', 'GET')
      ]);
      
      // Update state with fetched data
      setPowerData(powerData);
      setEnvironmentalData(environmentalData);
      setSettings(settings);
      setDataStatus(settings.dataSource === 'synthetic' ? 'synthetic' : 'live');
      setLastUpdated(new Date());
      
      console.log('Latest data fetched successfully');
      return true; // Success
    } catch (error) {
      console.error('Error fetching latest data:', error);
      // Only show toast error every 30 seconds to avoid spamming
      const now = new Date().getTime();
      if (!lastUpdated || (now - lastUpdated.getTime() > 30000)) {
        toast({
          title: "Data Connection Issue",
          description: "There may be a temporary issue with the data connection. The system will continue to try to reconnect.",
          variant: "destructive",
        });
      }
      
      // Don't immediately go offline - stay in current status for continuity
      if (!lastUpdated) {
        setDataStatus('offline');
      }
      
      // Re-throw the error to properly handle it in promise chains
      return false; // Failure
    }
  }, [toast, lastUpdated]);
  
  // CRITICAL FIX: Completely redesigned refresh rate control system
  // We'll use our own timer instead of relying on the refresh rate provider
  // This ensures we have complete control over the polling frequency
  
  // References for our polling system
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);
  
  // A more controlled approach to fetching data with proper throttling
  const startPolling = useCallback(() => {
    // Clear any existing timer first
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    
    // Only start direct polling if REST API polling is not already enabled
    if (wsConnected && wsEnabled) {
      console.log('REST API polling already active, not starting additional polling');
      return;
    }
    
    console.log(`🔄 Starting data polling with interval: ${refreshInterval}ms`);
    
    // Function to perform the data fetch with proper throttling
    const pollData = () => {
      // Calculate time since last fetch
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;
      
      // Don't fetch if we're already fetching or if it's been less than half the refresh interval
      if (isFetchingRef.current || (lastFetchTimeRef.current > 0 && timeSinceLastFetch < refreshInterval / 2)) {
        console.log(`Skipping fetch - already fetching: ${isFetchingRef.current}, time since last: ${timeSinceLastFetch}ms`);
        
        // Schedule next fetch respecting the minimum interval
        const nextFetchDelay = Math.max(refreshInterval - timeSinceLastFetch, 1000);
        console.log(`Next fetch scheduled in ${nextFetchDelay}ms`);
        
        pollingTimerRef.current = setTimeout(pollData, nextFetchDelay);
        return;
      }
      
      // Mark as fetching and update the last fetch time
      isFetchingRef.current = true;
      
      console.log(`⏰ Fetching data (refresh rate: ${refreshInterval}ms)`);
      
      // Perform the actual fetch
      fetchLatestData()
        .then(() => {
          // Update the last fetch time on success
          lastFetchTimeRef.current = Date.now();
          console.log('Fetch completed successfully');
        })
        .catch((err) => {
          console.error('Error during fetch:', err);
        })
        .finally(() => {
          // Reset the fetching flag
          isFetchingRef.current = false;
          
          // Schedule the next fetch
          pollingTimerRef.current = setTimeout(pollData, refreshInterval);
          console.log(`Next fetch scheduled in ${refreshInterval}ms`);
        });
    };
    
    // Start the polling
    pollData();
  }, [refreshInterval, wsConnected, wsEnabled, fetchLatestData]);
  
  // Start or restart polling when refresh interval changes or connection status changes
  useEffect(() => {
    console.log('Refresh interval or connection status changed, updating polling');
    startPolling();
    
    // Initial data fetch on mount, regardless of polling
    if (lastFetchTimeRef.current === 0) {
      fetchLatestData().then(() => {
        lastFetchTimeRef.current = Date.now();
      });
    }
    
    // Clean up polling on unmount
    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [refreshInterval, wsConnected, wsEnabled, startPolling, fetchLatestData]);
  
  // Create a persistent ref for tracking reconnection timer
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Periodically attempt to reconnect polling if it's disconnected but enabled
  useEffect(() => {
    // Helper function to clean up existing timer
    const cleanupReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    
    // Clean up existing timer first
    cleanupReconnectTimer();
    
    // If polling is enabled but not connected, try to reconnect periodically
    if (wsEnabled && !wsConnected && reconnect) {
      console.log('Setting up periodic REST API polling reconnection attempts');
      
      reconnectTimerRef.current = setInterval(() => {
        console.log('Attempting to restart REST API polling');
        reconnect();
      }, 60000); // Try to reconnect every minute
    }
    
    return cleanupReconnectTimer;
  }, [wsEnabled, wsConnected, reconnect]);
  
  // Update settings when they change from the query
  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
      setDataStatus(settingsData.dataSource === 'synthetic' ? 'synthetic' : 'live');
    }
  }, [settingsData]);
  
  const isLoading = isLoadingPowerData || isLoadingEnvironmentalData || isLoadingSettings;
  const error = powerDataError || environmentalDataError || settingsError || null;
  
  // Determine the current connection type and status
  // Even though it's all REST API now, maintain the interface for compatibility
  const connectionType = wsConnected && wsEnabled ? 'polling' : 'polling';
  const isConnected = (wsConnected && wsEnabled) || lastUpdated !== null;

  return (
    <PowerDataContext.Provider
      value={{
        powerData,
        environmentalData,
        historicalPowerData,
        historicalEnvironmentalData,
        settings,
        isLoading,
        error,
        lastUpdated,
        dataStatus,
        connectionType,
        isConnected
      }}
    >
      {children}
    </PowerDataContext.Provider>
  );
}

export function usePowerData() {
  const context = useContext(PowerDataContext);
  if (!context) {
    throw new Error("usePowerData must be used within a PowerDataProvider");
  }
  return context;
}
