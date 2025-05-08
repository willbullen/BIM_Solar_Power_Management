import { useState } from "react";
import { usePowerData } from "@/hooks/use-power-data";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Layout } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Loader2, 
  BarChart4, 
  Thermometer, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  RefrigeratorIcon,
  ArrowRight,
  Hammer,
  Snowflake,
  PackageIcon,
  Settings,
  HelpCircle,
  Zap,
  Info
} from "lucide-react";
import { format, subDays } from "date-fns";
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
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";

// Equipment types and interfaces
type EquipmentStatus = 'operational' | 'maintenance' | 'warning' | 'offline';

type Equipment = {
  id: number;
  name: string;
  type: string;
  status: EquipmentStatus;
  powerUsage: number;
  efficiency: number;
  lastMaintenance: Date;
  nextMaintenance: Date | null;
  temperature?: number;
  pressureLevel?: number;
  location: string;
  alerts: string[];
  maintenanceHistory: MaintenanceRecord[];
  performanceHistory: PerformanceData[];
};

type MaintenanceRecord = {
  id: number;
  date: Date;
  type: 'scheduled' | 'emergency' | 'preventive';
  description: string;
  technician: string;
  cost: number;
  duration: number; // hours
};

type PerformanceData = {
  timestamp: Date;
  powerUsage: number;
  efficiency: number;
  temperature?: number;
  pressureLevel?: number;
};

// Mock equipment data
const mockEquipment: Equipment[] = [
  {
    id: 1,
    name: "Main Freezer",
    type: "cold_storage",
    status: "operational",
    powerUsage: 45.2,
    efficiency: 92,
    lastMaintenance: new Date(2025, 3, 15), // April 15, 2025
    nextMaintenance: new Date(2025, 6, 15), // July 15, 2025
    temperature: -18.5,
    location: "Cold Storage Area A",
    alerts: [],
    maintenanceHistory: [
      {
        id: 1,
        date: new Date(2025, 3, 15),
        type: "scheduled",
        description: "Quarterly maintenance - cleaned coils, checked refrigerant levels",
        technician: "John Smith",
        cost: 450,
        duration: 4,
      },
      {
        id: 2,
        date: new Date(2025, 0, 10),
        type: "scheduled",
        description: "Annual inspection and maintenance",
        technician: "John Smith",
        cost: 850,
        duration: 8,
      },
    ],
    performanceHistory: generatePerformanceData(45, 92, -18.5),
  },
  {
    id: 2,
    name: "Processing Line A",
    type: "processing",
    status: "warning",
    powerUsage: 62.8,
    efficiency: 78,
    lastMaintenance: new Date(2025, 2, 10), // March 10, 2025
    nextMaintenance: new Date(2025, 5, 10), // June 10, 2025
    location: "Processing Hall",
    alerts: ["Efficiency below 80%", "Power usage above average"],
    maintenanceHistory: [
      {
        id: 3,
        date: new Date(2025, 2, 10),
        type: "scheduled",
        description: "Belt replacement and motor alignment",
        technician: "Mark Johnson",
        cost: 680,
        duration: 5.5,
      },
    ],
    performanceHistory: generatePerformanceData(62.8, 78),
  },
  {
    id: 3,
    name: "Chiller Unit 2",
    type: "cold_storage",
    status: "maintenance",
    powerUsage: 0,
    efficiency: 0,
    lastMaintenance: new Date(2025, 4, 5), // May 5, 2025
    nextMaintenance: null,
    temperature: 4.2,
    location: "Cold Storage Area B",
    alerts: ["Under maintenance", "Compressor replacement scheduled"],
    maintenanceHistory: [
      {
        id: 4,
        date: new Date(2025, 4, 5),
        type: "emergency",
        description: "Compressor failure - scheduled for replacement",
        technician: "Sarah Williams",
        cost: 2150,
        duration: 48,
      },
    ],
    performanceHistory: generatePerformanceData(30, 85, 4.2, true),
  },
  {
    id: 4,
    name: "Packaging Line B",
    type: "packaging",
    status: "operational",
    powerUsage: 38.5,
    efficiency: 95,
    lastMaintenance: new Date(2025, 2, 25), // March 25, 2025
    nextMaintenance: new Date(2025, 5, 25), // June 25, 2025
    pressureLevel: 72,
    location: "Packaging Department",
    alerts: [],
    maintenanceHistory: [
      {
        id: 5,
        date: new Date(2025, 2, 25),
        type: "preventive",
        description: "Lubrication and sensor calibration",
        technician: "James Rodriguez",
        cost: 380,
        duration: 3,
      },
    ],
    performanceHistory: generatePerformanceData(38.5, 95),
  },
  {
    id: 5,
    name: "Secondary Freezer",
    type: "cold_storage",
    status: "offline",
    powerUsage: 0,
    efficiency: 0,
    lastMaintenance: new Date(2025, 1, 20), // Feb 20, 2025
    nextMaintenance: new Date(2025, 7, 20), // Aug 20, 2025
    temperature: null,
    location: "Cold Storage Area C",
    alerts: ["Planned shutdown", "Not in use currently"],
    maintenanceHistory: [
      {
        id: 6,
        date: new Date(2025, 1, 20),
        type: "scheduled",
        description: "Biannual deep cleaning and inspection",
        technician: "John Smith",
        cost: 520,
        duration: 6,
      },
    ],
    performanceHistory: []
  },
];

// Generate sample performance data for equipment
function generatePerformanceData(avgPower: number, avgEfficiency: number, avgTemp?: number, maintenance?: boolean): PerformanceData[] {
  const data: PerformanceData[] = [];
  const now = new Date();
  
  // Generate data for the past week
  for (let i = 0; i < 168; i++) { // 24 hours * 7 days = 168 hours
    const timestamp = new Date(now.getTime() - (168 - i) * 60 * 60 * 1000);
    
    // Base values with some randomness
    let powerUsage = avgPower * (0.9 + Math.random() * 0.2); // ±10% variation
    let efficiency = avgEfficiency * (0.95 + Math.random() * 0.1); // ±5% variation
    let temperature = avgTemp !== undefined ? avgTemp * (0.95 + Math.random() * 0.1) : undefined; // ±5% variation
    
    // If maintenance mode, show degradation before maintenance and improvement after
    if (maintenance && i < 120) {
      // Show degradation leading up to maintenance
      const degradationFactor = 1 - (120 - i) / 120 * 0.3; // Up to 30% degradation
      powerUsage = avgPower * (1.1 + (1 - degradationFactor) * 0.4); // Increasing power usage
      efficiency = avgEfficiency * degradationFactor; // Decreasing efficiency
    } else if (maintenance && i >= 120) {
      // After maintenance
      powerUsage = 0; // Equipment is off during maintenance
      efficiency = 0;
    }
    
    data.push({
      timestamp,
      powerUsage,
      efficiency,
      temperature,
      pressureLevel: Math.random() > 0.5 ? 70 + Math.random() * 10 : undefined,
    });
  }
  
  return data;
}

export default function EquipmentPage() {
  const { isLoading } = usePowerData();
  const [equipment, setEquipment] = useState<Equipment[]>(mockEquipment);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  
  // Get the selected equipment
  const selectedEquipment = selectedEquipmentId ? equipment.find(e => e.id === selectedEquipmentId) : null;
  
  // Get the filtered equipment
  const getFilteredEquipment = () => {
    return equipment.filter(e => {
      const statusMatch = filterStatus === "all" || e.status === filterStatus;
      const typeMatch = filterType === "all" || e.type === filterType;
      return statusMatch && typeMatch;
    });
  };
  
  // Calculate total operational efficiency
  const calculateOverallEfficiency = () => {
    const operationalEquipment = equipment.filter(e => e.status === "operational");
    if (operationalEquipment.length === 0) return 0;
    
    const totalEfficiency = operationalEquipment.reduce((sum, e) => sum + e.efficiency, 0);
    return totalEfficiency / operationalEquipment.length;
  };
  
  // Calculate total power usage
  const calculateTotalPower = () => {
    return equipment.reduce((sum, e) => sum + e.powerUsage, 0);
  };
  
  // Get equipment status counts
  const getStatusCounts = () => {
    const counts = {
      operational: 0,
      maintenance: 0,
      warning: 0,
      offline: 0,
    };
    
    equipment.forEach(e => {
      counts[e.status]++;
    });
    
    return counts;
  };
  
  // Get equipment that needs attention
  const getEquipmentNeedingAttention = () => {
    return equipment.filter(e => e.status === "warning" || e.status === "maintenance");
  };
  
  // Get upcoming maintenance
  const getUpcomingMaintenance = () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return equipment
      .filter(e => e.nextMaintenance && e.nextMaintenance >= now && e.nextMaintenance <= thirtyDaysFromNow)
      .sort((a, b) => a.nextMaintenance!.getTime() - b.nextMaintenance!.getTime());
  };
  
  // Format equipment status for display
  const formatStatus = (status: EquipmentStatus) => {
    switch (status) {
      case "operational":
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Operational</Badge>;
      case "maintenance":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Maintenance</Badge>;
      case "warning":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Warning</Badge>;
      case "offline":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Offline</Badge>;
    }
  };
  
  // Get icon for equipment type
  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case "cold_storage":
        return <RefrigeratorIcon className="h-5 w-5" />;
      case "processing":
        return <Hammer className="h-5 w-5" />;
      case "packaging":
        return <PackageIcon className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };
  
  // Format equipment type for display
  const formatType = (type: string) => {
    switch (type) {
      case "cold_storage":
        return "Cold Storage";
      case "processing":
        return "Processing";
      case "packaging":
        return "Packaging";
      default:
        return type;
    }
  };
  
  // Format date for display
  const formatDate = (date: Date) => {
    return format(date, "MMM d, yyyy");
  };
  
  // Get days until next maintenance
  const getDaysUntilMaintenance = (date: Date | null) => {
    if (!date) return null;
    
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };
  
  // Get chart data for equipment performance
  const getPerformanceChartData = (performanceData: PerformanceData[]) => {
    return performanceData.map(data => ({
      timestamp: format(data.timestamp, "MMM d HH:mm"),
      power: Number(data.powerUsage.toFixed(1)),
      efficiency: Number(data.efficiency.toFixed(1)),
      temperature: data.temperature ? Number(data.temperature.toFixed(1)) : undefined,
      pressure: data.pressureLevel,
    }));
  };
  
  const totalEquipment = equipment.length;
  const statusCounts = getStatusCounts();
  const totalPower = calculateTotalPower();
  const overallEfficiency = calculateOverallEfficiency();
  
  if (isLoading) {
    return (
      <Layout title="Equipment Monitoring" description="Monitor and manage equipment status and performance">
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading equipment data...</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Equipment Monitoring" description="Monitor and manage equipment status and performance">
      {/* Equipment Overview */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            title="Equipment Status"
            value={`${statusCounts.operational}/${totalEquipment}`}
            description="Equipment currently operational"
            icon={CheckCircle}
          />
          
          <StatCard
            title="Total Power Usage"
            value={`${totalPower.toFixed(1)} kW`}
            description="Current power consumption"
            icon={Zap}
          />
          
          <StatCard
            title="Overall Efficiency"
            value={`${overallEfficiency.toFixed(1)}%`}
            description="Average operational efficiency"
            icon={Activity}
          />
          
          <StatCard
            title="Maintenance Required"
            value={`${statusCounts.maintenance + statusCounts.warning}`}
            description={`${getUpcomingMaintenance().length} scheduled in next 30 days`}
            icon={Hammer}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="cold_storage">Cold Storage</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="packaging">Packaging</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Equipment List */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Equipment List</CardTitle>
              <CardDescription>
                {getFilteredEquipment().length} items matching filters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getFilteredEquipment().map(equip => (
                  <div 
                    key={equip.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedEquipmentId === equip.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedEquipmentId(equip.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getEquipmentIcon(equip.type)}
                        <div>
                          <p className="font-medium">{equip.name}</p>
                          <p className="text-xs text-muted-foreground">{formatType(equip.type)}</p>
                        </div>
                      </div>
                      {formatStatus(equip.status)}
                    </div>
                    
                    {equip.status !== 'offline' && equip.status !== 'maintenance' && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Efficiency</span>
                          <span>{equip.efficiency}%</span>
                        </div>
                        <Progress value={equip.efficiency} className="h-1" />
                      </div>
                    )}
                    
                    {equip.alerts.length > 0 && (
                      <div className="mt-2 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 mt-0.5" />
                        <span>{equip.alerts[0]}{equip.alerts.length > 1 ? ` (+${equip.alerts.length - 1} more)` : ''}</span>
                      </div>
                    )}
                  </div>
                ))}
                
                {getFilteredEquipment().length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    No equipment matches the selected filters
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Equipment Details */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>
                {selectedEquipment 
                  ? (
                    <div className="flex items-center gap-2">
                      {getEquipmentIcon(selectedEquipment.type)}
                      {selectedEquipment.name}
                      {formatStatus(selectedEquipment.status)}
                    </div>
                  ) 
                  : 'Equipment Details'
                }
              </CardTitle>
              <CardDescription>
                {selectedEquipment 
                  ? `${formatType(selectedEquipment.type)} - ${selectedEquipment.location}`
                  : 'Select equipment to view details'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedEquipment ? (
                <Tabs defaultValue="status" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="status">
                      <Activity className="mr-2 h-4 w-4" />
                      Status
                    </TabsTrigger>
                    <TabsTrigger value="performance">
                      <BarChart4 className="mr-2 h-4 w-4" />
                      Performance
                    </TabsTrigger>
                    <TabsTrigger value="maintenance">
                      <Settings className="mr-2 h-4 w-4" />
                      Maintenance
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="status" className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">Current Status</h3>
                          <div className="flex items-center gap-2">
                            {selectedEquipment.status === 'operational' && <CheckCircle className="h-5 w-5 text-green-500" />}
                            {selectedEquipment.status === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                            {selectedEquipment.status === 'maintenance' && <Settings className="h-5 w-5 text-blue-500" />}
                            {selectedEquipment.status === 'offline' && <AlertCircle className="h-5 w-5 text-gray-500" />}
                            <span className="font-medium">{selectedEquipment.status.charAt(0).toUpperCase() + selectedEquipment.status.slice(1)}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">Power Usage</h3>
                          <p className="text-2xl font-bold">{selectedEquipment.powerUsage.toFixed(1)} kW</p>
                        </div>
                        
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">Efficiency</h3>
                          <div className="flex items-center gap-2">
                            <Progress value={selectedEquipment.efficiency} className="flex-1" />
                            <span className="font-medium">{selectedEquipment.efficiency}%</span>
                          </div>
                        </div>
                        
                        {selectedEquipment.temperature !== undefined && (
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium">Temperature</h3>
                            <div className="flex items-center gap-2">
                              <Thermometer className="h-5 w-5 text-red-500" />
                              <span className="text-lg font-medium">{selectedEquipment.temperature !== null ? `${selectedEquipment.temperature}°C` : 'N/A'}</span>
                            </div>
                          </div>
                        )}
                        
                        {selectedEquipment.pressureLevel !== undefined && (
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium">Pressure Level</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-medium">{selectedEquipment.pressureLevel} PSI</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">Last Maintenance</h3>
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-500" />
                            <span>{formatDate(selectedEquipment.lastMaintenance)}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">Next Maintenance</h3>
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-purple-500" />
                            <span>
                              {selectedEquipment.nextMaintenance 
                                ? formatDate(selectedEquipment.nextMaintenance) 
                                : 'Not scheduled'}
                              {selectedEquipment.nextMaintenance && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({getDaysUntilMaintenance(selectedEquipment.nextMaintenance)} days)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        
                        {selectedEquipment.alerts.length > 0 && (
                          <div className="space-y-2 mt-4">
                            <h3 className="text-sm font-medium">Alerts</h3>
                            <div className="space-y-2">
                              {selectedEquipment.alerts.map((alert, index) => (
                                <Alert key={index} variant="destructive">
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertTitle>Warning</AlertTitle>
                                  <AlertDescription>
                                    {alert}
                                  </AlertDescription>
                                </Alert>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="performance" className="space-y-4">
                    {selectedEquipment.performanceHistory.length > 0 ? (
                      <div className="space-y-4">
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={getPerformanceChartData(selectedEquipment.performanceHistory)}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="timestamp" />
                              <YAxis yAxisId="left" />
                              <YAxis yAxisId="right" orientation="right" />
                              <Tooltip />
                              <Legend />
                              
                              <Line 
                                yAxisId="left"
                                type="monotone" 
                                dataKey="power" 
                                name="Power (kW)" 
                                stroke="#8884d8" 
                                strokeWidth={2}
                              />
                              
                              <Line 
                                yAxisId="right"
                                type="monotone" 
                                dataKey="efficiency" 
                                name="Efficiency (%)" 
                                stroke="#82ca9d" 
                                strokeWidth={2}
                              />
                              
                              {selectedEquipment.temperature !== undefined && (
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="temperature" 
                                  name="Temperature (°C)" 
                                  stroke="#ff7300" 
                                  strokeWidth={2}
                                />
                              )}
                              
                              {selectedEquipment.pressureLevel !== undefined && (
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="pressure" 
                                  name="Pressure (PSI)" 
                                  stroke="#0088fe" 
                                  strokeWidth={2}
                                />
                              )}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Card>
                            <CardHeader className="py-3">
                              <CardTitle className="text-sm">Performance Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">Avg. Power Usage:</span>
                                  <span className="font-medium">
                                    {(selectedEquipment.performanceHistory.reduce((sum, data) => sum + data.powerUsage, 0) / selectedEquipment.performanceHistory.length).toFixed(1)} kW
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">Avg. Efficiency:</span>
                                  <span className="font-medium">
                                    {(selectedEquipment.performanceHistory.reduce((sum, data) => sum + data.efficiency, 0) / selectedEquipment.performanceHistory.length).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">Peak Power Usage:</span>
                                  <span className="font-medium">
                                    {Math.max(...selectedEquipment.performanceHistory.map(data => data.powerUsage)).toFixed(1)} kW
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">Min Efficiency:</span>
                                  <span className="font-medium">
                                    {Math.min(...selectedEquipment.performanceHistory.filter(data => data.efficiency > 0).map(data => data.efficiency)).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          
                          <Card>
                            <CardHeader className="py-3">
                              <CardTitle className="text-sm">Performance Insights</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {selectedEquipment.status === 'warning' && (
                                  <Alert>
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    <AlertTitle>Efficiency Degradation</AlertTitle>
                                    <AlertDescription className="text-xs text-muted-foreground">
                                      Current efficiency is below target. Consider scheduling maintenance.
                                    </AlertDescription>
                                  </Alert>
                                )}
                                
                                {selectedEquipment.status === 'operational' && (
                                  <Alert>
                                    <Info className="h-4 w-4 text-blue-500" />
                                    <AlertTitle>Normal Operation</AlertTitle>
                                    <AlertDescription className="text-xs text-muted-foreground">
                                      Equipment is operating within normal parameters.
                                    </AlertDescription>
                                  </Alert>
                                )}
                                
                                {selectedEquipment.status === 'maintenance' && (
                                  <Alert>
                                    <Settings className="h-4 w-4 text-blue-500" />
                                    <AlertTitle>Maintenance in Progress</AlertTitle>
                                    <AlertDescription className="text-xs text-muted-foreground">
                                      Equipment is undergoing scheduled maintenance.
                                    </AlertDescription>
                                  </Alert>
                                )}
                                
                                {selectedEquipment.status === 'offline' && (
                                  <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Equipment Offline</AlertTitle>
                                    <AlertDescription className="text-xs text-muted-foreground">
                                      This equipment is currently not in operation.
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-60 text-center">
                        <HelpCircle className="h-8 w-8 mb-4 text-muted-foreground" />
                        <p>No performance data available for this equipment</p>
                        <p className="text-sm text-muted-foreground">Performance history will be shown when available</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="maintenance" className="space-y-4">
                    <div className="space-y-4">
                      <h3 className="font-medium">Maintenance History</h3>
                      
                      {selectedEquipment.maintenanceHistory.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Technician</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead className="text-right">Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedEquipment.maintenanceHistory.map(record => (
                              <TableRow key={record.id}>
                                <TableCell>{formatDate(record.date)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {record.type.charAt(0).toUpperCase() + record.type.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell>{record.technician}</TableCell>
                                <TableCell>{record.duration} hours</TableCell>
                                <TableCell className="text-right">${record.cost}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground border rounded-lg">
                          No maintenance records available
                        </div>
                      )}
                      
                      <div className="mt-4">
                        <h3 className="font-medium mb-2">Maintenance Details</h3>
                        
                        {selectedEquipment.maintenanceHistory.length > 0 ? (
                          <div className="space-y-4">
                            <div className="p-4 border rounded-lg">
                              <h4 className="font-medium text-sm">
                                {selectedEquipment.maintenanceHistory[0].type.charAt(0).toUpperCase() + selectedEquipment.maintenanceHistory[0].type.slice(1)} Maintenance
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {formatDate(selectedEquipment.maintenanceHistory[0].date)} by {selectedEquipment.maintenanceHistory[0].technician}
                              </p>
                              <Separator className="my-2" />
                              <p className="text-sm">{selectedEquipment.maintenanceHistory[0].description}</p>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <Card>
                                  <CardHeader className="py-3">
                                    <CardTitle className="text-sm">Maintenance Stats</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm">Total Maintenance Cost:</span>
                                        <span className="font-medium">
                                          ${selectedEquipment.maintenanceHistory.reduce((sum, record) => sum + record.cost, 0)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm">Avg. Duration:</span>
                                        <span className="font-medium">
                                          {(selectedEquipment.maintenanceHistory.reduce((sum, record) => sum + record.duration, 0) / selectedEquipment.maintenanceHistory.length).toFixed(1)} hours
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm">Last Completed:</span>
                                        <span className="font-medium">
                                          {formatDate(selectedEquipment.lastMaintenance)}
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                              
                              <div>
                                <Card>
                                  <CardHeader className="py-3">
                                    <CardTitle className="text-sm">Upcoming Maintenance</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {selectedEquipment.nextMaintenance ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Clock className="h-4 w-4 text-blue-500" />
                                          <span className="font-medium">
                                            {formatDate(selectedEquipment.nextMaintenance)}
                                          </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {getDaysUntilMaintenance(selectedEquipment.nextMaintenance)} days until next scheduled maintenance
                                        </p>
                                        <div className="mt-2">
                                          <Progress 
                                            value={Math.max(0, 100 - getDaysUntilMaintenance(selectedEquipment.nextMaintenance)! / 90 * 100)}
                                            className="h-2"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center h-14 text-muted-foreground text-sm">
                                        No maintenance scheduled
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground border rounded-lg">
                            No maintenance details available
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex flex-col items-center justify-center h-60 text-center">
                  <Settings className="h-8 w-8 mb-4 text-muted-foreground" />
                  <p>Select equipment from the list to view details</p>
                  <p className="text-sm text-muted-foreground">Equipment status, performance, and maintenance information will be shown here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Equipment Requiring Attention */}
        <Card>
          <CardHeader>
            <CardTitle>Equipment Requiring Attention</CardTitle>
            <CardDescription>
              Units requiring maintenance or showing warning signs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getEquipmentNeedingAttention().length > 0 ? (
                getEquipmentNeedingAttention().map(equip => (
                  <div 
                    key={equip.id}
                    className="p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelectedEquipmentId(equip.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getEquipmentIcon(equip.type)}
                        <div>
                          <p className="font-medium">{equip.name}</p>
                          <p className="text-xs text-muted-foreground">{formatType(equip.type)}</p>
                        </div>
                      </div>
                      {formatStatus(equip.status)}
                    </div>
                    
                    {equip.alerts.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {equip.alerts.map((alert, index) => (
                          <div key={index} className="flex items-start gap-1.5 text-sm">
                            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500" />
                            <span>{alert}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex justify-end mt-2">
                      <Button variant="ghost" size="sm" className="h-8 gap-1">
                        View Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="md:col-span-2 lg:col-span-3 text-center py-8 text-muted-foreground border rounded-lg">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>All equipment is operating normally</p>
                  <p className="text-sm">No maintenance or attention required at this time</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}