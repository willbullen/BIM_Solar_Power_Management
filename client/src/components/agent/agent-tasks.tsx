import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ClipboardList,
  Plus,
  Calendar,
  RefreshCw,
  Check,
  X,
  Clock,
  AlertCircle,
  ArrowUpDown,
  Ban,
  Play,
  Pause
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface AgentTask {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  assignedTo: number | null;
  scheduledFor: string | null;
  completedAt: string | null;
  parameters: Record<string, any>;
  result?: any;
}

export function AgentTasks() {
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    description: '',
    type: 'analysis',
    priority: 'medium',
    scheduledFor: '',
    parameters: {}
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch tasks
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['/api/agent/tasks'],
    select: (data) => data as AgentTask[]
  });
  
  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<AgentTask, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'assignedTo' | 'completedAt' | 'result'>) => {
      return await apiRequest('/api/agent/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/tasks'] });
      setNewTaskDialogOpen(false);
      setNewTaskData({
        title: '',
        description: '',
        type: 'analysis',
        priority: 'medium',
        scheduledFor: '',
        parameters: {}
      });
      
      toast({
        title: 'Task created',
        description: 'New task has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating task',
        description: 'Failed to create the task. Please try again.',
        variant: 'destructive',
      });
    }
  });
  
  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number, status: string }) => {
      return await apiRequest(`/api/agent/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/tasks'] });
      toast({
        title: 'Task updated',
        description: 'Task status has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating task',
        description: 'Failed to update the task status. Please try again.',
        variant: 'destructive',
      });
    }
  });
  
  // Create new task
  const handleCreateTask = () => {
    // Validate required fields
    if (!newTaskData.title.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Please provide a title for the task.',
        variant: 'destructive',
      });
      return;
    }
    
    // Convert date string to proper format if provided
    const taskData = {
      ...newTaskData,
      status: 'pending',
      scheduledFor: newTaskData.scheduledFor ? new Date(newTaskData.scheduledFor).toISOString() : null
    };
    
    createTaskMutation.mutate(taskData);
  };
  
  // Update task status
  const handleUpdateTaskStatus = (taskId: number, newStatus: string) => {
    updateTaskStatusMutation.mutate({ taskId, status: newStatus });
  };
  
  // Get tasks filtered by status
  const getFilteredTasks = () => {
    if (!tasks) return [];
    
    if (statusFilter === 'all') {
      return tasks;
    }
    
    return tasks.filter(task => task.status === statusFilter);
  };
  
  // Get badge variant based on priority
  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };
  
  // Get badge for task status
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="flex items-center gap-1"><Play className="h-3 w-3" /> In Progress</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1"><X className="h-3 w-3" /> Failed</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Scheduled</Badge>;
      case 'paused':
        return <Badge variant="outline" className="flex items-center gap-1"><Pause className="h-3 w-3" /> Paused</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="flex items-center gap-1"><Ban className="h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  // Get relative time for display
  const getRelativeTime = (dateString: string | null) => {
    if (!dateString) return '';
    
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };
  
  return (
    <Card className="w-full shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Agent Tasks
          </CardTitle>
          <Dialog open={newTaskDialogOpen} onOpenChange={setNewTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Create a new task for the AI agent to execute.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">Title</Label>
                  <Input
                    id="title"
                    value={newTaskData.title}
                    onChange={(e) => setNewTaskData({...newTaskData, title: e.target.value})}
                    className="col-span-3"
                    placeholder="Task title"
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">Description</Label>
                  <Textarea
                    id="description"
                    value={newTaskData.description}
                    onChange={(e) => setNewTaskData({...newTaskData, description: e.target.value})}
                    className="col-span-3"
                    placeholder="Describe the task"
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">Type</Label>
                  <Select
                    value={newTaskData.type}
                    onValueChange={(value) => setNewTaskData({...newTaskData, type: value})}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select task type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="analysis">Analysis</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="optimization">Optimization</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="scheduled_report">Scheduled Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="priority" className="text-right">Priority</Label>
                  <Select
                    value={newTaskData.priority}
                    onValueChange={(value) => setNewTaskData({...newTaskData, priority: value})}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="scheduledFor" className="text-right">Schedule For</Label>
                  <Input
                    id="scheduledFor"
                    type="datetime-local"
                    value={newTaskData.scheduledFor}
                    onChange={(e) => setNewTaskData({...newTaskData, scheduledFor: e.target.value})}
                    className="col-span-3"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleCreateTask}
                  disabled={createTaskMutation.isPending}
                >
                  {createTaskMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Task'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription className="flex justify-between items-center">
          <span>View and manage AI agent tasks</span>
          
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-32 text-center px-4">
              <ClipboardList className="h-10 w-10 mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No tasks found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create new tasks for the AI agent to execute
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredTasks().map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      <div>
                        {task.title}
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {task.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{task.type}</TableCell>
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        {formatDate(task.createdAt)}
                        <p className="text-muted-foreground">
                          {getRelativeTime(task.createdAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {task.status === 'pending' && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                            disabled={updateTaskStatusMutation.isPending}
                            title="Start Task"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {task.status === 'in_progress' && (
                          <>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                              disabled={updateTaskStatusMutation.isPending}
                              title="Mark as Completed"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleUpdateTaskStatus(task.id, 'paused')}
                              disabled={updateTaskStatusMutation.isPending}
                              title="Pause Task"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        {task.status === 'paused' && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                            disabled={updateTaskStatusMutation.isPending}
                            title="Resume Task"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {(task.status === 'pending' || task.status === 'scheduled' || task.status === 'paused') && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleUpdateTaskStatus(task.id, 'cancelled')}
                            disabled={updateTaskStatusMutation.isPending}
                            title="Cancel Task"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="pt-2 text-xs text-muted-foreground">
        {tasks ? `${tasks.length} tasks found` : 'Loading tasks...'}
      </CardFooter>
    </Card>
  );
}