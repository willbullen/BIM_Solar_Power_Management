import React, { useState } from 'react';
import { useSolcastPvForecast, ProcessedPvForecast } from "@/hooks/use-solcast-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { 
  Area, 
  AreaChart, 
  Bar, 
  BarChart,
  CartesianGrid, 
  Legend, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from "recharts";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatDate = (date: Date) => {
  return format(date, 'MMM dd HH:mm');
};

export function SolcastForecastChart() {
  const [forecastHorizon, setForecastHorizon] = useState<number>(48);
  
  const { 
    data: pvForecastData,
    processedData: processedForecastData,
    isLoading: isLoadingPvForecast,
    isError: isErrorPvForecast
  } = useSolcastPvForecast(forecastHorizon);
  
  // For daily aggregation
  const aggregateDailyData = (data: ProcessedPvForecast[]) => {
    const dailyData: Record<string, {
      date: string,
      minP10: number,
      maxP90: number,
      avgP50: number,
      sumP50: number,
      count: number,
    }> = {};
    
    data.forEach(item => {
      const day = format(item.timestamp, 'yyyy-MM-dd');
      
      if (!dailyData[day]) {
        dailyData[day] = {
          date: format(item.timestamp, 'MMM dd'),
          minP10: item.p10,
          maxP90: item.p90,
          avgP50: item.p50,
          sumP50: item.p50,
          count: 1
        };
      } else {
        const current = dailyData[day];
        current.minP10 = Math.min(current.minP10, item.p10);
        current.maxP90 = Math.max(current.maxP90, item.p90);
        current.sumP50 += item.p50;
        current.count += 1;
      }
    });
    
    // Calculate averages
    return Object.values(dailyData).map(day => ({
      ...day,
      avgP50: day.sumP50 / day.count
    }));
  };
  
  const dailyData = React.useMemo(() => {
    return aggregateDailyData(processedForecastData || []);
  }, [processedForecastData]);
  
  // Helper function to get custom tooltip content
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow">
          <p className="font-medium">{payload[0].payload.periodEnd ? formatDate(new Date(payload[0].payload.periodEnd)) : label}</p>
          <p className="text-emerald-600 dark:text-emerald-400">
            <span className="font-medium">Expected (P50):</span> {payload[1]?.value.toFixed(2)} kW
          </p>
          <p className="text-amber-600 dark:text-amber-400">
            <span className="font-medium">High (P90):</span> {payload[2]?.value.toFixed(2)} kW
          </p>
          <p className="text-blue-600 dark:text-blue-400">
            <span className="font-medium">Low (P10):</span> {payload[0]?.value.toFixed(2)} kW
          </p>
        </div>
      );
    }
    return null;
  };
  
  // Forecast horizon options
  const horizonOptions = [
    { value: 24, label: "24 Hours" },
    { value: 48, label: "48 Hours" },
    { value: 72, label: "72 Hours" },
    { value: 168, label: "7 Days" }
  ];
  
  if (isLoadingPvForecast) {
    return (
      <Card className="col-span-full md:col-span-2 h-[380px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading forecast data...</p>
        </div>
      </Card>
    );
  }
  
  if (isErrorPvForecast) {
    return (
      <Card className="col-span-full md:col-span-2 h-[380px] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load forecast data.</p>
          <p className="text-xs text-muted-foreground mt-1">Using fallback data.</p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="col-span-full md:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Solar Output Forecast</CardTitle>
            <CardDescription>PV power prediction with confidence bands</CardDescription>
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
        <Tabs defaultValue="hourly">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="hourly">Hourly</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hourly" className="h-[330px] mt-0">
            <div className="h-full">
              {processedForecastData && processedForecastData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={processedForecastData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(tickItem) => format(new Date(tickItem), 'HH:mm\nMM/dd')}
                      interval={Math.floor(processedForecastData.length / 8)}
                    />
                    <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" />
                    <Area 
                      type="monotone" 
                      dataKey="p10" 
                      stackId="1"
                      stroke="#3b82f6" 
                      fill="#3b82f680" 
                      name="Min (P10)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="p50" 
                      stackId="2"
                      stroke="#059669" 
                      fill="#059669" 
                      fillOpacity={0.5}
                      name="Expected (P50)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="p90" 
                      stackId="3"
                      stroke="#d97706" 
                      fill="#d9770680"
                      name="Max (P90)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Info className="h-5 w-5 mr-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No forecast data available</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="daily" className="h-[330px] mt-0">
            <div className="h-full">
              {dailyData && dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailyData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend verticalAlign="top" />
                    <Bar dataKey="avgP50" name="Average Output" fill="#059669" />
                    <Bar dataKey="minP10" name="Minimum (P10)" fill="#3b82f6" />
                    <Bar dataKey="maxP90" name="Maximum (P90)" fill="#d97706" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Info className="h-5 w-5 mr-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No daily forecast data available</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground mt-2 flex items-center">
          <Info className="h-3 w-3 mr-1 inline" />
          {data?._fallback ? 
            "Using fallback forecast data. API subscription may need renewal." : 
            "Showing Solcast API forecast data with confidence bands"
          }
        </div>
      </CardContent>
    </Card>
  );
}