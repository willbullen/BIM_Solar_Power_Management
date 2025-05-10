import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EnhancedMessage } from "@/components/ui/enhanced-message";
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
  QrCode,
  Copy
} from "lucide-react";

// Types for AI Chat
interface Conversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

// Types for file attachments
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

// Types for Telegram
interface TelegramMessage {
  id: number;
  telegramUserId: number;
  direction: string;
  messageText: string;
  messageId?: string;
  timestamp: string;
  isProcessed: boolean;
  conversationId?: number;
}

interface TelegramUser {
  id: number;
  userId: number;
  telegramId: string;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  chatId: string;
  notificationsEnabled: boolean;
  receiveAlerts: boolean;
  receiveReports: boolean;
  createdAt: string;
  updatedAt: string;
  lastAccessed?: string;
  verificationCode?: string;
  verificationExpires?: string;
  isVerified: boolean;
}

interface TelegramVerificationResponse {
  verificationCode: string;
  instructions: string;
}

export function IntegratedAIChat() {
  const { toast } = useToast();
  const { user } = useAuth(); // Get the authenticated user
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const telegramInputRef = useRef<HTMLInputElement>(null);
  
  // AI Chat state
  const [message, setMessage] = useState("");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [newConversationTitle, setNewConversationTitle] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Telegram state
  const [testMessage, setTestMessage] = useState("");
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<TelegramVerificationResponse | null>(null);
  
  // Integrated UI state
  const [activeTab, setActiveTab] = useState<"ai" | "telegram">("ai");
  
  // Fetch conversations
  const { data: conversations = [], isLoading: loadingConversations, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ['/api/agent/conversations'],
    retry: false,
    enabled: !!user // Only fetch conversations when the user is authenticated
  });
  
  // Set active conversation when conversations are loaded
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConversation) {
      // Set the first conversation as active when loaded
      setActiveConversation(conversations[0]);
    }
  }, [conversations, activeConversation]);
  
  // Fetch messages for active conversation
  const { data: messages = [], isLoading: loadingMessages, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ['/api/agent/conversations', activeConversation?.id, 'messages'],
    enabled: !!activeConversation && typeof activeConversation.id === 'number',
    retry: false
  });
  
  // Fetch files for active conversation
  const { data: files = [], isLoading: loadingFiles, refetch: refetchFiles } = useQuery<FileAttachment[]>({
    queryKey: ['/api/files/conversation', activeConversation?.id],
    // Only enable this query when we have a valid conversation ID
    enabled: !!activeConversation && typeof activeConversation.id === 'number'
  });
  
  // Fetch Telegram user info
  const { data: telegramUser = null, isLoading: loadingTelegramUser, refetch: refetchTelegramUser } = useQuery<TelegramUser | null>({
    queryKey: ['/api/telegram/user'],
    retry: false
  });
  
  // Fetch Telegram messages
  const { data: telegramMessages = [], isLoading: loadingTelegramMessages, refetch: refetchTelegramMessages } = useQuery<TelegramMessage[]>({
    queryKey: ['/api/telegram/messages'],
    retry: false,
    enabled: !!telegramUser && telegramUser.isVerified === true,
    refetchInterval: 10000 // Poll for new messages every 10 seconds
  });
  
  // Effect to handle new Telegram messages
  useEffect(() => {
    if (telegramMessages && telegramMessages.length > 0) {
      // Notify user about new messages if this is not the initial load
      const prevMessageCount = localStorage.getItem('telegramMessageCount');
      const currentCount = telegramMessages.length.toString();
      
      if (prevMessageCount && parseInt(prevMessageCount) < telegramMessages.length) {
        const newMessagesCount = telegramMessages.length - parseInt(prevMessageCount);
        
        toast({
          title: "New Telegram Message",
          description: `You have ${newMessagesCount} new message${newMessagesCount > 1 ? 's' : ''} from Telegram`,
          action: (
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-blue-900/30 text-blue-200 border-blue-800 hover:bg-blue-800"
              onClick={() => setActiveTab("telegram")}
            >
              View
            </Button>
          )
        });
      }
      
      // Store the current count for next comparison
      localStorage.setItem('telegramMessageCount', currentCount);
      
      // Scroll to bottom after messages load
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [telegramMessages, toast]);
  
  // Authentication refresh effect - Added after all refetch functions are defined
  useEffect(() => {
    if (user) {
      // User is logged in, refresh conversations and other data
      refetchConversations();
      
      // If there are existing messages but user changed, refresh them
      if (activeConversation?.id) {
        refetchMessages();
        refetchFiles();
      }
      
      // If Telegram user info exists, refresh it as well
      if (telegramUser) {
        refetchTelegramUser();
        refetchTelegramMessages();
      }
    }
  }, [user?.id, refetchConversations, refetchMessages, refetchFiles, refetchTelegramUser, 
      refetchTelegramMessages, activeConversation?.id, telegramUser]);
  
  // Create a new conversation
  const createConversation = useMutation({
    mutationFn: (title: string) => 
      apiRequest('/api/agent/conversations', {
        method: 'POST',
        data: { title }
      }),
    onSuccess: (data) => {
      setActiveConversation(data);
      setShowCreateDialog(false);
      setNewConversationTitle("");
      refetchConversations();
      toast({
        title: "Conversation created",
        description: "New conversation has been created"
      });
    },
    onError: (error: Error) => {
      console.error("Conversation creation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create conversation: " + error.message
      });
    }
  });
  
  // Delete a conversation
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: number) => {
      // Ensure the user is authenticated
      if (!user || !user.id) {
        throw new Error("You must be logged in to delete a conversation");
      }
      
      try {
        const response = await apiRequest(`/api/agent/conversations/${conversationId}`, {
          method: 'DELETE'
        });
        return response;
      } catch (err: any) {
        // Check if this is a 404 error (conversation not found)
        if (err.status === 404) {
          // Instead of throwing an error, we'll handle this gracefully
          console.log(`Conversation ${conversationId} already deleted or not found`);
          // Return a success value to trigger onSuccess handler
          return { success: true, notFound: true };
        }
        // Rethrow other errors
        throw err;
      }
    },
    onSuccess: (data: any) => {
      setActiveConversation(null);
      refetchConversations();
      
      // Check if it was a "not found" situation
      if (data && data.notFound) {
        toast({
          title: "Conversation updated",
          description: "Conversation already removed. List refreshed."
        });
      } else {
        toast({
          title: "Conversation deleted",
          description: "The conversation has been deleted"
        });
      }
    },
    onError: (error: Error) => {
      console.error("Conversation deletion error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete conversation: " + error.message
      });
    }
  });
  
  // Send a message to AI Chat
  const sendMessage = useMutation({
    mutationFn: (content: string) => 
      apiRequest(`/api/agent/conversations/${activeConversation?.id}/messages`, {
        method: 'POST',
        data: { content }
      }),
    onSuccess: () => {
      setMessage("");
      refetchMessages();
      // Refetch after a short delay to get the AI response
      setTimeout(() => {
        refetchMessages();
        scrollToBottom();
      }, 1000);
    },
    onError: (error: Error) => {
      console.error("Send message error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message: " + error.message
      });
    }
  });
  
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
        description: "The message has been deleted"
      });
    },
    onError: (error: Error) => {
      console.error("Delete message error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete message: " + error.message
      });
    }
  });
  
  // Upload files
  const uploadFiles = async (files: File[], conversationId?: number, messageId?: number) => {
    if (files.length === 0) return;
    
    setUploading(true);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        if (conversationId) {
          formData.append('conversationId', conversationId.toString());
        }
        
        if (messageId) {
          formData.append('messageId', messageId.toString());
        }
        
        // Use isPublic: false for default privacy setting
        formData.append('isPublic', 'false');
        
        return await apiRequest('/api/files/upload', {
          method: 'POST',
          data: formData
        });
      });
      
      await Promise.all(uploadPromises);
      
      // Clear uploading files
      setUploading(false);
      
      // Refetch files
      refetchFiles();
      
      toast({
        title: "Files uploaded",
        description: `Successfully uploaded ${files.length} file(s)`
      });
    } catch (error) {
      console.error('File upload error:', error);
      setUploading(false);
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: "Failed to upload files"
      });
    }
  };
  
  // Generate verification code for Telegram
  const generateVerification = useMutation({
    mutationFn: () => 
      apiRequest('/api/telegram/verify', {
        method: 'POST'
      }),
    onSuccess: (data: TelegramVerificationResponse) => {
      setVerificationDetails(data);
      setShowVerificationDialog(true);
    },
    onError: (error: Error) => {
      console.error("Verification generation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate verification code: " + error.message
      });
    }
  });
  
  // Send test message to Telegram
  const sendTelegramMessage = useMutation({
    mutationFn: (message: string) => 
      apiRequest('/api/telegram/test-message', {
        method: 'POST',
        data: { message }
      }),
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Test message was sent successfully to your Telegram account."
      });
      setTestMessage("");
      // Refetch messages after sending
      setTimeout(() => {
        refetchTelegramMessages();
      }, 1000);
    },
    onError: (error: Error) => {
      console.error("Send test message error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send test message: " + error.message
      });
    }
  });
  
  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0 && activeConversation) {
      uploadFiles(Array.from(selectedFiles), activeConversation.id);
      e.target.value = ''; // Reset the input
    }
  };
  
  const handleTelegramFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0 && telegramUser?.isVerified) {
      // First, upload the file
      try {
        setUploading(true);
        const formData = new FormData();
        
        // Add all files
        Array.from(selectedFiles).forEach(file => {
          formData.append('file', file);
        });
        
        // Use isPublic: false for default privacy setting
        formData.append('isPublic', 'false');
        
        // Upload files
        const uploadResults = await apiRequest('/api/files/upload', {
          method: 'POST',
          data: formData
        });
        
        // Create a message with the file references
        if (Array.isArray(uploadResults) && uploadResults.length > 0) {
          const fileLinks = uploadResults.map((file: any) => 
            `[File: ${file.filename}](/api/files/${file.id}/download)`
          ).join('\n');
          
          const messageWithFiles = `I'm sending you these files:\n${fileLinks}`;
          
          // Send message with file references
          await sendTelegramMessage.mutateAsync(messageWithFiles);
        }
        
        setUploading(false);
        e.target.value = ''; // Reset the input
        
        toast({
          title: "Files sent to Telegram",
          description: `Successfully sent ${selectedFiles.length} file(s)`
        });
      } catch (error) {
        console.error('Error sending files to Telegram:', error);
        setUploading(false);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to send files to Telegram"
        });
      }
    }
  };
  
  // Dialog handlers
  const handleCreateConversation = (e: React.FormEvent) => {
    e.preventDefault();
    if (newConversationTitle.trim()) {
      createConversation.mutate(newConversationTitle);
    }
  };
  
  // Message sending handlers
  const handleSendAIMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    if (!activeConversation) {
      // Create a new conversation first, then send message
      const defaultTitle = `Conversation ${new Date().toLocaleString()}`;
      createConversation.mutate(defaultTitle, {
        onSuccess: (newConversation) => {
          // Now we can send the message
          setTimeout(() => {
            if (newConversation && newConversation.id) {
              // Temporarily set the active conversation
              setActiveConversation(newConversation);
              // Use a direct API call here since our mutation relies on activeConversation
              apiRequest(`/api/agent/conversations/${newConversation.id}/messages`, {
                method: 'POST',
                data: { content: message }
              })
                .then(() => {
                  setMessage("");
                  refetchMessages();
                  // Refetch after a short delay to get the AI response
                  setTimeout(() => {
                    refetchMessages();
                    scrollToBottom();
                  }, 1000);
                })
                .catch(error => {
                  console.error("Send message error:", error);
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to send message: " + error.message
                  });
                });
            }
          }, 500); // Small delay to ensure conversation is created first
        }
      });
    } else {
      // Regular flow with existing conversation
      sendMessage.mutate(message);
    }
  };
  
  const handleSendTelegramMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim() || !telegramUser?.isVerified) return;
    
    sendTelegramMessage.mutate(testMessage);
  };
  
  // Copy verification code to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied",
        description: "Verification code copied to clipboard"
      });
    });
  };
  
  // Keyboard event handlers
  const handleAIKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAIMessage(e as any);
    }
  };
  
  const handleTelegramKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendTelegramMessage(e as any);
    }
  };
  
  // Utils
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };
  
  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Check if the user has a verified Telegram account
  const isTelegramConnected = !!telegramUser?.isVerified;
  
  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, telegramMessages, activeTab]);
  
  // Format filename for display
  const formatFilename = (filename: string, maxLength = 20) => {
    if (filename.length <= maxLength) return filename;
    
    const extension = filename.split('.').pop() || '';
    const name = filename.slice(0, -(extension.length + 1));
    
    return `${name.slice(0, maxLength - extension.length - 3)}...${extension}`;
  };
  
  // Get file icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <File className="h-4 w-4" />;
    if (fileType.startsWith('text/')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };
  
  // Download a file
  const downloadFile = (fileId: number, filename: string) => {
    window.open(`/api/files/${fileId}/download`, '_blank');
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Sidebar with conversation list */}
      <Card className="md:col-span-1 bg-slate-900 border-slate-800 shadow-md h-[calc(100vh-12rem)]">
        <CardHeader className="pb-2 border-b border-slate-800 px-3 py-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-1">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm">Conversations</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-full hover:bg-slate-800"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4 text-blue-400" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-2 p-2">
              <Tabs defaultValue="ai" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger 
                    value="ai"
                    className="text-xs"
                    onClick={() => setActiveTab("ai")}
                  >
                    <Bot className="h-4 w-4 mr-1" />
                    AI Chat
                  </TabsTrigger>
                  <TabsTrigger 
                    value="telegram"
                    className="text-xs"
                    onClick={() => setActiveTab("telegram")}
                  >
                    <MessageCircle className="h-4 w-4 mr-1" />
                    Telegram
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {activeTab === "ai" ? (
                // AI Conversations List
                loadingConversations ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : conversations && conversations.length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`p-3 rounded-md cursor-pointer hover:bg-slate-800 transition-colors ${
                          activeConversation?.id === conversation.id ? 'bg-slate-800' : ''
                        } relative group`}
                        onClick={() => setActiveConversation(conversation)}
                      >
                        <div className="font-medium text-sm text-slate-200">{conversation.title}</div>
                        <div className="text-xs text-slate-400">{new Date(conversation.updatedAt).toLocaleString()}</div>
                        
                        {/* Delete button - visible on hover */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Are you sure you want to delete this conversation?")) {
                              deleteConversation.mutate(conversation.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 p-4 mt-2">
                    No conversations yet
                  </div>
                )
              ) : (
                // Telegram section
                !isTelegramConnected ? (
                  <div className="mt-2 p-2">
                    <Alert className="bg-blue-900/30 border-blue-800 text-blue-100">
                      <AlertCircle className="h-4 w-4 text-blue-400" />
                      <AlertTitle className="text-blue-100 text-sm">Not Connected</AlertTitle>
                      <AlertDescription className="text-blue-200 text-xs">
                        Connect your Telegram account to chat with the AI Agent via Telegram.
                        <Button 
                          className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1"
                          onClick={() => generateVerification.mutate()}
                          disabled={generateVerification.isPending}
                        >
                          {generateVerification.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <QrCode className="mr-2 h-3 w-3" />
                              Connect Telegram
                            </>
                          )}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="p-2 mt-2">
                    <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-md border border-slate-700">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-6 w-6 bg-blue-700">
                          <AvatarFallback className="bg-blue-700 text-xs">TG</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-medium text-slate-200">
                            {telegramUser?.telegramUsername || 'Telegram User'}
                          </p>
                          <p className="text-[10px] text-slate-400">Connected</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-800 px-2 py-0 text-[10px]">
                        <Check className="h-3 w-3 mr-1 text-green-500" />
                        Active
                      </Badge>
                    </div>
                  </div>
                )
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main content */}
      <Card className="md:col-span-3 bg-slate-900 border-slate-800 shadow-md h-[calc(100vh-12rem)] flex flex-col">
        {activeTab === "ai" ? (
          /* AI Chat Interface */
          <>
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
                    Start a new conversation with the AI agent to get assistance, insights, or answers to your questions.
                  </p>
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    New Conversation
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-22rem)] p-4">
                  {loadingMessages ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                    </div>
                  ) : messages && messages.length > 0 ? (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div 
                          key={msg.id} 
                          id={`message-${msg.id}`}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div 
                            className={`max-w-[85%] rounded-lg px-4 py-2 relative group ${
                              msg.role === 'user' 
                                ? 'bg-blue-600 text-white' 
                                : msg.role === 'system'
                                ? 'bg-green-900/50 text-slate-200 border border-green-800/50'
                                : 'bg-slate-800 text-slate-100'
                            }`}
                          >
                            {/* Delete message button - only show for user messages */}
                            {msg.role === 'user' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-900/80 hover:bg-red-800 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  if (window.confirm("Delete this message?")) {
                                    deleteMessage.mutate({
                                      conversationId: activeConversation.id,
                                      messageId: msg.id
                                    });
                                  }
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                            
                            {/* Enhanced message content with parsing */}
                            <div className="text-sm">
                              {msg.content && msg.content.trim() ? (
                                <EnhancedMessage 
                                  content={msg.content} 
                                  role={msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system' 
                                    ? msg.role 
                                    : 'assistant'} 
                                  timestamp={msg.createdAt} 
                                />
                              ) : (
                                <span className="text-slate-400 italic">Message content unavailable</span>
                              )}
                            </div>
                            
                            {/* Message metadata */}
                            <div className="text-xs mt-1 flex items-center justify-end opacity-70">
                              <span className="mr-1">{formatMessageTime(msg.createdAt)}</span>
                              {msg.role === 'assistant' && (
                                <Bot className="h-3 w-3 ml-1" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 text-slate-400">
                      <MessageSquare className="h-12 w-12 text-slate-500/50" />
                      <p className="text-sm">No messages yet. Start the conversation by sending a message.</p>
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
            
            {/* Display files if any */}
            {files && files.length > 0 && (
              <div className="p-3 border-t border-slate-800">
                <div className="text-xs text-slate-400 mb-2">Attached Files:</div>
                <ScrollArea className="max-h-24">
                  <div className="flex flex-wrap gap-2">
                    {files.map((file) => (
                      <div 
                        key={file.id}
                        className="flex items-center bg-slate-800 rounded-md px-2 py-1 text-xs border border-slate-700"
                      >
                        {getFileIcon(file.fileType)}
                        <span className="mx-1 text-slate-300">{formatFilename(file.filename)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-slate-700 rounded-full ml-1"
                          onClick={() => downloadFile(file.id, file.filename)}
                        >
                          <Download className="h-3 w-3 text-blue-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            <CardFooter className="p-3 border-t border-slate-800">
              {activeConversation ? (
                <form onSubmit={handleSendAIMessage} className="w-full flex space-x-2">
                  <Input
                    className="flex-grow bg-slate-800 border-slate-700 text-white"
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleAIKeyDown}
                    disabled={sendMessage.isPending}
                  />
                  
                  {/* File upload button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="bg-slate-800 hover:bg-slate-700 border-slate-700"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!activeConversation || uploading}
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          ) : (
                            <Paperclip className="h-4 w-4 text-blue-400" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Upload files</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    multiple
                  />
                  
                  <Button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!message.trim() || sendMessage.isPending}
                  >
                    {sendMessage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              ) : (
                <div className="w-full flex flex-col space-y-2">
                  <form onSubmit={handleSendAIMessage} className="w-full flex space-x-2">
                    <Input
                      className="flex-grow bg-slate-800 border-slate-700 text-white"
                      placeholder="Type to start a new conversation..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={handleAIKeyDown}
                    />
                    <Button 
                      type="submit" 
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={!message.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                  
                  <div className="flex items-center justify-center w-full">
                    <div className="border-t border-slate-700 w-full"></div>
                    <span className="text-xs text-slate-500 px-2">or</span>
                    <div className="border-t border-slate-700 w-full"></div>
                  </div>
                  
                  <Button 
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Create Named Conversation
                  </Button>
                </div>
              )}
            </CardFooter>
          </>
        ) : (
          /* Telegram Chat Interface */
          <>
            <CardHeader className="pb-2 border-b border-slate-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8 bg-blue-700">
                    <AvatarImage src="/telegram-logo.svg" alt="Telegram" />
                    <AvatarFallback className="bg-blue-700 text-white">TG</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-sm text-white">Telegram Chat</CardTitle>
                    <CardDescription className="text-xs text-gray-400">
                      {isTelegramConnected 
                        ? `Connected as ${telegramUser?.telegramUsername || 'User'}`
                        : 'Not connected'}
                    </CardDescription>
                  </div>
                </div>
                {isTelegramConnected && (
                  <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-800 px-2 py-0 text-xs">
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                    Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="p-0 flex-grow overflow-hidden">
              <ScrollArea className="h-[calc(100vh-22rem)] p-4">
                {loadingTelegramMessages ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                  </div>
                ) : !isTelegramConnected ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 text-slate-400">
                    <MessageCircle className="h-12 w-12 text-slate-500/50" />
                    <p className="text-sm">Connect your Telegram account to see messages</p>
                  </div>
                ) : telegramMessages && telegramMessages.length > 0 ? (
                  <div className="space-y-4">
                    {telegramMessages.map((message) => (
                      <div 
                        key={message.id}
                        className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            message.direction === 'outbound' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-800 text-slate-100'
                          }`}
                        >
                          <div className="text-sm">
                            {message.messageText && message.messageText.trim() ? (
                              <EnhancedMessage 
                                content={message.messageText} 
                                role={message.direction === 'outbound' ? 'user' : 'assistant'}
                                timestamp={message.timestamp}
                              />
                            ) : (
                              <span className="text-slate-400 italic">Message content unavailable</span>
                            )}
                          </div>
                          <div className="text-xs mt-1 flex items-center justify-end opacity-70">
                            <span>{formatMessageTime(message.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 text-slate-400">
                    <MessageCircle className="h-12 w-12 text-slate-500/50" />
                    <p className="text-sm">No messages yet. Send a test message below or message the bot on Telegram.</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
            
            <CardFooter className="p-3 border-t border-slate-800">
              {isTelegramConnected ? (
                <form onSubmit={handleSendTelegramMessage} className="w-full flex space-x-2">
                  <Input
                    className="flex-grow bg-slate-800 border-slate-700 text-white"
                    placeholder="Send a message via Telegram..."
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    onKeyDown={handleTelegramKeyDown}
                    disabled={sendTelegramMessage.isPending}
                  />
                  
                  {/* File upload button for Telegram */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="bg-slate-800 hover:bg-slate-700 border-slate-700"
                          onClick={() => telegramInputRef.current?.click()}
                          disabled={!isTelegramConnected || uploading}
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          ) : (
                            <Paperclip className="h-4 w-4 text-blue-400" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Send files via Telegram</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <input
                    type="file"
                    ref={telegramInputRef}
                    className="hidden"
                    onChange={handleTelegramFileSelect}
                    multiple
                  />
                  
                  <Button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!testMessage.trim() || sendTelegramMessage.isPending}
                  >
                    {sendTelegramMessage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              ) : (
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => generateVerification.mutate()}
                  disabled={generateVerification.isPending}
                >
                  {generateVerification.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Connection Code...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Connect to Telegram
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </>
        )}
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
      
      {/* Telegram verification dialog */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Connect Telegram Account</DialogTitle>
            <DialogDescription className="text-slate-400">
              Follow the instructions below to connect your Telegram account.
            </DialogDescription>
          </DialogHeader>
          {verificationDetails && (
            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-md">
                <p className="text-sm text-slate-300 mb-2">{verificationDetails.instructions}</p>
                <div className="flex items-center space-x-2">
                  <code className="bg-slate-700 px-3 py-1 rounded text-blue-300 flex-grow">
                    /verify {verificationDetails.verificationCode}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-slate-700 hover:bg-slate-600"
                    onClick={() => copyToClipboard(`/verify ${verificationDetails.verificationCode}`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-md space-y-2">
                <h4 className="font-medium flex items-center">
                  <ChevronRight className="h-4 w-4 mr-2 text-blue-400" />
                  Steps to Connect:
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                  <li>Open Telegram on your phone or desktop</li>
                  <li>Search for the bot: <span className="font-mono bg-slate-700 px-1 rounded">@evirobot</span></li>
                  <li>Start a chat with the bot by clicking "Start" or sending "/start"</li>
                  <li>Copy and send the verification command above</li>
                  <li>Once verified, you'll see a confirmation message</li>
                </ol>
                <p className="text-sm text-slate-400 italic mt-2">
                  This verification code will expire in 15 minutes for security.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setShowVerificationDialog(false);
                // Refetch user status after closing dialog in case they've verified
                setTimeout(() => {
                  refetchTelegramUser();
                }, 1000);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}