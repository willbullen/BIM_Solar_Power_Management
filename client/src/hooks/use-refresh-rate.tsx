import { createContext, ReactNode, useContext, useState } from "react";

type RefreshRateContextType = {
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  refreshRateLabel: string;
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
  const [refreshInterval, setRefreshInterval] = useState<number>(10000); // Default: 10 seconds
  
  // Find the label for the current refresh interval
  const refreshRateLabel = REFRESH_RATES.find(rate => rate.value === refreshInterval)?.label || "10s";
  
  return (
    <RefreshRateContext.Provider
      value={{
        refreshInterval,
        setRefreshInterval,
        refreshRateLabel,
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