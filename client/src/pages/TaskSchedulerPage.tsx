import { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  addHours,
  isAfter,
  isBefore,
  isEqual,
} from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';
import { AlertTriangle, Calendar as CalendarIcon, CheckCircle2, Clock, Play, X, AlertCircle, ArrowUpDown, Filter, Plus, RefreshCw, CalendarDays } from 'lucide-react';

import 'react-big-calendar/lib/css/react-big-calendar.css';

// Configure the calendar localizer
import { enUS } from 'date-fns/locale/en-US';
const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Define task status colors
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
};

// Define our form schema for creating/editing a task
const taskFormSchema = z.object({
  task: z.string().min(3, { message: 'Task description must be at least 3 characters' }),
  agentId: z.number().int().positive({ message: 'Please select an agent' }),
  scheduledFor: z.string().optional(),
  recurrence: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dependsOn: z.number().int().positive().optional(),
  notifyOnComplete: z.boolean().default(true),
  notifyOnFail: z.boolean().default(true),
  telegramNotify: z.boolean().default(false),
  tools: z.array(
    z.object({
      toolId: z.number().int().positive(),
      priority: z.number().int().default(0),
      parameters: z.record(z.any()).optional()
    })
  ).default([]),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

// Interfaces for our data types
interface Tool {
  id: number;
  name: string;
  description: string;
  toolType: string;
  parameters?: Record<string, any>;
  implementation?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  isBuiltIn: boolean;
  metadata?: Record<string, any>;
}

interface Agent {
  id: number;
  name: string;
  description: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  streaming: boolean;
  systemPrompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: number;
  agentId: number;
  userId: number;
  task: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  scheduledFor: string | null;
  recurrence: string | null;
  priority: 'low' | 'medium' | 'high';
  dependsOn?: number;
  notifyOnComplete: boolean;
  notifyOnFail: boolean;
  telegramNotify: boolean;
  result?: Record<string, any>;
  data?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  tools?: TaskTool[];
}

interface TaskTool {
  id: number;
  taskId: number;
  toolId: number;
  priority: number;
  parameters?: Record<string, any>;
  createdAt: string;
}

// Convert tasks to calendar events
const taskToEvent = (task: Task) => {
  const start = task.scheduledFor ? new Date(task.scheduledFor) : new Date(task.createdAt);
  const end = task.scheduledFor ? addHours(new Date(task.scheduledFor), 1) : addHours(new Date(task.createdAt), 1);
  
  return {
    id: task.id,
    title: task.task,
    start,
    end,
    status: task.status,
    priority: task.priority,
    resource: task,
  };
};

// Main component
export default function TaskSchedulerPage() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('view');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected, sendMessage } = useWebSocket();
  
  // Form for creating/editing tasks
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      task: '',
      agentId: undefined,
      scheduledFor: new Date().toISOString().slice(0, 16),
      recurrence: '',
      priority: 'medium',
      notifyOnComplete: true,
      notifyOnFail: true,
      telegramNotify: false,
      tools: [],
    },
  });
  
  // Query for loading tasks
  const { 
    data: tasks = [], 
    isLoading: isLoadingTasks,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['/api/tasks/scheduled'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Query for loading agents
  const { 
    data: agents = [], 
    isLoading: isLoadingAgents,
  } = useQuery({
    queryKey: ['/api/langchain/agents'],
  });
  
  // Query for loading tools
  const { 
    data: tools = [], 
    isLoading: isLoadingTools,
  } = useQuery({
    queryKey: ['/api/tasks/tools'],
  });
  
  // Mutation for creating a task
  const createTaskMutation = useMutation({
    mutationFn: (taskData: TaskFormValues) => 
      apiRequest('/api/tasks/scheduled', { method: 'POST', body: JSON.stringify(taskData) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/scheduled'] });
      toast({
        title: 'Task created',
        description: 'The task has been scheduled successfully',
      });
      setIsTaskDialogOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: `Failed to create task: ${err.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });
  
  // Mutation for updating a task
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: Partial<TaskFormValues> }) => 
      apiRequest(`/api/tasks/scheduled/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/scheduled'] });
      toast({
        title: 'Task updated',
        description: 'The task has been updated successfully',
      });
      setIsTaskDialogOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: `Failed to update task: ${err.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });
  
  // Mutation for deleting a task
  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/tasks/scheduled/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/scheduled'] });
      toast({
        title: 'Task deleted',
        description: 'The task has been deleted successfully',
      });
      setIsTaskDialogOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: `Failed to delete task: ${err.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });
  
  // Mutation for executing a task
  const executeTaskMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/tasks/scheduled/${id}/execute`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/scheduled'] });
      toast({
        title: 'Task execution started',
        description: 'The task execution has been initiated',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: `Failed to execute task: ${err.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });
  
  // Subscribe to task updates via WebSocket
  useEffect(() => {
    if (isConnected) {
      sendMessage({ 
        type: 'subscribe', 
        channel: 'task-updates' 
      });
      
      return () => {
        sendMessage({ 
          type: 'unsubscribe', 
          channel: 'task-updates' 
        });
      };
    }
  }, [isConnected, sendMessage]);
  
  // Filter tasks based on selected filters
  const filteredTasks = tasks.filter((task: Task) => {
    // Filter by status
    if (statusFilter && task.status !== statusFilter) {
      return false;
    }
    
    // Filter by agent
    if (agentFilter && task.agentId !== agentFilter) {
      return false;
    }
    
    // Filter by date if selected
    if (selectedDate && task.scheduledFor) {
      const taskDate = new Date(task.scheduledFor);
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      
      if (!isAfter(taskDate, start) || !isBefore(taskDate, end)) {
        return false;
      }
    }
    
    return true;
  });
  
  // Convert tasks to calendar events
  const events = filteredTasks.map(taskToEvent);
  
  // Handle task selection in calendar
  const handleTaskSelect = (event: any) => {
    const task = event.resource as Task;
    setSelectedTask(task);
    setDialogMode('view');
    setIsTaskDialogOpen(true);
    
    // Pre-fill form with task data for editing
    form.reset({
      task: task.task,
      agentId: task.agentId,
      scheduledFor: task.scheduledFor ? new Date(task.scheduledFor).toISOString().slice(0, 16) : undefined,
      recurrence: task.recurrence || undefined,
      priority: task.priority,
      dependsOn: task.dependsOn,
      notifyOnComplete: task.notifyOnComplete,
      notifyOnFail: task.notifyOnFail,
      telegramNotify: task.telegramNotify,
      tools: task.tools || [],
    });
  };
  
  // Handle date selection in calendar
  const handleDateSelect = ({ start }: { start: Date, end: Date }) => {
    setSelectedDate(start);
    form.setValue('scheduledFor', start.toISOString().slice(0, 16));
    setDialogMode('create');
    setIsCreating(true);
    setIsTaskDialogOpen(true);
    
    // Reset form for creating a new task
    form.reset({
      task: '',
      agentId: undefined,
      scheduledFor: start.toISOString().slice(0, 16),
      recurrence: '',
      priority: 'medium',
      notifyOnComplete: true,
      notifyOnFail: true,
      telegramNotify: false,
      tools: [],
    });
  };
  
  // Handle form submission
  const onSubmit = (data: TaskFormValues) => {
    if (dialogMode === 'create') {
      createTaskMutation.mutate(data);
    } else if (dialogMode === 'edit' && selectedTask) {
      updateTaskMutation.mutate({ 
        id: selectedTask.id, 
        data 
      });
    }
  };
  
  // Handle execute task
  const handleExecuteTask = (taskId: number) => {
    executeTaskMutation.mutate(taskId);
  };
  
  // Handle delete task
  const handleDeleteTask = (taskId: number) => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTaskMutation.mutate(taskId);
    }
  };
  
  // Custom event component for calendar
  const eventStyleGetter = (event: any) => {
    const style = {
      backgroundColor: event.status === 'completed' ? '#10b981' : 
                     event.status === 'failed' ? '#ef4444' : 
                     event.status === 'in-progress' ? '#3b82f6' : '#f59e0b',
      color: 'white',
      borderRadius: '5px',
      opacity: 0.8,
      display: 'block',
      border: '0px',
      cursor: 'pointer',
    };
    
    return {
      style,
    };
  };
  
  // Get agent name by ID
  const getAgentName = (id: number) => {
    const agent = agents.find((a: Agent) => a.id === id);
    return agent ? agent.name : 'Unknown agent';
  };
  
  // Get tool name by ID
  const getToolName = (id: number) => {
    const tool = tools.find((t: Tool) => t.id === id);
    return tool ? tool.name : 'Unknown tool';
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LangChain Agent Task Scheduler</h1>
          <p className="text-muted-foreground">
            Schedule and manage automated tasks with LangChain agents and tools
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetchTasks()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => {
            setDialogMode('create');
            setIsCreating(true);
            setIsTaskDialogOpen(true);
            form.reset({
              task: '',
              agentId: undefined,
              scheduledFor: new Date().toISOString().slice(0, 16),
              recurrence: '',
              priority: 'medium',
              notifyOnComplete: true,
              notifyOnFail: true,
              telegramNotify: false,
              tools: [],
            });
          }}>
            <Plus className="mr-2 h-4 w-4" /> New Task
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter tasks by agent, status and date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Status</FormLabel>
              <Select
                value={statusFilter || ''}
                onValueChange={(value) => setStatusFilter(value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <FormLabel>Agent</FormLabel>
              <Select
                value={agentFilter?.toString() || ''}
                onValueChange={(value) => setAgentFilter(value ? parseInt(value) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All agents</SelectItem>
                  {agents.map((agent: Agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <FormLabel>Selected Date</FormLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedDate(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStatusFilter(null);
                  setAgentFilter(null);
                  setSelectedDate(null);
                }}
              >
                Clear All Filters
              </Button>
            </div>
          </CardContent>
          
          <CardHeader className="border-t pt-6">
            <CardTitle>Task Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingTasks ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Total Tasks</span>
                    <span className="text-sm font-medium">{tasks.length}</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Pending</span>
                    <span className="text-sm font-medium">
                      {tasks.filter((t: Task) => t.status === 'pending').length}
                    </span>
                  </div>
                  <Progress 
                    value={tasks.length ? (tasks.filter((t: Task) => t.status === 'pending').length / tasks.length) * 100 : 0} 
                    className="h-2 bg-gray-200"
                    indicatorClassName="bg-yellow-400"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">In Progress</span>
                    <span className="text-sm font-medium">
                      {tasks.filter((t: Task) => t.status === 'in-progress').length}
                    </span>
                  </div>
                  <Progress 
                    value={tasks.length ? (tasks.filter((t: Task) => t.status === 'in-progress').length / tasks.length) * 100 : 0} 
                    className="h-2 bg-gray-200"
                    indicatorClassName="bg-blue-400"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Completed</span>
                    <span className="text-sm font-medium">
                      {tasks.filter((t: Task) => t.status === 'completed').length}
                    </span>
                  </div>
                  <Progress 
                    value={tasks.length ? (tasks.filter((t: Task) => t.status === 'completed').length / tasks.length) * 100 : 0} 
                    className="h-2 bg-gray-200"
                    indicatorClassName="bg-green-400"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Failed</span>
                    <span className="text-sm font-medium">
                      {tasks.filter((t: Task) => t.status === 'failed').length}
                    </span>
                  </div>
                  <Progress 
                    value={tasks.length ? (tasks.filter((t: Task) => t.status === 'failed').length / tasks.length) * 100 : 0} 
                    className="h-2 bg-gray-200"
                    indicatorClassName="bg-red-400"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="md:col-span-3">
          <CardContent className="pt-6">
            <Tabs defaultValue="calendar">
              <TabsList className="mb-4">
                <TabsTrigger value="calendar">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Calendar View
                </TabsTrigger>
                <TabsTrigger value="list">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  List View
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="calendar" className="min-h-[600px]">
                {isLoadingTasks ? (
                  <div className="flex items-center justify-center h-[600px]">
                    <div className="text-center">
                      <Skeleton className="h-[500px] w-full" />
                      <div className="mt-4">Loading tasks...</div>
                    </div>
                  </div>
                ) : (
                  <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 600 }}
                    onSelectEvent={handleTaskSelect}
                    onSelectSlot={handleDateSelect}
                    selectable
                    eventPropGetter={eventStyleGetter}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="list">
                {isLoadingTasks ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-muted-foreground">No tasks found with the current filters</div>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => {
                        setStatusFilter(null);
                        setAgentFilter(null);
                        setSelectedDate(null);
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTasks.map((task: Task) => (
                      <Card key={task.id} className="overflow-hidden">
                        <div className={`h-1 ${
                          task.status === 'completed' ? 'bg-green-400' : 
                          task.status === 'failed' ? 'bg-red-400' : 
                          task.status === 'in-progress' ? 'bg-blue-400' : 
                          'bg-yellow-400'
                        }`} />
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-lg line-clamp-1">{task.task}</h3>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {task.scheduledFor ? 
                                  format(new Date(task.scheduledFor), 'PPp') : 
                                  'Not scheduled'
                                }
                                {task.recurrence && (
                                  <Badge variant="outline" className="ml-2">
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    {task.recurrence}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                className={statusColors[task.status]}
                              >
                                {task.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {task.status === 'failed' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                {task.status === 'in-progress' && <Clock className="h-3 w-3 mr-1" />}
                                {task.status === 'pending' && <AlertCircle className="h-3 w-3 mr-1" />}
                                {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                              </Badge>
                              <Badge variant="outline">
                                {getAgentName(task.agentId)}
                              </Badge>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setDialogMode('view');
                                  setIsTaskDialogOpen(true);
                                  
                                  form.reset({
                                    task: task.task,
                                    agentId: task.agentId,
                                    scheduledFor: task.scheduledFor ? new Date(task.scheduledFor).toISOString().slice(0, 16) : undefined,
                                    recurrence: task.recurrence || undefined,
                                    priority: task.priority,
                                    dependsOn: task.dependsOn,
                                    notifyOnComplete: task.notifyOnComplete,
                                    notifyOnFail: task.notifyOnFail,
                                    telegramNotify: task.telegramNotify,
                                    tools: task.tools || [],
                                  });
                                }}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {task.tools && task.tools.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {task.tools.map((tool) => (
                                <Badge key={tool.id} variant="secondary" className="text-xs">
                                  {getToolName(tool.toolId)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Create New Task' : 
               dialogMode === 'edit' ? 'Edit Task' : 'View Task'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'create' ? 'Schedule a new task for a LangChain agent' : 
               dialogMode === 'edit' ? 'Modify the existing task' : 'Task details'}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue={dialogMode === 'view' ? "details" : "form"}>
            <TabsList className="mb-4">
              <TabsTrigger value="form" disabled={dialogMode === 'view'}>
                Task Form
              </TabsTrigger>
              <TabsTrigger value="details">
                Task Details
              </TabsTrigger>
              {dialogMode === 'view' && selectedTask && (
                <TabsTrigger value="result">
                  Result
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="form">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="task"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe what the agent should do..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="agentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent</FormLabel>
                          <Select
                            value={field.value?.toString() || ''}
                            onValueChange={(value) => field.onChange(parseInt(value))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an agent" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {agents.map((agent: Agent) => (
                                <SelectItem key={agent.id} value={agent.id.toString()}>
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="scheduledFor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Schedule Date & Time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="recurrence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recurrence (Optional)</FormLabel>
                          <Select
                            value={field.value || ''}
                            onValueChange={(value) => field.onChange(value || undefined)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="No recurrence" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No recurrence</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tools"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tools (Optional)</FormLabel>
                          <Select
                            value=""
                            onValueChange={(value) => {
                              const toolId = parseInt(value);
                              const existingTools = field.value || [];
                              if (!existingTools.some(t => t.toolId === toolId)) {
                                field.onChange([
                                  ...existingTools,
                                  { toolId, priority: existingTools.length }
                                ]);
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Add tools" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tools.map((tool: Tool) => (
                                <SelectItem key={tool.id} value={tool.id.toString()}>
                                  {tool.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {/* Display selected tools */}
                          <div className="mt-2 space-y-2">
                            {(field.value || []).map((toolItem: any, index: number) => (
                              <div key={index} className="flex items-center gap-2 text-sm p-2 border rounded">
                                <span>{getToolName(toolItem.toolId)}</span>
                                <button
                                  type="button"
                                  className="ml-auto text-red-500"
                                  onClick={() => {
                                    const updatedTools = [...field.value];
                                    updatedTools.splice(index, 1);
                                    field.onChange(updatedTools);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="notifyOnComplete"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel>Notify on completion</FormLabel>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="notifyOnFail"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel>Notify on failure</FormLabel>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="telegramNotify"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel>Send notifications via Telegram</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsTaskDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                    >
                      {createTaskMutation.isPending || updateTaskMutation.isPending ? (
                        <>Saving...</>
                      ) : (
                        <>{dialogMode === 'create' ? 'Create Task' : 'Update Task'}</>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="details">
              {selectedTask && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground">Task Description</h3>
                    <p className="mt-1">{selectedTask.task}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Status</h3>
                      <Badge 
                        className={`mt-1 ${statusColors[selectedTask.status]}`}
                      >
                        {selectedTask.status.charAt(0).toUpperCase() + selectedTask.status.slice(1)}
                      </Badge>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Priority</h3>
                      <p className="mt-1 capitalize">{selectedTask.priority}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Agent</h3>
                      <p className="mt-1">{getAgentName(selectedTask.agentId)}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Scheduled For</h3>
                      <p className="mt-1">{selectedTask.scheduledFor ? 
                        format(new Date(selectedTask.scheduledFor), 'PPpp') : 
                        'Not scheduled'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Created</h3>
                      <p className="mt-1">{format(new Date(selectedTask.createdAt), 'PPpp')}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Last Updated</h3>
                      <p className="mt-1">{format(new Date(selectedTask.updatedAt), 'PPpp')}</p>
                    </div>
                  </div>
                  
                  {selectedTask.recurrence && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Recurrence</h3>
                      <p className="mt-1">{selectedTask.recurrence}</p>
                    </div>
                  )}
                  
                  {selectedTask.tools && selectedTask.tools.length > 0 && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Tools</h3>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedTask.tools.map((tool) => (
                          <Badge key={tool.id} variant="secondary">
                            {getToolName(tool.toolId)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground">Notifications</h3>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center">
                        <Checkbox checked={selectedTask.notifyOnComplete} disabled />
                        <span className="ml-2">Notify on completion</span>
                      </div>
                      <div className="flex items-center">
                        <Checkbox checked={selectedTask.notifyOnFail} disabled />
                        <span className="ml-2">Notify on failure</span>
                      </div>
                      <div className="flex items-center">
                        <Checkbox checked={selectedTask.telegramNotify} disabled />
                        <span className="ml-2">Telegram notifications</span>
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter className="flex justify-between">
                    <div>
                      <Button 
                        variant="destructive" 
                        onClick={() => handleDeleteTask(selectedTask.id)}
                        disabled={deleteTaskMutation.isPending}
                      >
                        {deleteTaskMutation.isPending ? 'Deleting...' : 'Delete Task'}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      {selectedTask.status === 'pending' && (
                        <Button 
                          onClick={() => handleExecuteTask(selectedTask.id)}
                          disabled={executeTaskMutation.isPending}
                        >
                          {executeTaskMutation.isPending ? 'Executing...' : 'Execute Now'}
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setDialogMode('edit');
                          form.reset({
                            task: selectedTask.task,
                            agentId: selectedTask.agentId,
                            scheduledFor: selectedTask.scheduledFor ? new Date(selectedTask.scheduledFor).toISOString().slice(0, 16) : undefined,
                            recurrence: selectedTask.recurrence || undefined,
                            priority: selectedTask.priority,
                            dependsOn: selectedTask.dependsOn,
                            notifyOnComplete: selectedTask.notifyOnComplete,
                            notifyOnFail: selectedTask.notifyOnFail,
                            telegramNotify: selectedTask.telegramNotify,
                            tools: selectedTask.tools || [],
                          });
                        }}
                      >
                        Edit Task
                      </Button>
                      <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                        Close
                      </Button>
                    </div>
                  </DialogFooter>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="result">
              {selectedTask && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground">Task Result</h3>
                    {selectedTask.result ? (
                      <pre className="mt-2 p-4 bg-gray-100 rounded-md overflow-x-auto">
                        {JSON.stringify(selectedTask.result, null, 2)}
                      </pre>
                    ) : (
                      <p className="mt-1 text-muted-foreground">No result data available</p>
                    )}
                  </div>
                  
                  {selectedTask.completedAt && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Completed At</h3>
                      <p className="mt-1">{format(new Date(selectedTask.completedAt), 'PPpp')}</p>
                    </div>
                  )}
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}