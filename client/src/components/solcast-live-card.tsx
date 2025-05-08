import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sun, CloudRain, Wind, Thermometer, BarChart4 } from "lucide-react";
import { useSolcastLiveRadiation, useSolcastLivePv } from "@/hooks/use-solcast-data";
import { cn } from "@/lib/utils";

type SolcastLiveCardProps = {
  className?: string;
};

export function SolcastLiveCard({ className }: SolcastLiveCardProps) {
  const { data: radiationData, isLoading: isRadiationLoading } = useSolcastLiveRadiation();
  const { data: pvData, isLoading: isPvLoading } = useSolcastLivePv();
  
  const isLoading = isRadiationLoading || isPvLoading;
  
  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Solcast Live Data</CardTitle>
          <CardDescription>Current solar and weather conditions</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  if (!radiationData?.estimated_actuals?.length || !pvData?.estimated_actuals?.length) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Solcast Live Data</CardTitle>
          <CardDescription>Current solar and weather conditions</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px]">
          <p className="text-muted-foreground">No live data available</p>
        </CardContent>
      </Card>
    );
  }
  
  // Get the latest data
  const latestRadiation = radiationData.estimated_actuals[0];
  const latestPv = pvData.estimated_actuals[0];
  
  // Format timestamp
  const timestamp = new Date(latestRadiation.period_end);
  const formattedTime = timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  // Determine weather conditions based on GHI and DNI values
  const determineWeatherIcon = (ghi: number, dni: number) => {
    const ratio = dni > 0 ? ghi / dni : 0;
    
    if (ghi < 50) {
      return <CloudRain className="h-8 w-8 text-blue-400" />;
    } else if (ratio < 0.3) {
      return <CloudRain className="h-8 w-8 text-blue-300" />;
    } else if (ratio < 0.7) {
      return <CloudRain className="h-8 w-8 text-yellow-200" />;
    } else {
      return <Sun className="h-8 w-8 text-yellow-400" />;
    }
  };
  
  const getWeatherDescription = (ghi: number, dni: number) => {
    const ratio = dni > 0 ? ghi / dni : 0;
    
    if (ghi < 50) {
      return "Overcast";
    } else if (ratio < 0.3) {
      return "Mostly Cloudy";
    } else if (ratio < 0.7) {
      return "Partly Cloudy";
    } else {
      return "Mostly Sunny";
    }
  };
  
  const weatherIcon = determineWeatherIcon(latestRadiation.ghi, latestRadiation.dni);
  const weatherDesc = getWeatherDescription(latestRadiation.ghi, latestRadiation.dni);
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Solcast Live Data</CardTitle>
        <CardDescription>
          Current solar and weather conditions as of {formattedTime}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Weather and Solar Radiation */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              {weatherIcon}
              <div>
                <p className="text-sm text-muted-foreground">Current Conditions</p>
                <p className="font-medium text-white">{weatherDesc}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Sun className="h-6 w-6 text-yellow-400" />
              <div>
                <p className="text-sm text-muted-foreground">Global Solar Radiation (GHI)</p>
                <p className="font-medium text-white">{latestRadiation.ghi} W/m²</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Sun className="h-6 w-6 text-orange-400" />
              <div>
                <p className="text-sm text-muted-foreground">Direct Solar Radiation (DNI)</p>
                <p className="font-medium text-white">{latestRadiation.dni} W/m²</p>
              </div>
            </div>
          </div>
          
          {/* Temperature and PV Power */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <Thermometer className="h-6 w-6 text-red-400" />
              <div>
                <p className="text-sm text-muted-foreground">Air Temperature</p>
                <p className="font-medium text-white">{latestRadiation.air_temp.toFixed(1)}°C</p>
              </div>
            </div>
            
            {latestRadiation.wind_speed_10m !== undefined && (
              <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
                <Wind className="h-6 w-6 text-blue-400" />
                <div>
                  <p className="text-sm text-muted-foreground">Wind Speed</p>
                  <p className="font-medium text-white">{latestRadiation.wind_speed_10m.toFixed(1)} km/h</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
              <BarChart4 className="h-6 w-6 text-green-400" />
              <div>
                <p className="text-sm text-muted-foreground">Estimated PV Power</p>
                <p className="font-medium text-white">{latestPv.pv_estimate.toFixed(2)} kW</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-primary">Solcast Data:</span> Live weather and solar conditions provided by Solcast API. These values show the current atmospheric and solar radiation conditions, which impact your solar panel performance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}