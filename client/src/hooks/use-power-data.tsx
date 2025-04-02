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
  
  // Set up WebSocket connection
  useEffect(() => {
    // Use polling as an alternative to WebSockets for better Replit compatibility
    console.log('Starting power data polling...');
    
    // Initial data fetch
    const fetchLatestData = async () => {
      try {
        console.log('Fetching latest data...');
        const [powerResponse, envResponse, settingsResponse] = await Promise.all([
          fetch(`${window.location.origin}/api/power-data/latest`, { credentials: 'include' }),
          fetch(`${window.location.origin}/api/environmental-data/latest`, { credentials: 'include' }),
          fetch(`${window.location.origin}/api/settings`, { credentials: 'include' })
        ]);
        
        if (!powerResponse.ok || !envResponse.ok || !settingsResponse.ok) {
          throw new Error('Failed to fetch latest data');
        }
        
        const powerData = await powerResponse.json();
        const environmentalData = await envResponse.json();
        const settings = await settingsResponse.json();
        
        setPowerData(powerData);
        setEnvironmentalData(environmentalData);
        setSettings(settings);
        setDataStatus(settings.dataSource === 'synthetic' ? 'synthetic' : 'live');
        setLastUpdated(new Date());
        
        console.log('Latest data fetched successfully');
      } catch (error) {
        console.error('Error fetching latest data:', error);
        toast({
          title: "Data Fetch Error",
          description: "Failed to fetch latest power monitoring data.",
          variant: "destructive",
        });
        setDataStatus('offline');
      }
    };
    
    // Fetch data immediately
    fetchLatestData();
    
    // Set up polling interval
    const pollingInterval = setInterval(fetchLatestData, 10000); // Poll every 10 seconds
    
    // For compatibility, let's keep a dummy WebSocket object
    const dummyWs = {
      readyState: 1,
      close: () => {}
    };
    setSocket(dummyWs as any);
    
    return () => {
      clearInterval(pollingInterval);
    };
  }, [toast]);
  
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
