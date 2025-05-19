import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, momentLocalizer, Views, SlotInfo, EventProps } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

// Define task status types
const taskStatusColors = {
  pending: 'bg-yellow-200 text-yellow-800 border-yellow-500',
  running: 'bg-blue-200 text-blue-800 border-blue-500',
  completed: 'bg-green-200 text-green-800 border-green-500',
  failed: 'bg-red-200 text-red-800 border-red-500',
};

// Custom event component for tasks
const TaskEvent = ({ event }: EventProps) => {
  const statusColor = taskStatusColors[event.status as keyof typeof taskStatusColors] || 'bg-gray-200';
  
  return (
    <div className={`h-full p-1 overflow-hidden rounded border ${statusColor}`}>
      <div className="text-sm font-medium">{event.title}</div>
      <div className="text-xs">
        <Badge variant="outline" className="text-xs">
          {event.status}
        </Badge>
      </div>
    </div>
  );
};

// Define form data type for task creation/editing
interface TaskFormData {
  id?: number;
  title: string;
  description: string;
  agentId: number;
  startTime: string;
  endTime: string;
  priority: string;
  tools: string[];
  status?: string;
}

// Main TaskScheduler component
const TaskSchedulerPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for modal dialogs
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    agentId: 0,
    startTime: '',
    endTime: '',
    priority: 'medium',
    tools: [],
  });
  
  // Fetch tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['/api/langchain/tasks'],
    enabled: true,
  });
  
  // Fetch agents
  const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ['/api/langchain/agents'],
    enabled: true,
  });
  
  // Fetch tools
  const { data: availableTools = [], isLoading: isLoadingTools } = useQuery({
    queryKey: ['/api/langchain/tools'],
    enabled: true,
  });
  
  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (taskData: TaskFormData) => {
      return apiRequest('/api/langchain/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Task created',
        description: 'The task has been created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
      resetForm();
      setIsTaskFormOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating task',
        description: error.message || 'Failed to create task',
        variant: 'destructive',
      });
    },
  });
  
  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: (taskData: TaskFormData) => {
      return apiRequest(`/api/langchain/tasks/${taskData.id}`, {
        method: 'PUT',
        body: JSON.stringify(taskData),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Task updated',
        description: 'The task has been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
      resetForm();
      setIsTaskFormOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating task',
        description: error.message || 'Failed to update task',
        variant: 'destructive',
      });
    },
  });
  
  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => {
      return apiRequest(`/api/langchain/tasks/${taskId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Task deleted',
        description: 'The task has been deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
      setIsDeleteDialogOpen(false);
      setSelectedTask(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting task',
        description: error.message || 'Failed to delete task',
        variant: 'destructive',
      });
    },
  });
  
  // Execute task mutation
  const executeTaskMutation = useMutation({
    mutationFn: (taskId: number) => {
      return apiRequest(`/api/langchain/tasks/${taskId}/execute`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Task execution started',
        description: 'The task execution has started',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error executing task',
        description: error.message || 'Failed to execute task',
        variant: 'destructive',
      });
    },
  });
  
  // Stop task mutation
  const stopTaskMutation = useMutation({
    mutationFn: (taskId: number) => {
      return apiRequest(`/api/langchain/tasks/${taskId}/stop`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Task stopped',
        description: 'The task has been stopped',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tasks'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error stopping task',
        description: error.message || 'Failed to stop task',
        variant: 'destructive',
      });
    },
  });
  
  // Handle slot selection for task creation
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setFormData({
      title: '',
      description: '',
      agentId: agents.length > 0 ? agents[0].id : 0,
      startTime: moment(slotInfo.start).format('YYYY-MM-DDTHH:mm'),
      endTime: moment(slotInfo.end).format('YYYY-MM-DDTHH:mm'),
      priority: 'medium',
      tools: [],
    });
    setSelectedTask(null);
    setIsTaskFormOpen(true);
  }, [agents]);
  
  // Handle event selection for task editing
  const handleSelectEvent = useCallback((event: any) => {
    setSelectedTask(event);
    
    // Format task data for the form
    setFormData({
      id: event.id,
      title: event.title,
      description: event.description || '',
      agentId: event.agentId,
      startTime: moment(event.start).format('YYYY-MM-DDTHH:mm'),
      endTime: moment(event.end).format('YYYY-MM-DDTHH:mm'),
      priority: event.priority || 'medium',
      tools: event.tools || [],
      status: event.status,
    });
    
    setIsTaskFormOpen(true);
  }, []);
  
  // Reset form data
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      agentId: agents.length > 0 ? agents[0].id : 0,
      startTime: '',
      endTime: '',
      priority: 'medium',
      tools: [],
    });
    setSelectedTask(null);
  };
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle tool selection
  const handleToolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    
    setFormData(prev => {
      if (checked) {
        return { ...prev, tools: [...prev.tools, value] };
      } else {
        return { ...prev, tools: prev.tools.filter(tool => tool !== value) };
      }
    });
  };
  
  // Handle form submission
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedTask) {
      // Update existing task
      updateTaskMutation.mutate(formData);
    } else {
      // Create new task
      createTaskMutation.mutate(formData);
    }
  };
  
  // Handle task execution
  const handleExecuteTask = (taskId: number) => {
    executeTaskMutation.mutate(taskId);
    setIsTaskFormOpen(false);
  };
  
  // Handle task stopping
  const handleStopTask = (taskId: number) => {
    stopTaskMutation.mutate(taskId);
    setIsTaskFormOpen(false);
  };
  
  // Handle task deletion
  const handleDeleteTask = () => {
    if (selectedTask) {
      deleteTaskMutation.mutate(selectedTask.id);
    }
  };
  
  // Confirm task deletion
  const confirmDeleteTask = () => {
    setIsDeleteDialogOpen(true);
  };
  
  // Convert tasks to calendar events
  const events = tasks.map((task: any) => {
    // Parse startTime and endTime from task data
    const startTime = task.data?.startTime ? new Date(task.data.startTime) : new Date();
    const endTime = task.data?.endTime ? new Date(task.data.endTime) : new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour default
    
    return {
      id: task.id,
      title: task.task,
      start: startTime,
      end: endTime,
      description: task.data?.description,
      agentId: task.agentId,
      status: task.status,
      priority: task.data?.priority || 'medium',
      tools: task.data?.tools || [],
      result: task.result,
    };
  });
  
  if (isLoadingTasks || isLoadingAgents || isLoadingTools) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Scheduler</h1>
        <Button onClick={() => {
          resetForm();
          setSelectedTask(null);
          setIsTaskFormOpen(true);
        }}>
          Create Task
        </Button>
      </div>
      
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="h-[600px]">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            defaultView={Views.WEEK}
            views={['day', 'week', 'month']}
            step={15}
            timeslots={4}
            components={{
              event: TaskEvent,
            }}
            popup
          />
        </div>
      </div>
      
      {/* Task Form Dialog */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
            <DialogDescription>
              {selectedTask 
                ? 'Edit the details of your task below.' 
                : 'Fill in the details to create a new task.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleFormSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="col-span-3"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="col-span-3"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="agentId" className="text-right">
                  Agent
                </Label>
                <Select
                  value={formData.agentId.toString()}
                  onValueChange={(value) => handleSelectChange('agentId', value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="startTime" className="text-right">
                  Start Time
                </Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  required
                  className="col-span-3"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endTime" className="text-right">
                  End Time
                </Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  required
                  className="col-span-3"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="priority" className="text-right">
                  Priority
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => handleSelectChange('priority', value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Tools</Label>
                <div className="col-span-3 space-y-2">
                  {availableTools.map((tool: any) => (
                    <div key={tool.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`tool-${tool.id}`}
                        value={tool.name}
                        checked={formData.tools.includes(tool.name)}
                        onChange={handleToolChange}
                      />
                      <label htmlFor={`tool-${tool.id}`} className="text-sm">
                        {tool.name} - {tool.description}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedTask && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Status</Label>
                  <div className="col-span-3">
                    <Badge
                      className={taskStatusColors[selectedTask.status as keyof typeof taskStatusColors]}
                    >
                      {selectedTask.status}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter className="flex justify-between">
              {selectedTask && (
                <div className="flex space-x-2">
                  {selectedTask.status === 'running' ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleStopTask(selectedTask.id)}
                    >
                      Stop Task
                    </Button>
                  ) : (
                    selectedTask.status !== 'completed' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleExecuteTask(selectedTask.id)}
                      >
                        Execute Now
                      </Button>
                    )
                  )}
                  <Button 
                    type="button" 
                    variant="destructive"
                    onClick={confirmDeleteTask}
                  >
                    Delete
                  </Button>
                </div>
              )}
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsTaskFormOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedTask ? 'Update Task' : 'Create Task'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskSchedulerPage;