import React from 'react';
import { PowerForecastChart } from '@/components/power-forecast-chart';
import { EnvironmentalForecastChart } from '@/components/environmental-forecast-chart';
import { SolcastForecastChart } from '@/components/solcast-forecast-chart';
import { SolcastWeatherForecast } from '@/components/solcast-weather-forecast';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ForecastingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader 
        title="Power Forecasting" 
        description="View forecast data for power usage and environmental conditions" 
      />
      
      <Tabs defaultValue="power" className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="power">Power Forecasts</TabsTrigger>
          <TabsTrigger value="environmental">Environmental Forecasts</TabsTrigger>
          <TabsTrigger value="solar">Solar Forecasts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="power" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PowerForecastChart />
          </div>
          <div className="text-sm text-muted-foreground mt-4">
            <p>Power forecasts are based on historical consumption patterns and predicted environmental conditions.</p>
            <p>Use these predictions to plan energy usage and adjust operational schedules for maximum efficiency.</p>
          </div>
        </TabsContent>
        
        <TabsContent value="environmental" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EnvironmentalForecastChart />
            <SolcastWeatherForecast />
          </div>
          <div className="text-sm text-muted-foreground mt-4">
            <p>Environmental forecasts combine historical data with meteorological predictions.</p>
            <p>These forecasts help anticipate temperature changes that may affect refrigeration needs.</p>
          </div>
        </TabsContent>
        
        <TabsContent value="solar" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SolcastForecastChart />
          </div>
          <div className="text-sm text-muted-foreground mt-4">
            <p>Solar forecasts use Solcast API data to predict solar energy generation with confidence intervals.</p>
            <p>The P10/P50/P90 values indicate low/median/high generation scenarios, helping with energy planning.</p>
            <p className="mt-2 text-amber-500">
              Note: Solar forecasts may use fallback data if the Solcast API is unavailable.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}