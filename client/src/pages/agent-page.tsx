import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, UseQueryOptions } from "@tanstack/react-query";
import SharedLayout from "@/components/ui/shared-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { 
  Loader2, Send, Bot, MessageSquare, ListChecks, Settings, Plus, 
  CheckCircle, Database, MessageSquarePlus, ArrowRight, BarChart,
  Zap, CloudSun, Sun, CheckCheck, Calendar, Cpu, Key, Thermometer,
  BookOpen, FileText, Code2, BellRing, Settings2, PencilLine,
  Sparkles, Info as InfoIcon, ExternalLink, ClipboardList
} from "lucide-react";
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newConversationTitle, setNewConversationTitle] = useState("");
  const [isCreatingNewConversation, setIsCreatingNewConversation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scroll to the bottom of the messages
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Fetch conversations - only enable if user is authenticated
  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations, error: conversationsError } = useQuery({
    queryKey: ['/api/agent/conversations'],
    retry: false,
    enabled: !!user, // Only run the query if user is authenticated
    onError: (error) => {
      console.error('Error fetching conversations:', error);
      if (error.message.includes('401')) {
        // If we get a 401, try refreshing the user data
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Your session may have expired. Please refresh and log in again."
        });
      }
    }
  });

  // Fetch messages for the active conversation
  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = useQuery({
    queryKey: ['/api/agent/conversations', activeConversation, 'messages'],
    enabled: !!activeConversation,
    retry: false
  });

  // Create a new conversation
  const createConversation = useMutation({
    mutationFn: (title: string) => 
      apiRequest('POST', '/api/agent/conversations', { title }),
    onSuccess: (data) => {
      refetchConversations();
      setActiveConversation(data.id);
      setIsCreatingNewConversation(false);
      setNewConversationTitle("");
      toast({
        title: "Conversation created",
        description: "Your new conversation has been created."
      });
    },
    onError: (error: Error) => {
      console.error("Conversation creation error:", error);
      
      // Check if it's an authentication error
      if (error.message.includes("401")) {
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "You need to be logged in to create a conversation. Please log in and try again."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create a new conversation: " + error.message
        });
      }
    }
  });

  // Send a message
  const sendMessage = useMutation({
    mutationFn: (content: string) => 
      apiRequest('POST', `/api/agent/conversations/${activeConversation}/messages`, { content }),
    onSuccess: () => {
      setInput("");
      refetchMessages();
      setIsSubmitting(false);
      // Refetch after a short delay to get the AI response
      setTimeout(() => {
        refetchMessages();
        scrollToBottom();
      }, 1000);
    },
    onError: (error: Error) => {
      console.error("Send message error:", error);
      setIsSubmitting(false);
      
      if (error.message.includes("401")) {
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Your session may have expired. Please log in and try again."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to send message: " + error.message
        });
      }
    }
  });

  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeConversation || isSubmitting) return;
    
    setIsSubmitting(true);
    sendMessage.mutate(input);
  };

  // Handle creating a new conversation
  const handleCreateConversation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConversationTitle.trim()) return;
    
    createConversation.mutate(newConversationTitle);
  };

  // Start a new conversation
  const startNewConversation = () => {
    setIsCreatingNewConversation(true);
  };

  // Effect to automatically send message after conversation is created
  useEffect(() => {
    if (activeConversation && input && !isSubmitting && !createConversation.isPending) {
      setIsSubmitting(true);
      sendMessage.mutate(input);
    }
  }, [activeConversation, input, isSubmitting, createConversation.isPending]);

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Function to handle Enter key press for message sending
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (activeConversation) {
        handleSendMessage(e as any);
      } else {
        setIsCreatingNewConversation(true);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Sidebar with conversation list */}
      <Card className="md:col-span-1 h-[calc(80vh-7rem)] overflow-hidden bg-card rounded-lg border border-border shadow-md">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center space-x-1">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-md flex justify-between items-center w-full">
              Conversations
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>New Conversation</DialogTitle>
                    <DialogDescription>
                      Create a new conversation with the AI Agent Architect
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateConversation}>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Conversation Name</Label>
                        <Input
                          id="title"
                          value={newConversationTitle}
                          onChange={(e) => setNewConversationTitle(e.target.value)}
                          placeholder="e.g., Energy Optimization Plan"
                          className="col-span-3"
                          autoFocus
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createConversation.isPending || !newConversationTitle.trim()}>
                        {createConversation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Conversation'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1 h-full">
          <div className="p-2">
            {loadingConversations ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : conversations && conversations.length > 0 ? (
              <div className="space-y-2">
                {conversations.map((conversation: Conversation) => (
                  <div
                    key={conversation.id}
                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                      activeConversation === conversation.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setActiveConversation(conversation.id)}
                  >
                    <div className="font-medium">{conversation.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(conversation.updatedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-2 text-center space-y-4">
                <MessageSquarePlus className="h-10 w-10 text-muted-foreground/60" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={startNewConversation}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Start a conversation
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat area */}
      <Card className="md:col-span-3 h-[calc(80vh-7rem)] flex flex-col overflow-hidden bg-card rounded-lg border border-border shadow-md">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>AI Agent Architect</CardTitle>
                <CardDescription>
                  Ask questions about energy data, generate insights, or request analysis.
                </CardDescription>
              </div>
            </div>
            {activeConversation && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto">
                    <Database className="h-3.5 w-3.5 mr-2" />
                    Data Access
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Agent Database Access</h4>
                    <p className="text-sm text-muted-foreground">
                      This AI agent has secure access to your energy and environmental data for providing insights and recommendations.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Power Data</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Environmental</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Equipment</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Forecasting</span>
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          <ScrollArea className="h-full p-4">
            {activeConversation ? (
              loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-6">
                  {messages.map((message: Message) => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role !== 'user' && (
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarFallback className="bg-blue-100 text-blue-700">AI</AvatarFallback>
                        </Avatar>
                      )}
                      <div 
                        className={`max-w-[85%] px-4 py-3 rounded-lg ${
                          message.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-muted dark:bg-slate-800 rounded-tl-none'
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                        <div className={`mt-1 text-xs ${message.role === 'user' ? 'text-blue-100' : 'text-muted-foreground'}`}>
                          {new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                      {message.role === 'user' && (
                        <Avatar className="h-8 w-8 ml-2">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {message.role.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {sendMessage.isPending && (
                    <div className="flex justify-start">
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarFallback className="bg-blue-100 text-blue-700">AI</AvatarFallback>
                      </Avatar>
                      <div className="max-w-[85%] px-4 py-3 rounded-lg bg-muted dark:bg-slate-800 rounded-tl-none">
                        <div className="flex space-x-2">
                          <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900/30">
                    <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-lg font-semibold">Start a Conversation</h3>
                    <p className="text-muted-foreground">
                      Ask questions about energy usage patterns, request recommendations 
                      for optimization, or generate reports based on your data.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-sm w-full max-w-lg">
                    <div className="bg-muted p-2 rounded-lg">
                      "Analyze our energy consumption trends"
                    </div>
                    <div className="bg-muted p-2 rounded-lg">
                      "Suggest ways to optimize solar efficiency"
                    </div>
                    <div className="bg-muted p-2 rounded-lg">
                      "Generate a report on refrigeration usage"
                    </div>
                    <div className="bg-muted p-2 rounded-lg">
                      "Compare current to historical patterns"
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900/30">
                  <MessageSquarePlus className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-lg font-semibold">No Conversation Selected</h3>
                  <p className="text-muted-foreground">
                    Select an existing conversation from the sidebar or create a new one 
                    to start interacting with the AI Agent Architect.
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Conversation
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>New Conversation</DialogTitle>
                      <DialogDescription>
                        Create a new conversation with the AI Agent Architect
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateConversation}>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="conversation-title">Conversation Name</Label>
                          <Input
                            id="conversation-title"
                            value={newConversationTitle}
                            onChange={(e) => setNewConversationTitle(e.target.value)}
                            placeholder="e.g., Energy Optimization Plan"
                            className="col-span-3"
                            autoFocus
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={createConversation.isPending}>
                          {createConversation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            'Create Conversation'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </ScrollArea>
        </CardContent>
        
        <CardFooter className="border-t border-border p-4">
          <form onSubmit={handleSendMessage} className="flex w-full space-x-2">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeConversation ? "Type your message..." : "Select a conversation to start chatting"}
              disabled={!activeConversation || sendMessage.isPending || createConversation.isPending}
              className="flex-1 border-border focus-visible:ring-primary"
            />
            <Button 
              type="submit" 
              disabled={!activeConversation || !input.trim() || sendMessage.isPending || createConversation.isPending}
              className={!activeConversation || !input.trim() || sendMessage.isPending || createConversation.isPending ? "" : "bg-primary hover:bg-primary/90"}
            >
              {sendMessage.isPending || createConversation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardFooter>
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
      apiRequest('POST', '/api/agent/tasks', taskData),
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
      apiRequest('PATCH', `/api/agent/tasks/${id}/status`, { status }),
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
      <Card className="bg-card rounded-lg border border-border shadow-md">
        <CardHeader className="border-b border-border">
          <div className="flex items-center space-x-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Create a New Task</CardTitle>
              <CardDescription>
                Assign tasks to the AI agent for automated processing
              </CardDescription>
            </div>
          </div>
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

      <Card className="bg-card rounded-lg border border-border shadow-md">
        <CardHeader className="border-b border-border">
          <div className="flex items-center space-x-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Task List</CardTitle>
              <CardDescription>
                View and manage AI agent tasks
              </CardDescription>
            </div>
          </div>
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
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [settingValue, setSettingValue] = useState<string>("");
  
  // Fetch settings
  const { data: settings, isLoading, refetch: refetchSettings } = useQuery({
    queryKey: ['/api/agent/settings'],
    retry: false
  });
  
  // Update setting
  const updateSetting = useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) => 
      apiRequest('PATCH', `/api/agent/settings/${name}`, { value }),
    onSuccess: () => {
      refetchSettings();
      setEditingSetting(null);
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
  
  const handleUpdateSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSetting && settingValue.trim()) {
      updateSetting.mutate({ name: editingSetting, value: settingValue });
    }
  };

  const startEditing = (name: string, value: string) => {
    setEditingSetting(name);
    setSettingValue(value);
  };
  
  // Get setting icon based on name
  const getSettingIcon = (name: string) => {
    if (name.includes('model')) return <Cpu className="h-5 w-5 text-purple-500" />;
    if (name.includes('token')) return <Key className="h-5 w-5 text-amber-500" />;
    if (name.includes('temperature')) return <Thermometer className="h-5 w-5 text-orange-500" />;
    if (name.includes('context')) return <BookOpen className="h-5 w-5 text-blue-500" />;
    if (name.includes('prompt')) return <FileText className="h-5 w-5 text-indigo-500" />;
    if (name.includes('function')) return <Code2 className="h-5 w-5 text-emerald-500" />;
    if (name.includes('notification')) return <BellRing className="h-5 w-5 text-rose-500" />;
    return <Settings2 className="h-5 w-5 text-gray-500" />;
  };

  // Get setting category based on name prefix
  const getSettingCategory = (name: string) => {
    if (name.startsWith('model_')) return 'AI Model';
    if (name.startsWith('api_')) return 'API Configuration';
    if (name.includes('notification')) return 'Notifications';
    if (name.includes('function')) return 'Functions & Capabilities';
    return 'General Settings';
  };

  // Group settings by category
  const groupSettingsByCategory = (settings: any[]) => {
    const grouped: Record<string, any[]> = {};
    
    settings.forEach(setting => {
      const category = getSettingCategory(setting.name);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(setting);
    });
    
    return grouped;
  };
  
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20">
            <Settings2 className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Agent Configuration</h2>
            <p className="text-muted-foreground mt-1">
              Customize the AI agent's behavior, model settings, and capabilities
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 border rounded-lg bg-muted/10">
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
            <h3 className="text-lg font-medium">Loading settings...</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Retrieving AI agent configuration
            </p>
          </div>
        </div>
      ) : settings && settings.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupSettingsByCategory(settings)).map(([category, categorySettings]) => (
            <Card key={category} className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">{category}</CardTitle>
                <CardDescription>
                  {category === 'AI Model' && 'Configure the AI model parameters and behavior'}
                  {category === 'API Configuration' && 'Settings for external API connections'}
                  {category === 'Notifications' && 'Configure notification behaviors and thresholds'}
                  {category === 'Functions & Capabilities' && 'Manage agent capabilities and allowed functions'}
                  {category === 'General Settings' && 'General configuration options for the AI agent'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {categorySettings.map((setting: any) => (
                    <div key={setting.name} className="pb-5 border-b border-dashed border-slate-200 dark:border-slate-800 last:border-b-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mt-0.5">
                          {getSettingIcon(setting.name)}
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div>
                            <div className="flex items-center justify-between">
                              <label htmlFor={setting.name} className="font-medium">
                                {setting.name.split('_').map((word: string) => 
                                  word.charAt(0).toUpperCase() + word.slice(1)
                                ).join(' ')}
                              </label>
                              {editingSetting === setting.name ? (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => setEditingSetting(null)}
                                  className="h-7 px-2 text-muted-foreground"
                                >
                                  Cancel
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => startEditing(setting.name, setting.value)}
                                  className="h-7 px-2 text-blue-600 hover:text-blue-700 dark:text-blue-500"
                                >
                                  <PencilLine className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{setting.description}</p>
                          </div>
                          
                          {editingSetting === setting.name ? (
                            <form onSubmit={handleUpdateSetting} className="flex gap-2">
                              <Input
                                id={setting.name}
                                value={settingValue}
                                onChange={(e) => setSettingValue(e.target.value)}
                                className="flex-1"
                              />
                              <Button 
                                type="submit" 
                                size="sm"
                                disabled={updateSetting.isPending}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                {updateSetting.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </Button>
                            </form>
                          ) : (
                            <div className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 border rounded-md p-3">
                              <code className="text-sm font-mono break-all">
                                {setting.value}
                              </code>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 border rounded-lg bg-muted/10 text-center">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900/30 mb-4">
            <Settings className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold">No settings available</h3>
          <p className="text-muted-foreground max-w-md mt-1">
            The AI agent settings are not configured yet. Please contact an administrator to set up the agent configuration.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  const { user, loginMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("chat");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    loginMutation.mutate({ username, password });
  };
  
  // If user is not authenticated, show login form
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">AI Agent Login</CardTitle>
            <CardDescription>
              Sign in to access the AI Agent Architect
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  placeholder="admin" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Use username: <span className="font-medium">admin</span> and password: <span className="font-medium">password</span>
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <SharedLayout user={user}>
      <div className="space-y-8">
        <TooltipProvider>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300">
                AI Architect
              </Badge>
              <Badge variant="default">
                Active
              </Badge>
              <p className="text-sm text-muted-foreground">
                Version 1.0
              </p>
            </div>
            
            <div className="mt-2 sm:mt-0 flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    <span>Database Access</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="w-80">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      This AI agent has secure access to your energy and environmental data for providing insights and recommendations.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Power Monitoring</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Environmental Data</span>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              
              <Button variant="outline" size="sm">
                <Sparkles className="mr-2 h-4 w-4" />
                AI Settings
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Title Section */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Agent Architect</h1>
              <p className="text-sm text-muted-foreground">
                Your intelligent assistant for energy monitoring and optimization
              </p>
            </div>
          </div>

          {/* Tabs Section */}
          <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/10 dark:to-indigo-950/10 rounded-xl p-1 shadow-sm mb-6">
            <Tabs 
              defaultValue="chat" 
              className="w-full"
              onValueChange={(value) => setActiveTab(value)}
            >
              <div className="flex justify-between items-center px-4 py-4">
                <TabsList className="grid w-full max-w-md grid-cols-3 p-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                  <TabsTrigger 
                    value="chat" 
                    className="flex items-center justify-center gap-2 rounded-md data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Chat</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tasks" 
                    className="flex items-center justify-center gap-2 rounded-md data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
                  >
                    <ListChecks className="h-4 w-4" />
                    <span className="hidden sm:inline">Tasks</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="settings" 
                    className="flex items-center justify-center gap-2 rounded-md data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </TabsTrigger>
                </TabsList>
                
                <div className="md:hidden flex items-center gap-2">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <InfoIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">AI Agent Capabilities</h4>
                        <p className="text-sm text-muted-foreground">
                          This AI agent has advanced capabilities for energy data analysis, forecasting, and recommendation generation.
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Power Data Analysis</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Environmental Insights</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Equipment Monitoring</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Forecasting</span>
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </div>
              
              <div className="bg-card rounded-lg border border-border p-6 shadow-md">
                <TabsContent value="chat" className="mt-0 focus-visible:outline-none focus-visible:ring-0 space-y-4">
                  <ChatInterface />
                </TabsContent>
                
                <TabsContent value="tasks" className="mt-0 focus-visible:outline-none focus-visible:ring-0 space-y-4">
                  <TasksInterface />
                </TabsContent>
                
                <TabsContent value="settings" className="mt-0 focus-visible:outline-none focus-visible:ring-0 space-y-4">
                  <AgentSettingsInterface />
                </TabsContent>
              </div>
            </Tabs>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                {activeTab === "chat" && (
                  <>
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <span>Chat with AI to ask questions about your energy data</span>
                  </>
                )}
                {activeTab === "tasks" && (
                  <>
                    <ListChecks className="h-4 w-4 text-blue-500" />
                    <span>Create and manage automated AI tasks for deeper analysis</span>
                  </>
                )}
                {activeTab === "settings" && (
                  <>
                    <Settings className="h-4 w-4 text-blue-500" />
                    <span>Configure AI model parameters and capabilities</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="h-6 w-px bg-border"></div>
              <a 
                href="https://docs.openai.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Learn more</span>
              </a>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </SharedLayout>
  );
}