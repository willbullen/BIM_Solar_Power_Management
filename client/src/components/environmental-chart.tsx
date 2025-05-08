import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnvironmentalData } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Loader2, Sun, CloudRain, Wind, Thermometer } from 'lucide-react';

type EnvironmentalChartProps = {
  environmentalData: EnvironmentalData[];
  className?: string;
  isLoading?: boolean;
};

export function EnvironmentalChart({ environmentalData, className, isLoading = false }: EnvironmentalChartProps) {
  // Format data for chart
  const chartData = environmentalData.map(data => ({
    timestamp: new Date(data.timestamp),
    temperature: data.air_temp,
    solarRadiation: data.ghi,
    directRadiation: data.dni,
    humidity: data.humidity || 0,
    windSpeed: data.windSpeed || 0,
    weather: data.weather,
  }));

  // Custom tooltip formatter
  const formatTooltip = (value: number, name: string) => {
    if (name === 'temperature') return `${value.toFixed(1)}°C`;
    if (name === 'solarRadiation') return `${value.toFixed(0)} W/m²`;
    if (name === 'directRadiation') return `${value.toFixed(0)} W/m²`;
    if (name === 'humidity') return `${value.toFixed(0)}%`;
    if (name === 'windSpeed') return `${value.toFixed(1)} km/h`;
    return value;
  };
  
  // Format the X-axis (time)
  const formatXAxis = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Environmental Conditions</CardTitle>
          <CardDescription>Loading environmental data...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!environmentalData.length) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Environmental Conditions</CardTitle>
          <CardDescription>No environmental data available</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No data to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Environmental Conditions</CardTitle>
        <CardDescription>
          Kerry weather data (temperature, sun, humidity, and wind)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: 30,
                left: 0,
                bottom: 0,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis} 
                tick={{ fontSize: 12 }} 
              />
              <YAxis 
                yAxisId="temp" 
                domain={[0, 25]} 
                tickFormatter={(value) => `${value}°C`} 
                tick={{ fontSize: 12 }} 
              />
              <YAxis 
                yAxisId="percent" 
                orientation="right" 
                domain={[0, 100]} 
                tickFormatter={(value) => `${value}%`} 
                tick={{ fontSize: 12 }} 
              />
              <Tooltip 
                labelFormatter={(label) => new Date(label).toLocaleString()}
                formatter={formatTooltip}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="temperature" 
                name="Temperature" 
                stroke="#ff7c43" 
                fill="#ff7c43" 
                fillOpacity={0.3} 
                yAxisId="temp" 
              />
              <Area 
                type="monotone" 
                dataKey="solarRadiation" 
                name="Solar Radiation" 
                stroke="#ffd60a" 
                fill="#ffd60a" 
                fillOpacity={0.3} 
                yAxisId="percent" 
              />
              <Area 
                type="monotone" 
                dataKey="humidity" 
                name="Humidity" 
                stroke="#3b82f6" 
                fill="#3b82f6" 
                fillOpacity={0.3} 
                yAxisId="percent" 
              />
              <Area 
                type="monotone" 
                dataKey="windSpeed" 
                name="Wind Speed" 
                stroke="#10b981" 
                fill="#10b981" 
                fillOpacity={0.3} 
                yAxisId="temp" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Environmental statistics component
type EnvironmentalStatsProps = {
  environmentalData: EnvironmentalData[];
  className?: string;
};

export function EnvironmentalStats({ environmentalData, className }: EnvironmentalStatsProps) {
  if (!environmentalData || !environmentalData.length) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Environmental Statistics</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics
  const temperatures = environmentalData.map(data => data.air_temp);
  const ghiValues = environmentalData.map(data => data.ghi);
  const dniValues = environmentalData.map(data => data.dni);
  const humidities = environmentalData.map(data => data.humidity || 0);
  const windSpeeds = environmentalData.map(data => data.windSpeed || 0);
  
  const avgTemp = temperatures.reduce((sum, val) => sum + val, 0) / temperatures.length;
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  
  const avgGHI = ghiValues.reduce((sum, val) => sum + val, 0) / ghiValues.length;
  const minGHI = Math.min(...ghiValues);
  const maxGHI = Math.max(...ghiValues);
  
  const avgDNI = dniValues.reduce((sum, val) => sum + val, 0) / dniValues.length;
  const minDNI = Math.min(...dniValues);
  const maxDNI = Math.max(...dniValues);
  
  const avgHumidity = humidities.reduce((sum, val) => sum + val, 0) / humidities.length;
  const minHumidity = Math.min(...humidities);
  const maxHumidity = Math.max(...humidities);
  
  const avgWind = windSpeeds.reduce((sum, val) => sum + val, 0) / windSpeeds.length;
  const minWind = Math.min(...windSpeeds);
  const maxWind = Math.max(...windSpeeds);
  
  // Count weather types
  const weatherCounts: Record<string, number> = {};
  environmentalData.forEach(data => {
    weatherCounts[data.weather] = (weatherCounts[data.weather] || 0) + 1;
  });
  
  // Find predominant weather
  let predominantWeather = '';
  let maxCount = 0;
  
  Object.entries(weatherCounts).forEach(([weather, count]) => {
    if (count > maxCount) {
      predominantWeather = weather;
      maxCount = count;
    }
  });

  // Helper function to determine the weather icon
  const getWeatherIcon = (weather: string) => {
    if (weather.includes('Sunny') || weather.includes('Clear')) {
      return <Sun className="h-5 w-5 text-yellow-400" />;
    } else if (weather.includes('Rain') || weather.includes('Drizzle')) {
      return <CloudRain className="h-5 w-5 text-blue-400" />;
    } else if (weather.includes('Cloud')) {
      return <CloudRain className="h-5 w-5 text-gray-400" />;
    } else {
      return <Sun className="h-5 w-5 text-gray-400" />;
    }
  };

  // Generate styling based on values
  const tempStyle = maxTemp > 20 ? 'text-red-400' : maxTemp < 10 ? 'text-blue-400' : 'text-yellow-400';
  const windStyle = maxWind > 15 ? 'text-red-400' : 'text-blue-400';
  const solarStyle = maxGHI > 600 ? 'text-yellow-400' : 'text-blue-400';

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Environmental Statistics</CardTitle>
        <CardDescription>
          Detailed solar and weather conditions from Solcast
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Thermometer className={`h-5 w-5 ${tempStyle}`} />
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">Temperature</h4>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{minTemp.toFixed(1)}°C</span> min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{avgTemp.toFixed(1)}°C</span> avg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{maxTemp.toFixed(1)}°C</span> max
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Sun className={`h-5 w-5 ${solarStyle}`} />
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">Global Horizontal Irradiance (GHI)</h4>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{minGHI.toFixed(0)}</span> min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{avgGHI.toFixed(0)}</span> avg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{maxGHI.toFixed(0)}</span> max
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">W/m² solar radiation on horizontal surface</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Sun className={`h-5 w-5 text-orange-400`} />
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">Direct Normal Irradiance (DNI)</h4>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{minDNI.toFixed(0)}</span> min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{avgDNI.toFixed(0)}</span> avg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{maxDNI.toFixed(0)}</span> max
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">W/m² direct beam radiation</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Wind className={`h-5 w-5 ${windStyle}`} />
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">Wind Speed</h4>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{minWind.toFixed(1)}</span> min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{avgWind.toFixed(1)}</span> avg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{maxWind.toFixed(1)}</span> max
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">km/h at 10m height</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <CloudRain className="h-5 w-5 text-blue-400" />
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">Humidity</h4>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{minHumidity.toFixed(0)}%</span> min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{avgHumidity.toFixed(0)}%</span> avg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{maxHumidity.toFixed(0)}%</span> max
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              {getWeatherIcon(predominantWeather)}
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">Predominant Weather</h4>
                <div className="flex justify-between items-center mt-1">
                  <p className="font-medium text-sm">{predominantWeather}</p>
                  <p className="text-xs text-muted-foreground">
                    {((maxCount / environmentalData.length) * 100).toFixed(0)}% of time
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-primary">Solar conditions:</span> GHI and DNI are key metrics for solar power generation. GHI (Global Horizontal Irradiance) measures total solar radiation on a horizontal surface, while DNI (Direct Normal Irradiance) is direct beam radiation, which is more relevant for concentrated solar applications.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Solar influence analysis component
type SolarInfluenceProps = {
  environmentalData: EnvironmentalData[];
  powerData: any[]; // Accept any array type for flexibility
  className?: string;
};

export function SolarInfluenceAnalysis({ environmentalData, powerData, className }: SolarInfluenceProps) {
  // Check for null or empty data
  if (!environmentalData || !environmentalData.length || !powerData || !powerData.length) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Solar Efficiency Analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <p className="text-muted-foreground">Insufficient data available</p>
        </CardContent>
      </Card>
    );
  }
  
  // This component would analyze correlation between environmental conditions
  // and solar output, but we'll make a simplified version for now
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Solar Efficiency Analysis</CardTitle>
        <CardDescription>
          How environmental conditions affect solar output
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 border border-border rounded-lg">
            <h4 className="font-medium text-white text-sm mb-2">Kerry Weather Impact</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                <span>Spring in Kerry sees frequent rain showers reducing solar efficiency by 60-70%</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                <span>Coastal high winds (over 15 km/h) help keep panels cool, increasing efficiency by ~3%</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-400 mr-2">•</span>
                <span>High humidity (over 85%) typical of Kerry coastal areas may cause condensation on panels</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Kerry's mild temperatures (rarely above 18°C) are optimal for panel efficiency</span>
              </li>
            </ul>
          </div>
          
          <div className="p-4 border border-border rounded-lg">
            <h4 className="font-medium text-white text-sm mb-2">Kerry-Specific Recommendations</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Install rain sensors to optimize panel cleaning schedule during frequent Kerry drizzle</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Use enhanced battery storage to compensate for Kerry's inconsistent sun patterns</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Apply anti-condensation coating suitable for high-humidity coastal environments</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Consider additional panels (15-20% more) to compensate for Kerry's reduced sun hours</span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}