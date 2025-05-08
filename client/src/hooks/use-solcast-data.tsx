import { useQuery } from "@tanstack/react-query";

interface SolcastLiveRadiationData {
  estimated_actuals: {
    period_end: string;
    period: string;
    ghi: number;
    dni: number;
    air_temp: number;
    dhi?: number;
    cloud_opacity?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  }[];
}

interface SolcastLivePvData {
  estimated_actuals: {
    period_end: string;
    period: string;
    pv_estimate: number;
  }[];
}

interface SolcastForecastData {
  forecasts: {
    period_end: string;
    period: string;
    ghi: number;
    dni: number;
    air_temp: number;
    dhi?: number;
    cloud_opacity?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  }[];
  _fallback?: boolean;
}

interface SolcastPvForecastData {
  forecasts: {
    period_end: string;
    period: string;
    pv_estimate: number;
    pv_estimate10?: number;
    pv_estimate90?: number;
  }[];
}

export function useSolcastLiveRadiation() {
  return useQuery<SolcastLiveRadiationData>({
    queryKey: ['/api/solcast/live-radiation'],
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSolcastLivePv() {
  return useQuery<SolcastLivePvData>({
    queryKey: ['/api/solcast/live-pv'],
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSolcastForecast(hours: number = 48) {
  return useQuery<SolcastForecastData>({
    queryKey: ['/api/solcast/forecast', hours],
    queryFn: async () => {
      const response = await fetch(`/api/solcast/forecast?hours=${hours}`);
      if (!response.ok) {
        throw new Error('Failed to fetch forecast data');
      }
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 60 * 1000, // 30 minutes
  });
}

export interface ProcessedPvForecast {
  periodEnd: Date;
  timestamp: Date;
  p50: number; // Median estimate
  p10: number; // Lower bound (10th percentile)
  p90: number; // Upper bound (90th percentile)
}

export function useSolcastPvForecast(hours: number = 48) {
  const { data, isLoading, isError } = useQuery<SolcastPvForecastData>({
    queryKey: ['/api/solcast/pv-forecast', hours],
    queryFn: async () => {
      const response = await fetch(`/api/solcast/pv-forecast?hours=${hours}`);
      if (!response.ok) {
        throw new Error('Failed to fetch PV forecast data');
      }
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 60 * 1000, // 30 minutes
  });
  
  // Process data to transform into a more chart-friendly format
  const processedData = React.useMemo<ProcessedPvForecast[]>(() => {
    if (!data?.forecasts) return [];
    
    return data.forecasts.map((forecast) => ({
      periodEnd: new Date(forecast.period_end),
      timestamp: new Date(forecast.period_end),
      p50: forecast.pv_estimate, // Median estimate
      p10: forecast.pv_estimate10 || forecast.pv_estimate * 0.7, // Lower bound (10th percentile)
      p90: forecast.pv_estimate90 || forecast.pv_estimate * 1.3, // Upper bound (90th percentile)
    }));
  }, [data]);
  
  return {
    data,
    processedData,
    isLoading,
    isError,
  };
}