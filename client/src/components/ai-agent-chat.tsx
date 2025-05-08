import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Send } from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

type Message = {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  functionCall?: {
    name: string;
    arguments: any;
  };
  functionResponse?: any;
  timestamp: string;
};

type Conversation = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  messages: Message[];
};

export default function AIAgentChat() {
  const [activeTab, setActiveTab] = useState('chat');
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if OpenAI API key is configured
  useEffect(() => {
    checkApiKeyStatus();
  }, []);

  // Fetch conversations on component mount
  useEffect(() => {
    if (apiKeyConfigured) {
      fetchConversations();
    }
  }, [apiKeyConfigured]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const response = await apiRequest<Conversation[]>('GET', '/api/agent/conversations');
      setConversations(response);
      
      // If there's at least one conversation, set it as active
      if (response.length > 0 && !activeConversation) {
        await fetchConversation(response[0].id);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch conversations',
        variant: 'destructive',
      });
    }
  };

  const fetchConversation = async (conversationId: number) => {
    try {
      const response = await apiRequest<Conversation>('GET', `/api/agent/conversations/${conversationId}`);
      setActiveConversation(response);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch conversation',
        variant: 'destructive',
      });
    }
  };

  const createNewConversation = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest<Conversation>('POST', '/api/agent/conversations', {
        title: 'New Conversation',
      });
      
      setConversations(prev => [response, ...prev]);
      setActiveConversation(response);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new conversation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !activeConversation) return;
    
    try {
      setIsLoading(true);
      const response = await apiRequest<Message>('POST', `/api/agent/conversations/${activeConversation.id}/messages`, {
        content: message,
      });
      
      // Update the active conversation with the new message
      const updatedMessages = [...(activeConversation.messages || []), response];
      setActiveConversation({
        ...activeConversation,
        messages: updatedMessages,
      });
      
      // Clear the input
      setMessage('');
      
      // Fetch the AI response after a short delay
      setTimeout(async () => {
        await fetchConversation(activeConversation.id);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const renderMessage = (msg: Message) => {
    return (
      <div 
        key={msg.id} 
        className={`mb-4 ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'} max-w-[80%]`}
      >
        <div className="flex flex-col">
          <Badge variant={msg.role === 'user' ? 'outline' : 'default'} className="mb-1 w-fit">
            {msg.role === 'user' ? 'You' : 'Agent'}
          </Badge>
          
          <div 
            className={`rounded-lg p-3 ${
              msg.role === 'user' 
                ? 'bg-primary/10 text-primary-foreground' 
                : 'bg-muted'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            
            {msg.functionCall && (
              <div className="mt-2 border-t pt-2">
                <p className="text-sm font-medium">Function Call: {msg.functionCall.name}</p>
                <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-800">
                  {JSON.stringify(msg.functionCall.arguments, null, 2)}
                </pre>
              </div>
            )}
            
            {msg.functionResponse && (
              <div className="mt-2 border-t pt-2">
                <p className="text-sm font-medium">Function Response:</p>
                <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-800">
                  {JSON.stringify(msg.functionResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
          
          <span className="mt-1 text-xs text-muted-foreground">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <div className="flex items-center justify-between border-b p-4">
          <h1 className="text-xl font-bold">AI Assistant</h1>
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="chat" className="flex h-full flex-1 overflow-hidden p-0">
          <div className="flex w-full flex-col md:flex-row">
            {/* Sidebar with conversation list */}
            <div className="border-r md:w-1/4">
              <div className="flex flex-col p-4">
                <Button 
                  onClick={createNewConversation} 
                  className="mb-4"
                  disabled={isLoading}
                >
                  New Conversation
                </Button>
                
                <ScrollArea className="h-[calc(100vh-200px)]">
                  {conversations.map((conv) => (
                    <Card 
                      key={conv.id} 
                      className={`mb-2 cursor-pointer ${
                        activeConversation?.id === conv.id ? 'border-primary' : ''
                      }`}
                      onClick={() => fetchConversation(conv.id)}
                    >
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm">{conv.title}</CardTitle>
                      </CardHeader>
                    </Card>
                  ))}
                </ScrollArea>
              </div>
            </div>
            
            {/* Main chat area */}
            <div className="flex flex-1 flex-col">
              {activeConversation ? (
                <>
                  {/* Messages display */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="flex flex-col space-y-4">
                      {activeConversation.messages?.map(renderMessage)}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  {/* Message input */}
                  <div className="border-t p-4">
                    <div className="flex items-center space-x-2">
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <Button 
                        size="icon" 
                        onClick={sendMessage}
                        disabled={isLoading || !message.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p>Select or create a conversation to get started</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="tasks" className="flex h-full flex-1 overflow-hidden p-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Agent Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This is where scheduled and ongoing agent tasks will be displayed.</p>
              <p className="text-muted-foreground">
                Task management functionality is coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="flex h-full flex-1 overflow-hidden p-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Agent Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Configure agent behavior, model settings, and access controls.</p>
              <p className="text-muted-foreground">
                Settings management is coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}