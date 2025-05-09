import { createContext, ReactNode, useContext, useState, useEffect, useRef } from "react";

type RefreshRateContextType = {
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  refreshRateLabel: string;
  shouldFetch: boolean; // NEW: Signal to trigger data fetch
  setFetchComplete: () => void; // NEW: Signal that fetch is complete
};

const RefreshRateContext = createContext<RefreshRateContextType | undefined>(undefined);

type RefreshRateOption = {
  label: string;
  value: number; // in milliseconds
};

export const REFRESH_RATES: RefreshRateOption[] = [
  { label: "1s", value: 1000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
  { label: "5m", value: 300000 },
  { label: "10m", value: 600000 },
];

export function RefreshRateProvider({ children }: { children: ReactNode }) {
  // Default to 10s refresh interval
  const defaultInterval = 10000;
  
  // Initialize from localStorage if available
  const [refreshInterval, setRefreshIntervalState] = useState<number>(() => {
    try {
      const savedInterval = localStorage.getItem('refreshRate');
      if (savedInterval) {
        const parsed = parseInt(savedInterval, 10);
        if (!isNaN(parsed) && REFRESH_RATES.some(rate => rate.value === parsed)) {
          console.log(`Loaded saved refresh rate from localStorage: ${parsed}ms`);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load refresh rate from localStorage:', e);
    }
    return defaultInterval;
  });
  
  // NEW: State to indicate when data should be fetched
  const [shouldFetch, setShouldFetch] = useState<boolean>(true);
  
  // Timer reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // NEW: Handle refresh rate changes
  const setRefreshInterval = (newInterval: number) => {
    console.log(`Changing refresh rate from ${refreshInterval}ms to ${newInterval}ms`);
    
    // Store the selected refresh rate in localStorage for persistence
    try {
      localStorage.setItem('refreshRate', String(newInterval));
    } catch (e) {
      console.error('Failed to save refresh rate to localStorage:', e);
    }
    
    // Update state after localStorage is updated
    setRefreshIntervalState(newInterval);
    
    // Reset timer and force immediate data fetch
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Trigger an immediate fetch
    setShouldFetch(true);
  };
  
  // NEW: Signal that fetch is complete and schedule next one
  const setFetchComplete = () => {
    // Clear previous timeout
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Mark current fetch as complete
    setShouldFetch(false);
    
    // Schedule next fetch
    timerRef.current = setTimeout(() => {
      setShouldFetch(true);
    }, refreshInterval);
    
    console.log(`Next fetch scheduled in ${refreshInterval}ms`);
  };
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);
  
  // Find the label for the current refresh interval
  const refreshRateLabel = REFRESH_RATES.find(rate => rate.value === refreshInterval)?.label || "10s";
  
  return (
    <RefreshRateContext.Provider
      value={{
        refreshInterval,
        setRefreshInterval,
        refreshRateLabel,
        shouldFetch,
        setFetchComplete
      }}
    >
      {children}
    </RefreshRateContext.Provider>
  );
}

export function useRefreshRate() {
  const context = useContext(RefreshRateContext);
  if (context === undefined) {
    throw new Error("useRefreshRate must be used within a RefreshRateProvider");
  }
  return context;
}