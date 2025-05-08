import React, { useState, useEffect } from 'react';
import { usePowerData } from '@/hooks/use-power-data';
import { useAuth } from '@/hooks/use-auth';
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
import { Loader2, AlertTriangle, Info, TrendingUp, CircleCheck, BarChart3, FlameIcon, Droplets, ArrowRight } from 'lucide-react';
import { SharedLayout } from '@/components/ui/shared-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EnvironmentalChart, EnvironmentalStats, SolarInfluenceAnalysis } from '@/components/environmental-chart';
import { WeatherCorrelationAnalysis } from '@/components/weather-correlation-analysis';
import { SolarForecastSection } from '@/components/solar-forecast-section';
import { Button } from '@/components/ui/button';

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
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Power Forecasting &amp; Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Advanced analytics to predict power usage, detect anomalies, and optimize efficiency
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
          <TabsTrigger value="environment">Environment</TabsTrigger>
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
                      variant={selectedMetric === 'processLoad' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedMetric('processLoad')}
                    >
                      Process Load
                    </Badge>
                  </div>
                  
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={prepareChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          scale="band" 
                          padding={{ left: 10, right: 10 }} 
                        />
                        <YAxis 
                          label={{ 
                            value: 'Power (kW)', 
                            angle: -90, 
                            position: 'insideLeft',
                            style: { textAnchor: 'middle' }
                          }}
                        />
                        <Tooltip />
                        <Legend />
                        
                        {/* Historical data */}
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#8884d8" 
                          name="Historical" 
                          dot={true}
                          activeDot={{ r: 8 }}
                          strokeWidth={2}
                        />
                        
                        {/* Forecast */}
                        <Line 
                          type="monotone" 
                          dataKey="forecast" 
                          stroke="#82ca9d" 
                          name="Forecast" 
                          strokeDasharray="5 5"
                          strokeWidth={2}
                        />
                        
                        {/* Confidence bounds as shaded area */}
                        <Area 
                          type="monotone" 
                          dataKey="lowerBound" 
                          fill="#82ca9d" 
                          fillOpacity={0.2} 
                          stroke="none" 
                          name="Lower Bound" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="upperBound" 
                          fill="#82ca9d" 
                          fillOpacity={0.2} 
                          stroke="none" 
                          name="Upper Bound" 
                          baseLine={d => d.lowerBound}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Forecast Confidence</AlertTitle>
                    <AlertDescription>
                      Shaded area represents the 95% confidence interval. Forecasts incorporate environmental data and historical patterns.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 space-y-4">
                  <p>No forecasts have been generated yet</p>
                  <Button 
                    onClick={generateForecasts}
                    disabled={isLoadingHistorical}
                  >
                    {isLoadingHistorical ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading Data...
                      </>
                    ) : 'Generate Forecasts'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="environment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Environmental Conditions</CardTitle>
              <CardDescription>
                Weather and environmental factors that influence power usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnvironmentalStats environmentalData={environmentalData} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Solar Production Influence</CardTitle>
              <CardDescription>
                How environmental factors affect solar power generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SolarInfluenceAnalysis environmentalData={environmentalData} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection</CardTitle>
              <CardDescription>
                Unusual patterns in power consumption that may indicate issues
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
                        {metric.replace(/([A-Z])/g, ' $1').trim()}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={prepareAnomalyChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          scale="band" 
                        />
                        <YAxis 
                          label={{ 
                            value: 'Power (kW)', 
                            angle: -90, 
                            position: 'insideLeft',
                            style: { textAnchor: 'middle' }
                          }}
                        />
                        <Tooltip />
                        <Legend />
                        
                        {/* Actual values */}
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#8884d8" 
                          name="Actual" 
                          strokeWidth={2}
                          dot={(props) => {
                            const { cx, cy, isAnomaly } = props.payload;
                            if (isAnomaly) {
                              return (
                                <circle 
                                  cx={cx} 
                                  cy={cy} 
                                  r={6} 
                                  fill="#ff4d4f" 
                                  stroke="#8884d8" 
                                  strokeWidth={2}
                                />
                              );
                            }
                            return <circle cx={cx} cy={cy} r={3} fill="#8884d8" />;
                          }}
                        />
                        
                        {/* Expected values when anomaly is present */}
                        <Line 
                          type="monotone" 
                          dataKey="expected" 
                          stroke="#82ca9d" 
                          name="Expected" 
                          strokeDasharray="5 5"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="mt-4 space-y-4">
                    <h3 className="text-lg font-semibold">Detected Anomalies</h3>
                    <div className="space-y-2">
                      {anomalies
                        .filter(a => a.metric === selectedMetric)
                        .map((anomaly, index) => (
                          <Alert key={index} variant={anomaly.severity === 'high' ? 'destructive' : 'default'}>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="flex items-center gap-2">
                              {anomaly.metric} Anomaly
                              <Badge>{anomaly.severity}</Badge>
                            </AlertTitle>
                            <AlertDescription>
                              <p>At {format(anomaly.timestamp, 'PPp')}</p>
                              <p>Expected: {anomaly.expectedValue.toFixed(2)} kW, Actual: {anomaly.actualValue.toFixed(2)} kW</p>
                              <p className="mt-1">{anomaly.description}</p>
                            </AlertDescription>
                          </Alert>
                        ))}
                      
                      {anomalies.filter(a => a.metric === selectedMetric).length === 0 && (
                        <p>No anomalies detected for {selectedMetric.replace(/([A-Z])/g, ' $1').trim()}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 space-y-4">
                  <p>No anomalies have been detected yet</p>
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
                    ) : 'Detect Anomalies'}
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
                Suggestions to improve energy efficiency based on analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isGenerating ? (
                <div className="flex items-center justify-center h-80">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="ml-2">Generating efficiency recommendations...</span>
                </div>
              ) : recommendations.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {recommendations.map((rec, index) => (
                      <div 
                        key={index} 
                        className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <CircleCheck className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <p>{rec}</p>
                          </div>
                        </div>
                      </div>
                    ))}
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
  const { user } = useAuth();
  
  return (
    <SharedLayout user={user}>
      <ForecastingContent />
    </SharedLayout>
  );
}