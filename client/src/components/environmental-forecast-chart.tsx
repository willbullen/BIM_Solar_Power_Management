import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addHours } from 'date-fns';
import { 
  Line, 
  LineChart, 
  CartesianGrid, 
  Legend, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from "recharts";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EnvironmentalData {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  weather: string;
  sunIntensity: number;
  ghi?: number;
  dni?: number;
  air_temp?: number;
}

export function EnvironmentalForecastChart() {
  const [forecastHorizon, setForecastHorizon] = useState<number>(24);
  
  // Get latest environmental data
  const { data: environmentalData, isLoading, isError } = useQuery<EnvironmentalData[]>({
    queryKey: ['/api/environmental-data'],
    refetchInterval: 60 * 1000 // 1 minute
  });
  
  // Generate forecast data based on historical patterns
  const forecastData = useMemo(() => {
    if (!environmentalData || environmentalData.length < 24) return [];
    
    const now = new Date();
    const result = [];
    
    // Find average daily patterns from historical data
    const hourPatterns: Record<number, {
      temperature: number[],
      humidity: number[],
      sunIntensity: number[],
      ghi: number[],
      dni: number[]
    }> = {};
    
    // Initialize patterns for each hour
    for (let i = 0; i < 24; i++) {
      hourPatterns[i] = {
        temperature: [],
        humidity: [],
        sunIntensity: [],
        ghi: [],
        dni: []
      };
    }
    
    // Collect historical data for each hour
    environmentalData.forEach(entry => {
      const date = new Date(entry.timestamp);
      const hour = date.getHours();
      
      hourPatterns[hour].temperature.push(entry.temperature || entry.air_temp || 20);
      hourPatterns[hour].humidity.push(entry.humidity || 50);
      hourPatterns[hour].sunIntensity.push(entry.sunIntensity || 0);
      
      if (entry.ghi !== undefined) hourPatterns[hour].ghi.push(entry.ghi);
      if (entry.dni !== undefined) hourPatterns[hour].dni.push(entry.dni);
    });
    
    // Calculate averages for each hour
    const hourlyAverages = Object.entries(hourPatterns).map(([hour, patterns]) => {
      const getAverage = (values: number[]) => 
        values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      
      return {
        hour: parseInt(hour),
        temperature: getAverage(patterns.temperature),
        humidity: getAverage(patterns.humidity),
        sunIntensity: getAverage(patterns.sunIntensity),
        ghi: getAverage(patterns.ghi),
        dni: getAverage(patterns.dni)
      };
    });
    
    // Generate forecast for the next N hours
    for (let i = 0; i < forecastHorizon; i++) {
      const forecastTime = addHours(now, i);
      const hourOfDay = forecastTime.getHours();
      
      // Find pattern for this hour
      const hourPattern = hourlyAverages.find(h => h.hour === hourOfDay) || {
        temperature: 20,
        humidity: 50,
        sunIntensity: 0,
        ghi: 0,
        dni: 0
      };
      
      // Add some randomness to forecast (±10%)
      const addVariation = (value: number) => {
        const variation = value * (0.9 + Math.random() * 0.2);
        return variation;
      };
      
      // Adjust sun intensity based on time of day
      let sunIntensity = hourPattern.sunIntensity;
      let ghi = hourPattern.ghi;
      let dni = hourPattern.dni;
      
      // No sun at night
      if (hourOfDay < 6 || hourOfDay > 20) {
        sunIntensity = 0;
        ghi = 0;
        dni = 0;
      }
      
      // Peak sun during midday
      if (hourOfDay >= 10 && hourOfDay <= 14) {
        const peakMultiplier = 1.2;
        sunIntensity = Math.max(sunIntensity, hourPattern.sunIntensity * peakMultiplier);
        ghi = Math.max(ghi, hourPattern.ghi * peakMultiplier);
        dni = Math.max(dni, hourPattern.dni * peakMultiplier);
      }
      
      // Determine weather based on sun intensity
      let weather = 'Sunny';
      if (sunIntensity < 20) weather = 'Overcast';
      else if (sunIntensity < 40) weather = 'Cloudy';
      else if (sunIntensity < 60) weather = 'Mostly Cloudy';
      else if (sunIntensity < 80) weather = 'Partly Cloudy';
      
      result.push({
        timestamp: forecastTime,
        temperature: addVariation(hourPattern.temperature),
        humidity: addVariation(hourPattern.humidity),
        sunIntensity: sunIntensity,
        ghi: ghi,
        dni: dni,
        weather: weather
      });
    }
    
    return result;
  }, [environmentalData, forecastHorizon]);
  
  // Forecast horizon options
  const horizonOptions = [
    { value: 24, label: "24 Hours" },
    { value: 48, label: "48 Hours" },
    { value: 72, label: "72 Hours" }
  ];
  
  const formatHourlyLabel = (timestamp: Date) => {
    return format(timestamp, 'HH:mm\nMM/dd');
  };
  
  if (isLoading) {
    return (
      <Card className="col-span-full md:col-span-2 h-[380px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading environmental forecast data...</p>
        </div>
      </Card>
    );
  }
  
  if (isError) {
    return (
      <Card className="col-span-full md:col-span-2 h-[380px] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load environmental data.</p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="col-span-full md:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Environmental Forecast</CardTitle>
            <CardDescription>Predicted environmental conditions</CardDescription>
          </div>
          <Select
            value={forecastHorizon.toString()}
            onValueChange={(value) => setForecastHorizon(parseInt(value))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select horizon" />
            </SelectTrigger>
            <SelectContent>
              {horizonOptions.map(option => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <Tabs defaultValue="temperature">
          <TabsList className="grid w-full grid-cols-3 mb-3">
            <TabsTrigger value="temperature">Temperature</TabsTrigger>
            <TabsTrigger value="humidity">Humidity</TabsTrigger>
            <TabsTrigger value="solar">Solar Radiation</TabsTrigger>
          </TabsList>
          
          <TabsContent value="temperature" className="h-[330px] mt-0">
            <div className="h-full">
              {forecastData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={forecastData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatHourlyLabel}
                      interval={Math.floor(forecastData.length / 8)}
                    />
                    <YAxis label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value: any) => [`${value.toFixed(1)}°C`, 'Temperature']}
                      labelFormatter={(label: any) => format(new Date(label), 'MMM dd, HH:mm')}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="temperature" 
                      stroke="#ef4444" 
                      name="Temperature"
                      dot={false}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Info className="h-5 w-5 mr-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Not enough historical data for forecasting</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="humidity" className="h-[330px] mt-0">
            <div className="h-full">
              {forecastData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={forecastData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatHourlyLabel}
                      interval={Math.floor(forecastData.length / 8)}
                    />
                    <YAxis domain={[0, 100]} label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value: any) => [`${value.toFixed(1)}%`, 'Humidity']}
                      labelFormatter={(label: any) => format(new Date(label), 'MMM dd, HH:mm')}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="humidity" 
                      stroke="#3b82f6" 
                      name="Humidity"
                      dot={false}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Info className="h-5 w-5 mr-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Not enough historical data for forecasting</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="solar" className="h-[330px] mt-0">
            <div className="h-full">
              {forecastData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={forecastData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatHourlyLabel}
                      interval={Math.floor(forecastData.length / 8)}
                    />
                    <YAxis label={{ value: 'W/m²', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value: any, name: any) => {
                        if (name === 'Sun Intensity') return [`${Math.round(value)}%`, name];
                        return [`${Math.round(value)} W/m²`, name];
                      }}
                      labelFormatter={(label: any) => format(new Date(label), 'MMM dd, HH:mm')}
                    />
                    <Legend />
                    {forecastData[0].ghi !== undefined && (
                      <Line 
                        type="monotone" 
                        dataKey="ghi" 
                        stroke="#facc15" 
                        name="Global Horizontal" 
                        dot={false}
                        activeDot={{ r: 8 }}
                      />
                    )}
                    {forecastData[0].dni !== undefined && (
                      <Line 
                        type="monotone" 
                        dataKey="dni" 
                        stroke="#f97316" 
                        name="Direct Normal"
                        dot={false}
                        activeDot={{ r: 8 }}
                      />
                    )}
                    <Line 
                      type="monotone" 
                      dataKey="sunIntensity" 
                      stroke="#84cc16" 
                      name="Sun Intensity"
                      dot={false}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Info className="h-5 w-5 mr-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Not enough historical data for forecasting</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground mt-2 flex items-center">
          <Info className="h-3 w-3 mr-1 inline" />
          Forecast based on historical environmental patterns
        </div>
      </CardContent>
    </Card>
  );
}