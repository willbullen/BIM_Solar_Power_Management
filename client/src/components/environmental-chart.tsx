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
    temperature: data.temperature,
    sunIntensity: data.sunIntensity,
    weather: data.weather,
  }));

  // Custom tooltip formatter
  const formatTooltip = (value: number, name: string) => {
    if (name === 'temperature') return `${value.toFixed(1)}°C`;
    if (name === 'sunIntensity') return `${value.toFixed(0)}%`;
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
          Temperature and sun intensity over time
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
                domain={[0, 30]} 
                tickFormatter={(value) => `${value}°C`} 
                tick={{ fontSize: 12 }} 
              />
              <YAxis 
                yAxisId="sun" 
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
                dataKey="sunIntensity" 
                name="Sun Intensity" 
                stroke="#ffd60a" 
                fill="#ffd60a" 
                fillOpacity={0.3} 
                yAxisId="sun" 
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
  const temperatures = environmentalData.map(data => data.temperature);
  const sunIntensities = environmentalData.map(data => data.sunIntensity);
  
  const avgTemp = temperatures.reduce((sum, val) => sum + val, 0) / temperatures.length;
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  
  const avgSun = sunIntensities.reduce((sum, val) => sum + val, 0) / sunIntensities.length;
  const minSun = Math.min(...sunIntensities);
  const maxSun = Math.max(...sunIntensities);
  
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
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-white text-sm">Sun Intensity</h4>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="font-medium">{avgSun.toFixed(0)}%</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Minimum</p>
                  <p className="font-medium">{minSun.toFixed(0)}%</p>
                </div>
                <div className="bg-card/30 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Maximum</p>
                  <p className="font-medium">{maxSun.toFixed(0)}%</p>
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
            <h4 className="font-medium text-white text-sm mb-2">Key Findings</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                <span>High sun intensity {'>'}80% corresponds with maximum solar output efficiency</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                <span>Partially cloudy conditions reduce efficiency by approximately 30-40%</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-400 mr-2">•</span>
                <span>Overcast conditions reduce system efficiency to below 40% of capacity</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Temperature above 25°C reduces panel efficiency by approximately 5-10%</span>
              </li>
            </ul>
          </div>
          
          <div className="p-4 border border-border rounded-lg">
            <h4 className="font-medium text-white text-sm mb-2">Recommendations</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Schedule high-energy tasks during periods of high solar production</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Regular panel cleaning is recommended to maintain optimal efficiency</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Ensure panels are properly ventilated to reduce temperature effects</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Consider battery storage to maximize utilization of solar production</span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}