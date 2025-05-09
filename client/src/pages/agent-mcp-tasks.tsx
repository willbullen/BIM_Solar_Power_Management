import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, RefreshCw, Calendar, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Import MCP schemas
import { 
  mcpTaskCreateSchema, 
  mcpTaskStatusUpdateSchema,
  mcpTaskFilterSchema,
  type McpTaskCreate
} from "@/lib/mcp-schemas";

export function AgentMcpTasksPage() {
  const { toast } = useToast();
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  
  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    queryFn: getQueryFn({ on401: 'ignore' })
  });
  
  // Fetch MCP tasks with filtering
  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['/api/agent/mcp/tasks', { status: activeTab !== 'all' ? activeTab : undefined }],
    queryFn: getQueryFn({ on401: 'ignore' }),
  });
  
  // Fetch MCP capabilities
  const { data: capabilities, isLoading: isLoadingCapabilities } = useQuery({
    queryKey: ['/api/agent/mcp/capabilities'],
    queryFn: getQueryFn({ on401: 'ignore' }),
  });
  
  // Fetch single task detail
  const { data: taskDetail, isLoading: isLoadingTaskDetail, refetch: refetchTaskDetail } = useQuery({
    queryKey: ['/api/agent/mcp/tasks', activeTaskId],
    queryFn: getQueryFn({ on401: 'ignore' }),
    enabled: activeTaskId !== null,
  });
  
  // Create new task form
  const createTaskForm = useForm<McpTaskCreate>({
    resolver: zodResolver(mcpTaskCreateSchema),
    defaultValues: {
      name: "",
      description: "",
      capability: "",
      provider: "openai",
      parameters: {},
      priority: "medium",
      scheduledFor: null,
      parentTaskId: null,
    },
  });
  
  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: McpTaskCreate) => {
      return await apiRequest('/api/agent/mcp/tasks', {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/mcp/tasks'] });
      setIsCreateDialogOpen(false);
      createTaskForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create task",
        description: error.message || "There was an error creating your task.",
        variant: "destructive",
      });
    },
  });
  
  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number, status: string }) => {
      return await apiRequest(`/api/agent/mcp/tasks/${taskId}/status`, {
        method: 'PATCH',
        data: { status },
      });
    },
    onSuccess: () => {
      toast({
        title: "Task status updated",
        description: "The task status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/mcp/tasks'] });
      if (activeTaskId) {
        refetchTaskDetail();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update task status",
        description: error.message || "There was an error updating the task status.",
        variant: "destructive",
      });
    },
  });
  
  // Execute task manually mutation
  const executeTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest(`/api/agent/mcp/tasks/${taskId}/execute`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Task execution started",
        description: "The task is now being executed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/mcp/tasks'] });
      if (activeTaskId) {
        refetchTaskDetail();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to execute task",
        description: error.message || "There was an error executing the task.",
        variant: "destructive",
      });
    },
  });
  
  // Update form when capability is selected
  useEffect(() => {
    const capability = createTaskForm.watch('capability');
    if (capability && capabilities) {
      const selected = capabilities.find((c) => c.name === capability);
      if (selected) {
        // Pre-populate parameters with default structure based on capability
        createTaskForm.setValue('parameters', selected.parameters || {});
      }
    }
  }, [createTaskForm.watch('capability'), capabilities]);
  
  // Handle task submission
  const onSubmitTask = (data: McpTaskCreate) => {
    createTaskMutation.mutate(data);
  };
  
  // Handle viewing a task
  const handleViewTask = (taskId: number) => {
    setActiveTaskId(taskId);
    setIsViewDialogOpen(true);
  };
  
  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };
  
  // Get status badge variant based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { variant: 'secondary', label: 'Pending' };
      case 'scheduled':
        return { variant: 'outline', label: 'Scheduled' };
      case 'in-progress':
        return { variant: 'default', label: 'In Progress' };
      case 'completed':
        return { variant: 'success', label: 'Completed' };
      case 'failed':
        return { variant: 'destructive', label: 'Failed' };
      case 'canceled':
        return { variant: 'outline', label: 'Canceled' };
      default:
        return { variant: 'secondary', label: status };
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Model Context Protocol Tasks</h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button 
            size="sm" 
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>
      
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="w-full"
      >
        <TabsList className="grid grid-cols-6 mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab}>
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <p className="text-muted-foreground mb-4">No tasks found</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first task
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Capability</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          <div 
                            className="cursor-pointer hover:underline" 
                            onClick={() => handleViewTask(task.id)}
                          >
                            {task.name}
                          </div>
                        </TableCell>
                        <TableCell>{task.capability}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={getStatusBadge(task.status).variant as any}
                          >
                            {getStatusBadge(task.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              task.priority === 'critical' ? 'destructive' : 
                              task.priority === 'high' ? 'default' :
                              task.priority === 'medium' ? 'secondary' : 'outline'
                            }
                          >
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatRelativeTime(task.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewTask(task.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Create a new MCP task for AI processing
            </DialogDescription>
          </DialogHeader>
          <Form {...createTaskForm}>
            <form onSubmit={createTaskForm.handleSubmit(onSubmitTask)} className="space-y-4">
              <FormField
                control={createTaskForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter task name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createTaskForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What should the AI do?" 
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createTaskForm.control}
                name="capability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capability</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select capability" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingCapabilities ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : capabilities?.map(capability => (
                          <SelectItem 
                            key={capability.name} 
                            value={capability.name}
                          >
                            {capability.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the AI capability to use for this task
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createTaskForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
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
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createTaskMutation.isPending}
                >
                  {createTaskMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Task
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* View Task Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          {isLoadingTaskDetail || !taskDetail ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>{taskDetail.name}</DialogTitle>
                  <Badge 
                    variant={getStatusBadge(taskDetail.status).variant as any}
                    className="ml-auto"
                  >
                    {getStatusBadge(taskDetail.status).label}
                  </Badge>
                </div>
                <DialogDescription>
                  Task ID: {taskDetail.id} • Created {formatRelativeTime(taskDetail.createdAt)}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {taskDetail.description}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div>
                      <h4 className="font-medium">Capability</h4>
                      <p className="text-muted-foreground">{taskDetail.capability}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Provider</h4>
                      <p className="text-muted-foreground">{taskDetail.provider}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Priority</h4>
                      <p className="text-muted-foreground">
                        <Badge 
                          variant={
                            taskDetail.priority === 'critical' ? 'destructive' : 
                            taskDetail.priority === 'high' ? 'default' :
                            taskDetail.priority === 'medium' ? 'secondary' : 'outline'
                          }
                          className="mt-1"
                        >
                          {taskDetail.priority.charAt(0).toUpperCase() + taskDetail.priority.slice(1)}
                        </Badge>
                      </p>
                    </div>
                    {taskDetail.scheduledFor && (
                      <div>
                        <h4 className="font-medium">Scheduled For</h4>
                        <p className="text-muted-foreground">
                          {new Date(taskDetail.scheduledFor).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-1">Status History</h4>
                    <div className="text-sm">
                      <div className="flex items-center text-muted-foreground mb-1">
                        <span className="w-24">Created:</span>
                        <span>{new Date(taskDetail.createdAt).toLocaleString()}</span>
                      </div>
                      {taskDetail.startedAt && (
                        <div className="flex items-center text-muted-foreground mb-1">
                          <span className="w-24">Started:</span>
                          <span>{new Date(taskDetail.startedAt).toLocaleString()}</span>
                        </div>
                      )}
                      {taskDetail.completedAt && (
                        <div className="flex items-center text-muted-foreground mb-1">
                          <span className="w-24">Completed:</span>
                          <span>{new Date(taskDetail.completedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {taskDetail.result && (
                    <div>
                      <h4 className="font-medium mb-1">Result</h4>
                      <pre className="bg-secondary p-2 rounded text-xs overflow-auto max-h-[200px]">
                        {typeof taskDetail.result === 'string' 
                          ? taskDetail.result 
                          : JSON.stringify(taskDetail.result, null, 2)
                        }
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <div className="flex items-center space-x-2">
                  {taskDetail.status === 'pending' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => executeTaskMutation.mutate(taskDetail.id)}
                      disabled={executeTaskMutation.isPending}
                    >
                      {executeTaskMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Execute Now
                    </Button>
                  )}
                  
                  {(taskDetail.status === 'pending' || taskDetail.status === 'scheduled') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateTaskStatusMutation.mutate({ 
                        taskId: taskDetail.id, 
                        status: 'canceled' 
                      })}
                      disabled={updateTaskStatusMutation.isPending}
                    >
                      {updateTaskStatusMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Cancel Task
                    </Button>
                  )}
                </div>
                
                <Button 
                  variant="ghost" 
                  onClick={() => setIsViewDialogOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}