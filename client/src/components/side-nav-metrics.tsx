import React from 'react';
import { usePowerData } from '@/hooks/use-power-data';
import { Zap, Sun, CloudSun, Gauge, Thermometer, Wind } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function SideNavMetrics() {
  const { powerData, environmentalData, isLoading, lastUpdated, dataStatus } = usePowerData();

  // Get the latest data
  const latestPower = Array.isArray(powerData) && powerData.length > 0 ? powerData[powerData.length - 1] : null;

  // Calculate solar efficiency
  const solarEfficiency = latestPower && latestPower.totalLoad > 0 
    ? (latestPower.solarOutput / latestPower.totalLoad) * 100
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="border-sidebar-border bg-sidebar">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Metrics</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-sidebar-border bg-sidebar">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Environmental Data</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-sidebar-border bg-sidebar">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Current Metrics</CardTitle>
            <Badge variant={dataStatus === 'live' ? 'default' : 'outline'} className="text-xs">
              {dataStatus === 'live' ? 'Live' : 'Historical'}
            </Badge>
          </div>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(lastUpdated), 'HH:mm:ss')}
            </p>
          )}
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Zap className="h-3.5 w-3.5 mr-2 text-yellow-500" />
                <span className="text-xs">Total Load</span>
              </div>
              <span className="text-xs font-medium">
                {latestPower ? `${latestPower.totalLoad.toFixed(1)} kW` : '-- kW'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Gauge className="h-3.5 w-3.5 mr-2 text-blue-500" />
                <span className="text-xs">Grid Power</span>
              </div>
              <span className="text-xs font-medium">
                {latestPower ? `${latestPower.mainGridPower.toFixed(1)} kW` : '-- kW'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Sun className="h-3.5 w-3.5 mr-2 text-amber-500" />
                <span className="text-xs">Solar Output</span>
              </div>
              <span className="text-xs font-medium">
                {latestPower ? `${latestPower.solarOutput.toFixed(1)} kW` : '-- kW'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CloudSun className="h-3.5 w-3.5 mr-2 text-green-500" />
                <span className="text-xs">Solar Efficiency</span>
              </div>
              <span className="text-xs font-medium">
                {latestPower ? `${solarEfficiency.toFixed(1)}%` : '--%'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-sidebar-border bg-sidebar">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-medium">Environmental Data</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Thermometer className="h-3.5 w-3.5 mr-2 text-red-500" />
                <span className="text-xs">Temperature</span>
              </div>
              <span className="text-xs font-medium">
                {environmentalData ? `${environmentalData.air_temp.toFixed(1)}°C` : '--°C'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Sun className="h-3.5 w-3.5 mr-2 text-yellow-500" />
                <span className="text-xs">Solar Radiation</span>
              </div>
              <span className="text-xs font-medium">
                {environmentalData ? `${environmentalData.ghi.toFixed(0)} W/m²` : '-- W/m²'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Wind className="h-3.5 w-3.5 mr-2 text-blue-400" />
                <span className="text-xs">Wind Speed</span>
              </div>
              <span className="text-xs font-medium">
                {environmentalData && environmentalData.windSpeed !== null ? 
                  `${environmentalData.windSpeed.toFixed(1)} km/h` : '-- km/h'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}