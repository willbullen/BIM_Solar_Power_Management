import { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Area, ComposedChart, ReferenceLine
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle, Sun, Thermometer, Wind, CloudRain } from 'lucide-react';
import { format, parseISO, addHours } from 'date-fns';

interface ForecastChartProps {
  forecastData: any[];
  isLoading: boolean;
  isFallback?: boolean;
  className?: string;
  onHorizonChange?: (horizon: number) => void;
  selectedHorizon?: number;
}

export function ForecastChart({ 
  forecastData, 
  isLoading, 
  isFallback = false,
  className,
  onHorizonChange,
  selectedHorizon = 72
}: ForecastChartProps) {
  const [activeTab, setActiveTab] = useState('solar');

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Weather & Solar Forecast</CardTitle>
          <CardDescription>Loading forecast data...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!forecastData || forecastData.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Weather & Solar Forecast</CardTitle>
          <CardDescription>No forecast data available</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p className="text-muted-foreground">No forecast data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format time for x-axis
  const formatXAxis = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return format(date, 'HH:mm');
  };

  // Format tooltip time
  const formatTooltipTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return format(date, 'MMM dd, HH:mm');
  };

  // Custom tooltip formatter
  const formatTooltip = (value: number, name: string) => {
    if (name === 'ghi' || name === 'dni' || name === 'dhi') return `${value.toFixed(0)} W/m²`;
    if (name === 'air_temp') return `${value.toFixed(1)}°C`;
    if (name === 'cloud_opacity') return `${(value * 100).toFixed(0)}%`;
    if (name === 'wind_speed') return `${value.toFixed(1)} km/h`;
    if (name === 'pv_estimate') return `${value.toFixed(2)} kW`;
    if (name === 'pv_estimate10') return `P10: ${value.toFixed(2)} kW`;
    if (name === 'pv_estimate90') return `P90: ${value.toFixed(2)} kW`;
    return value;
  };

  // Day/night reference lines
  const today = new Date();
  const sunriseTime = new Date(today.setHours(6, 0, 0, 0));
  const sunsetTime = new Date(today.setHours(20, 0, 0, 0));

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              Weather & Solar Forecast
              {isFallback && (
                <Badge variant="outline" className="ml-2 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  Using Fallback Data
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Solcast API-powered weather and PV forecast
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2 mt-2 sm:mt-0">
            <span className="text-sm text-muted-foreground">Forecast horizon:</span>
            <Select 
              value={selectedHorizon.toString()}
              onValueChange={(value) => onHorizonChange?.(parseInt(value))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Horizon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 Hours</SelectItem>
                <SelectItem value="48">48 Hours</SelectItem>
                <SelectItem value="72">3 Days</SelectItem>
                <SelectItem value="168">7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="solar" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="solar" className="flex items-center gap-1">
              <Sun className="h-4 w-4" />
              <span>Solar Radiation</span>
            </TabsTrigger>
            <TabsTrigger value="pv" className="flex items-center gap-1">
              <Sun className="h-4 w-4" />
              <span>PV Output</span>
            </TabsTrigger>
            <TabsTrigger value="weather" className="flex items-center gap-1">
              <Thermometer className="h-4 w-4" />
              <span>Weather</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Solar Radiation Tab */}
          <TabsContent value="solar" className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={forecastData}
                margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatXAxis} 
                  tick={{ fontSize: 12 }}
                  tickCount={8}
                />
                <YAxis
                  yAxisId="left"
                  domain={[0, 'auto']}
                  tickFormatter={(value) => `${value} W/m²`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  labelFormatter={(label) => formatTooltipTime(label)}
                  formatter={formatTooltip}
                />
                <Legend verticalAlign="top" height={36} />
                <ReferenceLine x={sunriseTime} stroke="#FFA500" strokeDasharray="3 3" label={{ value: 'Sunrise', position: 'insideTopLeft', fontSize: 10 }} />
                <ReferenceLine x={sunsetTime} stroke="#0078D7" strokeDasharray="3 3" label={{ value: 'Sunset', position: 'insideTopRight', fontSize: 10 }} />
                <Line 
                  yAxisId="left"
                  name="Global Horizontal (GHI)" 
                  type="monotone" 
                  dataKey="ghi" 
                  stroke="#FFA500" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="left"
                  name="Direct Normal (DNI)" 
                  type="monotone" 
                  dataKey="dni" 
                  stroke="#FF5722" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="left"
                  name="Diffuse Horizontal (DHI)" 
                  type="monotone" 
                  dataKey="dhi" 
                  stroke="#90CAF9" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          
          {/* PV Power Tab */}
          <TabsContent value="pv" className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={forecastData}
                margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatXAxis} 
                  tick={{ fontSize: 12 }}
                  tickCount={8}
                />
                <YAxis
                  domain={[0, 'auto']}
                  tickFormatter={(value) => `${value.toFixed(1)} kW`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  labelFormatter={(label) => formatTooltipTime(label)}
                  formatter={formatTooltip}
                />
                <Legend verticalAlign="top" height={36} />
                <ReferenceLine x={sunriseTime} stroke="#FFA500" strokeDasharray="3 3" label={{ value: 'Sunrise', position: 'insideTopLeft', fontSize: 10 }} />
                <ReferenceLine x={sunsetTime} stroke="#0078D7" strokeDasharray="3 3" label={{ value: 'Sunset', position: 'insideTopRight', fontSize: 10 }} />
                <Area
                  type="monotone"
                  dataKey="pv_estimate90"
                  name="Upper Range (P90)"
                  fill="#4CAF50"
                  stroke="none"
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="pv_estimate10"
                  name="Lower Range (P10)"
                  fill="#4CAF50"
                  stroke="none"
                  fillOpacity={0.1}
                />
                <Line 
                  name="PV Output (P50)" 
                  type="monotone" 
                  dataKey="pv_estimate" 
                  stroke="#4CAF50" 
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </TabsContent>
          
          {/* Weather Tab */}
          <TabsContent value="weather" className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={forecastData}
                margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatXAxis} 
                  tick={{ fontSize: 12 }}
                  tickCount={8}
                />
                <YAxis
                  yAxisId="temp"
                  domain={[0, 35]}
                  tickFormatter={(value) => `${value}°C`}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  labelFormatter={(label) => formatTooltipTime(label)}
                  formatter={formatTooltip}
                />
                <Legend verticalAlign="top" height={36} />
                <Line 
                  yAxisId="temp"
                  name="Temperature" 
                  type="monotone" 
                  dataKey="air_temp" 
                  stroke="#FF5722" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="right"
                  name="Cloud Opacity" 
                  type="monotone" 
                  dataKey="cloud_opacity" 
                  stroke="#90CAF9" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="temp"
                  name="Wind Speed" 
                  type="monotone" 
                  dataKey="wind_speed" 
                  stroke="#4CAF50" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
        
        <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <p className="font-semibold mb-1">Forecast Notes:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>P10/P90 values represent the probabilistic range of PV output forecasts</li>
            <li>GHI (Global Horizontal Irradiance) is total solar radiation on horizontal surface</li>
            <li>DNI (Direct Normal Irradiance) is direct beam radiation only</li>
            <li>DHI (Diffuse Horizontal Irradiance) is indirect scattered radiation</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}