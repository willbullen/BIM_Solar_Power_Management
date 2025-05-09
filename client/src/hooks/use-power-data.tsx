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
  
  // Set up WebSocket connection for real-time data
  const { 
    isConnected: wsConnected,
    subscribe,
    lastMessage,
    reconnectCount,
    reconnect
  } = useWebSocket({
    maxReconnectAttempts: 15, // Increase max reconnection attempts
    reconnectDelay: 2000,     // Shorter initial delay between reconnect attempts
    onConnect: () => {
      console.log('WebSocket connected, subscribing to data channels');
      
      // Re-enable WebSocket if it was disabled due to previous connection issues
      if (!wsEnabled) {
        setWsEnabled(true);
      }
      
      // Subscribe to power and environmental data channels
      subscribe('power-data');
      subscribe('environmental-data');
      
      // Only show toast if we're reconnecting after a failure
      if (reconnectCount > 0) {
        toast({
          title: "Real-time data enabled",
          description: "You are now receiving real-time data updates.",
          variant: "default",
        });
      }
    },
    onMessage: (message: WebSocketMessage) => {
      // Handle incoming WebSocket messages by data type
      if (message.type === 'power-data') {
        setPowerData(message.data);
        setLastUpdated(new Date());
      } else if (message.type === 'environmental-data') {
        setEnvironmentalData(message.data);
        setLastUpdated(new Date());
      } else if (message.type === 'settings') {
        setSettings(message.data);
        setDataStatus(message.data.dataSource === 'synthetic' ? 'synthetic' : 'live');
      }
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected, falling back to polling');
      // If we disconnected, enable polling as fallback
      setWsEnabled(false);
      
      // Show toast only on first disconnection
      if (wsEnabled) {
        toast({
          title: "Switched to polling mode",
          description: "Connection to real-time data unavailable. Using automatic refresh instead.",
          variant: "default",
        });
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      // On error, fall back to polling
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
        apiRequest('GET', '/api/power-data/latest'),
        apiRequest('GET', '/api/environmental-data/latest'),
        apiRequest('GET', '/api/settings')
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
  
  // Initial data fetch when component mounts
  useEffect(() => {
    fetchLatestData();
  }, [fetchLatestData]);
  
  // New approach: Use the built-in rate controller from RefreshRateProvider
  const { shouldFetch, setFetchComplete } = useRefreshRate();
  
  // This effect runs ONLY when the shouldFetch flag changes
  useEffect(() => {
    // Turn off WebSocket connection attempts when we're debugging
    // This will force the use of polling which is more reliable for testing refresh rates
    const debugMode = false; // Set to false to use WebSockets when available
    
    // Skip polling if WebSocket is connected and we're not in debug mode
    if (wsConnected && wsEnabled && !debugMode) {
      console.log('WebSocket connected, skipping polling');
      return;
    }
    
    // Only fetch when the shouldFetch flag is true
    if (shouldFetch) {
      console.log(`⏰ Fetching data (refresh rate: ${refreshInterval}ms)`);
      
      // Perform the fetch
      fetchLatestData()
        .then(() => {
          console.log('Fetch completed successfully');
          // Let the rate controller know we're done
          setFetchComplete();
        })
        .catch((err) => {
          console.error('Error during fetch:', err);
          // Even on error, let the rate controller know we're done
          setFetchComplete();
        });
    }
  }, [shouldFetch, wsConnected, wsEnabled, refreshInterval, fetchLatestData, setFetchComplete]);
  
  // Create a persistent ref for tracking reconnection timer
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Periodically attempt to reconnect WebSocket if it's disconnected but enabled
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
    
    // If WebSocket is enabled but not connected, try to reconnect periodically
    if (wsEnabled && !wsConnected && reconnect) {
      console.log('Setting up periodic WebSocket reconnection attempts');
      
      reconnectTimerRef.current = setInterval(() => {
        console.log('Attempting to reconnect WebSocket');
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
  const connectionType = wsConnected && wsEnabled ? 'websocket' : 'polling';
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
