import { useState, useEffect } from 'react';
import { useAgentWebSocket } from '@/hooks/use-agent-websocket';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { 
  Bell, 
  MessageSquare, 
  AlertTriangle, 
  Info, 
  CheckCircle
} from 'lucide-react';

interface Notification {
  id: number;
  message: string;
  type: string;
  sentAt: string;
  recipientNumber: string;
}

interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  timestamp: string;
}

export function AgentNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Use WebSocket hook to receive real-time notifications and messages
  const { isConnected, connectionError, reconnectAttempt } = useAgentWebSocket({
    onNotification: (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 10)); // Keep latest 10
    },
    onMessage: (message) => {
      // Only show assistant and function messages from the agent
      if (message.role === 'assistant' || message.role === 'function') {
        setMessages(prev => [message, ...prev].slice(0, 10)); // Keep latest 10
      }
    }
  });
  
  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };
  
  // Format the sent time to a readable format
  const formatSentTime = (sentAt: string) => {
    try {
      return formatDistanceToNow(new Date(sentAt), { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };
  
  return (
    <Card className="w-full shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            AI Agent Activity
          </CardTitle>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        <CardDescription>
          {isConnected 
            ? "Real-time updates from the AI agent" 
            : connectionError 
              ? `Connection error (Attempts: ${reconnectAttempt})`
              : "Connecting to AI agent..."}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Notifications */}
        {notifications.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Recent Notifications
            </h3>
            <ul className="space-y-2 max-h-40 overflow-auto text-sm">
              {notifications.map(notification => (
                <li key={notification.id} className="flex items-start gap-2 p-2 border rounded-md bg-muted/50">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1">
                    <p>{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatSentTime(notification.sentAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Messages */}
        {messages.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Recent Agent Messages
            </h3>
            <ul className="space-y-2 max-h-40 overflow-auto text-sm">
              {messages.map(message => (
                <li key={message.id} className="flex items-start gap-2 p-2 border rounded-md bg-muted/50">
                  {message.role === 'assistant' 
                    ? <MessageSquare className="h-4 w-4 text-blue-500" /> 
                    : <Info className="h-4 w-4 text-green-500" />}
                  <div className="flex-1">
                    <p className="text-xs font-medium mb-1">
                      {message.role === 'assistant' ? 'AI Agent' : 'Function Result'}
                    </p>
                    <p>{message.content.length > 100 
                      ? `${message.content.substring(0, 100)}...` 
                      : message.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatSentTime(message.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Empty state */}
        {notifications.length === 0 && messages.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p>No recent notifications from AI agent</p>
            <p className="text-xs">Notifications will appear here in real-time</p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-0 text-xs text-muted-foreground">
        Notifications and messages are displayed in real-time as they're received
      </CardFooter>
    </Card>
  );
}