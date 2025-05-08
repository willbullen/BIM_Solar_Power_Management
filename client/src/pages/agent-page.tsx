import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import SharedLayout from "@/components/ui/shared-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Send, Bot, MessageSquare, ListChecks, Settings } from "lucide-react";

// Message types
interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  result: any;
  createdAt: string;
  updatedAt: string;
}

function ConversationsList({ onSelect, selectedId }: { onSelect: (id: number) => void, selectedId?: number }) {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['/api/agent/conversations'],
    retry: false
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-2 p-2">
      {conversations && conversations.length > 0 ? (
        conversations.map((conversation: Conversation) => (
          <div
            key={conversation.id}
            className={`p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${selectedId === conversation.id ? 'bg-muted' : ''}`}
            onClick={() => onSelect(conversation.id)}
          >
            <div className="font-medium">{conversation.title}</div>
            <div className="text-xs text-muted-foreground">{new Date(conversation.updatedAt).toLocaleString()}</div>
          </div>
        ))
      ) : (
        <div className="text-center text-muted-foreground p-4">No conversations yet</div>
      )}
    </div>
  );
}

function ChatInterface() {
  const [input, setInput] = useState("");
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations } = useQuery({
    queryKey: ['/api/agent/conversations'],
    retry: false
  });

  // Fetch messages for the active conversation
  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = useQuery({
    queryKey: ['/api/agent/conversations', activeConversation, 'messages'],
    enabled: !!activeConversation,
    retry: false
  });

  // Create a new conversation
  const createConversation = useMutation({
    mutationFn: (title: string) => apiRequest('/api/agent/conversations', {
      method: 'POST',
      body: JSON.stringify({ title })
    }),
    onSuccess: (data) => {
      setActiveConversation(data.id);
      refetchConversations();
      toast({
        title: "Conversation created",
        description: "Your new conversation has been started."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create a new conversation."
      });
    }
  });

  // Send a message
  const sendMessage = useMutation({
    mutationFn: (content: string) => apiRequest(`/api/agent/conversations/${activeConversation}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    }),
    onSuccess: () => {
      setInput("");
      refetchMessages();
      // Refetch after a short delay to get the AI response
      setTimeout(() => {
        refetchMessages();
      }, 2000);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message."
      });
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;

    if (!activeConversation) {
      createConversation.mutate(`Conversation ${new Date().toLocaleString()}`);
      // We'll send the message after the conversation is created and activeConversation is set
      return;
    }

    sendMessage.mutate(input);
  };

  // Wait until the conversation is created, then send the message
  useEffect(() => {
    if (activeConversation && input && !sendMessage.isPending && !createConversation.isPending) {
      sendMessage.mutate(input);
    }
  }, [activeConversation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewConversation = () => {
    setActiveConversation(null);
    setInput("");
    createConversation.mutate(`Conversation ${new Date().toLocaleString()}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full">
      {/* Sidebar with conversation list */}
      <Card className="md:col-span-1 h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex justify-between items-center">
            Conversations
            <Button variant="outline" size="sm" onClick={startNewConversation}>
              New
            </Button>
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <ConversationsList 
            onSelect={setActiveConversation} 
            selectedId={activeConversation || undefined} 
          />
        </ScrollArea>
      </Card>

      {/* Chat area */}
      <Card className="md:col-span-3 h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle>AI Agent Architect</CardTitle>
          <CardDescription>
            Ask questions about energy data, get recommendations, or request analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col h-full p-0">
          <ScrollArea className="flex-grow p-4">
            {activeConversation ? (
              loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((message: Message) => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {sendMessage.isPending && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Bot size={48} />
                  <p className="mt-2">Ask me anything about your energy data!</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                {createConversation.isPending ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <>
                    <Bot size={48} />
                    <p className="mt-2">Start a new conversation to chat with the AI agent</p>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={!activeConversation && !input.trim()}
              />
              <Button 
                onClick={handleSend} 
                disabled={(!activeConversation && !input.trim()) || sendMessage.isPending || createConversation.isPending}
              >
                {sendMessage.isPending || createConversation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TasksInterface() {
  const { toast } = useToast();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");

  // Fetch tasks
  const { data: tasks, isLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['/api/agent/tasks'],
    retry: false
  });

  // Create a new task
  const createTask = useMutation({
    mutationFn: (taskData: { title: string; description: string }) => 
      apiRequest('/api/agent/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      }),
    onSuccess: () => {
      setNewTaskTitle("");
      setNewTaskDescription("");
      refetchTasks();
      toast({
        title: "Task created",
        description: "Your new task has been created and assigned to the AI agent."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create a new task."
      });
    }
  });

  // Update task status
  const updateTaskStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      apiRequest(`/api/agent/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }),
    onSuccess: () => {
      refetchTasks();
      toast({
        title: "Task updated",
        description: "The task status has been updated."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update task status."
      });
    }
  });

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    
    createTask.mutate({
      title: newTaskTitle,
      description: newTaskDescription
    });
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-200 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-200 text-blue-800';
      case 'completed':
        return 'bg-green-200 text-green-800';
      case 'failed':
        return 'bg-red-200 text-red-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  // Format priority
  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge>Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create a New Task</CardTitle>
          <CardDescription>
            Assign tasks to the AI agent for automated processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="task-title" className="text-sm font-medium">
                Task Title
              </label>
              <Input
                id="task-title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g., Analyze power usage patterns for April"
              />
            </div>
            <div>
              <label htmlFor="task-description" className="text-sm font-medium">
                Task Description (optional)
              </label>
              <Input
                id="task-description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Provide any additional details for the task"
              />
            </div>
            <Button 
              onClick={handleCreateTask} 
              disabled={!newTaskTitle.trim() || createTask.isPending}
              className="w-full"
            >
              {createTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Task
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task List</CardTitle>
          <CardDescription>
            View and manage AI agent tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : tasks && tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task: Task) => (
                <Card key={task.id} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium">{task.title}</h3>
                      {getPriorityBadge(task.priority)}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <Badge variant="outline" className={getStatusColor(task.status)}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-muted-foreground">
                        Created: {new Date(task.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    {task.result && (
                      <>
                        <Separator className="my-3" />
                        <div>
                          <h4 className="text-sm font-medium mb-1">Result:</h4>
                          <div className="text-sm p-2 bg-muted rounded-md whitespace-pre-wrap">
                            {typeof task.result === 'string' 
                              ? task.result 
                              : JSON.stringify(task.result, null, 2)
                            }
                          </div>
                        </div>
                      </>
                    )}
                    
                    {task.status === 'pending' && (
                      <div className="mt-3 flex justify-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateTaskStatus.mutate({ id: task.id, status: 'cancelled' })}
                          disabled={updateTaskStatus.isPending}
                        >
                          Cancel Task
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-6 text-muted-foreground">
              No tasks found. Create a new task to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentSettingsInterface() {
  const { toast } = useToast();
  
  // Fetch settings
  const { data: settings, isLoading, refetch: refetchSettings } = useQuery({
    queryKey: ['/api/agent/settings'],
    retry: false
  });
  
  // Update setting
  const updateSetting = useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) => 
      apiRequest(`/api/agent/settings/${name}`, {
        method: 'PATCH',
        body: JSON.stringify({ value })
      }),
    onSuccess: () => {
      refetchSettings();
      toast({
        title: "Setting updated",
        description: "The agent setting has been updated successfully."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update setting."
      });
    }
  });
  
  const handleUpdateSetting = (name: string, value: string) => {
    updateSetting.mutate({ name, value });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Settings</CardTitle>
        <CardDescription>
          Configure the AI agent's behavior and capabilities
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : settings && settings.length > 0 ? (
          <div className="space-y-6">
            {settings.map((setting: any) => (
              <div key={setting.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor={setting.name} className="text-sm font-medium">
                    {setting.name.split('_').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </label>
                  {updateSetting.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <Input
                  id={setting.name}
                  defaultValue={setting.value}
                  onBlur={(e) => handleUpdateSetting(setting.name, e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{setting.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 text-muted-foreground">
            No settings found.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AgentPage() {
  const { user } = useAuth();
  
  return (
    <SharedLayout user={user}>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">AI Agent Architect</h1>
        </div>
        
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="flex items-center justify-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center justify-center">
              <ListChecks className="h-4 w-4 mr-2" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center justify-center">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat" className="mt-6">
            <ChatInterface />
          </TabsContent>
          
          <TabsContent value="tasks" className="mt-6">
            <TasksInterface />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <AgentSettingsInterface />
          </TabsContent>
        </Tabs>
      </div>
    </SharedLayout>
  );
}