import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnvironmentalData } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

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
  if (!environmentalData.length) {
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
  const solarRadiations = environmentalData.map(data => data.ghi);
  const humidities = environmentalData.map(data => data.humidity || 0);
  const windSpeeds = environmentalData.map(data => data.windSpeed || 0);
  
  const avgTemp = temperatures.reduce((sum, val) => sum + val, 0) / temperatures.length;
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  
  const avgSolar = solarRadiations.reduce((sum, val) => sum + val, 0) / solarRadiations.length;
  const minSolar = Math.min(...solarRadiations);
  const maxSolar = Math.max(...solarRadiations);
  
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

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Environmental Statistics</CardTitle>
        <CardDescription>
          Summary statistics for temperature and solar conditions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-white text-sm">Temperature</h4>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="font-medium">{avgTemp.toFixed(1)}°C</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Minimum</p>
                  <p className="font-medium">{minTemp.toFixed(1)}°C</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Maximum</p>
                  <p className="font-medium">{maxTemp.toFixed(1)}°C</p>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-white text-sm">Wind Speed</h4>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="font-medium">{avgWind.toFixed(1)} km/h</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Minimum</p>
                  <p className="font-medium">{minWind.toFixed(1)} km/h</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Maximum</p>
                  <p className="font-medium">{maxWind.toFixed(1)} km/h</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-white text-sm">Solar Radiation</h4>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="font-medium">{avgSolar.toFixed(0)} W/m²</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Minimum</p>
                  <p className="font-medium">{minSolar.toFixed(0)} W/m²</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Maximum</p>
                  <p className="font-medium">{maxSolar.toFixed(0)} W/m²</p>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-white text-sm">Humidity</h4>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="font-medium">{avgHumidity.toFixed(0)}%</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Minimum</p>
                  <p className="font-medium">{minHumidity.toFixed(0)}%</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Maximum</p>
                  <p className="font-medium">{maxHumidity.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <h4 className="font-medium text-white text-sm">Predominant Weather</h4>
          <div className="bg-card/30 p-3 rounded mt-2 flex items-center justify-between">
            <p className="font-medium">{predominantWeather}</p>
            <p className="text-xs text-muted-foreground">
              {((maxCount / environmentalData.length) * 100).toFixed(0)}% of the time
            </p>
          </div>
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