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
import { AgentMcpTasksPage } from "@/pages/agent-mcp-tasks";
import { TelegramChat } from "@/components/telegram-chat";
import { EnhancedMessage } from "@/components/enhanced-message";
import { MessageSearch } from "@/components/message-search";
import { AIChat } from "@/components/ai-chat";
import { IntegratedAIChat } from "@/components/integrated-ai-chat";
import { cn } from "@/lib/utils";
import { 
  Loader2, Send, Bot, MessageSquare, ListChecks, Settings, Plus, 
  CheckCircle, Database, MessageSquarePlus, ArrowRight, BarChart,
  Zap, CloudSun, Sun, CheckCheck, Calendar, Cpu, Key, Thermometer,
  BookOpen, FileText, Code2, BellRing, Settings2, PencilLine,
  Sparkles, Info as InfoIcon, ExternalLink, ClipboardList,
  ToggleLeft, Clock, BarChart3, MessageCircle, Search, Mic, MicOff,
  Pin, LineChart, AlignJustify, X
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Set<number>>(new Set());
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false);
  const [showPowerDataInput, setShowPowerDataInput] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<number | null>(null);
  const [powerDataQuery, setPowerDataQuery] = useState("");
  
  // Scroll to the bottom of the messages
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);
  
  // Scroll to a specific message by ID
  const scrollToMessage = useCallback((messageId: number) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveMessageId(messageId);
      // Clear active message highlight after 2 seconds
      setTimeout(() => setActiveMessageId(null), 2000);
    }
  }, []);

  // Toggle pin status for a message
  const togglePinMessage = useCallback((messageId: number) => {
    setPinnedMessages(prev => {
      const updated = new Set(prev);
      if (updated.has(messageId)) {
        updated.delete(messageId);
      } else {
        updated.add(messageId);
      }
      return updated;
    });
    
    // Save pinned messages to localStorage for persistence
    try {
      const pinnedMessagesArray = Array.from(pinnedMessages);
      localStorage.setItem(`pinnedMessages-${activeConversation}`, JSON.stringify(pinnedMessagesArray));
    } catch (error) {
      console.error("Failed to save pinned messages to localStorage:", error);
    }
  }, [pinnedMessages, activeConversation]);
  
  // Delete a message
  const deleteMessage = useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: number; messageId: number }) => 
      apiRequest(`/api/agent/conversations/${conversationId}/messages/${messageId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      refetchMessages();
      toast({
        title: "Message deleted",
        description: "The message has been successfully deleted."
      });
    },
    onError: (error: Error) => {
      console.error("Delete message error:", error);
      
      if (error.message.includes("401")) {
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Your session may have expired. Please log in and try again."
        });
      } else if (error.message.includes("Message not found")) {
        // The message might have been already deleted
        refetchMessages(); // Refresh the messages to get the current state
        toast({
          variant: "default",
          title: "Message not found",
          description: "The message may have already been deleted or doesn't exist."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete message: " + error.message
        });
      }
    }
  });
  
  // Load pinned messages when conversation changes
  useEffect(() => {
    if (activeConversation) {
      try {
        const saved = localStorage.getItem(`pinnedMessages-${activeConversation}`);
        if (saved) {
          const savedPinned = JSON.parse(saved) as number[];
          setPinnedMessages(new Set(savedPinned));
        } else {
          setPinnedMessages(new Set());
        }
      } catch (error) {
        console.error("Failed to load pinned messages from localStorage:", error);
        setPinnedMessages(new Set());
      }
    }
  }, [activeConversation]);

  // Fetch conversations - only enable if user is authenticated
  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations, error: conversationsError } = useQuery<any[]>({
    queryKey: ['/api/agent/conversations'],
    retry: false,
    enabled: !!user, // Only run the query if user is authenticated
    onSuccess: (data) => {
      // Success handler
    },
    onError: (error) => {
      console.error('Error fetching conversations:', error);
      if (error instanceof Error && error.message.includes('401')) {
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
  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = useQuery<any[]>({
    queryKey: ['/api/agent/conversations', activeConversation, 'messages'],
    enabled: !!activeConversation,
    retry: false,
    onSuccess: (data) => {
      // Success handler
    },
    onError: (error) => {
      console.error('Error fetching messages:', error);
      if (error instanceof Error && error.message.includes('401')) {
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

  // Create a new conversation
  const createConversation = useMutation({
    mutationFn: (title: string) => 
      apiRequest('/api/agent/conversations', {
        method: 'POST',
        data: { title }
      }),
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
      apiRequest(`/api/agent/conversations/${activeConversation}/messages`, {
        method: 'POST',
        data: { content }
      }),
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
    // Only trigger when activeConversation changes and we have input to send
    // This prevents the effect from running on every keystroke
    if (activeConversation && 
        input && 
        !isSubmitting && 
        !createConversation.isPending && 
        createConversation.isSuccess) {
      setIsSubmitting(true);
      sendMessage.mutate(input);
    }
  }, [activeConversation, isSubmitting, createConversation.isPending, createConversation.isSuccess]);

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
      <Card className="md:col-span-1 bg-slate-900 border-slate-800 shadow-md">
        <CardHeader className="pb-2 border-b border-slate-800 px-3 py-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-1">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm">Conversations</CardTitle>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-slate-800">
                  <Plus className="h-4 w-4 text-blue-400" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-800">
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                  <DialogDescription>
                    Create a new conversation with the AI Agent Architect
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateConversation}>
                  <div className="grid gap-4 py-3">
                    <div className="space-y-2">
                      <Label htmlFor="title">Conversation Name</Label>
                      <Input
                        id="title"
                        value={newConversationTitle}
                        onChange={(e) => setNewConversationTitle(e.target.value)}
                        placeholder="e.g., Energy Optimization Plan"
                        className="col-span-3 bg-slate-950 border-slate-800"
                        autoFocus
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createConversation.isPending || !newConversationTitle.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
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
        </CardHeader>
        <CardContent className="p-2">
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
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className="md:col-span-3 flex flex-col bg-slate-900 border border-slate-800 shadow-md">
        <CardHeader className="pb-3 border-b border-slate-800">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-blue-400" />
              <div>
                <CardTitle className="text-white">AI Agent Architect</CardTitle>
                <CardDescription className="text-gray-400">
                  Ask questions about energy data, generate insights, or request analysis.
                </CardDescription>
              </div>
            </div>
            {activeConversation && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-auto bg-slate-800 hover:bg-slate-700 text-gray-200">
                    <Database className="h-3.5 w-3.5 mr-2 text-blue-400" />
                    Data Access
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 bg-slate-800 border-slate-700">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-white">Agent Database Access</h4>
                    <p className="text-sm text-gray-400">
                      This AI agent has secure access to your energy and environmental data for providing insights and recommendations.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="flex items-center gap-1 text-xs text-gray-300">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Power Data</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-300">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Environmental</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-300">
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
        <CardContent className="flex-1 p-4">
          {activeConversation ? (
            loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="h-full flex flex-col">
                {/* Conversation toolbar with search and actions */}
                <div className="border-b border-slate-700 p-2 flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isSearchOpen && "bg-blue-900/30 text-blue-400"
                      )}
                      onClick={() => setIsSearchOpen(!isSearchOpen)}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                      
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full"
                          onClick={() => setIsVoiceInputActive(!isVoiceInputActive)}
                          disabled={true} // Implement voice input later
                        >
                          {isVoiceInputActive ? 
                            <MicOff className="h-4 w-4 text-red-400" /> : 
                            <Mic className="h-4 w-4" />
                          }
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Voice input (coming soon)</p>
                      </TooltipContent>
                    </Tooltip>
                      
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className={cn(
                            "h-8 w-8 rounded-full",
                            showPowerDataInput && "bg-blue-900/30 text-blue-400"
                          )}
                          onClick={() => setShowPowerDataInput(!showPowerDataInput)}
                        >
                          <LineChart className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Query power data</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <AlignJustify className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                      <DropdownMenuLabel>Conversation</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-slate-700" />
                      <DropdownMenuItem className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                        <Pin className="h-4 w-4 mr-2" />
                        <span>Pinned Messages</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>Conversation History</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                        <LineChart className="h-4 w-4 mr-2" />
                        <span>Data Visualization</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                  
                  {/* Message content area */}
                  <div className="space-y-4 overflow-y-auto">
                    {/* Message search component */}
                    {isSearchOpen && messages && messages.length > 0 && (
                      <div className="mb-4">
                        <MessageSearch 
                          messages={messages} 
                          onSelectResult={scrollToMessage} 
                        />
                      </div>
                    )}
                    
                    {/* Power data query input */}
                    {showPowerDataInput && (
                      <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                        <div className="mb-2 text-sm font-medium text-blue-300">Power Data Query</div>
                        <div className="flex gap-2">
                          <Input 
                            value={powerDataQuery}
                            onChange={(e) => setPowerDataQuery(e.target.value)}
                            placeholder="Ask about power data... e.g., 'Show solar output from yesterday'"
                            className="bg-slate-900/70 border-slate-700"
                          />
                          <Button 
                            size="sm" 
                            className="bg-blue-700 hover:bg-blue-800"
                            onClick={() => {
                              if (powerDataQuery.trim() && activeConversation) {
                                // Format query to indicate it's a power data query
                                const formattedQuery = `[POWER DATA QUERY] ${powerDataQuery.trim()}`;
                                sendMessage.mutate(formattedQuery);
                                setPowerDataQuery("");
                                setShowPowerDataInput(false);
                              }
                            }}
                            disabled={!powerDataQuery.trim() || !activeConversation || sendMessage.isPending}
                          >
                            <Database className="h-4 w-4 mr-2" />
                            Query
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Enhanced messages list */}
                    {messages.map((message: Message) => (
                      <div 
                        key={message.id}
                        id={`message-${message.id}`}
                        className={cn(
                          "relative transition-all duration-300",
                          activeMessageId === message.id && "ring-2 ring-blue-500 rounded-lg"
                        )}
                      >
                        <EnhancedMessage
                          id={message.id}
                          role={message.role}
                          content={message.content || ""}
                          timestamp={message.createdAt}
                          isPinned={pinnedMessages.has(message.id)}
                          onPin={() => togglePinMessage(message.id)}
                          onDelete={() => {
                            if (activeConversation) {
                              deleteMessage.mutate({
                                conversationId: activeConversation,
                                messageId: message.id
                              });
                            }
                          }}
                          hasReference={typeof message.content === 'string' && message.content !== null && message.content !== undefined && (message.content.includes('data reference') || message.content.includes('power data'))}
                        />
                      </div>
                    ))}
                    
                    {/* Typing indicator */}
                    {sendMessage.isPending && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] w-full">
                          <EnhancedMessage
                            role="assistant"
                            content={
                              <div className="flex space-x-2 items-center h-6">
                                <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                            }
                            timestamp={new Date().toISOString()}
                          />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-blue-900/30 flex items-center justify-center">
                    <Bot className="h-8 w-8 text-blue-400" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-lg font-semibold text-white">Start a Conversation</h3>
                    <p className="text-gray-400">
                      Ask questions about energy usage patterns, request recommendations 
                      for optimization, or generate reports based on your data.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-sm w-full max-w-lg">
                    <div className="bg-slate-800 p-2 rounded-lg text-gray-300">
                      "Analyze our energy consumption trends"
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg text-gray-300">
                      "Suggest ways to optimize solar efficiency"
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg text-gray-300">
                      "Generate a report on refrigeration usage"
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg text-gray-300">
                      "Compare current to historical patterns"
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="h-16 w-16 rounded-full bg-blue-900/30 flex items-center justify-center">
                  <MessageSquarePlus className="h-8 w-8 text-blue-400" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-lg font-semibold text-white">No Conversation Selected</h3>
                  <p className="text-gray-400">
                    Select an existing conversation from the sidebar or create a new one 
                    to start interacting with the AI Agent Architect.
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Conversation
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800">
                    <DialogHeader>
                      <DialogTitle className="text-white">New Conversation</DialogTitle>
                      <DialogDescription className="text-gray-400">
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
          </CardContent>
          
          <CardFooter className="border-t border-slate-800 p-4 bg-slate-900">
            <form onSubmit={handleSendMessage} className="flex w-full space-x-2">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeConversation ? "Type your message..." : "Select a conversation to start chatting"}
                disabled={!activeConversation || sendMessage.isPending || createConversation.isPending}
                className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-gray-400 focus-visible:ring-blue-600"
              />
              <Button 
                type="submit" 
                disabled={!activeConversation || !input.trim() || sendMessage.isPending || createConversation.isPending}
                className={!activeConversation || !input.trim() || sendMessage.isPending || createConversation.isPending ? "bg-slate-700" : "bg-blue-600 hover:bg-blue-700"}
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
  const { data: tasks, isLoading, refetch: refetchTasks } = useQuery<any[]>({
    queryKey: ['/api/agent/tasks'],
    retry: false,
    onSuccess: (data) => {
      // Success handler
    },
    onError: (error) => {
      console.error('Error fetching tasks:', error);
      if (error instanceof Error && error.message.includes('401')) {
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
    onError: (error: Error) => {
      console.error("Task creation error:", error);
      
      if (error.message.includes("401")) {
        // If we get a 401, try refreshing the user data
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Your session may have expired. Please log in and try again."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create a new task: " + error.message
        });
      }
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
    onError: (error: Error) => {
      console.error("Update task status error:", error);
      
      if (error.message.includes("401")) {
        // If we get a 401, try refreshing the user data
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Your session may have expired. Please log in and try again."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update task status: " + error.message
        });
      }
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
  const { data: settings, isLoading, refetch: refetchSettings } = useQuery<any[]>({
    queryKey: ['/api/agent/settings'],
    retry: false,
    onSuccess: (data) => {
      // Success handler
    },
    onError: (error) => {
      console.error('Error fetching agent settings:', error);
      if (error instanceof Error && error.message.includes('401')) {
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
    onError: (error: Error) => {
      console.error("Update setting error:", error);
      
      if (error.message.includes("401")) {
        // If we get a 401, try refreshing the user data
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Your session may have expired. Please log in and try again."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update setting: " + error.message
        });
      }
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
  
  // Get setting icon based on name with enhanced color handling for dark theme
  const getSettingIcon = (name: string) => {
    if (name.includes('model')) return <Cpu className="h-5 w-5 text-purple-400 dark:text-purple-300" />;
    if (name.includes('token')) return <Key className="h-5 w-5 text-amber-400 dark:text-amber-300" />;
    if (name.includes('temperature')) return <Thermometer className="h-5 w-5 text-orange-400 dark:text-orange-300" />;
    if (name.includes('enabled')) return <ToggleLeft className="h-5 w-5 text-green-400 dark:text-green-300" />; 
    if (name.includes('limit')) return <Clock className="h-5 w-5 text-blue-400 dark:text-blue-300" />;
    if (name.includes('context')) return <BookOpen className="h-5 w-5 text-blue-400 dark:text-blue-300" />;
    if (name.includes('prompt')) return <FileText className="h-5 w-5 text-indigo-400 dark:text-indigo-300" />;
    if (name.includes('max')) return <BarChart3 className="h-5 w-5 text-teal-400 dark:text-teal-300" />;
    if (name.includes('system')) return <Bot className="h-5 w-5 text-violet-400 dark:text-violet-300" />;
    if (name.includes('function')) return <Code2 className="h-5 w-5 text-emerald-400 dark:text-emerald-300" />;
    if (name.includes('notification')) return <BellRing className="h-5 w-5 text-rose-400 dark:text-rose-300" />;
    return <Settings2 className="h-5 w-5 text-slate-400 dark:text-slate-300" />;
  };

  // Get setting category based on name prefix
  const getSettingCategory = (name: string) => {
    if (name.startsWith('model_')) return 'AI Model';
    if (name.startsWith('api_')) return 'API Configuration';
    if (name.includes('notification')) return 'Notifications';
    if (name.includes('function')) return 'Functions & Capabilities';
    return 'General Settings';
  };
  
  // Get a contrasting color for category headers
  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'AI Model': return 'from-indigo-900/50 to-indigo-950/50 border-indigo-800/40';
      case 'API Configuration': return 'from-slate-900/50 to-slate-950/50 border-blue-900/30';
      case 'Notifications': return 'from-violet-900/50 to-violet-950/50 border-violet-800/40';
      case 'Functions & Capabilities': return 'from-emerald-900/50 to-emerald-950/50 border-emerald-800/40';
      default: return 'from-blue-900/50 to-blue-950/50 border-blue-800/40';
    }
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
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-900 to-blue-950 shadow-lg shadow-blue-900/20 border border-blue-700/20">
            <Settings2 className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">Agent Configuration</h2>
            <p className="text-slate-400 mt-1">
              Customize the AI agent's behavior, model settings, and capabilities
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 border border-slate-700/50 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-blue-950/80 flex items-center justify-center mb-4 ring-1 ring-blue-700/30 shadow-lg shadow-blue-900/20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-200">Loading settings...</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-md">
              Retrieving AI agent configuration
            </p>
          </div>
        </div>
      ) : settings && settings.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupSettingsByCategory(settings)).map(([category, categorySettings]) => (
            <Card key={category} className="border-slate-700/50 bg-slate-900/70 shadow-xl shadow-slate-950/50 overflow-hidden">
              <CardHeader className={`pb-3 border-b border-slate-700/50 bg-gradient-to-r ${getCategoryColor(category)}`}>
                <CardTitle className="text-lg text-slate-200">{category}</CardTitle>
                <CardDescription className="text-slate-400">
                  {category === 'AI Model' && 'Configure the AI model parameters and behavior'}
                  {category === 'API Configuration' && 'Settings for external API connections'}
                  {category === 'Notifications' && 'Configure notification behaviors and thresholds'}
                  {category === 'Functions & Capabilities' && 'Manage agent capabilities and allowed functions'}
                  {category === 'General Settings' && 'General configuration options for the AI agent'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 bg-slate-950/20">
                {category === 'General Settings' ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {categorySettings.map((setting: any) => (
                      <div 
                        key={setting.name} 
                        className="relative group p-4 rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 transition-all hover:shadow-md hover:shadow-blue-900/10 hover:border-slate-700"
                      >
                        <div className="absolute top-3 right-3">
                          {editingSetting === setting.name ? (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setEditingSetting(null)}
                              className="h-7 px-2 text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                              Cancel
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => startEditing(setting.name, setting.value)}
                              className="h-7 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                            >
                              <PencilLine className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center ring-1 ring-slate-700/50 shadow-md">
                            {getSettingIcon(setting.name)}
                          </div>
                          <label htmlFor={setting.name} className="font-medium text-slate-100">
                            {setting.name.split('_').map((word: string) => 
                              word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(' ')}
                          </label>
                        </div>
                        
                        <p className="text-sm text-slate-400 mb-3 pl-12">{setting.description}</p>
                        
                        {editingSetting === setting.name ? (
                          <form onSubmit={handleUpdateSetting} className="mt-3 flex gap-2">
                            <Input
                              id={setting.name}
                              value={settingValue}
                              onChange={(e) => setSettingValue(e.target.value)}
                              className="flex-1 bg-slate-800 border-slate-700 text-white focus-visible:ring-blue-500"
                              autoFocus
                            />
                            <Button 
                              type="submit" 
                              size="sm"
                              disabled={updateSetting.isPending}
                              className="bg-blue-600 hover:bg-blue-500 text-white shadow shadow-blue-500/20"
                            >
                              {updateSetting.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                          </form>
                        ) : (
                          <div className="bg-slate-800/80 border-slate-700/80 border rounded-lg p-3 mt-1 shadow-inner">
                            <code className="text-sm font-mono break-all text-slate-300">
                              {setting.value}
                            </code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {categorySettings.map((setting: any) => (
                      <div key={setting.name} className="pb-5 border-b border-dashed border-slate-700/50 last:border-b-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mt-0.5 ring-1 ring-slate-700/50 shadow-md">
                            {getSettingIcon(setting.name)}
                          </div>
                          
                          <div className="flex-1 space-y-3">
                            <div>
                              <div className="flex items-center justify-between">
                                <label htmlFor={setting.name} className="font-medium text-slate-100">
                                  {setting.name.split('_').map((word: string) => 
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                  ).join(' ')}
                                </label>
                                {editingSetting === setting.name ? (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => setEditingSetting(null)}
                                    className="h-7 px-2 text-slate-400 hover:text-white hover:bg-slate-800"
                                  >
                                    Cancel
                                  </Button>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => startEditing(setting.name, setting.value)}
                                    className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                                  >
                                    <PencilLine className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm text-slate-400 mt-1">{setting.description}</p>
                            </div>
                            
                            {editingSetting === setting.name ? (
                              <form onSubmit={handleUpdateSetting} className="flex gap-2">
                                <Input
                                  id={setting.name}
                                  value={settingValue}
                                  onChange={(e) => setSettingValue(e.target.value)}
                                  className="flex-1 bg-slate-800 border-slate-700 text-white focus-visible:ring-blue-500"
                                  autoFocus
                                />
                                <Button 
                                  type="submit" 
                                  size="sm"
                                  disabled={updateSetting.isPending}
                                  className="bg-blue-600 hover:bg-blue-500 text-white shadow shadow-blue-500/20"
                                >
                                  {updateSetting.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              </form>
                            ) : (
                              <div className="bg-slate-800/80 border-slate-700/80 border rounded-lg p-3 shadow-inner">
                                <code className="text-sm font-mono break-all text-slate-300">
                                  {setting.value}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 border border-slate-700/50 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 shadow-lg text-center">
          <div className="h-16 w-16 rounded-full bg-blue-950/80 flex items-center justify-center mb-4 ring-1 ring-blue-700/30 shadow-lg shadow-blue-900/20">
            <Settings className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100">No settings available</h3>
          <p className="text-slate-400 max-w-md mt-1">
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
  
  // Add event listener for switching to the Telegram tab
  useEffect(() => {
    const handleSwitchToTelegramTab = () => {
      console.log('Switching to Telegram tab from event');
      setActiveTab('telegram');
    };
    
    // Add the event listener
    document.addEventListener('switchToTelegramTab', handleSwitchToTelegramTab);
    
    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('switchToTelegramTab', handleSwitchToTelegramTab);
    };
  }, []);
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    loginMutation.mutate({ username, password });
  };
  
  // If user is not authenticated, show login form
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 bg-gradient-to-b dark:from-slate-950 dark:to-slate-900 px-4">
        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-slate-900/30">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-5">
              <div className="h-20 w-20 rounded-full bg-primary/10 dark:bg-blue-900/30 flex items-center justify-center ring-1 ring-primary/20 dark:ring-blue-700/30">
                <Bot className="h-10 w-10 text-primary dark:text-blue-400" />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              AI Agent Login
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-base mt-2">
              Sign in to access the AI Agent Architect
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700 dark:text-slate-300">Username</Label>
                <Input 
                  id="username" 
                  placeholder="admin" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 focus:border-blue-500 dark:focus:border-blue-500 dark:focus-visible:ring-blue-500/30 dark:focus-visible:ring-offset-slate-900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 focus:border-blue-500 dark:focus:border-blue-500 dark:focus-visible:ring-blue-500/30 dark:focus-visible:ring-offset-slate-900"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full mt-2 bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-sm"
                disabled={loginMutation.isPending}
              >
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
          <CardFooter className="flex justify-center border-t border-slate-200 dark:border-slate-800 pt-5 text-center">
            <div className="text-sm text-slate-500 dark:text-slate-400 px-4">
              Use username: <span className="font-medium text-slate-700 dark:text-slate-300">admin</span> and password: <span className="font-medium text-slate-700 dark:text-slate-300">admin123</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <SharedLayout user={user}>
      <div className="space-y-8">
        <TooltipProvider>
          {/* Enhanced Header with Dark Mode Optimizations */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30 dark:hover:bg-blue-900/50 transition-colors">
                AI Architect
              </Badge>
              <Badge variant="default" className="bg-green-600 hover:bg-green-500 dark:bg-green-600/90 dark:hover:bg-green-500/90">
                Active
              </Badge>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Version 1.0
              </p>
            </div>
            
            <div className="mt-2 sm:mt-0 flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    <Database className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span>Database Access</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="w-80 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      This AI agent has secure access to your energy and environmental data for providing insights and recommendations.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Power Monitoring</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Environmental Data</span>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <Sparkles className="mr-1 h-4 w-4 text-amber-500 dark:text-amber-400" />
                AI Settings
                <ArrowRight className="ml-1 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              </Button>
            </div>
          </div>
          
          {/* Title Section with Enhanced Dark Mode Styling */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-14 w-14 rounded-full bg-blue-900/20 dark:bg-blue-900/30 flex items-center justify-center ring-1 ring-blue-500/20 dark:ring-blue-800/40">
              <Bot className="h-7 w-7 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Agent Architect</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Your intelligent assistant for energy monitoring and optimization
              </p>
            </div>
          </div>

          {/* Enhanced Agent Interface Section with Proper Sizing */}
          <div className="bg-slate-950 rounded-xl shadow-lg mb-3 overflow-visible flex flex-col">
            <Tabs 
              defaultValue="tasks" 
              className="flex flex-col"
              onValueChange={(value) => setActiveTab(value)}
            >
              {/* Modern Navigation Bar with Improved Visual Hierarchy */}
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-slate-900 to-slate-950 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 bg-blue-600/30 text-blue-200 py-1 px-2 rounded-md text-xs font-medium">
                    <Bot className="h-3.5 w-3.5" />
                    <span>AI Agent</span>
                  </span>
                  
                  <TabsList className="flex bg-slate-900/60 p-0.5 rounded-md border border-slate-800 h-7">
                    <TabsTrigger 
                      value="tasks" 
                      className="flex items-center justify-center gap-1.5 text-xs py-1 px-3 rounded-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-300"
                    >
                      <ListChecks className="h-3.5 w-3.5" />
                      <span className="font-medium">Tasks</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="mcp-tasks" 
                      className="flex items-center justify-center gap-1.5 text-xs py-1 px-3 rounded-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-300"
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      <span className="font-medium">MCP</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="telegram" 
                      className="flex items-center justify-center gap-1.5 text-xs py-1 px-3 rounded-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-300"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span className="font-medium">Telegram</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="ai-chat" 
                      className="flex items-center justify-center gap-1.5 text-xs py-1 px-3 rounded-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-300"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span className="font-medium">AI Chat</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 bg-slate-900 border-slate-700 text-slate-400 flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-blue-400" />
                    <span>v1.2</span>
                  </Badge>
                  
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 p-0.5 hover:bg-slate-800 rounded-full">
                        <InfoIcon className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-64 p-3 bg-slate-900 border-slate-700 text-slate-300">
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                          AI Agent Capabilities
                        </h4>
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Power Analysis</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Environmental</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Equipment</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Forecasting</span>
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </div>
              
              {/* Improved Content Area without Restrictive Scrollbars */}
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 flex-1">

                
                <TabsContent 
                  value="tasks" 
                  className="m-0 p-0 focus-visible:outline-none focus-visible:ring-0 border-0"
                >
                  <div className="p-3">
                    <TasksInterface />
                  </div>
                </TabsContent>
                
                <TabsContent 
                  value="mcp-tasks" 
                  className="m-0 p-0 focus-visible:outline-none focus-visible:ring-0 border-0"
                >
                  <div className="p-3">
                    <AgentMcpTasksPage />
                  </div>
                </TabsContent>
                
                <TabsContent 
                  value="telegram" 
                  className="m-0 p-0 focus-visible:outline-none focus-visible:ring-0 border-0"
                >
                  <div className="p-3">
                    <TelegramChat />
                  </div>
                </TabsContent>
                
                <TabsContent 
                  value="ai-chat" 
                  className="m-0 p-0 focus-visible:outline-none focus-visible:ring-0 border-0"
                >
                  <div className="p-3">
                    <IntegratedAIChat />
                  </div>
                </TabsContent>
                

              </div>
            </Tabs>
          </div>
          
          {/* Enhanced Footer with Status Information - Dark Mode Optimized */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-900/80 to-slate-800/80 dark:from-slate-950 dark:to-slate-900 py-2.5 px-4 rounded-lg mt-2 shadow-inner border border-slate-200/10 dark:border-slate-800">
            <div className="flex items-center">
              <div className="text-slate-600 dark:text-slate-400 flex items-center gap-2 text-xs">

                {activeTab === "tasks" && (
                  <>
                    <div className="bg-amber-100/80 dark:bg-amber-900/20 p-1.5 rounded-md ring-1 ring-amber-200/50 dark:ring-amber-800/30">
                      <ListChecks className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span>Schedule automated analysis tasks for periodic energy reports</span>
                  </>
                )}
                {activeTab === "mcp-tasks" && (
                  <>
                    <div className="bg-cyan-100/80 dark:bg-cyan-900/20 p-1.5 rounded-md ring-1 ring-cyan-200/50 dark:ring-cyan-800/30">
                      <Cpu className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <span>Create and manage Model Context Protocol tasks for advanced AI processing</span>
                  </>
                )}
                {activeTab === "telegram" && (
                  <>
                    <div className="bg-purple-100/80 dark:bg-purple-900/20 p-1.5 rounded-md ring-1 ring-purple-200/50 dark:ring-purple-800/30">
                      <MessageCircle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span>Connect with Telegram to receive messages and notifications on your mobile device</span>
                  </>
                )}

                {activeTab === "ai-chat" && (
                  <>
                    <div className="bg-green-100/80 dark:bg-green-900/20 p-1.5 rounded-md ring-1 ring-green-200/50 dark:ring-green-800/30">
                      <Bot className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Unified AI Chat interface with file upload/download capabilities</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Agent Online</span>
              </div>
              
              <div className="border-l border-slate-300/20 dark:border-slate-700 pl-3">
                <a 
                  href="https://docs.openai.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 flex items-center gap-1.5 text-xs font-medium transition-colors"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Documentation</span>
                </a>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </SharedLayout>
  );
}