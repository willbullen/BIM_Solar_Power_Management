import { useState, useEffect, useRef, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { v4 as uuidv4 } from 'uuid';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { EnhancedMessage } from "@/components/enhanced-message";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Bot,
  Send,
  AlertCircle,
  Upload,
  Download,
  Paperclip,
  FileText,
  File,
  X,
  Check,
  Trash2,
  MessageCircle,
  ChevronRight,
  Plus,
  Copy
} from "lucide-react";

// Types for AI Chat
interface Conversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  agentId?: number;
}

interface LangchainAgent {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  enabled: boolean;  // This is the correct field name from the database
  created_at: string;
  updated_at: string;
}

interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  timestamp: string;  // Primary field for message timing
  functionCall?: any;
  functionResponse?: any;
  metadata?: any;
  
  // Optional fields that might be in API responses
  createdAt?: string;  // Some API responses use this instead of timestamp
  updatedAt?: string;
  userId?: number;
}

interface FileAttachment {
  id: number;
  conversationId?: number;
  messageId?: number;
  filename: string;
  isPublic: boolean;
  fileType: string;
  filePath: string;
  fileSize: number;
  createdBy: number;
  createdAt: string;
}

// Types for WebSocket
interface AgentWebSocketMessage {
  type: string;
  payload: any;
}

/**
 * Integrated AI Chat Component
 * 
 * This component provides a unified chat experience with AI agents.
 */
export function IntegratedAIChat() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const initialConversationId = urlParams.get('id') ? parseInt(urlParams.get('id') as string) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // AI Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newConversationTitle, setNewConversationTitle] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("default"); // For agent selection
  const [agents, setAgents] = useState<LangchainAgent[]>([]); // To store available agents
  const [manualMessages, setManualMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [files, setFiles] = useState<FileAttachment[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Get user from auth context
  const { user } = useAuth();
  
  // Chat stream handling
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [streamedMessages, setStreamedMessages] = useState<{ [key: string]: Message }>({});
  const [partialContent, setPartialContent] = useState<string | null>(null);
  const [streamMessageId, setStreamMessageId] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  // WebSocket singleton to prevent multiple connections
  useEffect(() => {
    if (!user || socket) return;
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log(`WebSocket URL: ${wsUrl}`);
      console.log("Creating new WebSocket connection as singleton");
      
      const newSocket = new WebSocket(wsUrl);
      
      newSocket.onopen = () => {
        console.log("WebSocket connected! AI Chat ready for real-time updates");
        setIsWebSocketConnected(true);
        
        // Send auth message
        if (user) {
          const authMessage = {
            type: "authenticate",
            payload: {
              userId: user.id,
              username: user.username
            }
          };
          newSocket.send(JSON.stringify(authMessage));
        }
      };
      
      newSocket.onmessage = (event) => {
        try {
          const message: AgentWebSocketMessage = JSON.parse(event.data);
          
          // Handle different message types
          if (message.type === "stream_start") {
            const { messageId } = message.payload;
            setStreamMessageId(messageId);
            setPartialContent("");
            
            // Create a placeholder message
            const newMsg: Message = {
              id: Number(messageId), // Will be replaced with the real ID later
              conversationId: activeConversation?.id || 0,
              role: "assistant",
              content: "",
              timestamp: new Date().toISOString(),
            };
            
            setStreamedMessages(prev => ({
              ...prev,
              [messageId]: newMsg
            }));
          } 
          else if (message.type === "stream_token") {
            const { messageId, content } = message.payload;
            
            // Update the partial content
            setPartialContent(prev => (prev || "") + content);
            
            // Update the streamed message
            setStreamedMessages(prev => {
              const updatedMessages = { ...prev };
              if (updatedMessages[messageId]) {
                updatedMessages[messageId] = {
                  ...updatedMessages[messageId],
                  content: (updatedMessages[messageId].content || "") + content
                };
              }
              return updatedMessages;
            });
          } 
          else if (message.type === "stream_end") {
            const { messageId, finalContent } = message.payload;
            
            // Clear streaming state
            setStreamMessageId(null);
            setPartialContent(null);
            
            // If there's a finalContent, use it (ensures we have the complete message)
            if (finalContent) {
              setStreamedMessages(prev => {
                const updatedMessages = { ...prev };
                if (updatedMessages[messageId]) {
                  updatedMessages[messageId] = {
                    ...updatedMessages[messageId],
                    content: finalContent
                  };
                }
                return updatedMessages;
              });
            }
            
            // Refresh the conversation to get the official message from the server
            if (activeConversation) {
              queryClient.invalidateQueries({ queryKey: [`/api/agent/conversations/${activeConversation.id}/messages`] });
            }
          }
          else if (message.type === "function_call") {
            console.log("Function call received:", message.payload);
          }
          else if (message.type === "function_response") {
            console.log("Function response received:", message.payload);
          }
          else if (message.type === "error") {
            console.error("Error from WebSocket:", message.payload);
            toast({
              title: "Error",
              description: message.payload.message || "An error occurred",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };
      
      newSocket.onclose = () => {
        console.log("WebSocket disconnected");
        setIsWebSocketConnected(false);
        setSocket(null); // Allow reconnection attempt
      };
      
      newSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsWebSocketConnected(false);
      };
      
      setSocket(newSocket);
      
      // Cleanup function
      return () => {
        if (newSocket.readyState === WebSocket.OPEN || newSocket.readyState === WebSocket.CONNECTING) {
          newSocket.close();
        }
      };
    } catch (error) {
      console.error("Error setting up WebSocket:", error);
    }
  }, [user, queryClient, toast, activeConversation]);
  
  // Function to directly fetch agents instead of using a query
  const fetchLangchainAgents = useCallback(() => {
    if (!user) return;

    console.log("Directly fetching langchain agents...");
    
    // Direct fetch for agents
    fetch(`${window.location.origin}/api/langchain/agents`, {
      headers: {
        'Accept': 'application/json',
        'X-Auth-User-Id': user.id.toString(),
        'X-Auth-Username': user.username
      }
    })
    .then(response => {
      console.log("Direct agent fetch response status:", response.status);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("===== AGENTS DEBUG =====");
      console.log("Agents data from direct fetch:", data);
      
      if (Array.isArray(data)) {
        // Log all agent data
        console.log("Total agents received:", data.length);
        
        data.forEach((agent, i) => {
          console.log(`Agent ${i+1}: id=${agent.id}, name=${agent.name}, enabled=${agent.enabled}`);
        });
        
        // Filter enabled agents
        const filtered = data.filter(agent => agent.enabled === true);
        console.log("Filtered agents count:", filtered.length);
        setAgents(filtered);
      }
      console.log("===== END AGENTS DEBUG =====");
    })
    .catch(error => {
      console.error("Error directly fetching agents:", error);
    });
  }, [user]);
  
  // Fetch agents when user changes
  useEffect(() => {
    fetchLangchainAgents();
  }, [fetchLangchainAgents]);
  
  // Fetch agents when dialog opens
  useEffect(() => {
    if (showCreateDialog && user) {
      console.log("Dialog opened - fetching agents");
      setNewConversationTitle("");
      setSelectedAgentId("default");
      fetchLangchainAgents();
    }
  }, [showCreateDialog, user, fetchLangchainAgents]);
  
  // Query for conversations
  const conversationsQuery = useQuery({
    queryKey: ['/api/agent/conversations'],
    enabled: !!user,
    refetchInterval: 30000, // 30 seconds
    onSuccess: (data) => {
      if (Array.isArray(data)) {
        setConversations(data);
        
        // If there's an initial conversation ID in URL and we haven't set active conversation yet
        if (initialConversationId && !activeConversation) {
          const conversation = data.find(c => c.id === initialConversationId);
          if (conversation) {
            setActiveConversation(conversation);
          }
        }
      }
    },
    onError: (error: Error) => {
      console.error("Error fetching conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversations. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Query for messages if there's an active conversation
  const messagesQuery = useQuery({
    queryKey: [`/api/agent/conversations/${activeConversation?.id}/messages`],
    enabled: !!activeConversation,
    refetchInterval: activeConversation ? 10000 : false, // 10 seconds if active
    onSuccess: (data) => {
      if (Array.isArray(data)) {
        setManualMessages(data);
      }
    },
    onError: (error: Error, variables) => {
      console.error("Error fetching messages:", error);
      toast({
        title: "Error",
        description: "Failed to load messages. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Query for files if there's an active conversation
  const filesQuery = useQuery({
    queryKey: [`/api/agent/conversations/${activeConversation?.id}/files`],
    enabled: !!activeConversation,
    onSuccess: (data) => {
      setFiles(data);
    },
    onError: (error: Error) => {
      console.error("Error fetching files:", error);
    }
  });
  
  // Create a new conversation
  const createConversation = useMutation({
    mutationFn: async ({ title, agentId }: { title: string, agentId?: string }) => {
      return apiRequest('/api/agent/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          agentId: (agentId && agentId !== "default") ? parseInt(agentId) : undefined 
        }),
      });
    },
    onSuccess: (data) => {
      setActiveConversation(data);
      setShowCreateDialog(false);
      setNewConversationTitle("");
      setSelectedAgentId("default");
      
      // Update conversations list
      queryClient.invalidateQueries({ queryKey: ['/api/agent/conversations'] });
      
      toast({
        title: "Success",
        description: "New conversation created",
      });
    },
    onError: (error: Error) => {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: "Failed to create conversation. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Send a new message
  const sendMessage = useMutation({
    mutationFn: async ({ content, conversationId }: { content: string, conversationId: number }) => {
      return apiRequest(`/api/agent/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: (data) => {
      // Add user message to the list immediately
      const userMsg: Message = {
        id: data.id || new Date().getTime(),
        conversationId: activeConversation?.id || 0,
        role: "user",
        content: currentMessage,
        timestamp: new Date().toISOString(),
      };
      
      setManualMessages(prev => [...prev, userMsg]);
      
      // Create a placeholder for the assistant response
      const assistantMsg: Message = {
        id: new Date().getTime() + 1,
        conversationId: activeConversation?.id || 0,
        role: "assistant",
        content: "Thinking...",
        timestamp: new Date().toISOString(),
      };
      
      setTimeout(() => {
        setManualMessages(prev => [...prev, assistantMsg]);
      }, 500);
      
      // Reset input and state
      setCurrentMessage("");
      setIsSubmitting(false);
      
      // Update the conversation in the list (to show it was updated)
      queryClient.invalidateQueries({ queryKey: ['/api/agent/conversations'] });
    },
    onError: (error: Error) => {
      console.error("Error sending message:", error);
      setIsSubmitting(false);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Handle conversation selection
  const handleSelectConversation = (conversation: Conversation) => {
    setActiveConversation(conversation);
    
    // Create new path with conversation ID
    const base = window.location.pathname;
    const newPath = `${base}?id=${conversation.id}`;
    
    // Update URL without navigation
    window.history.pushState(null, '', newPath);
  };
  
  // Handle creating a new conversation
  const handleCreateConversation = (e: FormEvent) => {
    e.preventDefault();
    if (!newConversationTitle.trim()) return;
    
    createConversation.mutate({ 
      title: newConversationTitle,
      agentId: selectedAgentId || undefined
    });
  };
  
  // Handle sending a message
  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !activeConversation || isSubmitting) return;
    
    setIsSubmitting(true);
    sendMessage.mutate({
      content: currentMessage,
      conversationId: activeConversation.id,
    });
  };
  
  // Scroll to bottom of messages when they change
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [manualMessages, streamedMessages]);
  
  // Load message history from storage if available
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeConversation]);
  
  // Handle file upload
  const uploadFile = useMutation({
    mutationFn: async ({ file, conversationId }: { file: File, conversationId: number }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      return apiRequest(`/api/agent/conversations/${conversationId}/files`, {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data) => {
      // Refresh files list
      queryClient.invalidateQueries({ queryKey: [`/api/agent/conversations/${activeConversation?.id}/files`] });
      
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !activeConversation) return;
    
    // Upload each file
    Array.from(files).forEach(file => {
      uploadFile.mutate({ file, conversationId: activeConversation.id });
    });
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Delete a file
  const deleteFile = useMutation({
    mutationFn: async ({ fileId, conversationId }: { fileId: number, conversationId: number }) => {
      return apiRequest(`/api/agent/conversations/${conversationId}/files/${fileId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      // Refresh files list
      queryClient.invalidateQueries({ queryKey: [`/api/agent/conversations/${activeConversation?.id}/files`] });
      
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Error deleting file:", error);
      toast({
        title: "Error",
        description: "Failed to delete file. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const handleDeleteFile = (fileId: number) => {
    if (!activeConversation) return;
    
    deleteFile.mutate({ fileId, conversationId: activeConversation.id });
  };
    
  // All messages to display (combining manual and streamed)
  const allMessages = [...manualMessages];
  Object.values(streamedMessages).forEach(streamMsg => {
    // Check if this message is already in manual messages
    const existingMsg = manualMessages.find(m => m.id === streamMsg.id);
    if (!existingMsg) {
      allMessages.push(streamMsg);
    }
  });
  
  // Sort by timestamp
  allMessages.sort((a, b) => {
    const timeA = new Date(a.timestamp || a.createdAt || "").getTime();
    const timeB = new Date(b.timestamp || b.createdAt || "").getTime();
    return timeA - timeB;
  });
  
  return (
    <div className="container mx-auto px-4 pb-8 mt-2 md:mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Left sidebar - Conversations */}
        <Card className="bg-slate-900 border-slate-800 shadow-md h-[calc(100vh-12rem)]">
          <CardHeader className="pb-3 border-b border-slate-800 px-4 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-white flex items-center">
                <MessageSquare className="h-4 w-4 mr-2" />
                Conversations
              </CardTitle>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7 bg-blue-900/30 hover:bg-blue-800/50 border-blue-800"
                onClick={() => {
                  setShowCreateDialog(true);
                  setNewConversationTitle("");
                  setSelectedAgentId("");
                }}
              >
                <Plus className="h-4 w-4 text-blue-400" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-full flex flex-col">
            <ScrollArea className="flex-grow">
              {conversationsQuery.isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : Array.isArray(conversations) && conversations.length > 0 ? (
                <div className="divide-y divide-slate-800">
                  {conversations.map((conversation) => (
                    <div 
                      key={conversation.id} 
                      className={`
                        flex items-center justify-between px-4 py-3 cursor-pointer transition-colors
                        ${activeConversation?.id === conversation.id ? 'bg-blue-900/20' : 'hover:bg-slate-800/50'}
                      `}
                      onClick={() => handleSelectConversation(conversation)}
                    >
                      <div className="flex items-center space-x-3">
                        <MessageSquare className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-200">{conversation.title}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(conversation.updatedAt).toLocaleDateString()}
                            {conversation.agentId && (
                              <Badge variant="outline" className="ml-1 bg-blue-900/30 text-blue-300 border-blue-800 px-1.5 py-0 text-[10px]">
                                <Bot className="h-2 w-2 mr-1" />
                                {agents.find(a => a.id === conversation.agentId)?.name || 'Agent'}
                              </Badge>
                            )}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <MessageSquarePlus className="h-12 w-12 text-slate-700 mb-2" />
                  <p className="text-sm text-slate-400 mb-4">No conversations yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-blue-900/30 hover:bg-blue-800/50 text-blue-300 border-blue-800"
                    onClick={() => {
                      setShowCreateDialog(true);
                      setNewConversationTitle("");
                      setSelectedAgentId("");
                    }}
                  >
                    Start a new conversation
                  </Button>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main content */}
        <Card className="md:col-span-3 bg-slate-900 border-slate-800 shadow-md h-[calc(100vh-12rem)] flex flex-col">
          <CardHeader className="pb-2 border-b border-slate-800 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8 bg-blue-700">
                  <AvatarImage src="/bot-avatar.png" alt="AI" />
                  <AvatarFallback className="bg-blue-700 text-white">AI</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-sm text-white">
                    {activeConversation ? activeConversation.title : 'AI Chat'}
                    {activeConversation?.agentId && (
                      <Badge variant="outline" className="ml-2 bg-blue-900/30 text-blue-300 border-blue-800 px-2 py-0 text-xs">
                        <Bot className="h-3 w-3 mr-1 text-blue-300" />
                        {agents.find(a => a.id === activeConversation.agentId)?.name || 'Agent'}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-400">
                    {activeConversation 
                      ? `Last updated: ${new Date(activeConversation.updatedAt).toLocaleString()}`
                      : 'Start a new conversation'}
                  </CardDescription>
                </div>
              </div>
              
              {/* Files badge - if there are files */}
              {files && files.length > 0 && (
                <Badge variant="outline" className="bg-indigo-900/30 text-indigo-300 border-indigo-800 px-2 py-0 text-xs">
                  <Paperclip className="h-3 w-3 mr-1" />
                  {files.length} {files.length === 1 ? 'File' : 'Files'}
                </Badge>
              )}
            </div>
          </CardHeader>
              
          <CardContent className="p-0 flex-grow overflow-hidden">
            {!activeConversation ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <Bot className="h-16 w-16 text-slate-700 mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">Welcome to AI Chat</h3>
                <p className="text-sm text-slate-400 max-w-md mb-4">
                  Start a new conversation with our AI assistant to get help with your energy management questions and tasks.
                </p>
                <Button 
                  variant="outline" 
                  className="bg-blue-900/30 hover:bg-blue-800/50 text-blue-300 border-blue-800"
                  onClick={() => {
                    setShowCreateDialog(true);
                    setNewConversationTitle("");
                    setSelectedAgentId("");
                  }}
                >
                  Start new conversation
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-full px-4 py-2">
                {messagesQuery.isLoading || conversationsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    <span className="ml-2 text-sm text-blue-400">Loading messages...</span>
                  </div>
                ) : Array.isArray(manualMessages) && manualMessages.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-center py-2 px-4 mb-4">
                      <p className="text-xs text-blue-400">
                        Beginning of conversation - {manualMessages.length} messages
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Conversation ID: {activeConversation?.id}
                        {activeConversation?.agentId && (
                          <span className="ml-1">
                            • Using: <span className="text-blue-400">{agents.find(a => a.id === activeConversation.agentId)?.name || 'Agent'}</span>
                          </span>
                        )}
                      </p>
                    </div>
                    {allMessages.map((msg, index) => (
                      <div 
                        key={`${msg.id || index}`} 
                        id={`message-${msg.id || index}`}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role !== 'user' && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src="/bot-avatar.png" alt="AI" />
                            <AvatarFallback className="bg-blue-700 text-white">AI</AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={`
                          flex flex-col space-y-2 max-w-[80%] 
                          ${msg.role === 'user' ? 'items-end' : 'items-start'}
                        `}>
                          <div className={`
                            px-4 py-3 rounded-lg 
                            ${msg.role === 'user' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-800 text-slate-100'}
                          `}>
                            {msg.content === "Thinking..." ? (
                              <div className="flex items-center space-x-2">
                                <span>Thinking</span>
                                <span className="flex space-x-1">
                                  <span className="animate-bounce">.</span>
                                  <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                                  <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
                                </span>
                              </div>
                            ) : msg.role === 'user' ? (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                              <EnhancedMessage 
                                role={msg.role === 'assistant' ? 'assistant' : (msg.role === 'user' ? 'user' : 'system')} 
                                content={msg.content} 
                                timestamp={msg.timestamp || msg.createdAt || new Date().toISOString()} 
                              />
                            )}
                          </div>
                          
                          <div className="flex items-center text-xs text-slate-500">
                            <span>
                              {msg.role === 'user' ? 'You' : 'AI'} • {new Date(msg.timestamp || msg.createdAt || "").toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        
                        {msg.role === 'user' && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src="/user-avatar.png" alt="You" />
                            <AvatarFallback className="bg-slate-700 text-white">{user?.username?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                    
                    {/* Streaming message */}
                    {streamMessageId && partialContent !== null && (
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src="/bot-avatar.png" alt="AI" />
                          <AvatarFallback className="bg-blue-700 text-white">AI</AvatarFallback>
                        </Avatar>
                        
                        <div className="flex flex-col space-y-2 max-w-[80%] items-start">
                          <div className="px-4 py-3 rounded-lg bg-slate-800 text-slate-100">
                            <EnhancedMessage 
                              role={"assistant" as "assistant" | "user" | "system"} 
                              content={partialContent || ""} 
                              timestamp={new Date().toISOString()} 
                            />
                            <span className="inline-block w-1 h-4 bg-blue-400 animate-pulse ml-1"></span>
                          </div>
                          
                          <div className="flex items-center text-xs text-slate-500">
                            <span>AI • Live</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messageEndRef} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Bot className="h-12 w-12 text-slate-700 mb-2" />
                    <p className="text-sm text-slate-400 mb-2">This conversation is empty</p>
                    <p className="text-xs text-slate-500">
                      Send a message below to start chatting with the AI
                    </p>
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
          
          {/* Input area */}
          <CardFooter className="p-3 border-t border-slate-800">
            {!isWebSocketConnected && (
              <div className="w-full flex items-center justify-center p-2 mb-2 bg-amber-950/30 border border-amber-800/50 rounded-md">
                <AlertCircle className="h-4 w-4 text-amber-500 mr-2" />
                <span className="text-xs text-amber-400">
                  Waiting for connection... Messages may be delayed
                </span>
              </div>
            )}
            
            {activeConversation && (
              <>
                {/* File attachments */}
                {files && files.length > 0 && (
                  <div className="w-full mb-3 p-2 bg-slate-800/50 rounded-md">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Files</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {files.map(file => (
                        <div 
                          key={file.id}
                          className="flex items-center bg-slate-800 rounded-md px-2 py-1 text-xs text-slate-300"
                        >
                          <FileText className="h-3 w-3 mr-1 text-indigo-400" />
                          <span className="truncate max-w-[150px]">{file.filename}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 ml-1 text-slate-500 hover:text-red-400"
                            onClick={() => handleDeleteFile(file.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleSendMessage} className="w-full flex items-end gap-2">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon" 
                    className="shrink-0 h-10 w-10 bg-slate-800 hover:bg-slate-700 border-slate-700"
                    onClick={handleFileUpload}
                  >
                    <Paperclip className="h-4 w-4 text-slate-400" />
                  </Button>
                  
                  <div className="relative w-full">
                    <Input
                      ref={inputRef}
                      placeholder="Type your message..."
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-200 pr-10 min-h-[40px] max-h-32 overflow-y-auto"
                      style={{ resize: 'vertical' }}
                      disabled={!activeConversation || isSubmitting}
                    />
                  </div>
                  
                  <Button 
                    type="submit"
                    variant="default" 
                    size="icon" 
                    className="shrink-0 h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!currentMessage.trim() || !activeConversation || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                  />
                </form>
              </>
            )}
          </CardFooter>
        </Card>
        
        {/* Create conversation dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle>New Conversation</DialogTitle>
              <DialogDescription className="text-slate-400">
                Create a new conversation with the AI Agent
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
                
                <div className="space-y-2">
                  <Label htmlFor="agent">Agent (Optional)</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectValue placeholder="Select an agent" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="default">No specific agent</SelectItem>
                      {/* Add debugging information */}
                      {agents.length === 0 && <SelectItem value="no-agents-found">No agents found</SelectItem>}
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createConversation.isPending || !newConversationTitle.trim()}
                  className="bg-blue-700 hover:bg-blue-800 text-white"
                >
                  {createConversation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    "Create Conversation"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}