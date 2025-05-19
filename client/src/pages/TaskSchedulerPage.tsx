import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, Views, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import SharedLayout from "@/components/ui/shared-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, Play, Square, Trash, Edit, Plus, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
// Import DateRangePicker when needed
// import { DateRangePicker } from "@/components/custom/date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

// Define the task status types
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

// Define a type for the task
interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  agentId: number;
  userId: number;
  startTime?: Date;
  endTime?: Date;
  result?: any;
  dependencies?: number[];
  priority?: 'low' | 'medium' | 'high';
  recurrence?: string;
  tools?: string[];
}

// Define type for tool
interface Tool {
  id: number;
  name: string;
  description: string;
  toolType: string;
  parameters: any;
  enabled: boolean;
}

// Define a type for calendar events
interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  status: TaskStatus;
  task: Task;
}

// Define agent type
interface Agent {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
}

const TaskSchedulerPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State for managing dialogs
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedView, setSelectedView] = useState<string>('month');

  // State for task form
  const [taskForm, setTaskForm] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: 'pending',
    agentId: 0,
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 60 * 60 * 1000), // Default 1 hour duration
    priority: 'medium',
    tools: []
  });

  // Query to fetch the tasks
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/langchain/tasks'],
    select: (data) => data as Task[],
  });

  // Query to fetch agents
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['/api/langchain/agents'],
    select: (data) => data as Agent[],
  });

  // Query to fetch available tools
  const { data: tools, isLoading: toolsLoading } = useQuery({
    queryKey: ['/api/langchain/tools'],
    select: (data) => data as Tool[],
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (task: Partial<Task>) => {
      return apiRequest('/api/langchain/tasks', {
        method: 'POST',
        data: task
      });
    },
    onSuccess: () => {
      toast({
        title: "Task Created",
        description: "The task has been scheduled successfully"
      });
      setIsCreateTaskOpen(false);
      resetTaskForm();
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Create Task",
        description: "There was an error creating the task. Please try again.",
        variant: "destructive"
      });
      console.error("Task creation error:", error);
    }
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: (task: Partial<Task>) => {
      return apiRequest(`/api/langchain/tasks/${task.id}`, {
        method: 'PUT',
        data: task
      });
    },
    onSuccess: () => {
      toast({
        title: "Task Updated",
        description: "The task has been updated successfully"
      });
      setIsEditTaskOpen(false);
      resetTaskForm();
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Update Task",
        description: "There was an error updating the task. Please try again.",
        variant: "destructive"
      });
      console.error("Task update error:", error);
    }
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => {
      return apiRequest(`/api/langchain/tasks/${taskId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Task Deleted",
        description: "The task has been deleted successfully"
      });
      setIsTaskDetailsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Delete Task",
        description: "There was an error deleting the task. Please try again.",
        variant: "destructive"
      });
      console.error("Task deletion error:", error);
    }
  });

  // Execute task mutation
  const executeTaskMutation = useMutation({
    mutationFn: (taskId: number) => {
      return apiRequest(`/api/langchain/tasks/${taskId}/execute`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "Task Execution Started",
        description: "The task execution has been initiated"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Execute Task",
        description: "There was an error executing the task. Please try again.",
        variant: "destructive"
      });
      console.error("Task execution error:", error);
    }
  });

  // Stop task mutation
  const stopTaskMutation = useMutation({
    mutationFn: (taskId: number) => {
      return apiRequest(`/api/langchain/tasks/${taskId}/stop`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "Task Stopped",
        description: "The task has been stopped successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Stop Task",
        description: "There was an error stopping the task. Please try again.",
        variant: "destructive"
      });
      console.error("Task stop error:", error);
    }
  });

  // Convert tasks to calendar events
  const calendarEvents = useMemo(() => {
    if (!tasks) return [];
    
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      start: task.startTime ? new Date(task.startTime) : new Date(),
      end: task.endTime ? new Date(task.endTime) : new Date(new Date().getTime() + 60 * 60 * 1000),
      status: task.status,
      task: task
    }));
  }, [tasks]);

  // Handle calendar event selection
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedTask(event.task);
    setIsTaskDetailsOpen(true);
  }, []);

  // Handle creating a task for a specific time slot
  const handleSelectSlot = useCallback(({ start, end }: { start: Date, end: Date }) => {
    setTaskForm({
      ...taskForm,
      startTime: start,
      endTime: end
    });
    setIsCreateTaskOpen(true);
  }, [taskForm]);

  // Reset task form
  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      status: 'pending',
      agentId: agents && agents.length > 0 ? agents[0].id : 0,
      startTime: new Date(),
      endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
      priority: 'medium',
      tools: []
    });
  };

  // Handle edit task
  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setTaskForm({
      ...task,
      startTime: task.startTime ? new Date(task.startTime) : undefined,
      endTime: task.endTime ? new Date(task.endTime) : undefined
    });
    setIsEditTaskOpen(true);
    setIsTaskDetailsOpen(false);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTaskForm({
      ...taskForm,
      [name]: value
    });
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setTaskForm({
      ...taskForm,
      [name]: value
    });
  };

  // Handle date selection
  const handleDateSelect = (date: Date | undefined, type: 'start' | 'end') => {
    if (!date) return;
    
    setTaskForm({
      ...taskForm,
      [type === 'start' ? 'startTime' : 'endTime']: date
    });
  };

  // Handle tool selection
  const handleToolToggle = (toolName: string, checked: boolean) => {
    setTaskForm(prev => {
      const currentTools = prev.tools || [];
      if (checked && !currentTools.includes(toolName)) {
        return { ...prev, tools: [...currentTools, toolName] };
      } else if (!checked && currentTools.includes(toolName)) {
        return { ...prev, tools: currentTools.filter(t => t !== toolName) };
      }
      return prev;
    });
  };

  // Submit task form
  const handleSubmitTask = () => {
    // Validate required fields
    if (!taskForm.title || !taskForm.description || !taskForm.agentId) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }

    // Add user ID to the task
    const taskData = {
      ...taskForm,
      userId: user?.id
    };

    // Create or update task
    if (taskForm.id) {
      updateTaskMutation.mutate(taskData);
    } else {
      createTaskMutation.mutate(taskData);
    }
  };

  // Get event style based on task status
  const eventStyleGetter = (event: CalendarEvent) => {
    let style = {
      backgroundColor: '#3b82f6', // Default blue
      borderRadius: '4px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block'
    };

    // Set color based on status
    switch (event.status) {
      case 'pending':
        style.backgroundColor = '#3b82f6'; // Blue
        break;
      case 'running':
        style.backgroundColor = '#10b981'; // Green
        break;
      case 'completed':
        style.backgroundColor = '#6366f1'; // Indigo
        break;
      case 'failed':
        style.backgroundColor = '#ef4444'; // Red
        break;
      default:
        break;
    }

    return { style };
  };

  // Get status badge color
  const getStatusBadgeColor = (status: TaskStatus) => {
    switch (status) {
      case 'pending': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'running': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'completed': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Handle task status change
  const handleStatusChange = (taskId: number, action: 'execute' | 'stop' | 'cancel') => {
    if (action === 'execute') {
      executeTaskMutation.mutate(taskId);
    } else if (action === 'stop') {
      stopTaskMutation.mutate(taskId);
    }
    setIsTaskDetailsOpen(false);
  };

  return (
    <SharedLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">LangChain Task Scheduler</h1>
          <Button onClick={() => setIsCreateTaskOpen(true)} className="flex items-center gap-2">
            <Plus size={16} /> Schedule New Task
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Task Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="calendar-container" style={{ height: 700 }}>
              {tasksLoading ? (
                <div className="flex flex-col gap-4 w-full h-full">
                  <Skeleton className="h-[600px] w-full" />
                </div>
              ) : (
                <Calendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  onSelectEvent={handleSelectEvent}
                  onSelectSlot={handleSelectSlot}
                  selectable
                  views={['month', 'week', 'day', 'agenda']}
                  view={selectedView as any}
                  onView={(view) => setSelectedView(view)}
                  date={selectedDate}
                  onNavigate={date => setSelectedDate(date)}
                  eventPropGetter={eventStyleGetter}
                  className="rounded-md bg-background"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">All Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Agent</th>
                    <th className="px-4 py-2 text-left">Priority</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Scheduled</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasksLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-4 py-2"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-2"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-2"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-2"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-2"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-4 py-2"><Skeleton className="h-4 w-24" /></td>
                      </tr>
                    ))
                  ) : tasks && tasks.length > 0 ? (
                    tasks.map(task => {
                      const agent = agents?.find(a => a.id === task.agentId);
                      return (
                        <tr key={task.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedTask(task); setIsTaskDetailsOpen(true); }}>
                          <td className="px-4 py-2 font-medium">{task.title}</td>
                          <td className="px-4 py-2">{agent?.name || 'Unknown'}</td>
                          <td className="px-4 py-2">
                            <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'secondary' : 'outline'}>
                              {task.priority}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            <Badge className={getStatusBadgeColor(task.status)}>
                              {task.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">{task.startTime ? moment(task.startTime).format('MMM D, YYYY h:mm A') : 'Not scheduled'}</td>
                          <td className="px-4 py-2">
                            <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditTask(task)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              {task.status === 'pending' && (
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleStatusChange(task.id, 'execute')}>
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              {task.status === 'running' && (
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleStatusChange(task.id, 'stop')}>
                                  <Square className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => deleteTaskMutation.mutate(task.id)}>
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        No tasks scheduled. Click "Schedule New Task" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Create Task Dialog */}
        <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Schedule New Task</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4">
                  <Label htmlFor="title">Task Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={taskForm.title}
                    onChange={handleInputChange}
                    placeholder="Enter task title"
                  />
                </div>
                <div className="col-span-4">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={taskForm.description}
                    onChange={handleInputChange}
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="agent">Agent</Label>
                  <Select 
                    value={taskForm.agentId?.toString()} 
                    onValueChange={(value) => handleSelectChange('agentId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents?.map(agent => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select 
                    value={taskForm.priority} 
                    onValueChange={(value) => handleSelectChange('priority', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Start Time</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {taskForm.startTime ? moment(taskForm.startTime).format('MMM D, YYYY h:mm A') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarPicker
                        mode="single"
                        selected={taskForm.startTime}
                        onSelect={(date) => handleDateSelect(date, 'start')}
                        initialFocus
                      />
                      <div className="p-3 border-t">
                        <Label htmlFor="startTime">Time</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={taskForm.startTime ? moment(taskForm.startTime).format('HH:mm') : ''}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(':');
                            const newDate = taskForm.startTime ? new Date(taskForm.startTime) : new Date();
                            newDate.setHours(parseInt(hours), parseInt(minutes));
                            handleDateSelect(newDate, 'start');
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-2">
                  <Label>End Time</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {taskForm.endTime ? moment(taskForm.endTime).format('MMM D, YYYY h:mm A') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarPicker
                        mode="single"
                        selected={taskForm.endTime}
                        onSelect={(date) => handleDateSelect(date, 'end')}
                        initialFocus
                      />
                      <div className="p-3 border-t">
                        <Label htmlFor="endTime">Time</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={taskForm.endTime ? moment(taskForm.endTime).format('HH:mm') : ''}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(':');
                            const newDate = taskForm.endTime ? new Date(taskForm.endTime) : new Date();
                            newDate.setHours(parseInt(hours), parseInt(minutes));
                            handleDateSelect(newDate, 'end');
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-4">
                  <Label>LangChain Tools</Label>
                  <ScrollArea className="h-40 w-full border rounded-md p-4">
                    <div className="space-y-2">
                      {toolsLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-start space-x-2">
                            <Skeleton className="h-4 w-4 mt-1" />
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-40" />
                              <Skeleton className="h-3 w-60" />
                            </div>
                          </div>
                        ))
                      ) : tools && tools.length > 0 ? (
                        tools.map(tool => (
                          <div key={tool.id} className="flex items-start space-x-2">
                            <Checkbox
                              id={`tool-${tool.id}`}
                              checked={(taskForm.tools || []).includes(tool.name)}
                              onCheckedChange={(checked) => 
                                handleToolToggle(tool.name, checked === true)
                              }
                            />
                            <div className="space-y-1">
                              <Label
                                htmlFor={`tool-${tool.id}`}
                                className="font-medium"
                              >
                                {tool.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">{tool.description}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No tools available</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitTask}>Schedule Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={isEditTaskOpen} onOpenChange={setIsEditTaskOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4">
                  <Label htmlFor="edit-title">Task Title</Label>
                  <Input
                    id="edit-title"
                    name="title"
                    value={taskForm.title}
                    onChange={handleInputChange}
                    placeholder="Enter task title"
                  />
                </div>
                <div className="col-span-4">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    value={taskForm.description}
                    onChange={handleInputChange}
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-agent">Agent</Label>
                  <Select 
                    value={taskForm.agentId?.toString()} 
                    onValueChange={(value) => handleSelectChange('agentId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents?.map(agent => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Select 
                    value={taskForm.priority} 
                    onValueChange={(value) => handleSelectChange('priority', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Start Time</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {taskForm.startTime ? moment(taskForm.startTime).format('MMM D, YYYY h:mm A') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarPicker
                        mode="single"
                        selected={taskForm.startTime}
                        onSelect={(date) => handleDateSelect(date, 'start')}
                        initialFocus
                      />
                      <div className="p-3 border-t">
                        <Label htmlFor="edit-startTime">Time</Label>
                        <Input
                          id="edit-startTime"
                          type="time"
                          value={taskForm.startTime ? moment(taskForm.startTime).format('HH:mm') : ''}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(':');
                            const newDate = taskForm.startTime ? new Date(taskForm.startTime) : new Date();
                            newDate.setHours(parseInt(hours), parseInt(minutes));
                            handleDateSelect(newDate, 'start');
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-2">
                  <Label>End Time</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {taskForm.endTime ? moment(taskForm.endTime).format('MMM D, YYYY h:mm A') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarPicker
                        mode="single"
                        selected={taskForm.endTime}
                        onSelect={(date) => handleDateSelect(date, 'end')}
                        initialFocus
                      />
                      <div className="p-3 border-t">
                        <Label htmlFor="edit-endTime">Time</Label>
                        <Input
                          id="edit-endTime"
                          type="time"
                          value={taskForm.endTime ? moment(taskForm.endTime).format('HH:mm') : ''}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(':');
                            const newDate = taskForm.endTime ? new Date(taskForm.endTime) : new Date();
                            newDate.setHours(parseInt(hours), parseInt(minutes));
                            handleDateSelect(newDate, 'end');
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-4">
                  <Label>LangChain Tools</Label>
                  <ScrollArea className="h-40 w-full border rounded-md p-4">
                    <div className="space-y-2">
                      {toolsLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-start space-x-2">
                            <Skeleton className="h-4 w-4 mt-1" />
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-40" />
                              <Skeleton className="h-3 w-60" />
                            </div>
                          </div>
                        ))
                      ) : tools && tools.length > 0 ? (
                        tools.map(tool => (
                          <div key={tool.id} className="flex items-start space-x-2">
                            <Checkbox
                              id={`edit-tool-${tool.id}`}
                              checked={(taskForm.tools || []).includes(tool.name)}
                              onCheckedChange={(checked) => 
                                handleToolToggle(tool.name, checked === true)
                              }
                            />
                            <div className="space-y-1">
                              <Label
                                htmlFor={`edit-tool-${tool.id}`}
                                className="font-medium"
                              >
                                {tool.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">{tool.description}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No tools available</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditTaskOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitTask}>Update Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Task Details Dialog */}
        <Dialog open={isTaskDetailsOpen} onOpenChange={setIsTaskDetailsOpen}>
          {selectedTask && (
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{selectedTask.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className={getStatusBadgeColor(selectedTask.status)}>
                    {selectedTask.status}
                  </Badge>
                  <Badge variant={selectedTask.priority === 'high' ? 'destructive' : selectedTask.priority === 'medium' ? 'secondary' : 'outline'}>
                    {selectedTask.priority}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                </div>
                {selectedTask.startTime && (
                  <div>
                    <h4 className="font-medium mb-1">Scheduled Time</h4>
                    <p className="text-sm text-muted-foreground">
                      {moment(selectedTask.startTime).format('MMMM D, YYYY h:mm A')} to{' '}
                      {selectedTask.endTime ? moment(selectedTask.endTime).format('h:mm A') : 'Not specified'}
                    </p>
                  </div>
                )}
                {selectedTask.tools && selectedTask.tools.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-1">Tools</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.tools.map(tool => (
                        <Badge key={tool} variant="secondary">{tool}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedTask.result && (
                  <div>
                    <h4 className="font-medium mb-1">Result</h4>
                    <ScrollArea className="h-40 w-full border rounded-md p-4">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {typeof selectedTask.result === 'object' 
                          ? JSON.stringify(selectedTask.result, null, 2) 
                          : selectedTask.result}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </div>
              <DialogFooter className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => handleEditTask(selectedTask)}>
                    <Edit className="h-4 w-4" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-1" onClick={() => deleteTaskMutation.mutate(selectedTask.id)}>
                    <Trash className="h-4 w-4" /> Delete
                  </Button>
                </div>
                <div className="space-x-2">
                  {selectedTask.status === 'pending' && (
                    <Button size="sm" className="gap-1" onClick={() => handleStatusChange(selectedTask.id, 'execute')}>
                      <Play className="h-4 w-4" /> Run Now
                    </Button>
                  )}
                  {selectedTask.status === 'running' && (
                    <Button variant="destructive" size="sm" className="gap-1" onClick={() => handleStatusChange(selectedTask.id, 'stop')}>
                      <Square className="h-4 w-4" /> Stop
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setIsTaskDetailsOpen(false)}>Close</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </SharedLayout>
  );
};

export default TaskSchedulerPage;