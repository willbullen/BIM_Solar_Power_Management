import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Page } from '@/components/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, addDays } from 'date-fns';
import { useForecastData, useForecastHorizon } from '@/hooks/use-forecast-data';
import { ForecastChart } from '@/components/forecast-chart';
import { ForecastSummary } from '@/components/forecast-summary';
import { AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ForecastPage() {
  const { selectedHorizon, horizonOptions, selectHorizon } = useForecastHorizon();
  const { 
    forecastData, 
    pvForecastData, 
    combinedData, 
    isLoading, 
    isFallback 
  } = useForecastData({ horizon: selectedHorizon });
  
  // Handle horizon change
  const handleHorizonChange = (hours: number) => {
    selectHorizon(hours);
  };
  
  // Format dates for display
  const today = new Date();
  const forecastEndDate = addDays(today, Math.ceil(selectedHorizon / 24));
  
  return (
    <Page>
      <Helmet>
        <title>Weather & Solar Forecast | Emporium Power Monitoring</title>
      </Helmet>
      
      <div className="container px-4 py-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Weather & Solar Forecast</h1>
          <p className="text-muted-foreground">
            Advanced forecasting powered by Solcast API with {selectedHorizon}-hour prediction horizon
          </p>
          
          {isFallback && (
            <Alert variant="warning" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Using Fallback Data</AlertTitle>
              <AlertDescription>
                Unable to fetch real-time Solcast forecast data. Using fallback synthetic data for demonstration.
                This may be due to API key limitations or connectivity issues.
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main forecast chart - takes up 3/4 of the space on large screens */}
          <div className="xl:col-span-3 space-y-6">
            <ForecastChart 
              forecastData={combinedData} 
              isLoading={isLoading}
              isFallback={isFallback}
              onHorizonChange={handleHorizonChange}
              selectedHorizon={selectedHorizon}
            />
            
            <Card>
              <CardHeader>
                <CardTitle>Forecast Interpretation Guide</CardTitle>
                <CardDescription>How to use and understand the forecast data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      <h3 className="font-medium">Solar Radiation</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      GHI (Global Horizontal Irradiance) shows total solar radiation on a horizontal surface.
                      Higher values indicate more intense sunlight available for PV generation.
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-blue-500" />
                      <h3 className="font-medium">Probabilistic Forecasts</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      P10/P90 values show the range of possible outcomes. P50 is the median forecast, 
                      while P10 and P90 represent low and high scenarios.
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-green-500" />
                      <h3 className="font-medium">Operational Planning</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use forecast data to optimize energy-intensive operations. Schedule high-power
                      activities during peak solar production times to maximize self-consumption.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Sidebar with forecast summary - takes up 1/4 of the space on large screens */}
          <div className="space-y-6">
            <ForecastSummary 
              forecastData={combinedData} 
              isLoading={isLoading}
              isFallback={isFallback}
            />
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Forecast Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start:</span>
                    <span className="font-medium">{format(today, 'EEE, MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End:</span>
                    <span className="font-medium">{format(forecastEndDate, 'EEE, MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horizon:</span>
                    <span className="font-medium">{selectedHorizon} hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolution:</span>
                    <span className="font-medium">30 minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="font-medium">{format(new Date(), 'HH:mm:ss')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Page>
  );
}