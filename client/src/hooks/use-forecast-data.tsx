import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export interface ForecastData {
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

export interface PvForecastData {
  forecasts: {
    period_end: string;
    period: string;
    pv_estimate: number;
    pv_estimate10?: number;
    pv_estimate90?: number;
  }[];
}

export interface ForecastOptions {
  horizon?: number; // Hours to forecast ahead
  period?: string; // Time interval between forecasts (e.g. 'PT30M')
}

export function useForecastData(options: ForecastOptions = {}) {
  const { horizon = 72, period = 'PT30M' } = options;
  const [selectedHorizon, setSelectedHorizon] = useState<number>(horizon);
  
  // Fetch weather and radiation forecast data
  const { data: forecastData, isLoading: isForecastLoading, error: forecastError } = useQuery({
    queryKey: ['/api/solcast/forecast', selectedHorizon, period],
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  // Fetch PV power forecast data
  const { data: pvForecastData, isLoading: isPvForecastLoading, error: pvForecastError } = useQuery({
    queryKey: ['/api/solcast/pv-forecast', selectedHorizon, period],
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const isLoading = isForecastLoading || isPvForecastLoading;
  const error = forecastError || pvForecastError;
  
  // Filter data to the selected time horizon
  const filteredForecastData = forecastData as ForecastData;
  const filteredPvForecastData = pvForecastData as PvForecastData;

  // Combine data for display
  const combinedData = useCombinedForecastData(filteredForecastData, filteredPvForecastData);
  
  return {
    forecastData: filteredForecastData,
    pvForecastData: filteredPvForecastData,
    combinedData,
    isLoading,
    error,
    isFallback: filteredForecastData?._fallback || false,
    selectedHorizon,
    setSelectedHorizon,
  };
}

// Helper function to combine weather and PV forecast data
function useCombinedForecastData(forecastData?: ForecastData, pvForecastData?: PvForecastData) {
  const [combinedData, setCombinedData] = useState<any[]>([]);
  
  useEffect(() => {
    if (!forecastData?.forecasts || !pvForecastData?.forecasts) {
      setCombinedData([]);
      return;
    }
    
    // Create a map of period_end to PV forecast
    const pvMap = new Map();
    pvForecastData.forecasts.forEach(pv => {
      pvMap.set(pv.period_end, pv);
    });
    
    // Combine data
    const combined = forecastData.forecasts.map(weather => {
      const pv = pvMap.get(weather.period_end);
      if (!pv) return null;
      
      return {
        timestamp: new Date(weather.period_end),
        period_end: weather.period_end,
        period: weather.period,
        air_temp: weather.air_temp,
        ghi: weather.ghi,
        dni: weather.dni,
        dhi: weather.dhi || 0,
        cloud_opacity: weather.cloud_opacity || 0,
        wind_speed: weather.wind_speed_10m || 0,
        wind_direction: weather.wind_direction_10m || 0,
        pv_estimate: pv.pv_estimate,
        pv_estimate10: pv.pv_estimate10 || 0,
        pv_estimate90: pv.pv_estimate90 || 0,
      };
    }).filter(Boolean);
    
    setCombinedData(combined);
  }, [forecastData, pvForecastData]);
  
  return combinedData;
}

// Custom hook for forecast horizon selection
export function useForecastHorizon() {
  const [selectedHorizon, setSelectedHorizon] = useState<number>(72);
  
  const horizonOptions = [
    { value: 24, label: '24 Hours' },
    { value: 48, label: '48 Hours' },
    { value: 72, label: '3 Days' },
    { value: 168, label: '7 Days' }
  ];
  
  const selectHorizon = (value: number) => {
    setSelectedHorizon(value);
    // Invalidate related queries to refresh data with new horizon
    queryClient.invalidateQueries({ queryKey: ['/api/solcast/forecast'] });
    queryClient.invalidateQueries({ queryKey: ['/api/solcast/pv-forecast'] });
  };
  
  return {
    selectedHorizon,
    horizonOptions,
    selectHorizon
  };
}