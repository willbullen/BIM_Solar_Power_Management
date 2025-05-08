import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, BarChart3, Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger
} from "@/components/ui/tabs";
import { useAIAnalytics } from "@/hooks/use-ai-analytics";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface AIPredictionsCardProps {
  historicalPowerData: any[];
  historicalEnvData: any[];
  className?: string;
}

export function AIPredictionsCard({ historicalPowerData, historicalEnvData, className }: AIPredictionsCardProps) {
  const [predictions, setPredictions] = useState<any | null>(null);
  const [forecastHorizon, setForecastHorizon] = useState<string>("day");
  const { generatePredictions, isLoading } = useAIAnalytics();
  const { toast } = useToast();

  const handleGeneratePredictions = async () => {
    try {
      const result = await generatePredictions(forecastHorizon, historicalPowerData, historicalEnvData);
      setPredictions(result);
    } catch (error) {
      console.error("Failed to generate predictions:", error);
      toast({
        title: "Predictions Generation Failed",
        description: "There was an error generating the predictions. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className={cn("shadow-md", className)}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="mr-2 h-5 w-5" />
          AI-Powered Predictions
        </CardTitle>
        <CardDescription>
          Forecast future energy consumption and generation patterns
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analyzing historical data and generating predictions...</p>
          </div>
        ) : predictions ? (
          <div className="space-y-6">
            {/* Prediction Header */}
            <div>
              <h3 className="text-lg font-medium">{predictions.forecastPeriod}</h3>
              <p className="text-muted-foreground mt-1">{predictions.summary}</p>
            </div>
            
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="consumption">Consumption</TabsTrigger>
                <TabsTrigger value="generation">Generation</TabsTrigger>
              </TabsList>
              
              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium">Energy Balance Forecast</h4>
                      <p className="text-sm text-muted-foreground">Predicted energy sources distribution</p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 inline-block mr-1" />
                      <span>{predictions.forecastPeriod}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Solar Generation</span>
                        <span className="font-medium">{predictions.predictions?.solarGeneration?.expected}</span>
                      </div>
                      <Progress value={
                        typeof predictions.predictions?.solarGeneration?.confidence === 'number' 
                          ? predictions.predictions.solarGeneration.confidence 
                          : 70
                      } className="h-2" />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Grid Requirements</span>
                        <span className="font-medium">{predictions.predictions?.gridRequirements?.expected}</span>
                      </div>
                      <Progress value={
                        typeof predictions.predictions?.gridRequirements?.confidence === 'number' 
                          ? predictions.predictions.gridRequirements.confidence 
                          : 85
                      } className="h-2" />
                    </div>
                  </div>
                  
                  {predictions.weatherImpact && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-start">
                      <AlertCircle className="h-4 w-4 mr-2 mt-0.5 text-amber-500" />
                      <div>
                        <span className="text-sm font-medium">Weather Impact:</span>
                        <p className="text-sm text-muted-foreground">{predictions.weatherImpact.description}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Load Distribution */}
                {predictions.predictions?.loadDistribution && (
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-3">Predicted Load Distribution</h4>
                    
                    <div className="space-y-3">
                      {Object.entries(predictions.predictions.loadDistribution).map(([key, value]: [string, any], index: number) => (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{key}</span>
                            <span className="font-medium">{value}</span>
                          </div>
                          <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full", 
                                index === 0 ? "bg-primary" : 
                                index === 1 ? "bg-purple-500" : "bg-blue-500"
                              )} 
                              style={{ width: value }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              {/* Consumption Tab */}
              <TabsContent value="consumption" className="space-y-4 pt-4">
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-3">Total Consumption Forecast</h4>
                  
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg bg-muted/30 p-4 text-center">
                      <div className="text-sm text-muted-foreground mb-1">Expected</div>
                      <div className="text-2xl font-bold text-primary">
                        {predictions.predictions?.totalConsumption?.expected}
                      </div>
                      {predictions.predictions?.totalConsumption?.changeFromCurrentPeriod && (
                        <div className={cn(
                          "text-xs mt-1",
                          predictions.predictions.totalConsumption.changeFromCurrentPeriod.includes('+') 
                            ? "text-red-500" 
                            : "text-green-500"
                        )}>
                          {predictions.predictions.totalConsumption.changeFromCurrentPeriod}
                        </div>
                      )}
                    </div>
                    
                    <div className="rounded-lg bg-muted/30 p-4">
                      <div className="text-sm text-muted-foreground mb-2">Confidence Range</div>
                      <div className="flex justify-between items-center">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Low</div>
                          <div className="font-medium">
                            {predictions.predictions?.totalConsumption?.lowRange}
                          </div>
                        </div>
                        <div className="h-0.5 flex-grow mx-2 bg-muted relative">
                          <div 
                            className="absolute top-0 h-2 w-2 rounded-full bg-primary -mt-0.5"
                            style={{ 
                              left: `${
                                typeof predictions.predictions?.totalConsumption?.confidence === 'number' 
                                  ? predictions.predictions.totalConsumption.confidence 
                                  : 50
                              }%`
                            }}
                          />
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">High</div>
                          <div className="font-medium">
                            {predictions.predictions?.totalConsumption?.highRange}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progress 
                          value={
                            typeof predictions.predictions?.totalConsumption?.confidence === 'number' 
                              ? predictions.predictions.totalConsumption.confidence 
                              : 75
                          } 
                          className="h-1.5"
                        />
                        <div className="text-xs text-right mt-1 text-muted-foreground">
                          Confidence: {
                            typeof predictions.predictions?.totalConsumption?.confidence === 'number' 
                              ? `${predictions.predictions.totalConsumption.confidence}%` 
                              : 'Medium'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Peak Load */}
                  {predictions.predictions?.gridRequirements?.peak && (
                    <div className="mt-4 rounded-lg bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Predicted Peak Demand:</span>
                        <span className="font-bold text-primary">
                          {predictions.predictions.gridRequirements.peak}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Time Series Sample - If available */}
                {predictions.timeSeriesForecasts && predictions.timeSeriesForecasts.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-3">Consumption Pattern Forecast</h4>
                    <div className="text-sm text-muted-foreground mb-4">
                      Sample of predicted consumption values over time
                    </div>
                    
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                      {predictions.timeSeriesForecasts.slice(0, 8).map((point: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 border-b">
                          <div className="text-sm">
                            {new Date(point.timestamp).toLocaleString(undefined, {
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric'
                            })}
                          </div>
                          <div className="font-medium">{point.totalLoad}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              {/* Generation Tab */}
              <TabsContent value="generation" className="space-y-4 pt-4">
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-3">Solar Generation Forecast</h4>
                  
                  <div className="p-4 bg-muted/30 rounded-lg text-center mb-4">
                    <div className="text-sm text-muted-foreground mb-1">Predicted Output</div>
                    <div className="text-2xl font-bold text-primary">
                      {predictions.predictions?.solarGeneration?.expected}
                    </div>
                    <div className="mt-2">
                      <Progress 
                        value={
                          typeof predictions.predictions?.solarGeneration?.confidence === 'number' 
                            ? predictions.predictions.solarGeneration.confidence 
                            : 65
                        } 
                        className="h-1.5"
                      />
                      <div className="text-xs text-right mt-1 text-muted-foreground">
                        Confidence: {
                          typeof predictions.predictions?.solarGeneration?.confidence === 'number' 
                            ? `${predictions.predictions.solarGeneration.confidence}%` 
                            : 'Medium'
                        }
                      </div>
                    </div>
                  </div>
                  
                  {/* Factors affecting solar generation */}
                  {predictions.predictions?.solarGeneration?.factors && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Key Factors</h5>
                      <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                        {predictions.predictions.solarGeneration.factors.map((factor: string, index: number) => (
                          <li key={index}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* Time Series Sample for Solar - If available */}
                {predictions.timeSeriesForecasts && predictions.timeSeriesForecasts.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-3">Solar Output Forecast</h4>
                    <div className="text-sm text-muted-foreground mb-4">
                      Sample of predicted solar generation values over time
                    </div>
                    
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                      {predictions.timeSeriesForecasts.slice(0, 8).map((point: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 border-b">
                          <div className="text-sm">
                            {new Date(point.timestamp).toLocaleString(undefined, {
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric'
                            })}
                          </div>
                          <div className="font-medium">{point.solarOutput}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Energy Usage Predictions</h3>
            <p className="text-muted-foreground mb-6">
              Generate AI-powered predictions for future energy consumption and generation patterns.
            </p>
            
            <div className="w-full max-w-sm space-y-4">
              <Select value={forecastHorizon} onValueChange={setForecastHorizon}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select forecast horizon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Forecast Horizon</SelectLabel>
                    <SelectItem value="day">Next 24 Hours</SelectItem>
                    <SelectItem value="week">Next 7 Days</SelectItem>
                    <SelectItem value="month">Next 30 Days</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              
              <Button onClick={handleGeneratePredictions} className="w-full">
                Generate Predictions
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      {predictions && (
        <CardFooter>
          <Button variant="outline" onClick={handleGeneratePredictions} className="ml-auto">
            Refresh Predictions
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}