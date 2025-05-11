import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { LoaderIcon, DatabaseIcon, FileTextIcon } from "lucide-react";

// Message type definition
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function LangChainChat() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch conversation history
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['/api/langchain/history'],
    queryFn: async () => {
      const response = await apiRequest('/api/langchain/history', {
        method: 'GET',
      });
      return response.history || [];
    },
  });
  
  // State for conversation messages
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Update messages when history data changes
  useEffect(() => {
    if (historyData) {
      setMessages(historyData);
    }
  }, [historyData]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      return apiRequest('/api/langchain/message', {
        method: 'POST',
        data: { message: messageText },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/history'] });
    },
    onError: (error) => {
      toast({
        title: "Error sending message",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Clear history mutation
  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/langchain/history', {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/history'] });
      setMessages([]);
      toast({
        title: "Conversation cleared",
        description: "The conversation history has been cleared",
      });
    },
    onError: (error) => {
      toast({
        title: "Error clearing conversation",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    // Add user message to the UI immediately
    const userMessage: Message = { role: 'user', content: message };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    
    // Clear input
    setMessage('');
    setIsLoading(true);
    
    try {
      // Send message to API
      const response = await sendMessageMutation.mutateAsync(userMessage.content);
      
      // Add assistant response when it comes back
      if (response && response.response) {
        const assistantMessage: Message = { role: 'assistant', content: response.response };
        setMessages(prevMessages => [...prevMessages, assistantMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle clearing history
  const handleClearHistory = () => {
    clearHistoryMutation.mutate();
  };
  
  // Render message bubbles
  const renderMessages = () => {
    return messages.map((msg, index) => (
      <div
        key={index}
        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`max-w-3/4 rounded-lg px-4 py-2 ${
            msg.role === 'user'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          }`}
        >
          <div className="whitespace-pre-wrap">{msg.content}</div>
        </div>
      </div>
    ));
  };
  
  return (
    <Card className="w-full h-[80vh] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center">
          <DatabaseIcon className="w-5 h-5 mr-2" />
          LangChain AI Assistant
        </CardTitle>
        <CardDescription>
          Interact with the AI assistant using LangChain. It can query the database and generate reports.
        </CardDescription>
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearHistory}
            disabled={messages.length === 0 || clearHistoryMutation.isPending}
          >
            {clearHistoryMutation.isPending ? (
              <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileTextIcon className="h-4 w-4 mr-2" />
            )}
            Clear Conversation
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {isHistoryLoading ? (
            <div className="flex justify-center items-center h-full">
              <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-full text-center text-muted-foreground">
              <DatabaseIcon className="h-12 w-12 mb-4" />
              <p className="max-w-xs">
                This AI Assistant can query the database and create reports. Try asking a question about the data!
              </p>
              <p className="mt-4 text-sm">
                Example: "Show me the latest power data" or "Generate a report on environmental data from the last week"
              </p>
            </div>
          ) : (
            <div className="py-4">
              {renderMessages()}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      <Separator />
      
      <CardFooter className="pt-4">
        <form onSubmit={handleSubmit} className="flex w-full space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-grow"
          />
          <Button type="submit" disabled={isLoading || !message.trim()}>
            {isLoading ? <LoaderIcon className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}