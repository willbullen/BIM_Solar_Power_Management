import React, { useState, useEffect } from 'react';
import { usePowerData } from '@/hooks/use-power-data';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { getQueryFn } from '@/lib/queryClient';
import { PowerData, EnvironmentalData } from '@shared/schema';
import { generatePowerForecast, detectAnomalies, getEfficiencyRecommendations, ForecastResult, AnomalyResult, PowerForecast } from '@/lib/forecasting';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from 'recharts';
import { format } from 'date-fns';
import { Loader2, AlertTriangle, Info, TrendingUp, CircleCheck, BarChart3, FlameIcon, Droplets } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Header } from "@/components/header";
import { Sidebar } from "@/components/ui/sidebar";

// Helper function to format timestamps for charts
const formatTimestamp = (timestamp: Date | string) => {
  return format(new Date(timestamp), 'HH:mm');
};

// Data point for recharts
interface ChartDataPoint {
  name: string;
  timestamp: string;
  value: number;
  forecast?: number;
  lowerBound?: number;
  upperBound?: number;
  [key: string]: any;
}

// Main content component
function ForecastingContent() {
  const { powerData, historicalPowerData, environmentalData, historicalEnvironmentalData } = usePowerData();
  const { toast } = useToast();
  
  // State for forecast, anomalies, and recommendations
  const [forecast, setForecast] = useState<PowerForecast | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<keyof PowerForecast>('totalLoad');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Fetch more historical data for better forecasting
  const { data: historicalData, isLoading: isLoadingHistorical } = useQuery<PowerData[], Error>({
    queryKey: ['/api/power-data'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });
  
  const { data: envData, isLoading: isLoadingEnvData } = useQuery<EnvironmentalData[], Error>({
    queryKey: ['/api/environmental-data'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });
  
  // Generate forecasts and anomaly detection when data is available
  const generateForecasts = () => {
    if ((!historicalData || historicalData.length < 10) && (!historicalPowerData || historicalPowerData.length < 10)) {
      toast({
        title: 'Insufficient Data',
        description: 'Need more historical data for accurate forecasting',
        variant: 'destructive',
      });
      return;
    }
    
    setIsGenerating(true);
    
    // Use the fetched historical data if available, otherwise use the data from context
    const powerDataForAnalysis = historicalData || historicalPowerData;
    const envDataForAnalysis = envData || historicalEnvironmentalData;
    
    try {
      // Generate forecasts for the next 24 hours
      const forecastResults = generatePowerForecast(
        powerDataForAnalysis,
        envDataForAnalysis,
        24
      );
      
      // Detect anomalies in recent data
      const anomalyResults = detectAnomalies(
        powerDataForAnalysis.slice(-50), // Analyze last 50 data points
        envDataForAnalysis.slice(-50)
      );
      
      // Get efficiency recommendations
      const efficiencyRecommendations = getEfficiencyRecommendations(
        powerDataForAnalysis,
        forecastResults,
        envDataForAnalysis
      );
      
      setForecast(forecastResults);
      setAnomalies(anomalyResults);
      setRecommendations(efficiencyRecommendations);
      
      toast({
        title: 'Analysis Complete',
        description: 'Forecasts and anomaly detection generated successfully',
      });
    } catch (error) {
      console.error('Error generating forecasts:', error);
      toast({
        title: 'Analysis Failed',
        description: 'An error occurred while generating forecasts',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Prepare data for charts
  const prepareChartData = (): ChartDataPoint[] => {
    if (!forecast || !historicalPowerData.length) return [];
    
    // Get the specific metric forecast
    const metricForecast = forecast[selectedMetric];
    
    // Combine historical and forecast data
    const chartData: ChartDataPoint[] = [];
    
    // Add recent historical data (last 12 points)
    const recentHistorical = historicalPowerData.slice(-12);
    
    recentHistorical.forEach(data => {
      chartData.push({
        name: formatTimestamp(data.timestamp),
        timestamp: new Date(data.timestamp).toISOString(),
        value: data[selectedMetric],
        forecast: undefined,
        lowerBound: undefined,
        upperBound: undefined,
      });
    });
    
    // Add forecast data
    metricForecast.forEach(fc => {
      chartData.push({
        name: formatTimestamp(fc.timestamp),
        timestamp: new Date(fc.timestamp).toISOString(),
        value: null as any, // Using any here to avoid type errors
        forecast: fc.predictedValue,
        lowerBound: fc.lowerBound,
        upperBound: fc.upperBound,
      });
    });
    
    return chartData;
  };
  
  // Prepare anomaly chart data
  const prepareAnomalyChartData = (): ChartDataPoint[] => {
    if (!anomalies.length || !historicalPowerData.length) return [];
    
    // Filter anomalies for the selected metric
    const metricAnomalies = anomalies.filter(a => a.metric === selectedMetric);
    
    // Create a map of anomalies by timestamp for quick lookup
    const anomalyMap = new Map<string, AnomalyResult>();
    metricAnomalies.forEach(anomaly => {
      anomalyMap.set(anomaly.timestamp.toISOString(), anomaly);
    });
    
    // Create chart data with anomaly markers
    return historicalPowerData.slice(-30).map(data => {
      const timestamp = new Date(data.timestamp).toISOString();
      const anomaly = anomalyMap.get(timestamp);
      
      return {
        name: formatTimestamp(data.timestamp),
        timestamp,
        value: data[selectedMetric],
        isAnomaly: anomaly ? 1 : 0,
        expected: anomaly ? anomaly.expectedValue : undefined,
      };
    });
  };
  
  // Get number of critical anomalies (high severity)
  const getCriticalAnomalyCount = (): number => {
    return anomalies.filter(a => a.severity === 'high').length;
  };
  
  // Get unique metrics with anomalies
  const getAnomalyMetrics = (): string[] => {
    // Convert Set to array explicitly for TypeScript compatibility
    return Array.from(new Set(anomalies.map(a => a.metric)));
  };
  
  // Auto-generate forecasts when data is available
  useEffect(() => {
    if (
      !isLoadingHistorical && 
      !isLoadingEnvData && 
      ((historicalData && historicalData.length > 10) || 
       (historicalPowerData && historicalPowerData.length > 10))
    ) {
      // Only auto-generate if not already done
      if (!forecast && !isGenerating) {
        generateForecasts();
      }
    }
  }, [isLoadingHistorical, isLoadingEnvData, historicalData, historicalPowerData]);
  
  // Render the page
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Power Forecasting &amp; Analysis</h1>
          <p className="text-muted-foreground">
            Advanced analytics to predict power usage, detect anomalies, and optimize efficiency
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Forecast Horizon
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24 Hours</div>
            <p className="text-xs text-muted-foreground">
              Predicting power usage for the next day
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Anomalies Detected
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{anomalies.length}</div>
            <p className="text-xs text-muted-foreground">
              {getCriticalAnomalyCount()} critical requiring attention
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recommendations
            </CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recommendations.length}</div>
            <p className="text-xs text-muted-foreground">
              Efficiency insights from data analysis
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="forecast" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="forecast">Forecasting</TabsTrigger>
          <TabsTrigger value="anomalies">Anomaly Detection</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Power Usage Forecast</CardTitle>
              <CardDescription>
                Predictions for the next 24 hours based on historical patterns and environmental factors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isGenerating ? (
                <div className="flex items-center justify-center h-80">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="ml-2">Analyzing data and generating forecasts...</span>
                </div>
              ) : forecast ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge 
                      variant={selectedMetric === 'totalLoad' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedMetric('totalLoad')}
                    >
                      Total Load
                    </Badge>
                    <Badge 
                      variant={selectedMetric === 'mainGridPower' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedMetric('mainGridPower')}
                    >
                      Main Grid
                    </Badge>
                    <Badge 
                      variant={selectedMetric === 'solarOutput' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedMetric('solarOutput')}
                    >
                      Solar Output
                    </Badge>
                    <Badge 
                      variant={selectedMetric === 'refrigerationLoad' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedMetric('refrigerationLoad')}
                    >
                      Refrigeration
                    </Badge>
                    <Badge 
                      variant={selectedMetric === 'bigColdRoom' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedMetric('bigColdRoom')}
                    >
                      Big Cold Room
                    </Badge>
                    <Badge 
                      variant={selectedMetric === 'bigFreezer' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedMetric('bigFreezer')}
                    >
                      Big Freezer
                    </Badge>
                    <Badge 
                      variant={selectedMetric === 'smoker' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedMetric('smoker')}
                    >
                      Smoker
                    </Badge>
                  </div>
                  
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={prepareChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          padding={{ left: 10, right: 10 }} 
                          tickMargin={10}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: any) => value ? [Number(value).toFixed(2), 'kW'] : ['N/A', '']}
                          labelFormatter={(label) => `Time: ${label}`}
                        />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="upperBound" 
                          fill="#e2e8f0" 
                          stroke="#cbd5e1" 
                          dot={false}
                          name="Upper Bound" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="lowerBound" 
                          fill="#f1f5f9" 
                          stroke="#cbd5e1" 
                          dot={false}
                          name="Lower Bound" 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#0ea5e9" 
                          strokeWidth={2} 
                          dot={true}
                          name="Actual" 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="forecast" 
                          stroke="#6366f1" 
                          strokeWidth={2} 
                          strokeDasharray="5 5"
                          dot={false}
                          name="Forecast" 
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <Card>
                      <CardHeader className="py-2">
                        <CardTitle className="text-sm">Peak Forecast</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold">
                              {forecast[selectedMetric].length > 0 
                                ? Math.max(...forecast[selectedMetric].map(f => f.predictedValue)).toFixed(2)
                                : 'N/A'} kW
                            </p>
                            <p className="text-xs text-muted-foreground">Expected peak value</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">
                              {forecast[selectedMetric].length > 0 
                                ? (() => {
                                    const maxIndex = forecast[selectedMetric].reduce((maxIdx, f, idx, arr) => 
                                      f.predictedValue > arr[maxIdx].predictedValue ? idx : maxIdx, 0);
                                    return format(new Date(forecast[selectedMetric][maxIndex].timestamp), 'HH:mm');
                                  })()
                                : 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground">Expected time</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="py-2">
                        <CardTitle className="text-sm">Forecast Confidence</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold">
                              {forecast[selectedMetric].length > 0
                                ? `±${((forecast[selectedMetric].reduce((sum, f) => 
                                  sum + (f.upperBound - f.lowerBound), 0) / 
                                  forecast[selectedMetric].length) / 2).toFixed(2)}`
                                : 'N/A'} kW
                            </p>
                            <p className="text-xs text-muted-foreground">Average confidence interval</p>
                          </div>
                          <div>
                            <CircleCheck className="h-10 w-10 text-green-500" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 space-y-4">
                  <p>No forecast data available yet</p>
                  <button 
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    onClick={generateForecasts}
                    disabled={isGenerating || isLoadingHistorical}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                        Generating...
                      </>
                    ) : 'Generate Forecast'}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection</CardTitle>
              <CardDescription>
                Unusual patterns in power consumption that may indicate issues or opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isGenerating ? (
                <div className="flex items-center justify-center h-80">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="ml-2">Analyzing data for anomalies...</span>
                </div>
              ) : anomalies.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {getAnomalyMetrics().map(metric => (
                      <Badge 
                        key={metric}
                        variant={selectedMetric === metric ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setSelectedMetric(metric as keyof PowerForecast)}
                      >
                        {metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={prepareAnomalyChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          padding={{ left: 10, right: 10 }} 
                          tickMargin={10}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: any) => value ? [Number(value).toFixed(2), 'kW'] : ['N/A', '']}
                          labelFormatter={(label) => `Time: ${label}`}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#0ea5e9" 
                          strokeWidth={2} 
                          name="Actual" 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="expected" 
                          stroke="#6366f1" 
                          strokeWidth={2} 
                          strokeDasharray="5 5"
                          name="Expected Range" 
                        />
                        {/* Anomaly points */}
                        {/* Simple anomaly rendering */}
                        <Line 
                          type="monotone" 
                          dataKey="isAnomaly" 
                          stroke="#ef4444" 
                          strokeWidth={0}
                          name="Anomaly"
                          activeDot={{ r: 8, fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 }}
                          dot={{ r: 6, fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-4 mt-6">
                    <h3 className="text-lg font-medium">Detected Anomalies</h3>
                    
                    {anomalies
                      .filter(anomaly => anomaly.metric === selectedMetric)
                      .map((anomaly, index) => (
                        <Alert key={index} variant={anomaly.severity === 'high' ? 'destructive' : 'default'}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle className="flex items-center gap-2">
                            Anomaly on {format(new Date(anomaly.timestamp), 'MMM d, yyyy HH:mm')}
                            <Badge variant={
                              anomaly.severity === 'high' ? 'destructive' : 
                              anomaly.severity === 'medium' ? 'default' : 
                              'outline'
                            }>
                              {anomaly.severity.toUpperCase()}
                            </Badge>
                          </AlertTitle>
                          <AlertDescription>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                              <div>
                                <p className="text-sm font-medium">Details</p>
                                <p className="text-sm mt-1">
                                  Actual value: <span className="font-medium">{anomaly.actualValue.toFixed(2)} kW</span>
                                </p>
                                <p className="text-sm">
                                  Expected value: <span className="font-medium">{anomaly.expectedValue.toFixed(2)} kW</span>
                                </p>
                                <p className="text-sm">
                                  Deviation: <span className="font-medium">{anomaly.deviation.toFixed(2)}%</span>
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium">Possible Causes</p>
                                <ul className="text-sm list-disc pl-5 mt-1">
                                  {anomaly.possibleCauses.map((cause, idx) => (
                                    <li key={idx}>{cause}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            
                            <div className="mt-3">
                              <p className="text-sm font-medium">Recommended Actions</p>
                              <ul className="text-sm list-disc pl-5 mt-1">
                                {anomaly.recommendedActions.map((action, idx) => (
                                  <li key={idx}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                      
                    {anomalies.filter(anomaly => anomaly.metric === selectedMetric).length === 0 && (
                      <p className="text-muted-foreground">No anomalies detected for {selectedMetric}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 space-y-4">
                  <p>No anomalies detected yet</p>
                  <button 
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    onClick={generateForecasts}
                    disabled={isGenerating || isLoadingHistorical}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                        Analyzing...
                      </>
                    ) : 'Run Anomaly Detection'}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Efficiency Recommendations</CardTitle>
              <CardDescription>
                AI-powered insights to help optimize power usage and reduce costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isGenerating ? (
                <div className="flex items-center justify-center h-80">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="ml-2">Generating efficiency recommendations...</span>
                </div>
              ) : recommendations.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-green-700 dark:text-green-300 flex items-center">
                          <BarChart3 className="h-4 w-4 mr-1" />
                          Power Optimization
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Strategies to reduce overall power consumption and costs
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-blue-700 dark:text-blue-300 flex items-center">
                          <Droplets className="h-4 w-4 mr-1" />
                          Refrigeration Efficiency
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Optimize cooling systems for better energy usage
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-amber-700 dark:text-amber-300 flex items-center">
                          <FlameIcon className="h-4 w-4 mr-1" />
                          Production Scheduling
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Align operations with optimal energy availability
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">AI-Generated Recommendations</h3>
                    
                    <div className="space-y-3">
                      {recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 border rounded-md bg-muted/20">
                          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <p>{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 space-y-4">
                  <p>No recommendations available yet</p>
                  <button 
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    onClick={generateForecasts}
                    disabled={isGenerating || isLoadingHistorical}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                        Analyzing...
                      </>
                    ) : 'Generate Recommendations'}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ForecastingPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onToggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        
        <main className={`flex-1 app-content p-4 ${sidebarCollapsed ? '' : 'lg:ml-64'}`}>
          <ForecastingContent />
        </main>
      </div>
    </div>
  );
}