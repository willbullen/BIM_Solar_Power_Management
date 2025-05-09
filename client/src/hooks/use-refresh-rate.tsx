import { createContext, ReactNode, useContext, useState, useEffect, useRef } from "react";

// Special flag to ensure we only have one provider instance
declare global {
  interface Window {
    _refreshRateProviderInitialized?: boolean;
  }
}

type RefreshRateContextType = {
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  refreshRateLabel: string;
  shouldFetch: boolean; // Signal to trigger data fetch
  setFetchComplete: () => void; // Signal that fetch is complete
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
  // Check if we already have an initialized provider
  const [isInitialized] = useState(() => {
    const alreadyInitialized = typeof window !== 'undefined' && window._refreshRateProviderInitialized === true;
    if (alreadyInitialized) {
      console.warn('Multiple RefreshRateProvider instances detected. This may cause issues with polling.');
      return false;
    }
    
    // Mark as initialized
    if (typeof window !== 'undefined') {
      window._refreshRateProviderInitialized = true;
      console.log('RefreshRateProvider initialized as singleton');
    }
    return true;
  });
  
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
  
  // State to indicate when data should be fetched (initialized to true to trigger first fetch)
  const [shouldFetch, setShouldFetch] = useState<boolean>(isInitialized);
  
  // Timer reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Guards against concurrent fetch requests with proper initialization
  const pendingFetchCountRef = useRef<number>(isInitialized ? 1 : 0);
  
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
  
  // The pendingFetchCountRef is already initialized above (line 79)
  
  // Improved version: Signal that fetch is complete and schedule next one
  const setFetchComplete = () => {
    // Decrement pending fetch counter
    if (pendingFetchCountRef.current > 0) {
      pendingFetchCountRef.current--;
    }
    
    // Only proceed if all fetches are complete
    if (pendingFetchCountRef.current === 0) {
      // Clear previous timeout
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      // Mark current fetch as complete
      setShouldFetch(false);
      
      // Schedule next fetch with precise timing
      const exactInterval = Math.max(refreshInterval, 1000); // Minimum 1 second to avoid overloading
      
      console.log(`Scheduling next fetch in ${exactInterval}ms (rate: ${refreshRateLabel})`);
      
      timerRef.current = setTimeout(() => {
        console.log(`Refresh timer triggered after ${exactInterval}ms`);
        pendingFetchCountRef.current++; // Increment counter before triggering fetch
        setShouldFetch(true);
      }, exactInterval);
    } else {
      console.log(`Fetch complete but ${pendingFetchCountRef.current} fetches still pending`);
    }
  };
  
  // Clean up timer on unmount
  useEffect(() => {
    console.log(`*** REFRESH RATE PROVIDER INITIALIZED: ${refreshInterval}ms ***`);
    
    // Log the current state for debugging
    const logState = () => {
      console.log(`Current refresh state - Rate: ${refreshInterval}ms, Should fetch: ${shouldFetch}, Has timer: ${!!timerRef.current}`);
    };
    
    // Log initial state
    logState();
    
    // Set up periodic logging for debugging
    const debugLogInterval = setInterval(logState, 10000);
    
    return () => {
      console.log(`*** REFRESH RATE PROVIDER CLEANUP ***`);
      
      // Clear our timers
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      clearInterval(debugLogInterval);
      
      // If we're the initialized instance, release the singleton when unmounted
      if (isInitialized && typeof window !== 'undefined') {
        console.log('Releasing RefreshRateProvider singleton');
        window._refreshRateProviderInitialized = false;
      }
    };
  }, [refreshInterval, shouldFetch]);
  
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