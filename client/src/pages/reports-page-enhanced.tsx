import { useState } from "react";
import { usePowerData } from "@/hooks/use-power-data";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { SharedLayout } from "@/components/ui/shared-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Download, Calendar, Filter, PieChart, BarChart4, 
  AreaChart, LineChart, Lightbulb, Brain, TrendingUp, FileText 
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { PowerChart } from "@/components/power-chart";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AIAnalyticsCard } from "@/components/ai-analytics-card";
import { AIReportCard } from "@/components/ai-report-card";
import { AIPredictionsCard } from "@/components/ai-predictions-card";

// Define type for power data reports
type PowerDataRow = {
  id: number;
  timestamp: Date;
  totalLoad: number;
  mainGridPower: number;
  solarOutput: number;
  processLoad: number;
  hvacLoad: number;
  lightingLoad: number;
  refrigerationLoad: number;
  efficiency: number;
};

// Define columns for power data table
const powerColumns: ColumnDef<PowerDataRow>[] = [
  {
    accessorKey: "timestamp",
    header: "Time",
    cell: ({ row }) => format(new Date(row.getValue("timestamp")), "yyyy-MM-dd HH:mm"),
  },
  {
    accessorKey: "totalLoad",
    header: "Total Load (kW)",
    cell: ({ row }) => {
      const value = row.getValue("totalLoad");
      return value != null ? (value as number).toFixed(2) : 'N/A';
    },
  },
  {
    accessorKey: "mainGridPower",
    header: "Grid Power (kW)",
    cell: ({ row }) => {
      const value = row.getValue("mainGridPower");
      return value != null ? (value as number).toFixed(2) : 'N/A';
    },
  },
  {
    accessorKey: "solarOutput",
    header: "Solar Output (kW)",
    cell: ({ row }) => {
      const value = row.getValue("solarOutput");
      return value != null ? (value as number).toFixed(2) : 'N/A';
    },
  },
  {
    accessorKey: "efficiency",
    header: "Solar Efficiency (%)",
    cell: ({ row }) => {
      const efficiency = row.getValue("efficiency");
      if (efficiency == null) return 'N/A';
      
      const effValue = efficiency as number;
      return (
        <div className="flex items-center">
          <span>{effValue.toFixed(1)}%</span>
          <div 
            className="ml-2 h-2 w-16 bg-secondary rounded-full overflow-hidden"
          >
            <div 
              className="h-full bg-primary" 
              style={{ width: `${Math.min(effValue, 100)}%` }}
            />
          </div>
        </div>
      );
    },
  },
];

// Environmental data columns
type EnvironmentalDataRow = {
  id: number;
  timestamp: Date;
  weather: string;
  temperature: number;
  humidity: number | null;
  ghi: number;
  dni: number;
};

const environmentalColumns: ColumnDef<EnvironmentalDataRow>[] = [
  {
    accessorKey: "timestamp",
    header: "Time",
    cell: ({ row }) => format(new Date(row.getValue("timestamp")), "yyyy-MM-dd HH:mm"),
  },
  {
    accessorKey: "weather",
    header: "Weather",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Badge variant="outline">{row.getValue("weather")}</Badge>
      </div>
    ),
  },
  {
    accessorKey: "temperature",
    header: "Temp (°C)",
    cell: ({ row }) => {
      const value = row.getValue("temperature");
      return value != null ? (value as number).toFixed(1) : 'N/A';
    },
  },
  {
    accessorKey: "humidity",
    header: "Humidity (%)",
    cell: ({ row }) => {
      const humidity = row.getValue("humidity") as number | null;
      return humidity != null ? humidity.toFixed(1) : "N/A";
    },
  },
  {
    accessorKey: "ghi",
    header: "GHI (W/m²)",
    cell: ({ row }) => {
      const value = row.getValue("ghi");
      return value != null ? (value as number).toFixed(0) : 'N/A';
    },
  },
  {
    accessorKey: "dni",
    header: "DNI (W/m²)",
    cell: ({ row }) => {
      const value = row.getValue("dni");
      return value != null ? (value as number).toFixed(0) : 'N/A';
    },
  },
];

export default function ReportsPage() {
  const { powerData, environmentalData, isLoading } = usePowerData();
  const [dateRange, setDateRange] = useState<string>("day");
  const [reportType, setReportType] = useState<string>("hourly");
  
  // Fetch historical power data
  const { data: historicalPowerData, isLoading: isLoadingHistorical } = useQuery({
    queryKey: ["/api/power-data", dateRange],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  
  // Fetch historical environmental data
  const { data: historicalEnvData, isLoading: isLoadingEnv } = useQuery({
    queryKey: ["/api/environmental-data", dateRange],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  
  // Filter data based on date range
  const getFilteredPowerData = () => {
    if (!historicalPowerData) return [];
    
    // Ensure historicalPowerData is an array
    let data = Array.isArray(historicalPowerData) ? [...historicalPowerData] : [];
    
    switch (dateRange) {
      case "day":
        data = data.filter(d => new Date(d.timestamp) >= subDays(new Date(), 1));
        break;
      case "week":
        data = data.filter(d => new Date(d.timestamp) >= subDays(new Date(), 7));
        break;
      case "month":
        data = data.filter(d => new Date(d.timestamp) >= subDays(new Date(), 30));
        break;
      default:
        break;
    }
    
    // Calculate efficiency for each data point
    return data.map(d => ({
      ...d,
      efficiency: d.totalLoad > 0 ? (d.solarOutput / d.totalLoad) * 100 : 0,
    }));
  };
  
  // Filter environmental data
  const getFilteredEnvData = () => {
    if (!historicalEnvData) return [];
    
    // Ensure historicalEnvData is an array
    let data = Array.isArray(historicalEnvData) ? [...historicalEnvData] : [];
    
    switch (dateRange) {
      case "day":
        data = data.filter(d => new Date(d.timestamp) >= subDays(new Date(), 1));
        break;
      case "week":
        data = data.filter(d => new Date(d.timestamp) >= subDays(new Date(), 7));
        break;
      case "month":
        data = data.filter(d => new Date(d.timestamp) >= subDays(new Date(), 30));
        break;
      default:
        break;
    }
    
    return data.map(d => ({
      ...d,
      temperature: d.air_temp, // Map air_temp to temperature for clarity
    }));
  };
  
  // Download report data as CSV
  const downloadReport = () => {
    const data = getFilteredPowerData();
    const headers = [
      "Timestamp",
      "Total Load (kW)",
      "Grid Power (kW)",
      "Solar Output (kW)",
      "Process Load (kW)",
      "HVAC Load (kW)",
      "Lighting Load (kW)",
      "Refrigeration Load (kW)",
      "Solar Efficiency (%)",
    ];
    
    const csvRows = [
      headers.join(","),
      ...data.map(row => {
        const timestamp = format(new Date(row.timestamp), "yyyy-MM-dd HH:mm:ss");
        const efficiency = row.totalLoad > 0 ? (row.solarOutput / row.totalLoad) * 100 : 0;
        
        // Safe toFixed for null values
        const safeToFixed = (value: any, precision: number) => {
          return value != null ? Number(value).toFixed(precision) : "N/A";
        };
        
        return [
          timestamp,
          safeToFixed(row.totalLoad, 2),
          safeToFixed(row.mainGridPower, 2),
          safeToFixed(row.solarOutput, 2),
          safeToFixed(row.processLoad, 2),
          safeToFixed(row.hvacLoad, 2),
          safeToFixed(row.lightingLoad, 2),
          safeToFixed(row.refrigerationLoad, 2),
          safeToFixed(efficiency, 1),
        ].join(",");
      }),
    ];
    
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `power-report-${dateRange}-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const isDataLoading = isLoading || isLoadingHistorical || isLoadingEnv;
  
  const { user } = useAuth();

  const filteredPowerData = getFilteredPowerData();
  const filteredEnvData = getFilteredEnvData();

  return (
    <SharedLayout user={user}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          
          <div className="flex flex-wrap gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Last 24 Hours</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={downloadReport} disabled={isDataLoading} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="standard" className="space-y-4">
          <TabsList className="w-full flex">
            <TabsTrigger value="standard" className="flex-1">
              <LineChart className="mr-2 h-4 w-4" />
              Standard Reports
            </TabsTrigger>
            <TabsTrigger value="ai-analytics" className="flex-1">
              <Brain className="mr-2 h-4 w-4" />
              AI Analytics
            </TabsTrigger>
          </TabsList>
          
          {/* Standard Reports Tab */}
          <TabsContent value="standard" className="space-y-6">
            {isDataLoading ? (
              <div className="flex items-center justify-center h-[400px] bg-card rounded-lg border">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-muted-foreground">Loading report data...</p>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="charts" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="charts">
                    <LineChart className="mr-2 h-4 w-4" />
                    Charts
                  </TabsTrigger>
                  <TabsTrigger value="power-data">
                    <BarChart4 className="mr-2 h-4 w-4" />
                    Power Data
                  </TabsTrigger>
                  <TabsTrigger value="environmental">
                    <AreaChart className="mr-2 h-4 w-4" />
                    Environmental
                  </TabsTrigger>
                  <TabsTrigger value="efficiency">
                    <PieChart className="mr-2 h-4 w-4" />
                    Efficiency
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="charts" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Power Consumption & Generation</CardTitle>
                      <CardDescription>Analysis of power usage across different sources over time</CardDescription>
                    </CardHeader>
                    <CardContent className="h-96">
                      <PowerChart 
                        data={filteredPowerData} 
                        showProcessLoad={true}
                        showLighting={true}
                        showHvac={true}
                        showRefrigeration={true}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="power-data" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Power Data Analysis</CardTitle>
                      <CardDescription>Detailed breakdown of power consumption metrics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DataTable 
                        columns={powerColumns} 
                        data={filteredPowerData}
                        searchColumn="timestamp"
                        searchPlaceholder="Search by time..."
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="environmental" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Environmental Data</CardTitle>
                      <CardDescription>Weather and environmental conditions affecting energy production</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DataTable 
                        columns={environmentalColumns} 
                        data={filteredEnvData}
                        searchColumn="timestamp"
                        searchPlaceholder="Search by time..."
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="efficiency" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Solar Efficiency Analysis</CardTitle>
                      <CardDescription>
                        Performance metrics for solar energy production and utilization
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-96">
                      <div className="h-full flex flex-col justify-center items-center">
                        <div className="text-center mb-4">
                          <div className="text-xl font-bold">
                            Average Solar Efficiency:
                            {filteredPowerData.length > 0 ? (
                              <span className="text-primary ml-2">
                                {(filteredPowerData.reduce((acc, item) => acc + item.efficiency, 0) / filteredPowerData.length).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="ml-2">N/A</span>
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            Based on {filteredPowerData.length} data points from the selected period
                          </p>
                        </div>
                        
                        <div className="w-full max-w-md">
                          <Separator className="my-4" />
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Peak Efficiency:</span>
                              <span className="font-medium">
                                {filteredPowerData.length > 0 ? 
                                  Math.max(...filteredPowerData.map(item => item.efficiency)).toFixed(1) + '%' : 
                                  'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Lowest Efficiency:</span>
                              <span className="font-medium">
                                {filteredPowerData.length > 0 ? 
                                  Math.min(...filteredPowerData
                                    .filter(item => item.solarOutput > 0)
                                    .map(item => item.efficiency)).toFixed(1) + '%' : 
                                  'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Peak Solar Output:</span>
                              <span className="font-medium">
                                {filteredPowerData.length > 0 ? 
                                  Math.max(...filteredPowerData.map(item => item.solarOutput)).toFixed(2) + ' kW' : 
                                  'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Solar Contribution:</span>
                              <span className="font-medium">
                                {filteredPowerData.length > 0 ? 
                                  ((filteredPowerData.reduce((acc, item) => acc + item.solarOutput, 0) / 
                                    filteredPowerData.reduce((acc, item) => acc + item.totalLoad, 0)) * 100).toFixed(1) + '%' : 
                                  'N/A'}
                              </span>
                            </div>
                          </div>
                          
                          <Separator className="my-4" />
                          
                          <div className="space-y-2">
                            <div className="text-sm font-medium mb-2">Efficiency Distribution</div>
                            <div className="h-4 bg-muted rounded-full overflow-hidden">
                              {filteredPowerData.length > 0 && (
                                <>
                                  <div 
                                    className="h-full bg-green-500 float-left" 
                                    style={{ 
                                      width: `${(filteredPowerData.filter(item => item.efficiency > 50).length / 
                                        filteredPowerData.length) * 100}%` 
                                    }}
                                  />
                                  <div 
                                    className="h-full bg-yellow-500 float-left" 
                                    style={{ 
                                      width: `${(filteredPowerData.filter(item => item.efficiency <= 50 && item.efficiency > 25).length / 
                                        filteredPowerData.length) * 100}%` 
                                    }}
                                  />
                                  <div 
                                    className="h-full bg-red-500 float-left" 
                                    style={{ 
                                      width: `${(filteredPowerData.filter(item => item.efficiency <= 25 && item.efficiency > 0).length / 
                                        filteredPowerData.length) * 100}%` 
                                    }}
                                  />
                                  <div 
                                    className="h-full bg-slate-500 float-left" 
                                    style={{ 
                                      width: `${(filteredPowerData.filter(item => item.efficiency === 0).length / 
                                        filteredPowerData.length) * 100}%` 
                                    }}
                                  />
                                </>
                              )}
                            </div>
                            <div className="flex text-xs justify-between mt-1 text-muted-foreground">
                              <span>0%</span>
                              <span>25%</span>
                              <span>50%</span>
                              <span>100%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
          
          {/* AI Analytics Tab */}
          <TabsContent value="ai-analytics" className="space-y-6">
            {isDataLoading ? (
              <div className="flex items-center justify-center h-[400px] bg-card rounded-lg border">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-muted-foreground">Loading data for AI analysis...</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 gap-4">
                  {/* AI Feature Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    <Card className="lg:col-span-1">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center">
                          <Brain className="h-5 w-5 mr-2" />
                          AI Analytics Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          The advanced AI analytics features allow you to gain deeper insights from your power and environmental data. These AI-powered tools analyze patterns, generate predictions, and create comprehensive reports.
                        </p>
                        <div className="space-y-4">
                          <div className="flex items-start">
                            <Brain className="h-5 w-5 mr-2 mt-0.5 text-primary" />
                            <div>
                              <span className="font-medium">Data Analytics</span>
                              <p className="text-sm text-muted-foreground">
                                Identify patterns, anomalies, and insights from historical data
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start">
                            <FileText className="h-5 w-5 mr-2 mt-0.5 text-primary" />
                            <div>
                              <span className="font-medium">Executive Reports</span>
                              <p className="text-sm text-muted-foreground">
                                Generate comprehensive reports with actionable recommendations
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start">
                            <TrendingUp className="h-5 w-5 mr-2 mt-0.5 text-primary" />
                            <div>
                              <span className="font-medium">Future Predictions</span>
                              <p className="text-sm text-muted-foreground">
                                Forecast energy usage patterns and solar generation
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="lg:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center">
                          <Lightbulb className="h-5 w-5 mr-2" />
                          Get Started with AI Analytics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Select one of the AI features below to analyze your data and gain valuable insights. Each feature provides a different perspective on your energy usage and environmental conditions.
                        </p>
                        
                        <Tabs defaultValue="analytics" className="mt-4">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="analytics">Analytics</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                            <TabsTrigger value="predictions">Predictions</TabsTrigger>
                          </TabsList>
                          <TabsContent value="analytics" className="pt-4">
                            <p className="text-sm text-muted-foreground">
                              Discover patterns, anomalies, and insights in your power and environmental data using advanced AI analytics.
                            </p>
                            <Button className="mt-4" onClick={() => document.getElementById('analytics-section')?.scrollIntoView({ behavior: 'smooth' })}>
                              Go to Analytics
                            </Button>
                          </TabsContent>
                          <TabsContent value="reports" className="pt-4">
                            <p className="text-sm text-muted-foreground">
                              Generate comprehensive executive reports with actionable recommendations based on your historical data.
                            </p>
                            <Button className="mt-4" onClick={() => document.getElementById('reports-section')?.scrollIntoView({ behavior: 'smooth' })}>
                              Go to Reports
                            </Button>
                          </TabsContent>
                          <TabsContent value="predictions" className="pt-4">
                            <p className="text-sm text-muted-foreground">
                              Forecast future energy usage patterns and solar generation potential based on historical trends.
                            </p>
                            <Button className="mt-4" onClick={() => document.getElementById('predictions-section')?.scrollIntoView({ behavior: 'smooth' })}>
                              Go to Predictions
                            </Button>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  </div>

                  {/* AI Analytics Features */}
                  <div id="analytics-section" className="scroll-m-20 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Advanced Analytics</h2>
                    <AIAnalyticsCard 
                      historicalPowerData={filteredPowerData} 
                      historicalEnvData={filteredEnvData} 
                    />
                  </div>
                  
                  <div id="reports-section" className="scroll-m-20 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Executive Reports</h2>
                    <AIReportCard 
                      historicalPowerData={filteredPowerData} 
                      historicalEnvData={filteredEnvData} 
                    />
                  </div>
                  
                  <div id="predictions-section" className="scroll-m-20">
                    <h2 className="text-xl font-semibold mb-4">Future Predictions</h2>
                    <AIPredictionsCard 
                      historicalPowerData={filteredPowerData} 
                      historicalEnvData={filteredEnvData} 
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </SharedLayout>
  );
}