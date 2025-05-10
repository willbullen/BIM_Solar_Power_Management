import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import {
  Loader2,
  MessageSquare,
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
  RefreshCw,
  PlusCircle
} from "lucide-react";
import { EnhancedMessage } from "./enhanced-message";

// Types for conversations
interface Conversation {
  id: number;
  title: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

// Types for messages
interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  functionName?: string;
  functionArgs?: string;
  functionResponse?: string;
  createdAt: string;
}

// Types for file attachments
interface FileAttachment {
  id: number;
  conversationId?: number;
  messageId?: number;
  filename: string;
  originalFilename: string;
  fileType: string;
  filePath: string;
  fileSize: number;
  isPublic: boolean;
  createdAt: string;
  createdBy?: number;
  metadata?: any;
}

export function AIChat() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ['/api/agent/conversations'],
    onSuccess: (data) => {
      // Set the first conversation as active if there is no active conversation
      if (data && data.length > 0 && !activeConversation) {
        setActiveConversation(data[0]);
      }
    },
    onError: (error) => {
      console.error('Error fetching conversations:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load conversations"
      });
    }
  });
  
  // Fetch messages for active conversation
  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ['/api/agent/conversations', activeConversation?.id, 'messages'],
    enabled: !!activeConversation,
    onSuccess: () => {
      // Scroll to bottom after messages load
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    },
    onError: (error) => {
      console.error('Error fetching messages:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load messages"
      });
    }
  });
  
  // Fetch files for active conversation
  const { data: files, isLoading: loadingFiles, refetch: refetchFiles } = useQuery<FileAttachment[]>({
    queryKey: ['/api/files/conversation', activeConversation?.id],
    // Only enable this query when we have a valid conversation ID
    enabled: !!activeConversation && typeof activeConversation.id === 'number',
    onError: (error) => {
      console.error('Error fetching files for conversation:', error);
      // Don't show toast errors for file loading as it's not critical
    }
  });
  
  // Send a message
  const sendMessage = useMutation({
    mutationFn: (newMessage: string) => 
      apiRequest(`/api/agent/conversations/${activeConversation?.id}/messages`, {
        method: 'POST',
        data: { content: newMessage }
      }),
    onSuccess: () => {
      // Clear the message input
      setMessage("");
      
      // Refetch messages
      refetchMessages();
      
      // Scroll to bottom
      setTimeout(() => {
        scrollToBottom();
      }, 500);
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
  
  // Create new conversation
  const createConversation = useMutation({
    mutationFn: (title: string) => 
      apiRequest('/api/agent/conversations', {
        method: 'POST',
        data: { title }
      }),
    onSuccess: (data: Conversation) => {
      // Refetch conversations
      refetchConversations();
      
      // Set the new conversation as active
      setActiveConversation(data);
      
      toast({
        title: "Conversation Created",
        description: "New conversation has been created"
      });
    },
    onError: (error: Error) => {
      console.error("Create conversation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create conversation: " + error.message
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
        
        // Make the API request
        return await apiRequest('/api/files/upload', {
          method: 'POST',
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      });
      
      await Promise.all(uploadPromises);
      
      // Clear uploading files
      setUploadingFiles([]);
      
      // Refetch files
      refetchFiles();
      
      toast({
        title: "Files Uploaded",
        description: `Successfully uploaded ${files.length} file(s)`
      });
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload files"
      });
    } finally {
      setUploading(false);
    }
  };
  
  // Delete a file
  const deleteFile = async (fileId: number) => {
    try {
      await apiRequest(`/api/files/${fileId}`, {
        method: 'DELETE'
      });
      
      // Refetch files
      refetchFiles();
      
      toast({
        title: "File Deleted",
        description: "File has been deleted"
      });
    } catch (error) {
      console.error("File delete error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete file"
      });
    }
  };
  
  // Handle file selection for upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      // Convert FileList to Array
      const filesArray = Array.from(event.target.files);
      setUploadingFiles(filesArray);
    }
  };
  
  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Remove a file from the upload list
  const removeFileFromUpload = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeConversation) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No active conversation"
      });
      return;
    }
    
    if (!message.trim() && uploadingFiles.length === 0) return;
    
    // If there are files to upload, upload them first
    if (uploadingFiles.length > 0) {
      uploadFiles(uploadingFiles, activeConversation.id)
        .then(() => {
          // Send the message if there is one
          if (message.trim()) {
            sendMessage.mutate(message);
          }
        });
    } else if (message.trim()) {
      // Just send the message if there are no files
      sendMessage.mutate(message);
    }
  };
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };
  
  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Handle enter key for message sending
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };
  
  // Format file size for display
  const formatFileSize = (sizeInBytes: number): string => {
    if (sizeInBytes < 1024) {
      return sizeInBytes + ' B';
    } else if (sizeInBytes < 1024 * 1024) {
      return (sizeInBytes / 1024).toFixed(1) + ' KB';
    } else if (sizeInBytes < 1024 * 1024 * 1024) {
      return (sizeInBytes / (1024 * 1024)).toFixed(1) + ' MB';
    } else {
      return (sizeInBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
  };
  
  // Get icon for file type
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <File className="h-4 w-4" />;
    } else if (fileType.startsWith('text/')) {
      return <FileText className="h-4 w-4" />;
    } else {
      return <Paperclip className="h-4 w-4" />;
    }
  };
  
  // Render conversation list
  const renderConversationList = () => {
    if (loadingConversations) {
      return (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
      );
    }
    
    if (!conversations || conversations.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 text-slate-400">
          <MessageSquare className="h-12 w-12 text-slate-500/50" />
          <p className="text-sm">No conversations yet</p>
          <Button 
            size="sm"
            className="mt-2"
            onClick={() => createConversation.mutate("New Conversation")}
            disabled={createConversation.isPending}
          >
            {createConversation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4 mr-2" />
            )}
            Create New
          </Button>
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {conversations.map((conversation) => (
          <div 
            key={conversation.id}
            className={`p-2 rounded-md cursor-pointer flex items-center justify-between ${
              activeConversation?.id === conversation.id 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            onClick={() => setActiveConversation(conversation)}
          >
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm truncate max-w-[150px]">{conversation.title}</span>
            </div>
            <Badge 
              variant="outline" 
              className={activeConversation?.id === conversation.id 
                ? "bg-blue-700/50 text-blue-100 border-blue-500"
                : "bg-slate-800 text-slate-300 border-slate-700"
              }
            >
              {new Date(conversation.createdAt).toLocaleDateString()}
            </Badge>
          </div>
        ))}
        
        <Button 
          size="sm"
          className="w-full mt-4"
          onClick={() => createConversation.mutate("New Conversation")}
          disabled={createConversation.isPending}
        >
          {createConversation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PlusCircle className="h-4 w-4 mr-2" />
          )}
          New Conversation
        </Button>
      </div>
    );
  };
  
  // Render file attachments
  const renderFileAttachments = () => {
    if (loadingFiles) {
      return (
        <div className="flex justify-center items-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        </div>
      );
    }
    
    if (!files || files.length === 0) {
      return (
        <div className="p-4 text-center text-slate-400 text-sm">
          No files attached to this conversation
        </div>
      );
    }
    
    return (
      <div className="space-y-2 p-2">
        {files.map((file) => (
          <div 
            key={file.id}
            className="flex items-center justify-between p-2 rounded-md bg-slate-800 text-slate-300 text-xs"
          >
            <div className="flex items-center space-x-2 overflow-hidden">
              {getFileIcon(file.fileType)}
              <span className="truncate max-w-[120px]">{file.originalFilename}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 text-xs">{formatFileSize(file.fileSize)}</span>
              <a 
                href={`/api/files/${file.id}/download`}
                download={file.originalFilename}
                className="p-1 rounded-sm hover:bg-slate-700"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-3 w-3 text-blue-400" />
              </a>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 p-1 rounded-sm hover:bg-red-900/30 hover:text-red-300"
                onClick={() => deleteFile(file.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Render message history
  const renderMessages = () => {
    if (loadingMessages) {
      return (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
      );
    }
    
    if (!activeConversation) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 text-slate-400">
          <MessageSquare className="h-12 w-12 text-slate-500/50" />
          <p className="text-sm">Select or create a conversation to start chatting</p>
        </div>
      );
    }
    
    if (!messages || messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 text-slate-400">
          <MessageSquare className="h-12 w-12 text-slate-500/50" />
          <p className="text-sm">No messages in this conversation</p>
          <p className="text-xs">Start typing below to chat with the AI agent</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="message-container">
            <EnhancedMessage
              message={message}
              onDelete={() => refetchMessages()}
              onRefresh={() => refetchMessages()}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  };
  
  // Render uploading files
  const renderUploadingFiles = () => {
    if (uploadingFiles.length === 0) return null;
    
    return (
      <div className="mt-2 space-y-2 bg-slate-800/50 p-2 rounded-md">
        <div className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-700 pb-1">
          <span>Files to upload ({uploadingFiles.length})</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 p-1 rounded-sm hover:bg-slate-700"
            onClick={() => setUploadingFiles([])}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        {uploadingFiles.map((file, index) => (
          <div 
            key={index}
            className="flex items-center justify-between text-xs p-1"
          >
            <div className="flex items-center space-x-2 overflow-hidden">
              <Paperclip className="h-3 w-3 text-blue-400" />
              <span className="truncate max-w-[180px] text-slate-300">{file.name}</span>
              <span className="text-slate-400">{formatFileSize(file.size)}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 p-1 rounded-sm hover:bg-red-900/30 hover:text-red-300"
              onClick={() => removeFileFromUpload(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        
        {uploading ? (
          <div className="flex items-center justify-center py-1">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400 mr-2" />
            <span className="text-xs text-slate-300">Uploading...</span>
          </div>
        ) : (
          <div className="flex justify-end pt-1">
            <Button 
              size="sm" 
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (activeConversation) {
                  uploadFiles(uploadingFiles, activeConversation.id);
                }
              }}
            >
              <Upload className="h-3 w-3 mr-1" />
              Upload Now
            </Button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow overflow-hidden bg-slate-900 border-slate-800 shadow-md">
        <CardHeader className="pb-2 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8 bg-blue-700">
                <AvatarFallback className="bg-blue-700 text-white">AI</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm text-white">AI Chat</CardTitle>
                <CardDescription className="text-xs text-gray-400">
                  Unified interface for AI conversations
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-800 px-2 py-0 text-xs">
              <Bot className="h-3 w-3 mr-1 text-green-500" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        
        <div className="grid grid-cols-4 h-[calc(100%-8rem)]">
          {/* Sidebar with conversations */}
          <div className="col-span-1 border-r border-slate-800 p-4 overflow-hidden flex flex-col h-full">
            <h3 className="text-sm font-medium text-slate-200 mb-3">Conversations</h3>
            <ScrollArea className="flex-grow">
              {renderConversationList()}
            </ScrollArea>
            <Separator className="my-4" />
            <h3 className="text-sm font-medium text-slate-200 mb-2">Files</h3>
            <ScrollArea className="h-48 border-t border-slate-800 pt-2">
              {renderFileAttachments()}
            </ScrollArea>
          </div>
          
          {/* Main chat area */}
          <div className="col-span-3 overflow-hidden flex flex-col">
            <ScrollArea className="flex-grow p-4">
              {renderMessages()}
            </ScrollArea>
          </div>
        </div>
        
        <CardFooter className="border-t border-slate-800 p-4">
          <form onSubmit={handleSendMessage} className="w-full space-y-2">
            {renderUploadingFiles()}
            
            <div className="flex space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
                      onClick={triggerFileInput}
                      disabled={!activeConversation}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Attach files</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Input
                className="flex-grow bg-slate-800 border-slate-700 text-white"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sendMessage.isPending || !activeConversation}
              />
              
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={(!message.trim() && uploadingFiles.length === 0) || sendMessage.isPending || !activeConversation}
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {/* Hidden file input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden"
              multiple 
              onChange={handleFileSelect}
              disabled={!activeConversation}
            />
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}