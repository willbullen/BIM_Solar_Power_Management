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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  ArrowRight
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
}

export function TelegramChat() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [testMessage, setTestMessage] = useState("");
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<TelegramVerificationResponse | null>(null);

  // Fetch Telegram status and connection info
  const { data: telegramUser, isLoading: loadingUser, refetch: refetchUser } = useQuery<TelegramUser | null>({
    queryKey: ['/api/telegram/user'],
    retry: false,
    onError: (error) => {
      console.error('Error fetching Telegram user:', error);
    }
  });

  // Fetch Telegram messages
  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = useQuery<TelegramMessage[]>({
    queryKey: ['/api/telegram/messages'],
    retry: false,
    enabled: !!telegramUser?.isVerified,
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

  // Send test message
  const sendTestMessage = useMutation({
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
        refetchMessages();
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

  // Function to handle verification button click
  const handleVerify = () => {
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
      {/* Connection Status */}
      {!isTelegramConnected && (
        <div className="pb-4">
          <Alert className="bg-blue-900/30 border-blue-800 text-blue-100">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertTitle className="text-blue-100">Telegram Not Connected</AlertTitle>
            <AlertDescription className="text-blue-200">
              Connect your Telegram account to chat with the AI Agent via Telegram.
              <Button 
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleVerify}
                disabled={generateVerification.isPending}
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
            </AlertDescription>
          </Alert>
        </div>
      )}

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
            {isTelegramConnected && (
              <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-800 px-2 py-0 text-xs">
                <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-0 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-22rem)] p-4">
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
                {messages.map((message) => (
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