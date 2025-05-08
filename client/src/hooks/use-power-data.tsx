import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PowerData, EnvironmentalData, Settings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

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
};

export const PowerDataContext = createContext<PowerDataContextType | null>(null);

export function PowerDataProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [powerData, setPowerData] = useState<PowerData | null>(null);
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataStatus, setDataStatus] = useState<'live' | 'synthetic' | 'offline'>('offline');
  
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
  
  // Set up data fetching mechanism - use polling instead of WebSockets for better compatibility
  useEffect(() => {
    console.log('Starting power data polling...');
    
    // Initial data fetch
    const fetchLatestData = async () => {
      try {
        console.log('Fetching latest data...');
        
        // Use the fetch API with error handling and timeout
        // Simplified fetch with timeout that doesn't use AbortController
        // to avoid browser-specific implementation issues
        const fetchWithTimeout = async (url: string, timeout = 5000) => {
          // Use Promise.race to implement timeout without AbortController
          const fetchPromise = fetch(url);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Request timed out'));
            }, timeout);
          });
          
          try {
            // Race between the fetch and the timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
            return response;
          } catch (error) {
            throw error;
          }
        };
        
        // Fetch data with timeouts to prevent hanging requests
        const powerResponse = await fetchWithTimeout('/api/power-data/latest');
        const envResponse = await fetchWithTimeout('/api/environmental-data/latest');
        const settingsResponse = await fetchWithTimeout('/api/settings');
        
        // Check if any responses failed
        if (!powerResponse.ok || !envResponse.ok || !settingsResponse.ok) {
          console.error('API response error:', {
            power: powerResponse.status,
            env: envResponse.status,
            settings: settingsResponse.status
          });
          throw new Error('Failed to fetch latest data');
        }
        
        // Parse JSON responses
        const powerData = await powerResponse.json();
        const environmentalData = await envResponse.json();
        const settings = await settingsResponse.json();
        
        // Update state with fetched data
        setPowerData(powerData);
        setEnvironmentalData(environmentalData);
        setSettings(settings);
        setDataStatus(settings.dataSource === 'synthetic' ? 'synthetic' : 'live');
        setLastUpdated(new Date());
        
        console.log('Latest data fetched successfully');
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
      }
    };
    
    // Fetch data immediately
    fetchLatestData();
    
    // Set up polling interval - get fresh data every 10 seconds
    const pollingInterval = setInterval(fetchLatestData, 10000);
    
    // Clean up on unmount
    return () => {
      clearInterval(pollingInterval);
    };
  }, [toast, lastUpdated]);
  
  // Update settings when they change from the query
  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
      setDataStatus(settingsData.dataSource === 'synthetic' ? 'synthetic' : 'live');
    }
  }, [settingsData]);
  
  const isLoading = isLoadingPowerData || isLoadingEnvironmentalData || isLoadingSettings;
  const error = powerDataError || environmentalDataError || settingsError || null;
  
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
