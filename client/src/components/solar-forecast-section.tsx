import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sun, AlertTriangle, CloudRain, RefreshCw } from 'lucide-react';
import { useForecastData, useForecastHorizon } from '@/hooks/use-forecast-data';
import { ForecastChart } from '@/components/forecast-chart';
import { ForecastSummary } from '@/components/forecast-summary';

export function SolarForecastSection() {
  const { selectedHorizon, horizonOptions, selectHorizon } = useForecastHorizon();
  const { 
    forecastData, 
    pvForecastData, 
    combinedData, 
    isLoading, 
    isFallback,
    error 
  } = useForecastData({ horizon: selectedHorizon });
  
  // Handle horizon change
  const handleHorizonChange = (hours: number) => {
    selectHorizon(hours);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Solar Radiation & Weather Forecast</h2>
          <p className="text-sm text-muted-foreground">
            Solcast API integration providing detailed solar and weather prediction
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isFallback && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              Using Fallback Data
            </Badge>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1"
            onClick={() => selectHorizon(selectedHorizon)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>Refresh</span>
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="chart" className="w-full">
        <TabsList className="grid grid-cols-2 w-full md:w-[400px]">
          <TabsTrigger value="chart">
            Forecast Charts
          </TabsTrigger>
          <TabsTrigger value="summary">
            Insight Summary
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="chart" className="space-y-4 mt-2">
          <ForecastChart 
            forecastData={combinedData} 
            isLoading={isLoading}
            isFallback={isFallback}
            onHorizonChange={handleHorizonChange}
            selectedHorizon={selectedHorizon}
          />
        </TabsContent>
        
        <TabsContent value="summary" className="space-y-4 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <ForecastSummary 
                forecastData={combinedData} 
                isLoading={isLoading}
                isFallback={isFallback}
              />
            </div>
            
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Forecast Details</CardTitle>
                  <CardDescription>Advanced solar forecast data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Horizon:</span>
                      <span className="font-medium">{selectedHorizon} hours</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Resolution:</span>
                      <span className="font-medium">30 min intervals</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Data points:</span>
                      <span className="font-medium">{combinedData?.length || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Data source:</span>
                      <span className="font-medium">{isFallback ? 'Fallback Data' : 'Solcast API'}</span>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Select Forecast Horizon:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {horizonOptions.map((option) => (
                        <Button 
                          key={option.value}
                          variant={selectedHorizon === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleHorizonChange(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}