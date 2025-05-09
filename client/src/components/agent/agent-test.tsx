import { useState, useEffect } from "react";
import { useAgentWebSocket } from "@/hooks/use-agent-websocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RocketIcon, AlertTriangleIcon, CheckCircleIcon, InfoIcon, LoaderIcon } from "lucide-react";

/**
 * A simple test component to verify WebSocket connection and message broadcasting
 */
export function AgentTestPanel() {
  const [messages, setMessages] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Use our WebSocket hook with handlers for different message types
  const { isConnected, connectionError, sendMessage, reconnect } = useAgentWebSocket({
    onMessage: (message) => {
      console.log("Received agent message:", message);
      setMessages((prev) => [...prev, message]);
    },
    onNotification: (notification) => {
      console.log("Received agent notification:", notification);
      setNotifications((prev) => [...prev, notification]);
    },
    onError: (error) => {
      console.error("WebSocket error:", error);
    },
  });

  // Send a test notification
  const handleTestNotification = () => {
    // Send a WebSocket message requesting a test notification
    // This will be processed by the server and broadcast back to all clients
    fetch("/api/agent/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: "system",
        message: "This is a test notification",
        type: "info",
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Notification sent:", data);
      })
      .catch((error) => {
        console.error("Error sending notification:", error);
      });
  };

  // Clear message and notification lists
  const handleClear = () => {
    setMessages([]);
    setNotifications([]);
  };

  // Helper function to get the icon for different notification types
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertTriangleIcon className="h-5 w-5 text-red-500" />;
      case "info":
        return <InfoIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <InfoIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RocketIcon className="h-5 w-5" />
          WebSocket Test Panel
        </CardTitle>
        <CardDescription>
          Test WebSocket connectivity and message broadcasting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection status */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span>
              {isConnected ? "Connected" : "Disconnected"}
              {connectionError && ` - ${connectionError}`}
            </span>
          </div>
        </div>

        {/* Notifications section */}
        <div>
          <h3 className="mb-2 font-medium">Recent Notifications</h3>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications received</p>
            ) : (
              notifications.map((notification, index) => (
                <Alert key={index} variant="default" className="py-2">
                  <div className="flex items-start gap-2">
                    {getNotificationIcon(notification.type)}
                    <div>
                      <AlertTitle className="text-sm font-medium">
                        {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
                      </AlertTitle>
                      <AlertDescription className="text-sm">{notification.message}</AlertDescription>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(notification.timestamp || notification.sentAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </Alert>
              ))
            )}
          </div>
        </div>

        {/* Messages section */}
        <div>
          <h3 className="mb-2 font-medium">Recent Messages</h3>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages received</p>
            ) : (
              messages.map((message, index) => (
                <div key={index} className="rounded-md border p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{message.role}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{message.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 bg-muted/50 px-6 py-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleTestNotification} variant="default" size="sm">
            Send API Notification
          </Button>
          <Button 
            onClick={() => sendMessage({
              type: 'subscribe',
              data: { channel: 'agent-message' }
            })} 
            variant="default"
            size="sm"
          >
            Subscribe
          </Button>
          <Button 
            onClick={() => sendMessage({
              type: 'message',
              channel: 'agent-message',
              data: { 
                content: 'Test direct message',
                role: 'user',
                timestamp: new Date().toISOString()
              }
            })} 
            variant="secondary"
            size="sm"
          >
            Test Message
          </Button>
          <Button 
            onClick={() => sendMessage({
              type: 'message',
              channel: 'agent-notification',
              data: { 
                type: 'info',
                message: 'Test direct notification',
                sentAt: new Date().toISOString()
              }
            })} 
            variant="secondary"
            size="sm"
          >
            Test Notification
          </Button>
          <Button onClick={reconnect} variant="outline" size="sm">
            Reconnect
          </Button>
          <Button onClick={handleClear} variant="ghost" size="sm">
            Clear
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground">
          <p>Note: Use these buttons to test WebSocket connectivity and message broadcasting. "Subscribe" must be clicked first before messages will be received.</p>
        </div>
      </CardFooter>
    </Card>
  );
}