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
      <Card className="border-sidebar-border bg-sidebar shadow-sm">
        <CardHeader className="pb-2 pt-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-yellow-500" />
                Current Metrics
              </span>
            </CardTitle>
            <Badge variant={dataStatus === 'live' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0 shadow-sm">
              {dataStatus === 'live' ? 'Live' : 'Historical'}
            </Badge>
          </div>
          {lastUpdated && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Updated: {format(new Date(lastUpdated), 'HH:mm:ss')}
            </p>
          )}
        </CardHeader>
        <CardContent className="pb-2 pt-1">
          <div className="space-y-2 rounded-md bg-background/50 p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Zap className="h-3 w-3 mr-1.5 text-yellow-500" />
                <span className="text-xs font-medium">Total Load</span>
              </div>
              <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded-md">
                {latestPower ? `${latestPower.totalLoad.toFixed(1)} kW` : '-- kW'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Gauge className="h-3 w-3 mr-1.5 text-blue-500" />
                <span className="text-xs font-medium">Grid Power</span>
              </div>
              <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded-md">
                {latestPower ? `${latestPower.mainGridPower.toFixed(1)} kW` : '-- kW'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Sun className="h-3 w-3 mr-1.5 text-amber-500" />
                <span className="text-xs font-medium">Solar Output</span>
              </div>
              <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded-md">
                {latestPower ? `${latestPower.solarOutput.toFixed(1)} kW` : '-- kW'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CloudSun className="h-3 w-3 mr-1.5 text-green-500" />
                <span className="text-xs font-medium">Solar Efficiency</span>
              </div>
              <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded-md">
                {latestPower ? `${solarEfficiency.toFixed(1)}%` : '--%'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-sidebar-border bg-sidebar shadow-sm">
        <CardHeader className="pb-2 pt-2">
          <CardTitle className="text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <CloudSun className="h-3.5 w-3.5 text-blue-500" />
              Environmental Data
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-1">
          <div className="space-y-2 rounded-md bg-background/50 p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Thermometer className="h-3 w-3 mr-1.5 text-red-500" />
                <span className="text-xs font-medium">Temperature</span>
              </div>
              <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded-md">
                {environmentalData ? `${environmentalData.air_temp.toFixed(1)}°C` : '--°C'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Sun className="h-3 w-3 mr-1.5 text-yellow-500" />
                <span className="text-xs font-medium">Solar Radiation</span>
              </div>
              <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded-md">
                {environmentalData ? `${environmentalData.ghi.toFixed(0)} W/m²` : '-- W/m²'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Wind className="h-3 w-3 mr-1.5 text-blue-400" />
                <span className="text-xs font-medium">Wind Speed</span>
              </div>
              <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded-md">
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