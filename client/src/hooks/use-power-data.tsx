import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PowerData, EnvironmentalData, Settings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRefreshRate } from "@/hooks/use-refresh-rate";

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
  const { refreshInterval } = useRefreshRate();
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
    console.log(`Starting power data polling with interval: ${refreshInterval}ms`);
    
    // Initial data fetch
    const fetchLatestData = async () => {
      try {
        console.log('Fetching latest data...');
        
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
    
    // Set up polling interval based on the selected refresh rate
    const pollingInterval = setInterval(fetchLatestData, refreshInterval);
    
    // Clean up on unmount or when refreshInterval changes
    return () => {
      console.log(`Clearing polling interval (${refreshInterval}ms) and setting up new one if needed`);
      clearInterval(pollingInterval);
    };
    
    // The refreshInterval dependency ensures this effect runs again when the rate changes
  }, [toast, refreshInterval]);
  
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
