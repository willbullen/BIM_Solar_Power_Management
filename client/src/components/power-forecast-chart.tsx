import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addHours } from 'date-fns';
import { 
  Area, 
  AreaChart, 
  CartesianGrid, 
  Legend, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from "recharts";
import { Loader2, AlertTriangle, Info } from "lucide-react";

interface PowerData {
  timestamp: string;
  mainGridPower: number;
  solarOutput: number;
  refrigerationLoad: number;
  bigColdRoom: number;
  bigFreezer: number;
  smoker: number;
  totalLoad: number;
  unaccountedLoad: number;
}

export function PowerForecastChart() {
  const [forecastHorizon, setForecastHorizon] = useState<number>(24);
  
  // Get latest power data
  const { data: powerData, isLoading, isError } = useQuery<PowerData[]>({
    queryKey: ['/api/power-data'],
    refetchInterval: 60 * 1000 // 1 minute
  });
  
  // Generate forecast data based on historical patterns
  const forecastData = useMemo(() => {
    if (!powerData || powerData.length < 24) return [];
    
    const now = new Date();
    const result = [];
    
    // Find average daily patterns from historical data
    const hourPatterns: Record<number, {
      totalLoad: number[],
      solarOutput: number[],
      gridPower: number[],
      refrigeration: number[]
    }> = {};
    
    // Initialize patterns for each hour
    for (let i = 0; i < 24; i++) {
      hourPatterns[i] = {
        totalLoad: [],
        solarOutput: [],
        gridPower: [],
        refrigeration: []
      };
    }
    
    // Collect historical data for each hour
    powerData.forEach(entry => {
      const date = new Date(entry.timestamp);
      const hour = date.getHours();
      
      hourPatterns[hour].totalLoad.push(entry.totalLoad);
      hourPatterns[hour].solarOutput.push(entry.solarOutput);
      hourPatterns[hour].gridPower.push(entry.mainGridPower);
      hourPatterns[hour].refrigeration.push(entry.refrigerationLoad + entry.bigColdRoom + entry.bigFreezer);
    });
    
    // Calculate averages for each hour
    const hourlyAverages = Object.entries(hourPatterns).map(([hour, patterns]) => {
      const getAverage = (values: number[]) => 
        values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      
      return {
        hour: parseInt(hour),
        totalLoad: getAverage(patterns.totalLoad),
        solarOutput: getAverage(patterns.solarOutput),
        gridPower: getAverage(patterns.gridPower),
        refrigeration: getAverage(patterns.refrigeration)
      };
    });
    
    // Generate forecast for the next N hours
    for (let i = 0; i < forecastHorizon; i++) {
      const forecastTime = addHours(now, i);
      const hourOfDay = forecastTime.getHours();
      
      // Find pattern for this hour
      const hourPattern = hourlyAverages.find(h => h.hour === hourOfDay) || {
        totalLoad: 5,
        solarOutput: 0,
        gridPower: 5,
        refrigeration: 3
      };
      
      // Add some randomness to forecast (±10%)
      const addVariation = (value: number) => {
        const variation = value * (0.9 + Math.random() * 0.2);
        return Math.max(0, variation);
      };
      
      // Adjust solar output based on time of day
      let solarOutput = hourPattern.solarOutput;
      
      // No solar at night
      if (hourOfDay < 6 || hourOfDay > 20) {
        solarOutput = 0;
      }
      
      // Peak solar during midday
      if (hourOfDay >= 10 && hourOfDay <= 14) {
        solarOutput = Math.max(solarOutput, hourPattern.solarOutput * 1.2);
      }
      
      result.push({
        timestamp: forecastTime,
        totalLoad: addVariation(hourPattern.totalLoad),
        solarOutput: addVariation(solarOutput),
        gridPower: addVariation(hourPattern.gridPower),
        refrigeration: addVariation(hourPattern.refrigeration)
      });
    }
    
    return result;
  }, [powerData, forecastHorizon]);
  
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
          <p className="text-sm text-muted-foreground">Loading power forecast data...</p>
        </div>
      </Card>
    );
  }
  
  if (isError) {
    return (
      <Card className="col-span-full md:col-span-2 h-[380px] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load power data.</p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="col-span-full md:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Power Usage Forecast</CardTitle>
            <CardDescription>Predicted power consumption</CardDescription>
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
        <div className="h-[330px]">
          {forecastData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={forecastData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#facc15" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGrid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRef" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatHourlyLabel}
                  interval={Math.floor(forecastData.length / 8)}
                />
                <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(2)} kW`, '']}
                  labelFormatter={(label: any) => format(new Date(label), 'MMM dd, HH:mm')}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="totalLoad" 
                  stroke="#06b6d4" 
                  fill="url(#colorTotal)" 
                  name="Total Load"
                />
                <Area 
                  type="monotone" 
                  dataKey="solarOutput" 
                  stroke="#facc15" 
                  fill="url(#colorSolar)" 
                  name="Solar Output"
                />
                <Area 
                  type="monotone" 
                  dataKey="gridPower" 
                  stroke="#f97316" 
                  fill="url(#colorGrid)" 
                  name="Grid Power"
                />
                <Area 
                  type="monotone" 
                  dataKey="refrigeration" 
                  stroke="#3b82f6" 
                  fill="url(#colorRef)" 
                  name="Refrigeration"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Info className="h-5 w-5 mr-2 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">Not enough historical data for forecasting</p>
            </div>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground mt-2 flex items-center">
          <Info className="h-3 w-3 mr-1 inline" />
          Forecast based on historical consumption patterns
        </div>
      </CardContent>
    </Card>
  );
}