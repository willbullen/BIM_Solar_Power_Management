import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/header";
import { Loader2, Wrench, AlertTriangle, Calendar, Activity, Info, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend 
} from "recharts";
import { format, parseISO } from "date-fns";
import { Equipment, EquipmentEfficiency, MaintenanceLog } from "@shared/schema";

// Helper function to safely parse dates
function safeParseDate(dateString: string | Date | null | undefined): Date | null {
  if (!dateString) return null;
  
  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.error("Invalid date value:", dateString);
      return null;
    }
    return date;
  } catch (error) {
    console.error("Error parsing date:", dateString, error);
    return null;
  }
}

// Helper function to safely format dates
function safeFormatDate(date: Date | string | null | undefined, formatString: string = 'MMM d, yyyy'): string {
  if (!date) return 'Unknown';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    return format(dateObj, formatString);
  } catch (error) {
    console.error("Error formatting date:", date, error);
    return 'Invalid date';
  }
}

function EquipmentContent() {
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  
  // Fetch equipment list
  const { 
    data: equipmentList, 
    isLoading: isLoadingEquipment, 
    error: equipmentError 
  } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  // Set first equipment as selected when data loads
  useEffect(() => {
    if (equipmentList && equipmentList.length > 0 && !selectedEquipmentId) {
      setSelectedEquipmentId(equipmentList[0].id);
    }
  }, [equipmentList, selectedEquipmentId]);

  // Fetch efficiency data for selected equipment
  const { 
    data: efficiencyData, 
    isLoading: isLoadingEfficiency 
  } = useQuery<EquipmentEfficiency[]>({
    queryKey: ["/api/equipment", selectedEquipmentId, "efficiency"],
    enabled: !!selectedEquipmentId,
  });

  // Fetch maintenance history for selected equipment
  const { 
    data: maintenanceHistory, 
    isLoading: isLoadingMaintenance 
  } = useQuery<MaintenanceLog[]>({
    queryKey: ["/api/equipment", selectedEquipmentId, "maintenance"],
    enabled: !!selectedEquipmentId,
  });

  // Fetch upcoming maintenance schedule
  const { 
    data: upcomingMaintenance, 
    isLoading: isLoadingUpcoming 
  } = useQuery<{ equipment: Equipment, nextMaintenance: Date }[]>({
    queryKey: ["/api/maintenance/upcoming"],
  });

  if (isLoadingEquipment) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading equipment data...</p>
        </div>
      </div>
    );
  }

  if (equipmentError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-destructive" />
          <p className="text-destructive">Failed to load equipment data</p>
        </div>
      </div>
    );
  }

  if (!equipmentList || equipmentList.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Info className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No equipment found in the system</p>
        </div>
      </div>
    );
  }

  const selectedEquipment = equipmentList.find(item => item.id === selectedEquipmentId);

  // Prepare efficiency data for chart
  const efficiencyChartData = efficiencyData?.map(item => {
    const date = safeParseDate(item.timestamp);
    return {
      date: date ? format(date, 'MM/dd') : 'Unknown',
      efficiency: Number((item.efficiencyRating * 100).toFixed(1)),
      power: Number(item.powerUsage.toFixed(2)),
      anomaly: item.anomalyDetected ? item.anomalyScore : 0
    };
  }) || [];

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational": return "bg-green-500";
      case "warning": return "bg-amber-500";
      case "critical": return "bg-red-500";
      case "maintenance": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  // Format maintenance schedule
  const maintenanceScheduleData = upcomingMaintenance?.map(item => {
    const nextDate = safeParseDate(item.nextMaintenance);
    const now = new Date();
    let days = 0;
    
    if (nextDate) {
      days = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    return {
      name: item.equipment.name,
      days: days
    };
  }) || [];

  // Sort by days to next maintenance
  maintenanceScheduleData.sort((a, b) => a.days - b.days);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Equipment Monitoring</h1>
          <p className="text-muted-foreground">Track and manage equipment efficiency and maintenance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Equipment List */}
        <div className="lg:col-span-3 border rounded-lg p-4 bg-card/70">
          <h2 className="font-semibold mb-3">Equipment</h2>
          <div className="space-y-2">
            {equipmentList.map((item) => (
              <button 
                key={item.id}
                onClick={() => setSelectedEquipmentId(item.id)}
                className={`w-full text-left p-3 rounded-md transition flex items-center justify-between ${
                  selectedEquipmentId === item.id 
                  ? 'bg-primary/20 text-primary-foreground' 
                  : 'hover:bg-primary/10'
                }`}
              >
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(item.status)}`} />
                  <span>{item.name}</span>
                </div>
                {item.status !== "operational" && (
                  <Badge 
                    variant={
                      item.status === "warning" ? "outline" : 
                      item.status === "critical" ? "destructive" : 
                      "secondary"
                    }
                    className="ml-2"
                  >
                    {item.status}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Equipment Details */}
        <div className="lg:col-span-9">
          {selectedEquipment && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Equipment Info Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        {selectedEquipment.name}
                        <div className={`w-3 h-3 rounded-full ml-2 ${getStatusColor(selectedEquipment.status)}`} />
                      </CardTitle>
                      <CardDescription>{selectedEquipment.type} - {selectedEquipment.model}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Manufacturer:</span>
                          <span>{selectedEquipment.manufacturer}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Installed Date:</span>
                          <span>{safeFormatDate(selectedEquipment.installedDate)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Nominal Power:</span>
                          <span>{selectedEquipment.nominalPower} kW</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Nominal Efficiency:</span>
                          <span>{selectedEquipment.nominalEfficiency != null ? (selectedEquipment.nominalEfficiency * 100).toFixed(1) + '%' : 'Not specified'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Current Efficiency:</span>
                          <span className={
                            selectedEquipment.currentEfficiency != null && selectedEquipment.nominalEfficiency != null && 
                            selectedEquipment.currentEfficiency < selectedEquipment.nominalEfficiency * 0.9
                              ? 'text-amber-500'
                              : selectedEquipment.currentEfficiency != null && selectedEquipment.nominalEfficiency != null && 
                                selectedEquipment.currentEfficiency < selectedEquipment.nominalEfficiency * 0.8
                                ? 'text-red-500'
                                : ''
                          }>
                            {selectedEquipment.currentEfficiency != null
                              ? `${(selectedEquipment.currentEfficiency * 100).toFixed(1)}%` 
                              : 'Not measured'}
                          </span>
                        </div>
                        {selectedEquipment.metadata && typeof selectedEquipment.metadata === 'object' && (
                          <div className="mt-4 pt-2 border-t border-border">
                            <p className="text-sm font-medium mb-1">Additional Details</p>
                            {(() => {
                              try {
                                const metadata = selectedEquipment.metadata as Record<string, string | number>;
                                return Object.entries(metadata).map(([key, value]) => (
                                  <div key={key} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                                    <span>{typeof value === 'number' ? value.toString() : String(value)}</span>
                                  </div>
                                ));
                              } catch (err) {
                                return <div className="text-sm text-muted-foreground">Metadata format not supported</div>;
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Maintenance Status Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Wrench className="w-5 h-5 mr-2" />
                        Maintenance Status
                      </CardTitle>
                      <CardDescription>Last and next scheduled maintenance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Last Maintenance:</span>
                            <span>{selectedEquipment.lastMaintenance ? safeFormatDate(selectedEquipment.lastMaintenance) : 'Never'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Next Maintenance:</span>
                            <span className={
                              selectedEquipment.nextMaintenance ? 
                                (safeParseDate(selectedEquipment.nextMaintenance) && safeParseDate(selectedEquipment.nextMaintenance)! < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                  ? 'text-red-500 font-medium'
                                  : '')
                                : ''
                            }>
                              {selectedEquipment.nextMaintenance ? safeFormatDate(selectedEquipment.nextMaintenance) : 'Not scheduled'}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Maintenance Interval:</span>
                            <span>{selectedEquipment.maintenanceInterval} days</span>
                          </div>
                        </div>

                        {selectedEquipment.nextMaintenance && safeParseDate(selectedEquipment.nextMaintenance) && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Time until next maintenance:</span>
                              <span>
                                {(() => {
                                  const nextDate = safeParseDate(selectedEquipment.nextMaintenance);
                                  if (!nextDate) return "Unknown";
                                  const now = new Date();
                                  return Math.max(0, Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) + " days";
                                })()}
                              </span>
                            </div>
                            <Progress 
                              value={
                                selectedEquipment.lastMaintenance && safeParseDate(selectedEquipment.lastMaintenance) && safeParseDate(selectedEquipment.nextMaintenance)
                                  ? (() => {
                                      const now = new Date().getTime();
                                      const lastDate = safeParseDate(selectedEquipment.lastMaintenance)!.getTime();
                                      const nextDate = safeParseDate(selectedEquipment.nextMaintenance)!.getTime();
                                      return 100 - (Math.min(100, 100 * (now - lastDate) / (nextDate - lastDate)));
                                    })()
                                  : 0
                              } 
                              className="h-2"
                            />
                          </div>
                        )}

                        <div className="pt-2 mt-6">
                          <Button 
                            variant="outline" 
                            className="w-full"
                            disabled={isLoadingMaintenance || (maintenanceHistory && maintenanceHistory.length > 0)}
                          >
                            <Wrench className="w-4 h-4 mr-2" />
                            {maintenanceHistory && maintenanceHistory.length > 0 
                              ? 'Maintenance Records Available' 
                              : 'Schedule Maintenance'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Performance Card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Recent Performance</CardTitle>
                    <CardDescription>Performance metrics for the last 30 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingEfficiency ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : efficiencyData && efficiencyData.length > 0 ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={efficiencyChartData}
                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                            <XAxis dataKey="date" stroke="#888" />
                            <YAxis yAxisId="left" stroke="#888" />
                            <YAxis yAxisId="right" orientation="right" stroke="#888" />
                            <Tooltip
                              contentStyle={{ backgroundColor: "#1e1e1e", borderColor: "#333" }}
                            />
                            <Legend />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="power"
                              name="Power Usage (kW)"
                              stroke="#8884d8"
                              activeDot={{ r: 8 }}
                            />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="efficiency"
                              name="Efficiency (%)"
                              stroke="#82ca9d"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center h-36">
                        <p className="text-muted-foreground">No efficiency data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Efficiency Tab */}
              <TabsContent value="efficiency" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Activity className="w-5 h-5 mr-2" />
                      Efficiency Analytics
                    </CardTitle>
                    <CardDescription>
                      Detailed efficiency metrics and anomaly detection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingEfficiency ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : efficiencyData && efficiencyData.length > 0 ? (
                      <div className="space-y-6">
                        {/* Efficiency Chart */}
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={efficiencyChartData}
                              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                              <XAxis dataKey="date" stroke="#888" />
                              <YAxis yAxisId="left" stroke="#888" />
                              <YAxis yAxisId="right" orientation="right" stroke="#888" />
                              <Tooltip
                                contentStyle={{ backgroundColor: "#1e1e1e", borderColor: "#333" }}
                              />
                              <Legend />
                              <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="efficiency"
                                name="Efficiency (%)"
                                stroke="#82ca9d"
                              />
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="anomaly"
                                name="Anomaly Score"
                                stroke="#ff7300"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Anomaly Card */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border rounded-lg p-4 bg-card-foreground/5">
                            <h3 className="font-semibold text-sm mb-1">Anomaly Overview</h3>
                            <p className="text-muted-foreground text-sm mb-3">
                              Detected performance anomalies for this equipment
                            </p>
                            
                            {efficiencyData.some(item => item.anomalyDetected) ? (
                              <div className="space-y-3">
                                {efficiencyData
                                  .filter(item => item.anomalyDetected)
                                  .slice(0, 3)
                                  .map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="text-sm">
                                          Anomaly detected on {safeFormatDate(item.timestamp, 'MMM d')}
                                        </p>
                                        <div className="flex justify-between mt-1">
                                          <span className="text-xs text-muted-foreground">
                                            Severity score: {typeof item.anomalyScore === 'number' ? item.anomalyScore.toFixed(1) : '0.0'}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            Efficiency: {typeof item.efficiencyRating === 'number' ? (item.efficiencyRating * 100).toFixed(1) : '0.0'}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  
                                <Button variant="outline" size="sm" className="w-full mt-2">
                                  View All Anomalies
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-24 text-center">
                                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
                                  <div className="h-5 w-5 rounded-full bg-green-500" />
                                </div>
                                <p className="text-sm">No anomalies detected</p>
                                <p className="text-xs text-muted-foreground">
                                  Equipment is operating within normal parameters
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="border rounded-lg p-4 bg-card-foreground/5">
                            <h3 className="font-semibold text-sm mb-1">Efficiency Factors</h3>
                            <p className="text-muted-foreground text-sm mb-3">
                              Key factors affecting equipment efficiency
                            </p>
                            
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-sm">Operating Temperature</span>
                                  <span className="text-sm">
                                    {efficiencyData[0]?.temperatureConditions !== undefined && efficiencyData[0]?.temperatureConditions !== null 
                                      ? Number(efficiencyData[0].temperatureConditions).toFixed(1) + '°C'
                                      : "N/A"}
                                  </span>
                                </div>
                                <Progress value={75} className="h-1" />
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-sm">Production Volume</span>
                                  <span className="text-sm">
                                    {efficiencyData[0]?.productionVolume !== undefined && efficiencyData[0]?.productionVolume !== null 
                                      ? efficiencyData[0].productionVolume + ' units'
                                      : "N/A"}
                                  </span>
                                </div>
                                <Progress value={60} className="h-1" />
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-sm">Power Consumption</span>
                                  <span className="text-sm">
                                    {efficiencyData[0]?.powerUsage !== undefined && efficiencyData[0]?.powerUsage !== null 
                                      ? Number(efficiencyData[0].powerUsage).toFixed(2) + ' kW'
                                      : "N/A"}
                                  </span>
                                </div>
                                <Progress value={85} className="h-1" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center h-36">
                        <p className="text-muted-foreground">No efficiency data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Maintenance Tab */}
              <TabsContent value="maintenance" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Maintenance History */}
                  <Card className="md:col-span-7">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Wrench className="w-5 h-5 mr-2" />
                        Maintenance History
                      </CardTitle>
                      <CardDescription>
                        Past maintenance records for this equipment
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingMaintenance ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : maintenanceHistory && maintenanceHistory.length > 0 ? (
                        <div className="space-y-4">
                          {maintenanceHistory.map((record, idx) => (
                            <div key={idx} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
                              <div className="flex justify-between">
                                <h4 className="font-medium">{record.maintenanceType}</h4>
                                <span className="text-sm text-muted-foreground">
                                  {safeFormatDate(record.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm mt-1">{record.description}</p>
                              <div className="flex flex-wrap gap-x-4 mt-2">
                                {record.technician && (
                                  <span className="text-xs text-muted-foreground">
                                    Tech: {record.technician}
                                  </span>
                                )}
                                {record.cost && (
                                  <span className="text-xs text-muted-foreground">
                                    Cost: ${typeof record.cost === 'number' ? record.cost.toFixed(2) : record.cost}
                                  </span>
                                )}
                                {record.partsReplaced && (
                                  <span className="text-xs text-muted-foreground">
                                    Parts: {record.partsReplaced}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-center">
                          <Info className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">No maintenance records available</p>
                          <Button className="mt-4" size="sm">
                            Add Maintenance Record
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Upcoming Maintenance */}
                  <Card className="md:col-span-5">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Calendar className="w-5 h-5 mr-2" />
                        Upcoming Maintenance
                      </CardTitle>
                      <CardDescription>
                        Scheduled maintenance for all equipment
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingUpcoming ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : upcomingMaintenance && upcomingMaintenance.length > 0 ? (
                        <div className="space-y-4">
                          <div className="h-60">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={maintenanceScheduleData}
                                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                <XAxis dataKey="name" stroke="#888" />
                                <YAxis stroke="#888" label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: "#1e1e1e", borderColor: "#333" }}
                                />
                                <Bar 
                                  dataKey="days" 
                                  name="Days until maintenance" 
                                  fill="#8884d8"
                                  minPointSize={2}
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="space-y-2">
                            {maintenanceScheduleData.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center">
                                <div className="flex items-center">
                                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span className="text-sm">{item.name}</span>
                                </div>
                                <Badge variant={
                                  item.days < 7 ? "destructive" : 
                                  item.days < 14 ? "outline" : 
                                  "secondary"
                                }>
                                  {item.days} days
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-center">
                          <Info className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">No upcoming maintenance scheduled</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EquipmentPage() {
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
          <EquipmentContent />
        </main>
      </div>
    </div>
  );
}