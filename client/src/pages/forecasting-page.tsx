import React from "react";
import { PageHeader } from "@/components/page-header";
import { SolcastForecastChart } from "@/components/solcast-forecast-chart";
import { SolcastWeatherForecast } from "@/components/solcast-weather-forecast";
import { PowerForecastChart } from "@/components/power-forecast-chart";
import { EnvironmentalForecastChart } from "@/components/environmental-forecast-chart";

export default function ForecastingPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader 
        title="Forecasts" 
        description="Advanced forecasting with Solcast API integration" 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Solar Output Forecast with PV Power Prediction */}
        <SolcastForecastChart />
        
        {/* Weather Forecast */}
        <SolcastWeatherForecast />
        
        {/* Power Consumption Forecast */}
        <PowerForecastChart />
        
        {/* Environmental Forecast */}
        <EnvironmentalForecastChart />
      </div>
    </div>
  );
}