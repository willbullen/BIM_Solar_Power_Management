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

export function useSolcastForecast() {
  return useQuery<SolcastForecastData>({
    queryKey: ['/api/solcast/forecast'],
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 60 * 1000, // 30 minutes
  });
}

export function useSolcastPvForecast() {
  return useQuery<SolcastPvForecastData>({
    queryKey: ['/api/solcast/pv-forecast'],
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 60 * 1000, // 30 minutes
  });
}