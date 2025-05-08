import React, { useState } from 'react';
import { useSolcastForecast } from "@/hooks/use-solcast-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
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
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Droplets, Sun, SunDim, Thermometer, Wind } from 'lucide-react';

const getWeatherIcon = (weather: string) => {
  switch (weather?.toLowerCase()) {
    case 'sunny':
      return <Sun className="h-5 w-5 text-amber-500" />;
    case 'clear':
      return <Sun className="h-5 w-5 text-amber-500" />;
    case 'partly cloudy':
      return <SunDim className="h-5 w-5 text-amber-400" />;
    case 'mostly cloudy':
      return <Cloud className="h-5 w-5 text-gray-400" />;
    case 'cloudy':
      return <Cloud className="h-5 w-5 text-gray-500" />;
    case 'overcast':
      return <Cloud className="h-5 w-5 text-gray-600" />;
    case 'fog':
      return <CloudFog className="h-5 w-5 text-gray-400" />;
    case 'light rain':
      return <CloudRain className="h-5 w-5 text-blue-400" />;
    case 'rain':
      return <CloudRain className="h-5 w-5 text-blue-500" />;
    case 'heavy rain':
      return <CloudRain className="h-5 w-5 text-blue-600" />;
    case 'thunderstorm':
      return <CloudLightning className="h-5 w-5 text-purple-500" />;
    case 'snow':
      return <CloudSnow className="h-5 w-5 text-blue-200" />;
    default:
      return <Sun className="h-5 w-5 text-amber-500" />;
  }
};

export function SolcastWeatherForecast() {
  const [forecastHorizon, setForecastHorizon] = useState<number>(48);
  
  const { 
    data: forecastData,
    isLoading: isLoadingForecast,
    isError: isErrorForecast
  } = useSolcastForecast(forecastHorizon);
  
  // Process the forecast data
  const processedData = React.useMemo(() => {
    if (!forecastData?.forecasts) return [];
    
    return forecastData.forecasts.map((forecast: any) => ({
      ...forecast,
      timestamp: new Date(forecast.period_end),
      weather: forecast.weather || determineWeatherFromRadiation(forecast.ghi, forecast.dni, forecast.cloud_opacity),
    }));
  }, [forecastData]);
  
  // Function to determine weather based on radiation values
  function determineWeatherFromRadiation(ghi: number, dni: number, cloudOpacity?: number) {
    if (cloudOpacity !== undefined) {
      if (cloudOpacity >= 0.8) return 'Overcast';
      if (cloudOpacity >= 0.5) return 'Cloudy';
      if (cloudOpacity >= 0.3) return 'Mostly Cloudy';
      if (cloudOpacity > 0) return 'Partly Cloudy';
      return 'Sunny';
    }
    
    // Fallback using GHI and DNI
    const ratio = dni / (ghi || 1); // Avoid division by zero
    
    if (ghi < 50) return 'Overcast';
    if (ratio < 0.3) return 'Cloudy';
    if (ratio < 0.5) return 'Mostly Cloudy';
    if (ratio < 0.8) return 'Partly Cloudy';
    return 'Sunny';
  }
  
  // Forecast horizon options
  const horizonOptions = [
    { value: 24, label: "24 Hours" },
    { value: 48, label: "48 Hours" },
    { value: 72, label: "72 Hours" },
    { value: 168, label: "7 Days" }
  ];
  
  const formatHourlyLabel = (timestamp: Date) => {
    return format(timestamp, 'HH:mm\nMM/dd');
  };
  
  if (isLoadingForecast) {
    return (
      <Card className="col-span-full md:col-span-2 h-[380px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading weather forecast data...</p>
        </div>
      </Card>
    );
  }
  
  if (isErrorForecast) {
    return (
      <Card className="col-span-full md:col-span-2 h-[380px] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load weather forecast data.</p>
          <p className="text-xs text-muted-foreground mt-1">Using fallback data.</p>
        </div>
      </Card>
    );
  }
  
  // Weather timeline renderer
  const renderWeatherTimeline = () => {
    // Take first 24 forecast points (or less if not available)
    const timelineData = processedData.slice(0, Math.min(24, processedData.length));
    
    if (!timelineData.length) {
      return (
        <div className="flex items-center justify-center h-[150px]">
          <Info className="h-5 w-5 mr-2 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No weather timeline data available</p>
        </div>
      );
    }
    
    return (
      <div className="flex overflow-x-auto pb-2 pt-2 px-1 space-x-3">
        {timelineData.map((item, index) => (
          <div key={index} className="flex flex-col items-center min-w-[70px]">
            <span className="text-xs text-muted-foreground">
              {format(item.timestamp, 'HH:mm')}
            </span>
            <div className="my-2">
              {getWeatherIcon(item.weather)}
            </div>
            <Badge variant="outline" className="text-xs px-2 py-0 h-5">
              {item.weather}
            </Badge>
            <div className="text-sm mt-2 flex items-center">
              <Thermometer className="h-3 w-3 mr-1" />
              <span>{Math.round(item.air_temp)}°C</span>
            </div>
            {item.wind_speed_10m && (
              <div className="text-xs text-muted-foreground flex items-center">
                <Wind className="h-3 w-3 mr-1" />
                <span>{Math.round(item.wind_speed_10m)} km/h</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <Card className="col-span-full md:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Weather Forecast</CardTitle>
            <CardDescription>Predicted weather conditions</CardDescription>
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
        <div className="mb-3">
          <h4 className="text-sm font-medium mb-2">24-Hour Weather Timeline</h4>
          {renderWeatherTimeline()}
        </div>
        
        <Tabs defaultValue="temperature">
          <TabsList className="grid w-full grid-cols-3 mb-3">
            <TabsTrigger value="temperature">Temperature</TabsTrigger>
            <TabsTrigger value="radiation">Solar Radiation</TabsTrigger>
            <TabsTrigger value="cloud">Cloud Cover</TabsTrigger>
          </TabsList>
          
          <TabsContent value="temperature" className="h-[240px] mt-0">
            <div className="h-full">
              {processedData && processedData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={processedData}
                    margin={{ top: 5, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatHourlyLabel}
                      interval={Math.floor(processedData.length / 8)}
                    />
                    <YAxis label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value: any) => [`${value.toFixed(1)}°C`, 'Temperature']}
                      labelFormatter={(label: any) => format(new Date(label), 'MMM dd, HH:mm')}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="air_temp" 
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
                  <p className="text-muted-foreground text-sm">No temperature data available</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="radiation" className="h-[240px] mt-0">
            <div className="h-full">
              {processedData && processedData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={processedData}
                    margin={{ top: 5, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatHourlyLabel}
                      interval={Math.floor(processedData.length / 8)}
                    />
                    <YAxis label={{ value: 'W/m²', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value: any, name: any) => [`${Math.round(value)} W/m²`, name]}
                      labelFormatter={(label: any) => format(new Date(label), 'MMM dd, HH:mm')}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="ghi" 
                      stroke="#facc15" 
                      name="Global Horizontal" 
                      dot={false}
                      activeDot={{ r: 8 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="dni" 
                      stroke="#f97316" 
                      name="Direct Normal"
                      dot={false}
                      activeDot={{ r: 8 }}
                    />
                    {processedData[0].dhi && (
                      <Line 
                        type="monotone" 
                        dataKey="dhi" 
                        stroke="#84cc16" 
                        name="Diffuse Horizontal"
                        dot={false}
                        activeDot={{ r: 8 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Info className="h-5 w-5 mr-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No radiation data available</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="cloud" className="h-[240px] mt-0">
            <div className="h-full">
              {processedData && processedData.length > 0 && processedData[0].cloud_opacity !== undefined ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={processedData}
                    margin={{ top: 5, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatHourlyLabel}
                      interval={Math.floor(processedData.length / 8)}
                    />
                    <YAxis domain={[0, 1]} label={{ value: 'Cloud Opacity', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value: any) => [`${(value * 100).toFixed(0)}%`, 'Cloud Cover']}
                      labelFormatter={(label: any) => format(new Date(label), 'MMM dd, HH:mm')}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="cloud_opacity" 
                      stroke="#64748b" 
                      name="Cloud Cover"
                      dot={false}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Info className="h-5 w-5 mr-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No cloud cover data available</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground mt-2 flex items-center">
          <Info className="h-3 w-3 mr-1 inline" />
          {forecastData?._fallback ? 
            "Using fallback forecast data. API subscription may need renewal." : 
            "Showing Solcast API weather forecast data"
          }
        </div>
      </CardContent>
    </Card>
  );
}