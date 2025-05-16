import { useState, useEffect, useRef } from "react";
import { 
  useQuery, 
  useMutation, 
  UseQueryOptions, 
  UseQueryResult, 
  QueryKey 
} from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToastAction } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Loader2,
  MessageSquare,
  Bot,
  Send,
  AlertCircle,
  CheckCircle,
  Clock,
  QrCode,
  Copy,
  ArrowRight,
  Zap,
  BrainCircuit,
  RefreshCw
} from "lucide-react";

// Message types
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
  botUsername?: string;
}

// Langchain Agent interface
interface LangchainAgent {
  id: number;
  name: string;
  description: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enabled: boolean;
  tools?: any[];
}

export function TelegramChat() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [testMessage, setTestMessage] = useState("");
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<TelegramVerificationResponse | null>(null);
  const [mainAssistantAgent, setMainAssistantAgent] = useState<LangchainAgent | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [availableAgents, setAvailableAgents] = useState<LangchainAgent[]>([]);

  // Fetch Langchain agents to get the Main Assistant Agent and other available agents
  const { data: langchainAgents, isLoading: loadingAgents } = useQuery<LangchainAgent[]>({
    queryKey: ['/api/langchain/agents'] as const,
    retry: 3,
    staleTime: 30000
  });

  // Effect to handle agent data changes
  useEffect(() => {
    if (langchainAgents) {
      console.log("===== AGENTS DEBUG =====");
      console.log("Raw agents data:", langchainAgents);
      console.log("Total agents received:", langchainAgents?.length || 0);
      
      if (langchainAgents && Array.isArray(langchainAgents) && langchainAgents.length > 0) {
        // Log each agent for debugging
        langchainAgents.forEach((agent, idx) => {
          console.log(`Agent ${idx+1}: id=${agent.id}, name=${agent.name}, enabled=${agent.enabled}`);
        });
        
        // Store all available agents for the dropdown
        const filtered = langchainAgents.filter(agent => agent.enabled);
        console.log("Filtered agents count:", filtered.length);
        setAvailableAgents(filtered);
        
        // Find the Main Assistant Agent
        const mainAgent = langchainAgents.find(agent => agent.name === 'Main Assistant Agent' && agent.enabled);
        if (mainAgent) {
          setMainAssistantAgent(mainAgent);
          // Set the Main Assistant Agent as the default selected agent
          setSelectedAgentId(mainAgent.id);
          console.log('Found Main Assistant Agent:', mainAgent.id);
        } else if (filtered.length > 0) {
          // If no Main Assistant Agent is found, select the first available agent
          setSelectedAgentId(filtered[0].id);
          console.log('Using first available agent:', filtered[0].id);
        }
      } else {
        console.log("No agents received or invalid data format");
      }
      console.log("===== END AGENTS DEBUG =====");
    }
  }, [langchainAgents]);

  // Fetch Telegram status and connection info
  const { data: telegramUser, isLoading: loadingUser, refetch: refetchUser } = useQuery<TelegramUser | null>({
    queryKey: ['/api/telegram/user'],
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: true,
    staleTime: 30000,
    onError: (error) => {
      console.error('Error fetching Telegram user:', error);
      // Don't show error toast for authentication issues
      if (!error.message?.includes('401') && !error.message?.includes('authentication')) {
        toast({
          title: "Error",
          description: "Failed to fetch Telegram connection status",
          variant: "destructive"
        });
      }
    }
  });

  // Fetch Telegram bot settings to get the bot username
  const { data: botSettings } = useQuery<{botUsername: string, isEnabled: boolean}>({
    queryKey: ['/api/telegram/bot-info'],
    retry: 3,
    retryDelay: 1000,
    staleTime: 60000,
    onError: (error) => {
      console.error('Error fetching Telegram bot info:', error);
    }
  });
  
  // Fetch Telegram messages
  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = useQuery<TelegramMessage[]>({
    queryKey: ['/api/telegram/messages'],
    retry: 3,
    enabled: !!telegramUser && telegramUser.isVerified === true,
    refetchInterval: 10000, // Poll for new messages every 10 seconds
    onSuccess: (data, prevData) => {
      // Check if we received new messages
      if (prevData && data && data.length > prevData.length) {
        // New messages arrived
        const newMessages = data.length - prevData.length;
        
        // Notify user about new messages
        toast({
          title: "New Telegram Message",
          description: `You have ${newMessages} new message${newMessages > 1 ? 's' : ''} from Telegram`,
          action: (
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-blue-900/30 text-blue-200 border-blue-800 hover:bg-blue-800"
              onClick={() => {
                // Find and click the Telegram tab - we'll use a custom event to trigger this
                document.dispatchEvent(new CustomEvent('switchToTelegramTab'));
              }}
            >
              View
            </Button>
          )
        });
      }
      
      // Scroll to bottom after messages load
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    },
    onError: (error) => {
      console.error('Error fetching Telegram messages:', error);
    }
  });

  // Generate verification code for Telegram
  const generateVerification = useMutation({
    mutationFn: () => {
      console.log("Making verification code request");
      return apiRequest('/api/telegram/verify', {
        method: 'POST'
      });
    },
    onSuccess: (data: TelegramVerificationResponse) => {
      console.log("Successfully generated verification code", data);
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

  // Send test message using selected Langchain Agent
  const sendTestMessage = useMutation({
    mutationFn: async (message: string) => {
      // Verify that the user is properly authenticated and verified
      if (!telegramUser) {
        console.error("Cannot send message - no Telegram user data available");
        throw new Error("Your Telegram connection status could not be verified. Please refresh the page and try again.");
      }
      
      if (!telegramUser.isVerified) {
        console.error("Cannot send message - Telegram account not verified");
        throw new Error("Your Telegram account is not verified. Please click 'Verify Telegram' to connect your account.");
      }
      
      // Always use useAgent:true to ensure proper agent selection
      // Selected agent or Main Assistant or Default
      console.log(`Current agent selection: ${selectedAgentId || 'default'}`);
      
      // Find the name of the selected agent for better logging
      const selectedAgent = selectedAgentId ? 
        availableAgents.find(a => a.id === selectedAgentId) : 
        mainAssistantAgent;
        
      if (selectedAgentId) {
        console.log(`Using specific Langchain Agent for message: ${selectedAgent?.name} (ID: ${selectedAgentId})`);
        
        return apiRequest('/api/telegram/test-message', {
          method: 'POST',
          data: { 
            message,
            agentId: selectedAgentId,
            useAgent: true,
            forceRefresh: true // Add flag to ensure fresh data
          }
        });
      } else if (mainAssistantAgent) {
        // If no specific agent selected but Main Assistant is available, use it
        console.log(`Using Main Assistant Agent for message: ${mainAssistantAgent.name} (ID: ${mainAssistantAgent.id})`);
        
        return apiRequest('/api/telegram/test-message', {
          method: 'POST',
          data: { 
            message,
            agentId: mainAssistantAgent.id,
            useAgent: true
          }
        });
      } else {
        // Let the server find the Main Assistant Agent
        console.log('Using server default agent selection (Main Assistant preferred)');
        return apiRequest('/api/telegram/test-message', {
          method: 'POST',
          data: { 
            message,
            useAgent: true // Always use agent processing
          }
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Test message was sent successfully to your Telegram account."
      });
      setTestMessage("");
      // Refetch messages after sending
      setTimeout(() => {
        refetchMessages();
      }, 1000);
    },
    onError: (error: any) => {
      console.error("Send test message error:", error);
      
      // Check for verification-related errors
      if (error.message?.includes("not verified") || error.message?.includes("verify")) {
        toast({
          variant: "destructive",
          title: "Verification Required",
          description: "Please verify your Telegram account before sending messages",
          action: (
            <ToastAction altText="Verify" onClick={() => setShowVerificationDialog(true)}>
              Verify Now
            </ToastAction>
          )
        });
        
        // Automatically open verification dialog for user convenience
        setShowVerificationDialog(true);
        return;
      }
      
      // Check for connectivity issues
      if (error.message?.includes("connection") || error.message?.includes("bot")) {
        toast({
          variant: "destructive",
          title: "Telegram Connection Error",
          description: "There was a problem connecting to Telegram. Please try refreshing your connection.",
          action: (
            <ToastAction altText="Refresh" onClick={refetchUser}>
              Refresh
            </ToastAction>
          )
        });
        return;
      }
      
      // Default error case
      toast({
        variant: "destructive",
        title: "Message Send Failed",
        description: error.message || "Could not send message to Telegram"
      });
      
      // Refresh user status to ensure we have the latest verification status
      refetchUser();
    }
  });

  // Copy verification code to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied",
        description: "Verification code copied to clipboard"
      });
    });
  };

  // Handle sending a test message
  const handleSendTestMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim() || !telegramUser?.isVerified) return;
    
    sendTestMessage.mutate(testMessage);
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
  
  // Function to reload the agents if needed
  const reloadAgents = () => {
    console.log("Manually reloading Langchain agents");
    queryClient.invalidateQueries({ queryKey: ['/api/langchain/agents'] });
    toast({
      title: "Reloading agents",
      description: "Refreshing the list of available AI agents..."
    });
  };

  // Function to handle verification button click
  const handleVerify = () => {
    console.log("Starting Telegram verification process");
    generateVerification.mutate();
  };

  // Handle enter key for message sending
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendTestMessage(e as any);
    }
  };

  // Format the message timestamp
  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Check if the user has a verified Telegram account
  const isTelegramConnected = !!telegramUser?.isVerified;

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status with Refresh Button */}
      <div className="pb-4">
        <Alert className={isTelegramConnected ? 
          "bg-green-900/30 border-green-800 text-green-100" : 
          "bg-blue-900/30 border-blue-800 text-blue-100"}>
          {isTelegramConnected ? (
            <CheckCircle className="h-4 w-4 text-green-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-blue-400" />
          )}
          <AlertTitle className={isTelegramConnected ? "text-green-100" : "text-blue-100"}>
            {isTelegramConnected ? "Telegram Connected" : "Telegram Not Connected"}
          </AlertTitle>
          <AlertDescription className={isTelegramConnected ? "text-green-200" : "text-blue-200"}>
            {botSettings?.isEnabled === false ? (
              <>
                Telegram integration is currently disabled. Please contact an administrator to enable it.
              </>
            ) : isTelegramConnected ? (
              <div className="flex flex-col space-y-2">
                <div>
                  Connected as <strong>{telegramUser?.telegramUsername || telegramUser?.telegramFirstName || 'User'}</strong>.
                  {telegramUser?.lastAccessed && (
                    <span className="ml-2 text-xs opacity-80">
                      Last activity: {new Date(telegramUser.lastAccessed).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-green-900/30 text-green-200 border-green-800 hover:bg-green-800"
                    onClick={() => {
                      refetchUser();
                      refetchMessages();
                      toast({
                        title: "Refreshed Connection",
                        description: "Telegram connection status updated"
                      });
                    }}
                  >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Refresh Status
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-green-900/30 text-green-200 border-green-800 hover:bg-green-800"
                    onClick={() => {
                      // Let the user send a test message to check if it works
                      if (testMessage.trim().length === 0) {
                        setTestMessage("Hello from dashboard!");
                      }
                    }}
                  >
                    <Send className="mr-2 h-3 w-3" />
                    Quick Test
                  </Button>
                </div>
              </div>
            ) : (
              <>
                Connect your Telegram account to chat with the AI Agent via Telegram.
                <div className="flex items-center space-x-2 mt-2">
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleVerify}
                    disabled={generateVerification.isPending || botSettings?.isEnabled === false}
                  >
                    {generateVerification.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Connect Telegram
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="bg-blue-900/30 text-blue-200 border-blue-800 hover:bg-blue-800"
                    onClick={() => {
                      // Refresh connection status
                      refetchUser();
                      toast({
                        title: "Refreshed Connection",
                        description: "Checking Telegram connection status..."
                      });
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check Status
                  </Button>
                </div>
              </>
            )}
          </AlertDescription>
        </Alert>
      </div>

      {/* Message History */}
      <Card className="flex-grow overflow-hidden bg-slate-900 border-slate-800 shadow-md">
        <CardHeader className="pb-2 border-b border-slate-800">
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
                    ? `Connected as ${telegramUser.telegramUsername || 'User'}`
                    : 'Not connected'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedAgentId && isTelegramConnected && (
                <Badge variant="outline" className="bg-blue-900/30 text-blue-300 border-blue-800 px-2 py-0 text-xs">
                  <BrainCircuit className="h-3 w-3 mr-1 text-blue-500" />
                  Langchain
                </Badge>
              )}
              {isTelegramConnected && (
                <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-800 px-2 py-0 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                  Connected
                </Badge>
              )}
            </div>
          </div>
          
          {/* Agent Selector - Compact and integrated */}
          {isTelegramConnected && (
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center flex-grow">
                <Label htmlFor="agent-selector" className="text-xs text-gray-300 mr-2 shrink-0 font-medium">
                  AI Agent:
                </Label>
                <Select 
                  value={selectedAgentId?.toString() || ""} 
                  onValueChange={(value) => setSelectedAgentId(parseInt(value))}
                >
                  <SelectTrigger id="agent-selector" className="h-7 text-xs bg-slate-800 border-slate-700 focus:ring-blue-600">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    {availableAgents && availableAgents.length > 0 ? (
                      availableAgents.map(agent => (
                        <SelectItem 
                          key={agent.id} 
                          value={agent.id.toString()}
                          className="text-xs focus:bg-slate-700 focus:text-white"
                        >
                          <div className="flex items-center">
                            <span>{agent.name}</span>
                            {agent.name === 'Main Assistant Agent' && (
                              <Badge variant="outline" className="ml-2 h-4 px-1 py-0 text-[10px] bg-blue-900/30 text-blue-300 border-blue-800">
                                Default
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No agents available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center ml-2">
                {loadingAgents ? (
                  <div className="flex items-center text-xs text-blue-400">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    <span>Loading agents...</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">
                    {availableAgents.length > 0 
                      ? `${availableAgents.length} agent${availableAgents.length > 1 ? 's' : ''} available` 
                      : 'No agents available'}
                  </div>
                )}
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 py-0 text-[10px] text-blue-400 hover:text-blue-300"
                  onClick={reloadAgents}
                >
                  <Loader2 className="h-2.5 w-2.5 mr-1" />
                  Reload
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="p-0 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-26rem)] p-4">
            {loadingMessages ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              </div>
            ) : !isTelegramConnected ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 text-slate-400">
                <MessageSquare className="h-12 w-12 text-slate-500/50" />
                <p className="text-sm">Connect your Telegram account to see messages</p>
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="space-y-4">
                {/* Reverse the array to display oldest first */}
                {[...messages].reverse().map((message) => (
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
                      <div className="text-sm">{message.messageText}</div>
                      <div className="text-xs mt-1 flex items-center justify-end opacity-70">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatMessageTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 text-slate-400">
                <MessageSquare className="h-12 w-12 text-slate-500/50" />
                <p className="text-sm">No messages yet. Send a test message below or message the bot on Telegram.</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
        
        <CardFooter className="border-t border-slate-800 p-4">
          {isTelegramConnected ? (
            <form onSubmit={handleSendTestMessage} className="w-full flex space-x-2">
              <Input
                className="flex-grow bg-slate-800 border-slate-700 text-white"
                placeholder="Send a test message via Telegram..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sendTestMessage.isPending}
              />
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!testMessage.trim() || sendTestMessage.isPending}
              >
                {sendTestMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          ) : (
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleVerify}
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
      </Card>

      {/* Verification Dialog */}
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
                  <ArrowRight className="h-4 w-4 mr-2 text-blue-400" />
                  Steps to Connect:
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                  <li>Open Telegram on your phone or desktop</li>
                  <li>Search for the bot: <span className="font-mono bg-slate-700 px-1 rounded">@{verificationDetails.botUsername || botSettings?.botUsername || 'envirobot'}</span></li>
                  <li>Start a chat with the bot by clicking "Start" or sending "/start"</li>
                  <li>Copy and send the verification command above</li>
                  <li>Once verified, you'll see a confirmation message</li>
                </ol>
                <p className="text-sm text-slate-400 italic mt-2">
                  This verification code will expire in 15 minutes for security.
                </p>
                {/* Connection refresh controls */}
                <div className="pt-2 mt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Having trouble connecting?</span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 bg-slate-800 hover:bg-slate-700"
                        onClick={() => {
                          // Check connection status without generating a new code
                          refetchUser();
                          toast({
                            title: "Checking connection",
                            description: "Verifying your Telegram account status..."
                          });
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Check Status
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 bg-slate-800 hover:bg-slate-700"
                        onClick={() => {
                          // Generate a new verification code
                          generateVerification.mutate();
                          toast({
                            title: "Generating New Code",
                            description: "Creating a fresh verification code..."
                          });
                        }}
                      >
                        <QrCode className="h-3 w-3 mr-1" />
                        New Code
                      </Button>
                    </div>
                  </div>
                </div>
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
                  refetchUser();
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