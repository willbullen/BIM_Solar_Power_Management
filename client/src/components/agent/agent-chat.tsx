import { useState, useRef, useEffect } from 'react';
import { useAgentWebSocket } from '@/hooks/use-agent-websocket';
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
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot,
  Send,
  User,
  Cpu,
  Plus,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AgentMessage {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
  functionCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  functionResponse?: any;
}

interface Conversation {
  id: number;
  title: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export function AgentChat() {
  const [inputMessage, setInputMessage] = useState('');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [localMessages, setLocalMessages] = useState<AgentMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  
  // WebSocket connection
  const { isConnected } = useAgentWebSocket({
    onMessage: (message) => {
      if (activeConversation && message.conversationId === activeConversation.id) {
        // Add the new message to our local state
        setLocalMessages(prev => {
          // Check if message already exists
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      }
    }
  });
  
  // Fetch conversations
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['/api/agent/conversations'],
    select: (data) => data as Conversation[]
  });
  
  // Fetch messages for the active conversation
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/agent/conversations', activeConversation?.id, 'messages'],
    select: (data) => data as AgentMessage[],
    enabled: !!activeConversation?.id,
    onSuccess: (data) => {
      setLocalMessages(data);
    }
  });
  
  // Create a new conversation
  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      return await apiRequest('/api/agent/conversations', {
        method: 'POST',
        body: JSON.stringify({ title })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/conversations'] });
      setActiveConversation(data);
    }
  });
  
  // Send a message
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: number, content: string }) => {
      return await apiRequest(`/api/agent/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
    },
    onSuccess: (data) => {
      if (activeConversation) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/agent/conversations', activeConversation.id, 'messages'] 
        });
        // Optimistically add the user message to local state
        setLocalMessages(prev => [...prev, data]);
      }
    }
  });
  
  // Create a new conversation if none exists
  useEffect(() => {
    if (!conversationsLoading && conversations && conversations.length === 0) {
      createConversationMutation.mutate('New Conversation');
    } else if (!conversationsLoading && conversations && conversations.length > 0 && !activeConversation) {
      setActiveConversation(conversations[0]);
    }
  }, [conversations, conversationsLoading, createConversationMutation]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);
  
  // Handle sending a message
  const handleSendMessage = () => {
    if (!inputMessage.trim() || !activeConversation) return;
    
    sendMessageMutation.mutate({
      conversationId: activeConversation.id,
      content: inputMessage
    });
    
    setInputMessage('');
    
    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };
  
  // Create a new conversation
  const handleNewConversation = () => {
    createConversationMutation.mutate(`Conversation ${new Date().toLocaleTimeString()}`);
  };
  
  // Format message timestamp
  const formatMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };
  
  // Get avatar for message role
  const getMessageAvatar = (role: string) => {
    switch (role) {
      case 'user':
        return (
          <Avatar>
            <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
            <AvatarImage src="/user-avatar.png" />
          </Avatar>
        );
      case 'assistant':
        return (
          <Avatar>
            <AvatarFallback className="bg-blue-500 text-white"><Bot className="h-4 w-4" /></AvatarFallback>
            <AvatarImage src="/assistant-avatar.png" />
          </Avatar>
        );
      case 'function':
        return (
          <Avatar>
            <AvatarFallback className="bg-green-500 text-white"><Cpu className="h-4 w-4" /></AvatarFallback>
          </Avatar>
        );
      case 'system':
        return (
          <Avatar>
            <AvatarFallback className="bg-gray-500 text-white">S</AvatarFallback>
          </Avatar>
        );
      default:
        return (
          <Avatar>
            <AvatarFallback>?</AvatarFallback>
          </Avatar>
        );
    }
  };
  
  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle>AI Energy Advisor</CardTitle>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        <CardDescription className="flex justify-between items-center">
          <span>Ask about power consumption, environmental data, or recommendations</span>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1"
            onClick={handleNewConversation}
            disabled={createConversationMutation.isPending}
          >
            <Plus className="h-3 w-3" />
            New Chat
          </Button>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-[calc(600px-138px)] px-4">
          {messagesLoading ? (
            <div className="flex justify-center items-center h-40">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : localMessages.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-40 text-center px-4">
              <Bot className="h-10 w-10 mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No messages yet. Start a conversation with the AI Energy Advisor.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {localMessages.map((message) => (
                <div 
                  key={message.id} 
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role !== 'user' && getMessageAvatar(message.role)}
                  
                  <div 
                    className={`rounded-lg px-3 py-2 max-w-[80%] ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground'
                        : message.role === 'assistant'
                          ? 'bg-muted'
                          : message.role === 'function'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                  >
                    {message.role === 'function' && (
                      <div className="text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        Function Result
                      </div>
                    )}
                    
                    {message.functionCall && (
                      <div className="text-xs mb-2 bg-muted p-2 rounded-md">
                        <div className="font-medium">Function: {message.functionCall.name}</div>
                        <pre className="text-xs overflow-x-auto mt-1">
                          {JSON.stringify(message.functionCall.arguments, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    
                    {message.functionResponse && (
                      <div className="text-xs mt-2 bg-muted p-2 rounded-md">
                        <div className="font-medium">Response:</div>
                        <pre className="text-xs overflow-x-auto mt-1">
                          {JSON.stringify(message.functionResponse, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    <div className="text-xs mt-1 text-muted-foreground">
                      {formatMessageTime(message.timestamp)}
                    </div>
                  </div>
                  
                  {message.role === 'user' && getMessageAvatar(message.role)}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="pt-2">
        <form 
          className="flex w-full gap-2" 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <Textarea
            ref={inputRef}
            placeholder="Type your message here..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-grow resize-none"
            rows={2}
            disabled={!activeConversation || sendMessageMutation.isPending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button 
            type="submit"
            size="icon"
            disabled={!inputMessage.trim() || !activeConversation || sendMessageMutation.isPending}
            className="self-end"
          >
            {sendMessageMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}