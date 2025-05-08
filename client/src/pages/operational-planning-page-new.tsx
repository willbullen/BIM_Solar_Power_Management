import { useState } from "react";
import { usePowerData } from "@/hooks/use-power-data";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { format, addDays, addHours } from "date-fns";
import { Layout } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon, Clock, Save, FileText, Zap, SunIcon, Cloud, ArrowRight, BarChart3, TimerIcon, ListChecks, CalendarDays, Loader2 } from "lucide-react";
import { PowerChart } from "@/components/power-chart";
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
  Bar
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";

// Define a type for a scheduled task
type ScheduledTask = {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  equipmentType: string;
  powerDemand: number;
  priority: 'high' | 'medium' | 'low';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  optimized: boolean;
};

// Define a type for a power estimate period
type PowerEstimate = {
  timestamp: Date;
  gridPower: number;
  solarPower: number;
  demand: number;
  optimizedDemand?: number;
};

const mockTasks: ScheduledTask[] = [
  {
    id: 1,
    title: 'Seafood Processing',
    startTime: new Date(2025, 4, 8, 8, 0), // May 8, 2025, 8:00 AM
    endTime: new Date(2025, 4, 8, 12, 0),  // May 8, 2025, 12:00 PM
    equipmentType: 'Processing Line',
    powerDemand: 45,
    priority: 'high',
    status: 'scheduled',
    optimized: true,
  },
  {
    id: 2,
    title: 'Freezer Maintenance',
    startTime: new Date(2025, 4, 8, 14, 0), // May 8, 2025, 2:00 PM
    endTime: new Date(2025, 4, 8, 16, 0),   // May 8, 2025, 4:00 PM
    equipmentType: 'Cold Storage',
    powerDemand: 20,
    priority: 'medium',
    status: 'scheduled',
    optimized: true,
  },
  {
    id: 3,
    title: 'Product Packaging',
    startTime: new Date(2025, 4, 9, 9, 0),  // May 9, 2025, 9:00 AM
    endTime: new Date(2025, 4, 9, 15, 0),   // May 9, 2025, 3:00 PM
    equipmentType: 'Packaging Line',
    powerDemand: 35,
    priority: 'high',
    status: 'scheduled',
    optimized: false,
  },
  {
    id: 4,
    title: 'Quality Testing',
    startTime: new Date(2025, 4, 9, 13, 0), // May 9, 2025, 1:00 PM
    endTime: new Date(2025, 4, 9, 16, 0),   // May 9, 2025, 4:00 PM
    equipmentType: 'Lab Equipment',
    powerDemand: 15,
    priority: 'medium',
    status: 'scheduled',
    optimized: true,
  },
  {
    id: 5,
    title: 'Facility Cleaning',
    startTime: new Date(2025, 4, 8, 18, 0), // May 8, 2025, 6:00 PM
    endTime: new Date(2025, 4, 8, 21, 0),   // May 8, 2025, 9:00 PM
    equipmentType: 'Cleaning Equipment',
    powerDemand: 25,
    priority: 'low',
    status: 'scheduled',
    optimized: true,
  },
];

// Generate forecast data based on the scheduled tasks
const generateForecastData = (tasks: ScheduledTask[], hours: number = 48): PowerEstimate[] => {
  const data: PowerEstimate[] = [];
  const startDate = new Date();
  
  // Generate hourly data for the specified number of hours
  for (let i = 0; i < hours; i++) {
    const timestamp = addHours(startDate, i);
    
    // Base load is between 20-30 kW
    const baseLoad = 20 + Math.random() * 10;
    
    // Solar power varies by time of day (simplified model)
    let solarPower = 0;
    const hour = timestamp.getHours();
    
    // Simplified solar generation curve (peak at noon)
    if (hour >= 6 && hour <= 18) {
      // Peak solar production around noon
      const normalizedHour = Math.abs(hour - 12) / 6; // 0 at noon, 1 at 6am and 6pm
      solarPower = 25 * (1 - normalizedHour * normalizedHour); // Parabolic curve
      
      // Add some randomness for clouds etc.
      solarPower *= 0.8 + Math.random() * 0.4;
    }
    
    // Calculate additional load from scheduled tasks
    let taskLoad = 0;
    tasks.forEach(task => {
      if (timestamp >= task.startTime && timestamp <= task.endTime) {
        taskLoad += task.powerDemand;
      }
    });
    
    // Calculate optimized task load (assume 15% reduction with optimization)
    const optimizedTaskLoad = taskLoad * 0.85;
    
    data.push({
      timestamp,
      gridPower: Math.max(0, baseLoad + taskLoad - solarPower),
      solarPower,
      demand: baseLoad + taskLoad,
      optimizedDemand: baseLoad + optimizedTaskLoad,
    });
  }
  
  return data;
};

export default function OperationalPlanningPage() {
  const { isLoading } = usePowerData();
  const [selectedView, setSelectedView] = useState<'day' | 'week'>('day');
  const [optimizationEnabled, setOptimizationEnabled] = useState(true);
  const [tasks, setTasks] = useState<ScheduledTask[]>(mockTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  
  // State for new task form
  const [newTask, setNewTask] = useState<Omit<ScheduledTask, 'id' | 'status' | 'optimized'>>({
    title: '',
    startTime: addHours(new Date(), 1),
    endTime: addHours(new Date(), 3),
    equipmentType: 'Processing Line',
    powerDemand: 30,
    priority: 'medium',
  });
  
  // Generate forecast data
  const forecastData = generateForecastData(tasks);
  
  // Calculate savings metrics
  const calculateSavings = () => {
    if (!optimizationEnabled) return { cost: 0, energy: 0, co2: 0 };
    
    const totalOriginalEnergy = forecastData.reduce((sum, period) => sum + period.gridPower, 0);
    const totalOptimizedEnergy = forecastData.reduce((sum, period) => 
      sum + (period.optimizedDemand ? Math.max(0, period.optimizedDemand - period.solarPower) : period.gridPower), 0);
    
    const energySaved = totalOriginalEnergy - totalOptimizedEnergy;
    
    // Assume electricity costs $0.15/kWh and CO2 emissions are 0.5 kg/kWh
    return {
      energy: energySaved,
      cost: energySaved * 0.15,
      co2: energySaved * 0.5,
    };
  };
  
  const savings = calculateSavings();
  
  // Get the selected task
  const selectedTask = selectedTaskId ? tasks.find(task => task.id === selectedTaskId) : null;
  
  // Format a date to display
  const formatTaskTime = (date: Date) => {
    return format(date, 'MMM d, h:mm a');
  };
  
  // Handle saving a task
  const handleSaveTask = () => {
    if (isAddingTask) {
      // Add new task
      const newId = Math.max(...tasks.map(t => t.id), 0) + 1;
      const taskToAdd: ScheduledTask = {
        ...newTask,
        id: newId,
        status: 'scheduled',
        optimized: optimizationEnabled,
      };
      
      setTasks([...tasks, taskToAdd]);
      setIsAddingTask(false);
      resetNewTask();
    } else if (selectedTaskId) {
      // Update existing task
      setTasks(tasks.map(task => 
        task.id === selectedTaskId 
          ? { ...task, ...newTask, optimized: optimizationEnabled } 
          : task
      ));
      setSelectedTaskId(null);
      resetNewTask();
    }
  };
  
  // Reset the new task form
  const resetNewTask = () => {
    setNewTask({
      title: '',
      startTime: addHours(new Date(), 1),
      endTime: addHours(new Date(), 3),
      equipmentType: 'Processing Line',
      powerDemand: 30,
      priority: 'medium',
    });
  };
  
  // Cancel editing or adding a task
  const handleCancelTask = () => {
    setIsAddingTask(false);
    setSelectedTaskId(null);
    resetNewTask();
  };
  
  // Edit a task
  const handleEditTask = (taskId: number) => {
    const taskToEdit = tasks.find(task => task.id === taskId);
    if (taskToEdit) {
      setNewTask({
        title: taskToEdit.title,
        startTime: taskToEdit.startTime,
        endTime: taskToEdit.endTime,
        equipmentType: taskToEdit.equipmentType,
        powerDemand: taskToEdit.powerDemand,
        priority: taskToEdit.priority,
      });
      setSelectedTaskId(taskId);
      setIsAddingTask(false);
    }
  };
  
  // Delete a task
  const handleDeleteTask = (taskId: number) => {
    setTasks(tasks.filter(task => task.id !== taskId));
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      resetNewTask();
    }
  };
  
  // Handle changes to new task form fields
  const handleTaskInputChange = (field: string, value: any) => {
    setNewTask(prev => ({ ...prev, [field]: value }));
  };
  
  // Filter tasks for the selected view
  const getFilteredTasks = () => {
    const today = new Date();
    const weekFromNow = addDays(today, 7);
    
    if (selectedView === 'day') {
      return tasks.filter(task => {
        const taskDate = new Date(task.startTime);
        return taskDate.getDate() === today.getDate() && 
               taskDate.getMonth() === today.getMonth() && 
               taskDate.getFullYear() === today.getFullYear();
      });
    } else {
      return tasks.filter(task => {
        return task.startTime >= today && task.startTime <= weekFromNow;
      });
    }
  };
  
  // Run optimization
  const runOptimization = () => {
    // In a real application, this would run a complex algorithm
    // Here we'll just simulate by adjusting task times to better match solar production
    
    // Optimized tasks would be rescheduled to times with higher solar production
    const optimizedTasks = tasks.map(task => {
      if (task.priority !== 'high') {
        // For non-high-priority tasks, adjust start times to periods of higher solar production
        // This is a simplified simulation - in a real app this would be more sophisticated
        const isAfternoon = task.startTime.getHours() >= 12;
        const newStartTime = new Date(task.startTime);
        
        if (!isAfternoon) {
          // Move morning tasks to around noon for better solar usage
          newStartTime.setHours(11 + Math.floor(Math.random() * 3));
          newStartTime.setMinutes(0);
          
          // Maintain same duration
          const duration = task.endTime.getTime() - task.startTime.getTime();
          const newEndTime = new Date(newStartTime.getTime() + duration);
          
          return {
            ...task,
            startTime: newStartTime,
            endTime: newEndTime,
            optimized: true,
          };
        }
      }
      
      return { ...task, optimized: true };
    });
    
    setTasks(optimizedTasks);
    setOptimizationEnabled(true);
  };
  
  // Chart data for power forecast
  const getPowerChartData = () => {
    // Get only the next 24 hours for the chart
    return forecastData.slice(0, 24).map(item => ({
      name: format(item.timestamp, 'HH:mm'),
      gridPower: Number(item.gridPower.toFixed(1)),
      solarPower: Number(item.solarPower.toFixed(1)),
      totalDemand: Number(item.demand.toFixed(1)),
      optimizedDemand: optimizationEnabled ? Number(item.optimizedDemand?.toFixed(1)) : undefined,
    }));
  };
  
  if (isLoading) {
    return (
      <Layout title="Operational Planning" description="Optimize facility operations based on power availability">
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Operational Planning" description="Optimize facility operations based on power availability">
      <div className="space-y-6">
        {/* Top Cards with Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Forecasted Energy Savings"
            value={`${Math.round(savings.energy)} kWh`}
            description="Estimated reduction with optimization"
            icon={Zap}
            trend={savings.energy > 0 ? { value: 12.5, positive: true } : undefined}
          />
          
          <StatCard
            title="Cost Reduction"
            value={`$${savings.cost.toFixed(2)}`}
            description="Estimated cost savings over 48 hours"
            icon={BarChart3}
            trend={savings.cost > 0 ? { value: 15.3, positive: true } : undefined}
          />
          
          <StatCard
            title="Carbon Reduction"
            value={`${savings.co2.toFixed(1)} kg`}
            description="Estimated CO2 emissions avoided"
            icon={Cloud}
            trend={savings.co2 > 0 ? { value: 10.8, positive: true } : undefined}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <TabsList className="grid w-auto grid-cols-2">
              <TabsTrigger 
                value="day" 
                onClick={() => setSelectedView('day')}
                className={selectedView === 'day' ? "bg-primary text-primary-foreground" : ""}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Today
              </TabsTrigger>
              <TabsTrigger 
                value="week" 
                onClick={() => setSelectedView('week')}
                className={selectedView === 'week' ? "bg-primary text-primary-foreground" : ""}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Week
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="optimize-switch"
                checked={optimizationEnabled}
                onCheckedChange={setOptimizationEnabled}
              />
              <Label htmlFor="optimize-switch">Enable Optimization</Label>
            </div>
          </div>
          
          <Button onClick={runOptimization}>
            <SunIcon className="mr-2 h-4 w-4" />
            Optimize for Solar
          </Button>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Power Forecast Chart */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Power Availability Forecast</CardTitle>
              <CardDescription>
                Predicted power consumption and solar generation
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={getPowerChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
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
                  <Bar 
                    dataKey="solarPower" 
                    fill="#f59e0b" 
                    name="Solar Power"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalDemand" 
                    stroke="#ef4444" 
                    name="Total Demand"
                    strokeWidth={2}
                  />
                  {optimizationEnabled && (
                    <Line 
                      type="monotone" 
                      dataKey="optimizedDemand" 
                      stroke="#10b981" 
                      name="Optimized Demand"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  )}
                  <Line 
                    type="monotone" 
                    dataKey="gridPower" 
                    stroke="#6366f1" 
                    name="Grid Power"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          {/* Task Form */}
          <Card>
            <CardHeader>
              <CardTitle>
                {isAddingTask ? "Add New Task" : selectedTaskId ? "Edit Task" : "Schedule Tasks"}
              </CardTitle>
              <CardDescription>
                {isAddingTask || selectedTaskId 
                  ? "Provide task details below" 
                  : "Add and manage operational tasks"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(isAddingTask || selectedTaskId) ? (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="task-title">Task Name</Label>
                    <Input 
                      id="task-title" 
                      placeholder="Enter task name"
                      value={newTask.title}
                      onChange={(e) => handleTaskInputChange('title', e.target.value)}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="equipment-type">Equipment Type</Label>
                    <Select 
                      value={newTask.equipmentType}
                      onValueChange={(value) => handleTaskInputChange('equipmentType', value)}
                    >
                      <SelectTrigger id="equipment-type">
                        <SelectValue placeholder="Select equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Processing Line">Processing Line</SelectItem>
                        <SelectItem value="Cold Storage">Cold Storage</SelectItem>
                        <SelectItem value="Packaging Line">Packaging Line</SelectItem>
                        <SelectItem value="Lab Equipment">Lab Equipment</SelectItem>
                        <SelectItem value="Cleaning Equipment">Cleaning Equipment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="task-priority">Priority</Label>
                    <Select 
                      value={newTask.priority}
                      onValueChange={(value: 'high' | 'medium' | 'low') => 
                        handleTaskInputChange('priority', value)
                      }
                    >
                      <SelectTrigger id="task-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="power-demand">Power Demand (kW)</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[newTask.powerDemand]}
                        min={5}
                        max={60}
                        step={5}
                        onValueChange={(values) => 
                          handleTaskInputChange('powerDemand', values[0])
                        }
                        className="flex-1"
                      />
                      <span className="w-12 text-center">{newTask.powerDemand}</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>Start Time</Label>
                    <Input 
                      type="datetime-local"
                      value={format(newTask.startTime, "yyyy-MM-dd'T'HH:mm")}
                      onChange={(e) => handleTaskInputChange('startTime', new Date(e.target.value))}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>End Time</Label>
                    <Input 
                      type="datetime-local"
                      value={format(newTask.endTime, "yyyy-MM-dd'T'HH:mm")}
                      onChange={(e) => handleTaskInputChange('endTime', new Date(e.target.value))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={handleCancelTask}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveTask}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Task
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => {
                      setIsAddingTask(true);
                      setSelectedTaskId(null);
                    }}
                  >
                    <ListChecks className="mr-2 h-4 w-4" />
                    Add New Task
                  </Button>
                  
                  <p className="text-sm text-muted-foreground mt-4">
                    {
                      getFilteredTasks().length 
                        ? `${getFilteredTasks().length} task(s) scheduled for ${selectedView === 'day' ? 'today' : 'this week'}`
                        : `No tasks scheduled for ${selectedView === 'day' ? 'today' : 'this week'}`
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Scheduled Tasks Table */}
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Tasks</CardTitle>
            <CardDescription>
              {selectedView === 'day' ? "Today's operational tasks" : "This week's operational tasks"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Power</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredTasks().length > 0 ? (
                  getFilteredTasks().map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <TimerIcon className="mr-1 h-3 w-3 text-muted-foreground" />
                          <span>{formatTaskTime(task.startTime)}</span>
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <ArrowRight className="mr-1 h-3 w-3" />
                          <span>{formatTaskTime(task.endTime)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{task.equipmentType}</TableCell>
                      <TableCell>{task.powerDemand} kW</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            task.priority === 'high' ? 'destructive' :
                            task.priority === 'medium' ? 'default' :
                            'secondary'
                          }
                        >
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {task.status}
                        </Badge>
                        {task.optimized && (
                          <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            optimized
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditTask(task.id)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}>
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="24" 
                            height="24" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            className="h-4 w-4"
                          >
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No tasks scheduled for {selectedView === 'day' ? 'today' : 'this week'}.
                      <br />
                      Click "Add New Task" to schedule an operation.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}