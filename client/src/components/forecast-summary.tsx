import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { AlertTriangle, CloudRain, Sun, Thermometer, Wind } from 'lucide-react';
import { format } from 'date-fns';

interface ForecastSummaryProps {
  forecastData: any[];
  isLoading: boolean;
  isFallback?: boolean;
  className?: string;
}

export function ForecastSummary({ 
  forecastData, 
  isLoading, 
  isFallback = false,
  className 
}: ForecastSummaryProps) {
  if (isLoading || !forecastData || forecastData.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Forecast Summary
            {isFallback && (
              <Badge variant="outline" className="ml-2 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                Using Fallback Data
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isLoading ? 'Loading forecast data...' : 'No forecast data available'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[200px]">
          {isLoading ? (
            <p className="text-muted-foreground">Loading summary data...</p>
          ) : (
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-muted-foreground">No forecast data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Calculate summary stats
  const temperatures = forecastData.map(data => data.air_temp);
  const ghi = forecastData.map(data => data.ghi);
  const pvOutput = forecastData.map(data => data.pv_estimate);
  const cloudOpacity = forecastData.map(data => data.cloud_opacity || 0);
  const windSpeed = forecastData.map(data => data.wind_speed || 0);
  
  // Get 24h, 48h, 72h periods
  const now = new Date();
  const next24h = forecastData.filter(d => {
    const date = new Date(d.timestamp);
    return date <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
  });
  
  const next48h = forecastData.filter(d => {
    const date = new Date(d.timestamp);
    return date <= new Date(now.getTime() + 48 * 60 * 60 * 1000);
  });
  
  // Peak solar periods
  const peakRadiationTime = forecastData.reduce((max, current) => {
    return current.ghi > (max.ghi || 0) ? current : max;
  }, { ghi: 0, timestamp: now });
  
  const peakPvTime = forecastData.reduce((max, current) => {
    return current.pv_estimate > (max.pv_estimate || 0) ? current : max;
  }, { pv_estimate: 0, timestamp: now });
  
  // Group by day and calculate daily metrics
  const dailyData = forecastData.reduce((acc, curr) => {
    const date = new Date(curr.timestamp);
    const dayKey = format(date, 'yyyy-MM-dd');
    
    if (!acc[dayKey]) {
      acc[dayKey] = {
        date: new Date(date.setHours(0, 0, 0, 0)),
        ghiSum: 0,
        totalPv: 0,
        samples: 0,
        maxTemp: -Infinity,
        minTemp: Infinity,
        avgCloud: 0,
        cloudSamples: 0
      };
    }
    
    acc[dayKey].ghiSum += curr.ghi || 0;
    acc[dayKey].totalPv += curr.pv_estimate || 0;
    acc[dayKey].samples += 1;
    
    if (curr.air_temp > acc[dayKey].maxTemp) acc[dayKey].maxTemp = curr.air_temp;
    if (curr.air_temp < acc[dayKey].minTemp) acc[dayKey].minTemp = curr.air_temp;
    
    if (typeof curr.cloud_opacity === 'number') {
      acc[dayKey].avgCloud += curr.cloud_opacity;
      acc[dayKey].cloudSamples += 1;
    }
    
    return acc;
  }, {});
  
  // Convert to array
  const dailySummary = Object.values(dailyData)
    .map((day: any) => ({
      ...day,
      totalGhi: day.ghiSum,
      avgGhi: day.ghiSum / day.samples,
      totalEnergy: day.totalPv / 2, // Converting kW for 30-min periods to kWh
      avgCloud: day.cloudSamples ? day.avgCloud / day.cloudSamples : 0
    }))
    .sort((a: any, b: any) => a.date - b.date);
    
  // Format for display
  const formatTime = (timestamp: Date | string) => {
    if (!timestamp) return 'N/A';
    return format(new Date(timestamp), 'MMM dd, HH:mm');
  };
  
  // Function to get weather condition icon
  const getWeatherIcon = (cloudOpacity: number) => {
    if (cloudOpacity < 0.3) return <Sun className="w-5 h-5 text-yellow-400" />;
    if (cloudOpacity < 0.7) return <Sun className="w-5 h-5 text-gray-400" />;
    return <CloudRain className="w-5 h-5 text-blue-400" />;
  };
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Forecast Summary
          {isFallback && (
            <Badge variant="outline" className="ml-2 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              Using Fallback Data
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Key insights from weather and PV forecast data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Peak Values */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Peak Values</h3>
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Sun className="h-5 w-5 text-yellow-400" />
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">Peak Solar Radiation</h4>
                <div className="flex justify-between items-center mt-1 text-sm">
                  <p className="font-medium">{Math.round(peakRadiationTime.ghi)} W/m²</p>
                  <p className="text-xs text-muted-foreground">at {formatTime(peakRadiationTime.timestamp)}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Sun className="h-5 w-5 text-green-400" />
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">Peak PV Output</h4>
                <div className="flex justify-between items-center mt-1 text-sm">
                  <p className="font-medium">{peakPvTime.pv_estimate.toFixed(2)} kW</p>
                  <p className="text-xs text-muted-foreground">at {formatTime(peakPvTime.timestamp)}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Thermometer className="h-5 w-5 text-red-400" />
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">Temperature Range</h4>
                <div className="flex justify-between items-center mt-1 text-sm">
                  <p className="font-medium">
                    {Math.min(...temperatures).toFixed(1)}°C - {Math.max(...temperatures).toFixed(1)}°C
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Daily Summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Daily Forecasts</h3>
            
            {dailySummary.slice(0, 3).map((day: any, index: number) => (
              <div key={index} className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
                {getWeatherIcon(day.avgCloud)}
                <div className="flex-1">
                  <h4 className="font-medium text-white text-sm">{format(day.date, 'EEE, MMM dd')}</h4>
                  <div className="flex justify-between items-center mt-1 text-xs">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-yellow-400">{Math.round(day.avgGhi)} W/m²</span> avg radiation
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-green-400">{day.totalEnergy.toFixed(1)} kWh</span> total energy
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-muted-foreground">
                        <span className="font-medium">{day.minTemp.toFixed(1)}-{day.maxTemp.toFixed(1)}°C</span>
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium">{(day.avgCloud * 100).toFixed(0)}%</span> cloud coverage
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Operational Insights */}
        <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20 text-xs">
          <p className="font-semibold mb-1 text-primary">Operational Insights:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Optimal solar production expected {formatTime(peakPvTime.timestamp)} ({peakPvTime.pv_estimate.toFixed(2)} kW)</li>
            <li>• Expected energy yield: {dailySummary[0]?.totalEnergy.toFixed(1)} kWh today, {dailySummary.reduce((sum, day) => sum + day.totalEnergy, 0).toFixed(1)} kWh next 7 days</li>
            <li>• Consider scheduling high-power operations between {format(new Date().setHours(10, 0), 'HH:mm')} - {format(new Date().setHours(16, 0), 'HH:mm')} to maximize solar utilization</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}