import React, { useState, useEffect } from 'react';
import { PowerData, EnvironmentalData } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Bar, BarChart, Cell } from 'recharts';
import { Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import * as ss from 'simple-statistics';

type WeatherCorrelationProps = {
  powerData: PowerData[];
  environmentalData: EnvironmentalData[];
  className?: string;
  isLoading?: boolean;
};

// Calculate Pearson correlation coefficient
function calculateCorrelation(xValues: number[], yValues: number[]): number {
  if (xValues.length !== yValues.length || xValues.length < 2) {
    return 0;
  }
  
  try {
    return ss.sampleCorrelation(xValues, yValues);
  } catch (error) {
    console.error('Error calculating correlation:', error);
    return 0;
  }
}

// Format correlation strength
function formatCorrelationStrength(corr: number): string {
  const absCorr = Math.abs(corr);
  if (absCorr > 0.7) return 'Strong';
  if (absCorr > 0.5) return 'Moderate';
  if (absCorr > 0.3) return 'Weak';
  return 'Very weak';
}

// Get correlation color based on strength
function getCorrelationColor(corr: number): string {
  const absCorr = Math.abs(corr);
  if (absCorr > 0.7) return corr > 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
  if (absCorr > 0.5) return corr > 0 ? 'rgb(134, 239, 172)' : 'rgb(252, 165, 165)';
  if (absCorr > 0.3) return corr > 0 ? 'rgb(187, 247, 208)' : 'rgb(254, 202, 202)';
  return 'rgb(226, 232, 240)';
}

export function WeatherCorrelationAnalysis({ 
  powerData, 
  environmentalData, 
  className,
  isLoading = false
}: WeatherCorrelationProps) {
  const [selectedMetric, setSelectedMetric] = useState<string>('solarOutput');
  const [correlations, setCorrelations] = useState<{[key: string]: {temperature: number, sunIntensity: number}}>({});
  const [scatterData, setScatterData] = useState<any[]>([]);
  const [weatherImpact, setWeatherImpact] = useState<any[]>([]);
  
  // Calculate correlations when data changes
  useEffect(() => {
    if (powerData.length < 10 || environmentalData.length < 10) return;
    
    // Align timestamps between power and environmental data
    const alignedData = alignDataByTimestamp();
    if (!alignedData || alignedData.length < 10) return;
    
    // Calculate correlations for each power metric
    const powerMetrics = ['solarOutput', 'refrigerationLoad', 'bigColdRoom', 'bigFreezer', 'totalLoad'];
    const newCorrelations: {[key: string]: {temperature: number, sunIntensity: number}} = {};
    
    powerMetrics.forEach(metric => {
      const powerValues = alignedData.map(d => d.power[metric as keyof PowerData] as number);
      const temperatureValues = alignedData.map(d => d.env.temperature);
      const sunIntensityValues = alignedData.map(d => d.env.sunIntensity);
      
      newCorrelations[metric] = {
        temperature: calculateCorrelation(temperatureValues, powerValues),
        sunIntensity: calculateCorrelation(sunIntensityValues, powerValues)
      };
    });
    
    setCorrelations(newCorrelations);
    
    // Prepare scatter plot data for selected metric
    const newScatterData = alignedData.map(d => ({
      temperature: d.env.temperature,
      sunIntensity: d.env.sunIntensity,
      [selectedMetric]: d.power[selectedMetric as keyof PowerData] as number,
      timestamp: new Date(d.power.timestamp).toLocaleString(),
      weather: d.env.weather
    }));
    
    setScatterData(newScatterData);
    
    // Calculate average power consumption by weather type
    calculateWeatherTypeImpact();
    
  }, [powerData, environmentalData, selectedMetric]);
  
  // Function to align power and environmental data by timestamp
  const alignDataByTimestamp = () => {
    if (!powerData.length || !environmentalData.length) return [];
    
    const alignedData: {power: PowerData, env: EnvironmentalData}[] = [];
    
    // Create a map of environmental data by timestamp for quick lookup
    const envMap = new Map<string, EnvironmentalData>();
    environmentalData.forEach(env => {
      const timestamp = new Date(env.timestamp).getTime();
      envMap.set(timestamp.toString(), env);
    });
    
    // Match power data with closest environmental data
    powerData.forEach(power => {
      const powerTimestamp = new Date(power.timestamp).getTime();
      
      // First try exact match
      if (envMap.has(powerTimestamp.toString())) {
        alignedData.push({
          power,
          env: envMap.get(powerTimestamp.toString())!
        });
        return;
      }
      
      // If no exact match, find closest
      let closestDiff = Infinity;
      let closestEnv: EnvironmentalData | null = null;
      
      envMap.forEach((env, timestampStr) => {
        const envTimestamp = parseInt(timestampStr);
        const diff = Math.abs(powerTimestamp - envTimestamp);
        
        if (diff < closestDiff) {
          closestDiff = diff;
          closestEnv = env;
        }
      });
      
      // Only include if the timestamp difference is less than 5 minutes
      if (closestEnv && closestDiff < 5 * 60 * 1000) {
        alignedData.push({
          power,
          env: closestEnv
        });
      }
    });
    
    return alignedData;
  };
  
  // Calculate impact of different weather types on power consumption
  const calculateWeatherTypeImpact = () => {
    const alignedData = alignDataByTimestamp();
    if (!alignedData || alignedData.length < 5) return;
    
    // Group data by weather type
    const weatherGroups: {[key: string]: {count: number, metrics: {[key: string]: number[]}}} = {};
    
    alignedData.forEach(({ power, env }) => {
      const weather = env.weather;
      
      if (!weatherGroups[weather]) {
        weatherGroups[weather] = {
          count: 0,
          metrics: {
            solarOutput: [],
            refrigerationLoad: [],
            bigColdRoom: [],
            bigFreezer: [],
            totalLoad: []
          }
        };
      }
      
      weatherGroups[weather].count++;
      Object.keys(weatherGroups[weather].metrics).forEach(metric => {
        if (metric in power) {
          weatherGroups[weather].metrics[metric].push(power[metric as keyof PowerData] as number);
        }
      });
    });
    
    // Calculate averages for each weather type and metric
    const weatherImpactData: any[] = [];
    
    Object.entries(weatherGroups).forEach(([weather, data]) => {
      if (data.count < 3) return; // Skip if not enough data points
      
      const impact: any = { weather, count: data.count };
      
      Object.entries(data.metrics).forEach(([metric, values]) => {
        if (values.length > 0) {
          impact[metric] = ss.mean(values);
          impact[`${metric}Std`] = values.length > 1 ? ss.standardDeviation(values) : 0;
        }
      });
      
      weatherImpactData.push(impact);
    });
    
    setWeatherImpact(weatherImpactData);
  };
  
  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Weather Impact Analysis</CardTitle>
          <CardDescription>Analyzing correlation between weather conditions and power consumption...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  if (powerData.length < 10 || environmentalData.length < 10) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Weather Impact Analysis</CardTitle>
          <CardDescription>Insufficient data for correlation analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Not enough data points</AlertTitle>
            <AlertDescription>
              At least 10 data points are required for meaningful correlation analysis. Continue collecting data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Weather Impact Analysis</CardTitle>
        <CardDescription>
          Correlation between environmental conditions and power consumption
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="correlation" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="correlation">Correlation Analysis</TabsTrigger>
            <TabsTrigger value="scatter">Scatter Plot</TabsTrigger>
            <TabsTrigger value="weather">Weather Type Impact</TabsTrigger>
          </TabsList>
          
          <TabsContent value="correlation">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Temperature Correlation</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(correlations).map(([metric, values]) => ({
                          name: formatMetricName(metric),
                          value: values.temperature,
                          color: getCorrelationColor(values.temperature)
                        }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[-1, 1]} tickCount={5} />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip
                          formatter={(value: number) => [
                            `${value.toFixed(2)} (${formatCorrelationStrength(value)})`,
                            'Correlation'
                          ]}
                        />
                        <Legend />
                        <Bar dataKey="value" name="Temperature Correlation">
                          {Object.entries(correlations).map(([metric, values], index) => (
                            <Cell key={`cell-${index}`} fill={getCorrelationColor(values.temperature)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Sun Intensity Correlation</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(correlations).map(([metric, values]) => ({
                          name: formatMetricName(metric),
                          value: values.sunIntensity,
                          color: getCorrelationColor(values.sunIntensity)
                        }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[-1, 1]} tickCount={5} />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip
                          formatter={(value: number) => [
                            `${value.toFixed(2)} (${formatCorrelationStrength(value)})`,
                            'Correlation'
                          ]}
                        />
                        <Legend />
                        <Bar dataKey="value" name="Sun Intensity Correlation">
                          {Object.entries(correlations).map(([metric, values], index) => (
                            <Cell key={`cell-${index}`} fill={getCorrelationColor(values.sunIntensity)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border border-border rounded-lg mt-4">
                <h3 className="text-sm font-medium mb-2">Correlation Insights</h3>
                <ul className="space-y-2">
                  {generateCorrelationInsights()}
                </ul>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="scatter">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-2">
                <select 
                  className="bg-card border border-input rounded-md px-3 py-1 text-sm"
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                >
                  <option value="solarOutput">Solar Output</option>
                  <option value="refrigerationLoad">Refrigeration Load</option>
                  <option value="bigColdRoom">Big Cold Room</option>
                  <option value="bigFreezer">Big Freezer</option>
                  <option value="totalLoad">Total Load</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Temperature vs {formatMetricName(selectedMetric)}</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                      >
                        <CartesianGrid />
                        <XAxis 
                          type="number" 
                          dataKey="temperature" 
                          name="Temperature" 
                          unit="°C" 
                          domain={['dataMin - 2', 'dataMax + 2']}
                        />
                        <YAxis 
                          type="number" 
                          dataKey={selectedMetric} 
                          name={formatMetricName(selectedMetric)} 
                          unit=" kW" 
                        />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          formatter={(value: any, name: string) => {
                            if (name === selectedMetric) return [`${value.toFixed(2)} kW`, formatMetricName(selectedMetric)];
                            return [`${value.toFixed(1)}°C`, name];
                          }}
                        />
                        <Scatter 
                          name={formatMetricName(selectedMetric)}
                          data={scatterData} 
                          fill="#8884d8"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Sun Intensity vs {formatMetricName(selectedMetric)}</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                      >
                        <CartesianGrid />
                        <XAxis 
                          type="number" 
                          dataKey="sunIntensity" 
                          name="Sun Intensity" 
                          unit="%" 
                          domain={[0, 100]}
                        />
                        <YAxis 
                          type="number" 
                          dataKey={selectedMetric} 
                          name={formatMetricName(selectedMetric)} 
                          unit=" kW" 
                        />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          formatter={(value: any, name: string) => {
                            if (name === selectedMetric) return [`${value.toFixed(2)} kW`, formatMetricName(selectedMetric)];
                            return [`${value}%`, name];
                          }}
                        />
                        <Scatter 
                          name={formatMetricName(selectedMetric)}
                          data={scatterData} 
                          fill="#82ca9d"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border border-border rounded-lg mt-2">
                <h3 className="text-sm font-medium mb-2">Scatter Plot Insights</h3>
                <p className="text-sm text-muted-foreground">
                  {getScatterPlotInsight()}
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="weather">
            <div className="space-y-4">
              <select 
                className="bg-card border border-input rounded-md px-3 py-1 text-sm"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
              >
                <option value="solarOutput">Solar Output</option>
                <option value="refrigerationLoad">Refrigeration Load</option>
                <option value="bigColdRoom">Big Cold Room</option>
                <option value="bigFreezer">Big Freezer</option>
                <option value="totalLoad">Total Load</option>
              </select>
              
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weatherImpact}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weather" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === selectedMetric) return [`${value.toFixed(2)} kW`, formatMetricName(name)];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey={selectedMetric} 
                      name={formatMetricName(selectedMetric)} 
                      fill="#8884d8" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="p-4 border border-border rounded-lg mt-2">
                <h3 className="text-sm font-medium mb-2">Weather Type Insights</h3>
                <p className="text-sm text-muted-foreground">
                  {getWeatherTypeInsight()}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
  
  // Helper function to format metric name for display
  function formatMetricName(metric: string): string {
    switch (metric) {
      case 'solarOutput': return 'Solar Output';
      case 'refrigerationLoad': return 'Refrigeration Load';
      case 'bigColdRoom': return 'Big Cold Room';
      case 'bigFreezer': return 'Big Freezer';
      case 'totalLoad': return 'Total Load';
      default: return metric;
    }
  }
  
  // Generate correlation insights based on calculated correlations
  function generateCorrelationInsights(): JSX.Element[] {
    const insights: JSX.Element[] = [];
    
    if (Object.keys(correlations).length === 0) {
      return [<li key="no-data" className="text-sm text-muted-foreground">Insufficient data for correlation analysis</li>];
    }
    
    // Solar output insights
    if (correlations.solarOutput) {
      const sunCorr = correlations.solarOutput.sunIntensity;
      const tempCorr = correlations.solarOutput.temperature;
      
      if (Math.abs(sunCorr) > 0.5) {
        insights.push(
          <li key="solar-sun" className="text-sm flex items-start">
            <span className={sunCorr > 0 ? "text-green-400 mr-2" : "text-red-400 mr-2"}>•</span>
            <span>
              Solar output has a <strong>{formatCorrelationStrength(sunCorr)}</strong> {sunCorr > 0 ? 'positive' : 'negative'} correlation with sun intensity 
              ({sunCorr.toFixed(2)}). {sunCorr > 0 ? 'Higher sun intensity increases solar generation.' : 'Unexpected negative correlation requires investigation.'}
            </span>
          </li>
        );
      }
      
      if (Math.abs(tempCorr) > 0.3) {
        insights.push(
          <li key="solar-temp" className="text-sm flex items-start">
            <span className={tempCorr > 0 ? "text-green-400 mr-2" : "text-amber-400 mr-2"}>•</span>
            <span>
              Solar output has a <strong>{formatCorrelationStrength(tempCorr)}</strong> {tempCorr > 0 ? 'positive' : 'negative'} correlation with temperature 
              ({tempCorr.toFixed(2)}). {tempCorr < 0 ? 'High temperatures may be reducing panel efficiency.' : 'Temperature increases align with solar production.'}
            </span>
          </li>
        );
      }
    }
    
    // Refrigeration insights
    if (correlations.refrigerationLoad) {
      const tempCorr = correlations.refrigerationLoad.temperature;
      
      if (Math.abs(tempCorr) > 0.3) {
        insights.push(
          <li key="refrig-temp" className="text-sm flex items-start">
            <span className={tempCorr > 0 ? "text-amber-400 mr-2" : "text-green-400 mr-2"}>•</span>
            <span>
              Refrigeration load has a <strong>{formatCorrelationStrength(tempCorr)}</strong> {tempCorr > 0 ? 'positive' : 'negative'} correlation with temperature 
              ({tempCorr.toFixed(2)}). {tempCorr > 0 ? 'Higher temperatures increase refrigeration power consumption.' : 'Refrigeration efficiency improves in cooler temperatures.'}
            </span>
          </li>
        );
      }
    }
    
    // Cold room and freezer insights
    if (correlations.bigColdRoom && correlations.bigFreezer) {
      const coldRoomTempCorr = correlations.bigColdRoom.temperature;
      const freezerTempCorr = correlations.bigFreezer.temperature;
      
      if (Math.abs(coldRoomTempCorr) > 0.3 && Math.abs(freezerTempCorr) > 0.3) {
        const comparisonText = Math.abs(coldRoomTempCorr) > Math.abs(freezerTempCorr)
          ? 'Cold room is more sensitive to temperature changes than the freezer'
          : 'Freezer is more sensitive to temperature changes than the cold room';
        
        insights.push(
          <li key="cold-vs-freezer" className="text-sm flex items-start">
            <span className="text-blue-400 mr-2">•</span>
            <span>
              {comparisonText} (correlation: {coldRoomTempCorr.toFixed(2)} vs {freezerTempCorr.toFixed(2)}). 
              Consider prioritizing insulation upgrades accordingly.
            </span>
          </li>
        );
      }
    }
    
    // Total load insights
    if (correlations.totalLoad) {
      const tempCorr = correlations.totalLoad.temperature;
      const sunCorr = correlations.totalLoad.sunIntensity;
      
      if (Math.abs(tempCorr) > 0.4) {
        insights.push(
          <li key="total-temp" className="text-sm flex items-start">
            <span className={tempCorr > 0 ? "text-amber-400 mr-2" : "text-green-400 mr-2"}>•</span>
            <span>
              Total power load has a <strong>{formatCorrelationStrength(tempCorr)}</strong> {tempCorr > 0 ? 'positive' : 'negative'} correlation with temperature 
              ({tempCorr.toFixed(2)}). {tempCorr > 0 ? 'Facility consumes more power in warmer conditions.' : 'Lower power consumption observed in warmer conditions.'}
            </span>
          </li>
        );
      }
      
      if (Math.abs(sunCorr) > 0.3) {
        const offsetText = correlations.solarOutput && correlations.solarOutput.sunIntensity > 0.5
          ? 'Solar generation is helping offset grid consumption during sunny periods.'
          : 'Consider optimizing solar generation to better offset total consumption.';
        
        insights.push(
          <li key="total-sun" className="text-sm flex items-start">
            <span className={sunCorr < 0 ? "text-green-400 mr-2" : "text-amber-400 mr-2"}>•</span>
            <span>
              Total power load has a <strong>{formatCorrelationStrength(sunCorr)}</strong> {sunCorr > 0 ? 'positive' : 'negative'} correlation with sun intensity 
              ({sunCorr.toFixed(2)}). {offsetText}
            </span>
          </li>
        );
      }
    }
    
    // If no specific insights, provide a general one
    if (insights.length === 0) {
      insights.push(
        <li key="general" className="text-sm text-muted-foreground">
          No strong correlations detected between environmental conditions and power metrics. 
          This suggests your operations may be well-insulated from weather variations.
        </li>
      );
    }
    
    return insights;
  }
  
  // Generate insights for scatter plot view
  function getScatterPlotInsight(): string {
    if (!correlations[selectedMetric]) {
      return 'Insufficient data to generate insights for this metric.';
    }
    
    const tempCorr = correlations[selectedMetric].temperature;
    const sunCorr = correlations[selectedMetric].sunIntensity;
    
    let insight = `${formatMetricName(selectedMetric)} shows `;
    
    if (Math.abs(tempCorr) > 0.3) {
      insight += `a ${formatCorrelationStrength(tempCorr).toLowerCase()} ${tempCorr > 0 ? 'positive' : 'negative'} correlation with temperature (${tempCorr.toFixed(2)}). `;
      
      if (selectedMetric === 'refrigerationLoad' || selectedMetric === 'bigColdRoom' || selectedMetric === 'bigFreezer') {
        insight += tempCorr > 0 
          ? 'This is expected as cooling systems work harder in warmer conditions. Consider scheduling maintenance during cooler periods.' 
          : 'This unusual pattern requires investigation as cooling systems typically use more energy in warmer conditions.';
      } else if (selectedMetric === 'solarOutput') {
        insight += tempCorr > 0 
          ? 'This may be due to sunnier days also being warmer, not necessarily panel efficiency.' 
          : 'This may indicate reduced panel efficiency at higher temperatures, which is a known issue with photovoltaic systems.';
      }
    } else if (Math.abs(sunCorr) > 0.3) {
      insight += `a ${formatCorrelationStrength(sunCorr).toLowerCase()} ${sunCorr > 0 ? 'positive' : 'negative'} correlation with sun intensity (${sunCorr.toFixed(2)}). `;
      
      if (selectedMetric === 'solarOutput') {
        insight += sunCorr > 0 
          ? 'This confirms your solar system is performing as expected, with higher generation during sunny periods.' 
          : 'This unexpected pattern requires investigation as solar output should increase with sun intensity.';
      } else {
        insight += 'This may indicate an opportunity to better align energy-intensive operations with solar production.';
      }
    } else {
      insight += 'weak correlations with both temperature and sun intensity, suggesting it may be largely independent of these environmental factors.';
    }
    
    return insight;
  }
  
  // Generate insights for weather type view
  function getWeatherTypeInsight(): string {
    if (!weatherImpact || weatherImpact.length === 0) {
      return 'Insufficient data to analyze different weather types.';
    }
    
    // Find weather type with highest and lowest values for selected metric
    const validWeatherTypes = weatherImpact.filter(w => w[selectedMetric] !== undefined);
    if (validWeatherTypes.length < 2) {
      return 'Need more diverse weather conditions for comparative analysis.';
    }
    
    const highest = validWeatherTypes.reduce((prev, current) => 
      (current[selectedMetric] > prev[selectedMetric]) ? current : prev
    );
    
    const lowest = validWeatherTypes.reduce((prev, current) => 
      (current[selectedMetric] < prev[selectedMetric]) ? current : prev
    );
    
    const difference = highest[selectedMetric] - lowest[selectedMetric];
    const percentDifference = (difference / lowest[selectedMetric]) * 100;
    
    let insight = `${formatMetricName(selectedMetric)} is highest during ${highest.weather} conditions (${highest[selectedMetric].toFixed(2)} kW) and lowest during ${lowest.weather} conditions (${lowest[selectedMetric].toFixed(2)} kW). `;
    
    insight += `This represents a ${percentDifference.toFixed(0)}% difference. `;
    
    if (selectedMetric === 'solarOutput') {
      insight += highest.weather.toLowerCase().includes('sunny') || highest.weather.toLowerCase().includes('clear')
        ? 'This confirms expected solar panel performance across weather conditions.' 
        : 'This unusual pattern may indicate miscalibrated sensors or issues with panel orientation.';
    } else if (selectedMetric === 'refrigerationLoad' || selectedMetric === 'bigColdRoom' || selectedMetric === 'bigFreezer') {
      insight += highest.weather.toLowerCase().includes('sunny') || highest.weather.toLowerCase().includes('clear')
        ? 'Consider optimizing cooling systems for better efficiency during sunny/warm periods.' 
        : 'Unexpectedly high refrigeration demands during this weather condition may indicate operational issues.';
    } else if (selectedMetric === 'totalLoad') {
      insight += 'Understanding these weather-related usage patterns can help with demand management and energy cost reduction.';
    }
    
    return insight;
  }
}